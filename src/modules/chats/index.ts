import type { Elysia } from 'elysia';
import { t } from 'elysia';
import { ChatService } from './service';
import { ID_SCHEMA } from '../../common/snow';

export const route = (app: Elysia) => {
	app.group('/chats', (group) =>
		group
			.get(
				'/',
				//@ts-expect-error
				async ({ user }) => {
					return await ChatService.list(user.id);
				},
				{
					detail: { tags: ['Chats'], summary: 'List user chats' },
				},
			)
			.post(
				'/',
				//@ts-expect-error
				async ({ set, body, user }) => {
					await ChatService.create({
						userId: user.id,
						patientId: body.patientId,
						title: body.title,
					});

					set.status = 201;
					return;
				},
				{
					body: t.Object({
						patientId: ID_SCHEMA,
						title: t.String(),
					}),
					detail: { tags: ['Chats'], summary: 'Create a new chat' },
				},
			)
			.get(
				'/search',
				//@ts-expect-error
				async ({ query, user }) => {
					return await ChatService.findByPatientName(
						user.id,
						query.patientName ?? '',
					);
				},
				{
					query: t.Object({
						patientName: t.Optional(t.String()),
					}),
					detail: { tags: ['Chats'], summary: 'Search chats' },
				},
			)
			.delete(
				'/:id',
				//@ts-expect-error
				async ({ params: { id }, user }) => {
					await ChatService.delete(user.id, id);
					return { success: true };
				},
				{
					params: t.Object({ id: ID_SCHEMA }),
					detail: { tags: ['Chats'], summary: 'Delete a chat' },
				},
			),
	);
};

