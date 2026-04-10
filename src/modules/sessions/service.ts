import { randomBytes } from 'node:crypto';
import { dragonfly, FIVE_MINUTES_IN_SECONDS } from '../../common/dragonfly';
import { env } from '../../common/env';
import { prisma } from '../../common/prisma';
import { exception, http, httpCodes } from '../../common/request';
import { genSnow } from '../../common/snow';
import { Auth, FIFTEEN_DAYS_IN_MS } from '../../config/auth';

export const MAX_SESSIONS_PER_USER = 5;

type MagicLinkIntent = 'signup' | 'login';

type MagicLinkPayload = {
	email: string;
	intent: MagicLinkIntent;
};

type SessionMetadata = {
	ip: string;
	os: string;
	browser: string;
};

export class SessionService {
	public static genMagicToken() {
		return randomBytes(32).toString('hex');
	}

	public static async requestMagicLink({
		email,
		intent,
	}: MagicLinkPayload) {
		const pendingKey = this.getPendingMagicLinkKey(email, intent);
		const isPending = await dragonfly.get(pendingKey);

		if (isPending) {
			throw exception(
				httpCodes[http.BadRequest],
				http.BadRequest,
				'A magic link has already been sent to this email. Please check your inbox.',
			);
		}

		const existingUser = await prisma.user.findUnique({
			where: { email },
			select: { id: true },
		});

		if (intent === 'signup' && existingUser) {
			throw exception(httpCodes[http.BadRequest], http.BadRequest, {
				message: 'Email already taken',
			});
		}

		if (intent === 'login' && !existingUser) {
			throw exception(httpCodes[http.Unauthorized], http.Unauthorized, {
				message: 'User not found',
			});
		}

		const token = this.genMagicToken();
		const tokenKey = this.getMagicLinkTokenKey(token);

		await Promise.all([
			dragonfly.setex(tokenKey, FIVE_MINUTES_IN_SECONDS, { email, intent }),
			dragonfly.setex(pendingKey, FIVE_MINUTES_IN_SECONDS, '1'),
		]);

		return { token };
	}

	public static async verifyMagicLink({
		browser,
		ip,
		os,
		token,
	}: SessionMetadata & { token: string }) {
		const tokenKey = this.getMagicLinkTokenKey(token);
		const payload = await dragonfly.get<MagicLinkPayload>(tokenKey);

		if (!payload) {
			throw exception(
				httpCodes[http.BadRequest],
				http.BadRequest,
				'Invalid or expired magic link',
			);
		}

		await Promise.all([
			dragonfly.del(tokenKey),
			dragonfly.del(this.getPendingMagicLinkKey(payload.email, payload.intent)),
		]);

		let user = await prisma.user.findUnique({
			where: { email: payload.email },
			select: { id: true, email: true },
		});

		if (payload.intent === 'signup') {
			if (user) {
				throw exception(
					httpCodes[http.BadRequest],
					http.BadRequest,
					'Email already taken',
				);
			}

			user = await prisma.user.create({
				data: {
					id: genSnow(),
					email: payload.email,
				},
				select: { id: true, email: true },
			});
		}

		if (!user) {
			throw exception(
				httpCodes[http.Unauthorized],
				http.Unauthorized,
				'User not found',
			);
		}

		const tokens = await this.issueSession(user, {
			browser,
			ip,
			os,
		});

		return {
			...tokens,
			intent: payload.intent,
			user,
		};
	}

	public static async authWithProvider(provider: 'google') {
		const {
			AUTH0_CALLBACK_URL,
			AUTH0_CLIENT_ID,
			AUTH0_DOMAIN,
			AUTH0_AUDIENCE,
		} = env;
		const params = new URLSearchParams();

		params.append('response_type', 'code');
		params.append('client_id', AUTH0_CLIENT_ID);
		params.append('redirect_uri', AUTH0_CALLBACK_URL);
		params.append('scope', 'openid profile email');
		params.append('audience', AUTH0_AUDIENCE);

		if (provider === 'google') params.append('connection', 'google-oauth2');

		return `https://${AUTH0_DOMAIN}/authorize?${params.toString()}`;
	}

