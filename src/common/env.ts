import * as e from "envalid"

export const env = e.cleanEnv(process.env, {
  PORT: e.port(),
  DATABASE_URL: e.url(),
  NODE_ENV: e.str({ default: "dev" }),

  REDIS_HOST: e.str(),
  REDIS_PORT: e.num(),

  JWT_SECRET: e.str(),

  AUTH0_CLIENT_ID: e.str(),
  AUTH0_CLIENT_SECRET: e.str(),
  AUTH0_DOMAIN: e.str(),
  AUTH0_AUDIENCE: e.str(),
  AUTH0_CALLBACK_URL: e.str(),

  RESEND_SECRET_KEY: e.str(),
  SMTP_USER: e.email(),

  BUCKET_ACCESS_KEY: e.str(),
  BUCKET_SECRET_KEY: e.str(),
  BUCKET_ENDPOINT: e.str(),
  BUCKET_NAME: e.str(),
  BUCKET_PUBLIC_URL: e.str(),
})
