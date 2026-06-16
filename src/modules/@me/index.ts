import { t } from 'elysia';
import type { app } from '../../app';
import { prisma } from '../../common/prisma';
import { http, httpCodes } from '../../common/request';
import { resolveUserAvatarUrl } from '../../common/user-avatar';
import { ID_SCHEMA } from '../../common/snow';
import { MeService } from './service';

export const route = (elysia: typeof app) => {
	elysia.group('/users', (gp) => {
		gp.get(
			'/@me',
			async (context) => {
				const user = (context as typeof context & { user?: { id: bigint } })
					.user;
				if (!user) throw new Error('Unauthorized');

				context.set.status = httpCodes[http.Success];

				const profile = await MeService.getById(user.id);

				const extended = await prisma.user.findUnique({
					where: { id: user.id },
					select: { plan: true, onboardingCompleted: true },
				});

				return {
					avatar: resolveUserAvatarUrl(user.id, profile.avatar),
					email: profile.email,
					name: profile.name,
					plan: extended?.plan ?? 'FREE',
					onboardingCompleted: extended?.onboardingCompleted ?? false,
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
			async (context) => {
				const user = (context as typeof context & { user?: { id: bigint } })
					.user;
				if (!user) throw new Error('Unauthorized');

				return MeService.getAvatar(user.id);
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

		gp.post(
			'/avatar/upload',
			async (context) => {
				const user = (context as typeof context & { user?: { id: bigint } })
					.user;
				if (!user) throw new Error('Unauthorized');

				const file = context.body.file;
				const buffer = Buffer.from(await file.arrayBuffer());

				context.set.status = httpCodes[http.Success];
				return MeService.uploadAvatar(user.id, buffer);
			},
			{
				body: t.Object({
					file: t.File({ maxSize: '2m' }),
				}),
				type: 'multipart/form-data',
				detail: {
					summary: 'Upload avatar via API',
					description:
						'Uploads avatar through the API (avoids browser CORS to R2).',
					tags: ['Users'],
				},
			},
		);

		gp.delete(
			'/avatar',
			async (context) => {
				const user = (context as typeof context & { user?: { id: bigint } })
					.user;
				if (!user) throw new Error('Unauthorized');

				return MeService.removeAvatar(user.id);
			},
			{
				detail: {
					summary: 'Delete User Avatar',
					description: "Deletes the current user's avatar.",
					tags: ['Users'],
				},
			},
		);
		gp.post(
			'/@me/onboarding',
			async (context) => {
				const user = (context as typeof context & { user?: { id: bigint } })
					.user;
				if (!user) throw new Error('Unauthorized');

				await MeService.completeOnboarding({
					id: user.id,
					...context.body,
				});

				context.set.status = httpCodes[http.Success];
				return { ok: true };
			},
			{
				body: t.Object({
					dateOfBirth: t.String({ format: 'date' }),
					college: t.String({ minLength: 1, maxLength: 200 }),
					referralSource: t.String({ minLength: 1, maxLength: 100 }),
				}),
				detail: {
					summary: 'Complete user onboarding',
					description:
						'Saves date of birth, college, and referral source after sign-up.',
					tags: ['Users'],
				},
			},
		);

		gp.delete(
			'/@me',
			async (context) => {
				const user = (context as typeof context & { user?: { id: bigint } })
					.user;
				if (!user) throw new Error('Unauthorized');

				await MeService.deleteAccount(user.id);

				context.cookie.access?.remove();
				context.cookie.refresh?.remove();
				return { ok: true };
			},
			{
				detail: {
					summary: 'Delete Current User',
					description:
						'Soft-deletes the current user account and clears all sessions.',
					tags: ['Users'],
				},
			},
		);

		gp.put(
			'/@me',
			async (context) => {
				const user = (context as typeof context & { user?: { id: bigint } })
					.user;
				if (!user) throw new Error('Unauthorized');

				await MeService.update({ id: user.id, ...context.body });

				const profile = await MeService.getById(user.id);
				context.set.status = httpCodes[http.Success];

				return {
					ok: true,
					avatar: MeService.avatarPublicUrl(user.id, profile.avatar),
					email: profile.email,
					name: profile.name,
				};
			},
			{
				// TODO: add name validation rules
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

		gp.post(
			'/@me/change-email',
			async (context) => {
				const user = (context as typeof context & { user?: { id: bigint } })
					.user;
				if (!user) throw new Error('Unauthorized');

				await MeService.requestEmailChange(
					user.id,
					context.body.newEmail,
				);

				context.set.status = httpCodes[http.Success];
				return { ok: true, message: 'Verification email sent.' };
			},
			{
				body: t.Object({
					newEmail: t.String({ format: 'email' }),
				}),
				detail: {
					summary: 'Request Email Change',
					description:
						'Sends a verification email to the new address to confirm the email change.',
					tags: ['Users'],
				},
			},
		);

		return gp;
	});
};
