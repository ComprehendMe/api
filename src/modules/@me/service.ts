import { Bucket } from 'src/common/bucket';
import { prisma } from 'src/common/prisma';
import { exception, http, httpCodes } from 'src/common/request';

interface UpdateUser {
	id: bigint;
	name?: string;
	email?: string;
}

export class MeService {
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

		return { route };
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

		const { ok } = await Bucket.remove(`avatars/${id}/${user.avatar}.webp`);
		if (!ok) {
			throw exception(
				httpCodes[http.InternalServerError],
				http.InternalServerError,
				{ message: 'Failed to remove avatar from bucket' },
			);
		}

		return { ok };
	}

	public static async update({ email, name, id }: UpdateUser) {
		const userExists = await prisma.user.findUnique({
			where: {
				id,
			},
		});
		if (!userExists)
			throw exception(httpCodes[http.BadRequest], http.BadRequest, {
				message: 'User not exists',
			});

		const hasEmailTaken = await prisma.user.findUnique({
			where: {
				email,
			},
		});
		if (hasEmailTaken)
			throw exception(httpCodes[http.BadRequest], http.BadRequest, {
				message: 'Email already in use',
			});

		await prisma.user.update({
			where: {
				id,
			},
			data: {
				name,
				email,
			},
		});

		return { ok: true };
	}
}
