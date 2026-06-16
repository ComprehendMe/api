
import { stripe, stripeConfigured } from '../../config/payments';
import Stripe from 'stripe';
import type { PaymentModel } from './model';


export class PaymentService {
  public static async pay(options: PaymentModel.CreatePaymentOptions): Promise<string | null> {
    if (!stripeConfigured || !stripe) return null;

    const { amount, currency, productName, successUrl, cancelUrl, metadata } = options;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: currency,
            product_data: {
              name: productName,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: metadata,
    });

    return session.url;
  }

  public static async cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    if (!stripe) throw new Error('Stripe is not configured');
    const canceledSubscription = await stripe.subscriptions.cancel(subscriptionId);
    return canceledSubscription;
  }

  public static async refund(paymentIntentId: string, amount?: number): Promise<Stripe.Refund> {
    if (!stripe) throw new Error('Stripe is not configured');
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount
    });

    return refund;
  }
}
