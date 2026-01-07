import { createTransport } from "nodemailer";
import { env } from "./env";
import { Resend } from "resend";

const { SMTP_USER, SMTP_PORT, SMTP_HOST, SMTP_PASS } = env;
const resend = new Resend(env.RESEND_SECRET_KEY)
type MailOptions = {
  to: string;
  subject?: string;
  text?: string;
  html?: string;
}

/*
  const { error } = await resend.emails.send({
    to: [to],
    from: env.SMTP_USER,
    subject: subject ?? '',
    text: text ?? '',
    html: html ?? ''
  })

  if (error) {
    console.log(error);
    throw new Error('Error to send mail');
  }
 */


export const mail = async ({ to, html, subject, text }: MailOptions) => {
  const transport = createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });

  await transport.sendMail({ to, subject, html, text })
}
