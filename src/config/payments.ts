import Stripe from 'stripe';
import { env } from '../common/env';

export const stripeConfigured = Boolean(env.STRIPE_SECRET_KEY?.trim());

export const stripe = stripeConfigured
	? new Stripe(env.STRIPE_SECRET_KEY, {
			apiVersion: '2025-11-17.clover',
			httpClient: Stripe.createFetchHttpClient(),
			typescript: true,
		})
	: null;
