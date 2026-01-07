import { t } from 'elysia';
import { app } from '../../app';
import { env } from '../../common/env';
import { http, httpCodes } from '../../common/request';
import { MeService } from './service';

export const route = (elysia: typeof app) => {
	elysia.group('/users', (gp) => {
		gp.get(
			'/@me',
			async ({ user: { id: userId }, set }) => {
				set.status = httpCodes[http.Success];

				const { avatar, email, name } = await MeService.getById(userId);

				return {
					avatar: `${env.BUCKET_PUBLIC_URL}/avatars/${avatar}.webp`,
					email,
					name,
				};
			},
			{
				detail: {
					summary: 'Get Current User',
					description:
						'Retrieves the profile information of the currently authenticated user.',
					tags: ['Users'],
				},
			},
		);

		gp.post(
			'/avatar',
			async ({ user: { id: userId }, set }) => {
				return MeService.getAvatar(userId);
			},
			{
				detail: {
					summary: 'Generate Avatar Upload URL',
					description:
						'Generates a presigned URL for uploading a new user avatar.',
					tags: ['Users'],
				},
			},
		);

		gp.delete(
			'/avatar',
			async ({ user: { id: userId }, set }) => {
				return MeService.removeAvatar(userId);
			},
			{
				detail: {
					summary: 'Delete User Avatar',
					description: "Deletes the current user's avatar.",
					tags: ['Users'],
				},
			},
		);
		gp.put(
			'/@me',
			async ({ body, user: { id: userId }, set }) => {
				return await MeService.update({ id: userId, ...body });
			},
			{
				//NOTE: dps é importante colocar alguma validação nos nomes
				body: t.Object({
					name: t.Optional(t.String()),
					email: t.Optional(t.String({ format: 'email' })),
				}),
				detail: {
					summary: 'Update Current User',
					description:
						'Updates the profile information of the currently authenticated user.',
					tags: ['Users'],
				},
			},
		);

		return gp;
	});
};
