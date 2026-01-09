import { randomBytes } from 'node:crypto';
import { dragonfly } from '../../common/dragonfly';
import { env } from '../../common/env';
import { prisma } from '../../common/prisma';
import { exception, http, httpCodes } from '../../common/request';
import { genSnow } from '../../common/snow';
import { Auth, FIFTEEN_DAYS_IN_MS } from '../../config/auth';
import type { SessionModel } from './model';

export const MAX_SESSIONS_PER_USER = 5;

export class SessionService {
	public static genMagicToken() {
		return randomBytes(32).toString('hex');
	}

	//TODO: refatorar tudo isso aqui
	public static async signup({
		browser,
		ip,
		os,
		token,
	}: SessionModel.SignupOptions) {
		const REDIS_KEY = `signup:${token}`;
		const email = await dragonfly.get<string>(REDIS_KEY);

		if (!email) {
			throw exception(
				httpCodes[http.BadRequest],
				http.BadRequest,
				'Invalid or expired magic link',
			);
		}

		await dragonfly.del(REDIS_KEY);

		const existingUser = await prisma.user.findUnique({ where: { email } });

		if (existingUser) {
			throw exception(
				httpCodes[http.BadRequest],
				http.BadRequest,
				'Email already taken',
			);
		}

		const user = await prisma.user.create({
			data: {
				id: genSnow(),
				email,
			},
			select: { id: true, email: true },
		});

		if (!user)
			throw exception(
				httpCodes[http.InternalServerError],
				http.InternalServerError,
				'Error to create user',
			);

		const { refresh, hash } = Auth.genRefreshToken();
		const access = Auth.genAccessToken(user);

		await prisma.session.create({
			data: {
				id: genSnow(),
				os,
				browser,
				expiresAt: new Date(Date.now() + FIFTEEN_DAYS_IN_MS),
				hash,
				ip,
				userId: user.id,
			},
		});

		return { access, refresh };
	}

	public static async login({
		browser,
		email,
		ip,
		os,
	}: SessionModel.LoginOptions) {
		const user = await prisma.user.findFirst({
			where: { email },
			select: {
				id: true,
				email: true,
			},
		});
		if (!user)
			throw exception(
				httpCodes[http.Unauthorized],
				http.Unauthorized,
				'Invalid email or password',
			);

		const sessionCount = await prisma.session.count({
			where: { userId: user.id },
		});

		if (sessionCount >= MAX_SESSIONS_PER_USER) {
			const oldestSession = await prisma.session.findFirst({
				where: { userId: user.id },
				orderBy: { id: 'asc' },
			});
			if (oldestSession) {
				await prisma.session.delete({ where: { id: oldestSession.id } });
			}
		}

		const { refresh, hash } = Auth.genRefreshToken();
		const access = Auth.genAccessToken(user);

		await prisma.session.create({
			data: {
				id: genSnow(),
				os,
				browser,
				expiresAt: new Date(Date.now() + FIFTEEN_DAYS_IN_MS),
				hash,
				ip,
				userId: user.id,
			},
		});

		return { access, refresh };
	}

	public static async authWithProvider(provider: SessionModel.Provider) {
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
	}: {
		code: string;
		ip: string;
		os: string;
		browser: string;
	}) {
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
				code: code,
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

		//@ts-expect-error
		const { access_token } = await tokenResponse.json();

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

		const userinfo = await userinfoResponse.json();
		//@ts-expect-error
		const { email, sub: googleId, given_name, family_name, avatar } = userinfo;

		const user = await prisma.user.upsert({
			where: { email },
			create: {
				id: genSnow(),
				email,
				name: `${given_name} ${family_name}`,
				avatar,
				googleId,
			},
			update: { googleId, avatar },
			select: { id: true, email: true },
		});

		if (!user)
			throw exception(
				httpCodes[http.InternalDatabaseError],
				http.InternalDatabaseError,
				'Internal Database Error',
			);

		const { refresh, hash } = Auth.genRefreshToken();
		const access = Auth.genAccessToken(user);

		await prisma.session.create({
			data: {
				id: genSnow(),
				os,
				browser,
				expiresAt: new Date(Date.now() + FIFTEEN_DAYS_IN_MS),
				hash,
				ip,
				userId: user.id,
			},
		});

		return { access, refresh };
	}

	public static async refresh(token?: string) {
		if (!token)
			throw exception(
				httpCodes[http.Unauthorized],
				http.Unauthorized,
				'Missing token',
			);
		const hashed = Auth.hashRefreshToken(token);

		const session = await prisma.session.findFirst({
			where: {
				hash: hashed,
			},
		});

		if (!session)
			throw exception(
				httpCodes[http.Unauthorized],
				http.Unauthorized,
				'Invalid refresh token',
			);

		const user = await prisma.user.findFirst({
			where: {
				id: session.userId,
			},
			select: {
				id: true,
				email: true,
			},
		});

		if (!user)
			throw exception(
				httpCodes[http.InternalServerError],
				http.InternalServerError,
				'Unknown User',
			);

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
		let where: any = { where: { userId } };

		if (limit)
			where = {
				where: {
					userId,
				},
				take: limit,
			};

		try {
			return await prisma.session.findMany({
				where: {
					userId,
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
		if (sessionId)
			where = {
				userId,
				expiresAt: {
					lte: new Date(),
				},
				id: sessionId,
			};

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

	public static async logout(token: string) {
		const hash = Auth.hashRefreshToken(token);

		const session = await prisma.session.findFirst({
			where: {
				hash,
			},
		});

		if (!session)
			throw exception(
				httpCodes[http.Unauthorized],
				http.Unauthorized,
				'Invalid refresh token',
			);

		await prisma.session.delete({
			where: {
				id: session.id,
			},
		});
	}
}
