import { createTransport } from "nodemailer";
import { env } from "./env";

const { SMTP_USER, SMTP_PORT, SMTP_HOST, SMTP_PASS, SMTP_FROM } = env;

type MailOptions = {
  to: string;
  subject?: string;
  text?: string;
  html?: string;
}

export const mail = async ({ to, html, subject, text }: MailOptions) => {
  const transport = createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    },
    connectionTimeout: 15000,
    socketTimeout: 15000,
  });

  try {
    await transport.sendMail({
      from: SMTP_FROM || SMTP_USER,
      to,
      subject,
      html,
      text,
    });
  } finally {
    transport.close();
  }
}
