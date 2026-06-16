import { t } from 'elysia';
import { app } from '../../app';
import { SearchService } from './service';

export const route = (elysia: typeof app) => {
	elysia.get(
		'/search',
		async (context) => {
			const user = (context as typeof context & { user?: { id: bigint } }).user;
			if (!user) throw new Error('Unauthorized');

			return SearchService.search(user.id, context.query.q ?? '');
		},
		{
			query: t.Object({
				q: t.String(),
			}),
			detail: {
				tags: ['Search'],
				summary: 'Global search across patients, chats, and friends',
			},
		},
	);
};
