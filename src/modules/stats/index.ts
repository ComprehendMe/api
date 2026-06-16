import type { Elysia } from 'elysia';
import { http, httpCodes } from '../../common/request';
import { StatsService } from './service';

export const route = (app: Elysia) => {
	app.group('/users', (group) =>
		group
			.get(
				'/@me/stats',
				async (context) => {
					const user = (context as typeof context & { user?: { id: bigint } }).user;
					if (!user) throw new Error('Unauthorized');

					context.set.status = httpCodes[http.Success];
					return StatsService.getDashboardStats(user.id);
				},
				{
					detail: { tags: ['Users'], summary: 'Dashboard stats (streak + weekly minutes)' },
				},
			)
			.post(
				'/@me/activity',
				async (context) => {
					const user = (context as typeof context & { user?: { id: bigint } }).user;
					if (!user) throw new Error('Unauthorized');

					await StatsService.recordPresence(user.id, 1);
					context.set.status = httpCodes[http.Success];
					return { ok: true };
				},
				{
					detail: { tags: ['Users'], summary: 'Record time on site (minutes)' },
				},
			),
	);
};
