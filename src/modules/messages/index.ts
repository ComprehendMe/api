import type { Elysia } from 'elysia';
import { t } from 'elysia';
import { MessageService } from './service';
import { ID_SCHEMA } from '../../common/snow';

export const route = (app: Elysia) => {
	app.group('/chats/:chatId/messages', (group) =>
		group
			.get('/', async ({ params: { chatId } }) => {
				return await MessageService.list(chatId);
			}, {
				params: t.Object({ chatId: ID_SCHEMA }),
				detail: {
					tags: ['Messages'],
					summary: 'Get chat history'
				}
			})
			.post('/', async ({ params: { chatId }, body }) => {
				return await MessageService.send(chatId, body.content);
			}, {
				params: t.Object({ chatId: ID_SCHEMA }),
				body: t.Object({
					content: t.String({ minLength: 1 }),
				}),
				detail: {
					tags: ['Messages'],
					summary: 'Send a message to the AI patient'
				}
			})
	);
};