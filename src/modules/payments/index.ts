import { t } from 'elysia';
import { app } from '../../app';
import { env } from '../../common/env';
import { exception, http, httpCodes } from '../../common/request';
import { BillingService } from './billing-service';

export const route = (elysia: typeof app) => {
	elysia.group('/payments', (gp) => {
		gp.get('/billing', async (context) => {
			const user = (context as typeof context & { user?: { id: bigint } }).user;
			if (!user) throw new Error('Unauthorized');

			return BillingService.getBillingSummary(user.id);
		});

		gp.post(
			'/checkout',
			async (context) => {
				const user = (context as typeof context & { user?: { id: bigint } }).user;
				if (!user) throw new Error('Unauthorized');

				return BillingService.createPremiumCheckout(user.id);
			},
			{
				body: t.Optional(t.Object({})),
			},
		);

		gp.post(
			'/confirm',
			async (context) => {
				const user = (context as typeof context & { user?: { id: bigint } }).user;
				if (!user) throw new Error('Unauthorized');

				return BillingService.confirmCheckout(
					user.id,
					context.body.sessionId,
				);
			},
			{
				body: t.Object({
					sessionId: t.String({ minLength: 1 }),
				}),
			},
		);

		return gp;
	});
};
