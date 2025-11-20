export namespace PaymentModel {
  export interface CreatePaymentOptions {
    amount: number;
    currency: 'usd' | 'brl';
    productName: string;
    successUrl: string;
    cancelUrl: string;
    metadata?: { [key: string]: string };
  }
}
