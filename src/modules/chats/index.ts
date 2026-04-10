import type { Elysia } from 'elysia';
import { t } from 'elysia';
import { ID_SCHEMA } from '../../common/snow';
import { ChatService } from './service';

export const route = (app: Elysia) => {
	app.group('/chats', (group) =>
		group
			.get(
				'/',
				async (context) => {
					const user = (context as typeof context & { user?: { id: bigint } }).user;
					if (!user) throw new Error('Unauthorized');
					return await ChatService.list(user.id);
				},
				{
					detail: { tags: ['Chats'], summary: 'List user chats' },
				},
			)
			.post(
				'/',
				async (context) => {
					const user = (context as typeof context & { user?: { id: bigint } }).user;
					if (!user) throw new Error('Unauthorized');
					const chat = await ChatService.create({
						userId: user.id,
						patientId: context.body.patientId,
						title: context.body.title,
					});

					context.set.status = 201;
					return chat;
				},
				{
					body: t.Object({
						patientId: ID_SCHEMA,
						title: t.Optional(t.String({ minLength: 1 })),
					}),
					detail: { tags: ['Chats'], summary: 'Create a new chat' },
				},
			)
			.get(
				'/search',
				async (context) => {
					const user = (context as typeof context & { user?: { id: bigint } }).user;
					if (!user) throw new Error('Unauthorized');
					return await ChatService.findByPatientName(
						user.id,
						context.query.patientName ?? '',
					);
				},
				{
					query: t.Object({
						patientName: t.Optional(t.String()),
					}),
					detail: { tags: ['Chats'], summary: 'Search chats' },
				},
			)
			.get(
				'/:id',
				async (context) => {
					const user = (context as typeof context & { user?: { id: bigint } }).user;
					if (!user) throw new Error('Unauthorized');
					return await ChatService.getById(user.id, context.params.id);
				},
				{
					params: t.Object({ id: ID_SCHEMA }),
					detail: { tags: ['Chats'], summary: 'Get a chat by id' },
				},
			)
			.delete(
				'/:id',
				async (context) => {
					const user = (context as typeof context & { user?: { id: bigint } }).user;
					if (!user) throw new Error('Unauthorized');
					await ChatService.delete(user.id, context.params.id);
					return { success: true };
				},
				{
					params: t.Object({ id: ID_SCHEMA }),
					detail: { tags: ['Chats'], summary: 'Delete a chat' },
				},
			),
	);
};
