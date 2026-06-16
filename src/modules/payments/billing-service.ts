import { UserPlan } from '@prisma/client';
import { env } from '../../common/env';
import { prisma } from '../../common/prisma';
import { exception, http, httpCodes } from '../../common/request';
import { stripe, stripeConfigured } from '../../config/payments';

const PREMIUM_AMOUNT_CENTS = 1000;

export class BillingService {
	public static async getBillingSummary(userId: bigint) {
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { plan: true, stripeCustomerId: true },
		});

		if (!user) {
			throw exception(httpCodes[http.NotFound], http.NotFound, 'User not found');
		}

		const invoices: {
			id: string;
			name: string;
			date: string;
			plan: string;
			amount: string;
			status: 'active' | 'archived';
			downloadUrl: string | null;
		}[] = [];

		if (user.stripeCustomerId && stripeConfigured && stripe) {
			try {
				const stripeInvoices = await stripe.invoices.list({
					customer: user.stripeCustomerId,
					limit: 24,
				});

				for (const inv of stripeInvoices.data) {
					const created = inv.created
						? new Date(inv.created * 1000)
						: new Date();
					invoices.push({
						id: inv.id,
						name: inv.number ? `Invoice ${inv.number}` : `Invoice ${inv.id.slice(-8)}`,
						date: created.toLocaleDateString('en-GB', {
							day: 'numeric',
							month: 'short',
							year: 'numeric',
						}),
						plan: user.plan === UserPlan.PREMIUM ? 'premium plan' : 'basic plan',
						amount:
							inv.amount_paid != null
								? `USD $ ${(inv.amount_paid / 100).toFixed(0)}`
								: '—',
						status: inv.status === 'paid' ? 'active' : 'archived',
						downloadUrl: inv.invoice_pdf ?? null,
					});
				}
			} catch {
				// Stripe unavailable — return empty invoices
			}
		}

		return {
			plan: user.plan,
			invoices,
			checkoutAvailable: stripeConfigured,
		};
	}

	public static async createPremiumCheckout(userId: bigint) {
		if (!stripeConfigured || !stripe) {
			throw exception(
				httpCodes[http.BadRequest],
				http.BadRequest,
				'Payments are not configured yet. Please try again later.',
			);
		}

		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { email: true, stripeCustomerId: true, plan: true },
		});

		if (!user) {
			throw exception(httpCodes[http.NotFound], http.NotFound, 'User not found');
		}

		if (user.plan === UserPlan.PREMIUM) {
			throw exception(
				httpCodes[http.BadRequest],
				http.BadRequest,
				'You are already on the Premium plan.',
			);
		}

		let customerId = user.stripeCustomerId;
		if (!customerId) {
			const customer = await stripe.customers.create({
				email: user.email,
				metadata: { userId: userId.toString() },
			});
			customerId = customer.id;
			await prisma.user.update({
				where: { id: userId },
				data: { stripeCustomerId: customerId },
			});
		}

		const appBase = env.APP_URL.replace(/\/$/, '');
		const session = await stripe.checkout.sessions.create({
			customer: customerId,
			mode: 'payment',
			payment_method_types: ['card'],
			line_items: [
				{
					price_data: {
						currency: 'usd',
						unit_amount: PREMIUM_AMOUNT_CENTS,
						product_data: {
							name: 'ComprehendMe Premium Plan',
						},
					},
					quantity: 1,
				},
			],
			success_url: `${appBase}/dashboard/settings/billing?session_id={CHECKOUT_SESSION_ID}`,
			cancel_url: `${appBase}/dashboard/settings/billing`,
			metadata: { userId: userId.toString() },
		});

		if (!session.url) {
			throw exception(
				httpCodes[http.InternalServerError],
				http.InternalServerError,
				'Could not start checkout.',
			);
		}

		return { url: session.url };
	}

	public static async confirmCheckout(userId: bigint, sessionId: string) {
		if (!stripeConfigured || !stripe) {
			throw exception(
				httpCodes[http.BadRequest],
				http.BadRequest,
				'Payments are not configured.',
			);
		}

		const session = await stripe.checkout.sessions.retrieve(sessionId);

		if (session.metadata?.userId !== userId.toString()) {
			throw exception(
				httpCodes[http.Unauthorized],
				http.Unauthorized,
				'Invalid checkout session.',
			);
		}

		if (session.payment_status !== 'paid') {
			return { ok: false, plan: UserPlan.FREE };
		}

		await prisma.user.update({
			where: { id: userId },
			data: { plan: UserPlan.PREMIUM },
		});

		return { ok: true, plan: UserPlan.PREMIUM };
	}
}
