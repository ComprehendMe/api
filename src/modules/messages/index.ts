import type { Elysia } from 'elysia';
import { t } from 'elysia';
import { ID_SCHEMA } from '../../common/snow';
import { MessageService } from './service';

export const route = (app: Elysia) => {
	app.group('/chats/:chatId/messages', (group) =>
		group
			.get(
				'/',
				async (context) => {
					const user = (context as typeof context & { user?: { id: bigint } }).user;
					if (!user) throw new Error('Unauthorized');

					return await MessageService.list(BigInt(context.params.chatId), user.id);
				},
				{
					params: t.Object({ chatId: ID_SCHEMA }),
					detail: {
						tags: ['Messages'],
						summary: 'Get chat history',
					},
				},
			)
			.post(
				'/',
				async (context) => {
					const user = (context as typeof context & { user?: { id: bigint } }).user;
					if (!user) throw new Error('Unauthorized');

					return await MessageService.send(
						BigInt(context.params.chatId),
						user.id,
						context.body.content,
					);
				},
				{
					params: t.Object({ chatId: ID_SCHEMA }),
					body: t.Object({
						content: t.String({ minLength: 1 }),
					}),
					detail: {
						tags: ['Messages'],
						summary: 'Send a message to the AI patient',
					},
				},
			),
	);
};
