import { env } from "./env";
import { Resend } from "resend";


const resend = new Resend(env.RESEND_SECRET_KEY)
type MailOptions = {
  to: string;
  subject?: string;
  text?: string;
  html?: string;
}

//WARN: ta dando erro
export const mail = async ({ to, html, subject, text }: MailOptions) => {
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
}
