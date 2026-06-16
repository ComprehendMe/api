import { randomBytes } from 'node:crypto';
import { Bucket } from 'src/common/bucket';
import { dragonfly, FIFTEEN_MINUTES_IN_SECONDS } from 'src/common/dragonfly';
import { env } from 'src/common/env';
import { mail } from 'src/common/mail';
import { prisma } from 'src/common/prisma';
import { exception, http, httpCodes } from 'src/common/request';
import { emailChangeTemplate } from 'src/common/templates/mail';

interface UpdateUser {
	id: bigint;
	name?: string;
	email?: string;
}

interface CompleteOnboarding {
	id: bigint;
	dateOfBirth: string;
	college: string;
	referralSource: string;
}

export class MeService {
	public static avatarPublicUrl(userId: bigint, avatarHash: string | null) {
		if (!avatarHash) return null;
		return `${env.BUCKET_PUBLIC_URL}/avatars/${userId}/${avatarHash}.webp`;
	}

	public static async getById(id: bigint) {
		const user = await prisma.user.findFirst({
			where: {
				id,
			},
			select: {
				email: true,
				name: true,
				avatar: true,
				updatedAt: true,
			},
		});

		if (!user) {
			throw exception(httpCodes[http.NotFound], http.NotFound, {
				message: 'User not found',
			});
		}

		return user;
	}

	public static async getAvatar(id: bigint) {
		const { hash, route } = await Bucket.genPresignedUrl(`avatars/${id}`);

		await prisma.user.update({
			data: {
				avatar: hash,
			},
			where: {
				id,
			},
		});

		return { route, hash };
	}

	public static async uploadAvatar(id: bigint, body: Buffer) {
		if (body.length === 0 || body.length > 2 * 1024 * 1024) {
			throw exception(httpCodes[http.BadRequest], http.BadRequest, {
				message: 'Invalid avatar size',
			});
		}

		const user = await prisma.user.findUnique({
			where: { id },
			select: { avatar: true },
		});

		if (!user) {
			throw exception(httpCodes[http.NotFound], http.NotFound, {
				message: 'User not found',
			});
		}

		if (user.avatar) {
			// Best-effort cleanup; a missing or inaccessible old object must not block the new upload.
			await Bucket.remove(`avatars/${id}/${user.avatar}`);
		}

		let hash: string;
		try {
			hash = await Bucket.putWebp(`avatars/${id}`, body);
		} catch {
			throw exception(
				httpCodes[http.InternalServerError],
				http.InternalServerError,
				{ message: 'Failed to upload avatar to storage' },
			);
		}

		await prisma.user.update({
			where: { id },
			data: { avatar: hash },
		});

		return {
			ok: true,
			avatar: MeService.avatarPublicUrl(id, hash),
		};
	}

	public static async removeAvatar(id: bigint) {
		const user = await prisma.user.findFirst({
			select: {
				avatar: true,
			},
			where: {
				id,
			},
		});

		if (!user) {
			throw exception(httpCodes[http.NotFound], http.NotFound, {
				message: 'User not found',
			});
		}

		if (!user.avatar) {
			return { ok: true };
		}

		const { ok } = await Bucket.remove(`avatars/${id}/${user.avatar}`);
		if (!ok) {
			throw exception(
				httpCodes[http.InternalServerError],
				http.InternalServerError,
				{ message: 'Failed to remove avatar from bucket' },
			);
		}

		await prisma.user.update({
			where: { id },
			data: { avatar: null },
		});

		return { ok: true };
	}

	public static async requestEmailChange(userId: bigint, newEmail: string) {
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { email: true },
		});

		if (!user) {
			throw exception(httpCodes[http.NotFound], http.NotFound, {
				message: 'User not found',
			});
		}

		if (newEmail === user.email) {
			throw exception(httpCodes[http.BadRequest], http.BadRequest, {
				message: 'New email is the same as your current email.',
			});
		}

		const emailTaken = await prisma.user.findUnique({
			where: { email: newEmail },
			select: { id: true },
		});

		if (emailTaken) {
			throw exception(httpCodes[http.BadRequest], http.BadRequest, {
				message: 'Email already in use.',
			});
		}

		const pendingKey = `email_change:pending:${userId}`;
		const isPending = await dragonfly.get(pendingKey);
		if (isPending) {
			throw exception(
				httpCodes[http.BadRequest],
				http.BadRequest,
				'A verification email has already been sent. Please check your inbox.',
			);
		}

		const token = randomBytes(32).toString('hex');
		const tokenKey = `email_change:token:${token}`;

		await Promise.all([
			dragonfly.setex(tokenKey, FIFTEEN_MINUTES_IN_SECONDS, {
				userId: userId.toString(),
				oldEmail: user.email,
				newEmail,
			}),
			dragonfly.setex(pendingKey, FIFTEEN_MINUTES_IN_SECONDS, '1'),
		]);

		const confirmLink = new URL(
			`/api/auth/verify-email-change?token=${encodeURIComponent(token)}`,
			env.APP_URL,
		);

		await mail({
			to: newEmail,
			subject: 'Confirm your email change - ComprehendMe',
			html: emailChangeTemplate(confirmLink.href, newEmail),
			text: `Confirm your email change by clicking here: ${confirmLink.href}`,
		});

		return { ok: true };
	}

	public static async update({ email, name, id }: UpdateUser) {
		const userExists = await prisma.user.findUnique({
			where: { id },
		});
		if (!userExists)
			throw exception(httpCodes[http.BadRequest], http.BadRequest, {
				message: 'User not exists',
			});

		if (email && email !== userExists.email) {
			const hasEmailTaken = await prisma.user.findUnique({
				where: { email },
			});
			if (hasEmailTaken && hasEmailTaken.id !== id)
				throw exception(httpCodes[http.BadRequest], http.BadRequest, {
					message: 'Email already in use',
				});
		}

		await prisma.user.update({
			where: { id },
			data: {
				...(name !== undefined ? { name } : {}),
				...(email !== undefined ? { email } : {}),
			},
		});

		return { ok: true };
	}

	public static async deleteAccount(id: bigint) {
		const user = await prisma.user.findUnique({ where: { id } });
		if (!user) {
			throw exception(httpCodes[http.NotFound], http.NotFound, {
				message: 'User not found',
			});
		}

		await prisma.$transaction([
			prisma.session.deleteMany({ where: { userId: id } }),
			prisma.friendship.deleteMany({
				where: { OR: [{ requesterId: id }, { addresseeId: id }] },
			}),
			prisma.user.update({
				where: { id },
				data: { deletedAt: new Date() },
			}),
		]);

		return { ok: true };
	}

	public static async completeOnboarding({
		id,
		dateOfBirth,
		college,
		referralSource,
	}: CompleteOnboarding) {
		const userExists = await prisma.user.findUnique({ where: { id } });
		if (!userExists) {
			throw exception(httpCodes[http.NotFound], http.NotFound, {
				message: 'User not found',
			});
		}

		await prisma.user.update({
			where: { id },
			data: {
				dateOfBirth: new Date(dateOfBirth),
				college,
				referralSource,
				onboardingCompleted: true,
			},
		});

		return { ok: true };
	}
}
