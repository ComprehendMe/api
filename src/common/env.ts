import * as e from "envalid"

export const env = e.cleanEnv(process.env, {
  PORT: e.port(),
  DATABASE_URL: e.url(),

  REDIS_HOST: e.str(),
  REDIS_PORT: e.num(),

  JWT_SECRET: e.str(),

  SMTP_USER: e.str(),
  SMTP_PASS: e.str(),
  SMTP_PORT: e.port(),
  SMTP_HOST: e.str(),

  R2_ACCESS_KEY: e.str(),
  R2_SECRET_KEY: e.str(),
  R2_ENDPOINT: e.str(),
  R2_BUCKET: e.str(),
  R2_PUBLIC_URL: e.str(),
})
