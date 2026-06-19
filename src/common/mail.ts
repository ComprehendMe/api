import { Resend } from "resend";
import { env } from "./env";

const resend = new Resend(env.RESEND_SECRET_KEY);

type MailOptions = {
  to: string;
  subject?: string;
  text?: string;
  html?: string;
}

export const mail = async ({ to, html, subject, text }: MailOptions) => {
  const { error } = await resend.emails.send({
    from: 'ComprehendMe <onboarding@resend.dev>',
    to: [to],
    subject: subject ?? '',
    text: text ?? '',
    html: html ?? '',
  });

  if (error) {
    console.error('Resend error:', error);
    throw new Error('Error to send mail');
  }
}
