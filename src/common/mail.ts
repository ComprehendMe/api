import { createTransport } from "nodemailer";
import { env } from "./env";

const { SMTP_HOST, SMTP_PASS, SMTP_PORT, SMTP_USER } = env;

const transport = createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  }
})

type MailOptions = {
  to: string;
  subject?: string;
  text?: string;
  html?: string;
}

export const mail = async ({ to, html, subject, text }: MailOptions) => {
  await transport.sendMail({ to, html, subject, text });
}