	public static async handleAuth0Callback({
		code,
		ip,
		os,
		browser,
	}: SessionMetadata & { code: string }) {
		const {
			AUTH0_DOMAIN,
			AUTH0_CLIENT_ID,
			AUTH0_CLIENT_SECRET,
			AUTH0_CALLBACK_URL,
		} = env;

		const tokenResponse = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				grant_type: 'authorization_code',
				client_id: AUTH0_CLIENT_ID,
				client_secret: AUTH0_CLIENT_SECRET,
				code,
				redirect_uri: AUTH0_CALLBACK_URL,
			}),
		});

		if (!tokenResponse.ok) {
			throw exception(
				httpCodes[http.InternalServerError],
				http.InternalServerError,
				'Failed to exchange authorization code for tokens',
			);
		}

		const { access_token } = (await tokenResponse.json()) as {
			access_token?: string;
		};

		if (!access_token) {
			throw exception(
				httpCodes[http.InternalServerError],
				http.InternalServerError,
				'Missing provider access token',
			);
		}

		const userinfoResponse = await fetch(`https://${AUTH0_DOMAIN}/userinfo`, {
			headers: { Authorization: `Bearer ${access_token}` },
		});

		if (!userinfoResponse.ok) {
			throw exception(
				httpCodes[http.InternalServerError],
				http.InternalServerError,
				'Failed to fetch user info',
			);
		}

		const userinfo = (await userinfoResponse.json()) as {
			email?: string;
			sub?: string;
			given_name?: string;
			family_name?: string;
			avatar?: string;
		};

		if (!userinfo.email || !userinfo.sub) {
			throw exception(
				httpCodes[http.InternalServerError],
				http.InternalServerError,
				'Provider user info is incomplete',
			);
		}

		const user = await prisma.user.upsert({
			where: { email: userinfo.email },
			create: {
				id: genSnow(),
				email: userinfo.email,
				name: [userinfo.given_name, userinfo.family_name]
					.filter(Boolean)
					.join(' '),
				avatar: userinfo.avatar,
				googleId: userinfo.sub,
			},
			update: { googleId: userinfo.sub, avatar: userinfo.avatar },
			select: { id: true, email: true },
		});

		if (!user) {
			throw exception(
				httpCodes[http.InternalDatabaseError],
				http.InternalDatabaseError,
				'Internal Database Error',
			);
		}

		return await this.issueSession(user, {
			browser,
			ip,
			os,
		});
	}

	public static async refresh(token?: string) {
		if (!token) {
			throw exception(
				httpCodes[http.Unauthorized],
				http.Unauthorized,
				'Missing token',
			);
		}

		const hashed = Auth.hashRefreshToken(token);

		const session = await prisma.session.findFirst({
			where: {
				hash: hashed,
			},
		});

		if (!session) {
			throw exception(
				httpCodes[http.Unauthorized],
				http.Unauthorized,
				'Invalid refresh token',
			);
		}

		const user = await prisma.user.findFirst({
			where: {
				id: session.userId,
			},
			select: {
				id: true,
				email: true,
			},
		});

		if (!user) {
			throw exception(
				httpCodes[http.InternalServerError],
				http.InternalServerError,
				'Unknown User',
			);
		}

		const { hash, refresh } = Auth.genRefreshToken();
		const access = Auth.genAccessToken(user);

		await prisma.session.update({
			data: {
				hash,
			},
			where: {
				id: session.id,
			},
		});

		return { refresh, access };
	}

	public static async list(userId: bigint, limit?: number) {
		try {
			return await prisma.session.findMany({
				where: {
					userId,
				},
				take: limit,
				orderBy: {
					expiresAt: 'desc',
				},
			});
		} catch (error: any) {
			console.log(error);
			throw exception(
				httpCodes[http.InternalServerError],
				http.InternalServerError,
				error.message,
			);
		}
	}

	public static async delete(userId: bigint, sessionId?: bigint) {
		let where: any = {
			userId,
			expiresAt: {
				lte: new Date(),
			},
		};
		if (sessionId) {
			where = {
				userId,
				expiresAt: {
					lte: new Date(),
				},
				id: sessionId,
			};
		}

		try {
			await prisma.session.deleteMany({
				where,
			});
			return { ok: true };
		} catch (error) {
			console.log(error);
			return { ok: false };
		}
	}

	public static async logout(token?: string) {
		if (!token) return;

		const hash = Auth.hashRefreshToken(token);

		const session = await prisma.session.findFirst({
			where: {
				hash,
			},
		});

		if (!session) return;

		await prisma.session.delete({
			where: {
				id: session.id,
			},
		});
	}

	private static async issueSession(
		user: { id: bigint; email: string },
		metadata: SessionMetadata,
	) {
		const sessionCount = await prisma.session.count({
			where: { userId: user.id },
		});

		if (sessionCount >= MAX_SESSIONS_PER_USER) {
			const oldestSession = await prisma.session.findFirst({
				where: { userId: user.id },
				orderBy: { expiresAt: 'asc' },
			});

			if (oldestSession) {
				await prisma.session.delete({
					where: { id: oldestSession.id },
				});
			}
		}

		const { refresh, hash } = Auth.genRefreshToken();
		const access = Auth.genAccessToken(user);

		await prisma.session.create({
			data: {
				id: genSnow(),
				os: metadata.os,
				browser: metadata.browser,
				expiresAt: new Date(Date.now() + FIFTEEN_DAYS_IN_MS),
				hash,
				ip: metadata.ip,
				userId: user.id,
			},
		});

		return { access, refresh };
	}

	private static getMagicLinkTokenKey(token: string) {
		return `auth:magic:token:${token}`;
	}

	private static getPendingMagicLinkKey(
		email: string,
		intent: MagicLinkIntent,
	) {
		return `auth:magic:pending:${intent}:${email}`;
	}
}
