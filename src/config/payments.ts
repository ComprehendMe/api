import Stripe from 'stripe';
import { env } from '../common/env';

export const stripe = new Stripe(
  env.STRIPE_SECRET_KEY,
  {
    apiVersion: '2025-11-17.clover',
    httpClient: Stripe.createFetchHttpClient(),
    typescript: true,
  }
);

