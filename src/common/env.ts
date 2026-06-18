import * as e from "envalid"
import { normalizeGeminiApiKey } from "./gemini-key"

export const env = e.cleanEnv(process.env, {
  PORT: e.port(),
  DATABASE_URL: e.url(),
  NODE_ENV: e.str({ default: "dev" }),

  REDIS_HOST: e.str(),
  REDIS_PORT: e.num(),
  REDIS_PASSWORD: e.str({ default: '' }),

  APP_URL: e.str(),
  FRONTEND_URL: e.str(),
  JWT_SECRET: e.str(),

  AUTH0_CLIENT_ID: e.str(),
  AUTH0_CLIENT_SECRET: e.str(),
  AUTH0_DOMAIN: e.str(),
  AUTH0_AUDIENCE: e.str({ default: "" }),
  AUTH0_CALLBACK_URL: e.str({
    default: "",
    desc: "OAuth callback; defaults to APP_URL + /api/sessions/oauth/cb",
  }),

  COOKIE_SECURE: e.bool({
    default: false,
    desc: "Cookie Secure flag (true for tunnel/HTTPS)",
  }),
  COOKIE_SAMESITE: e.str({
    default: "lax",
    desc: "Cookie SameSite (lax | none | strict)",
  }),

  RESEND_SECRET_KEY: e.str(),

  SMTP_HOST: e.str(),
  SMTP_USER: e.email(),
  SMTP_PORT: e.port(),
  SMTP_PASS: e.str(),

  BUCKET_ACCESS_KEY: e.str({ default: '' }),
  BUCKET_SECRET_KEY: e.str({ default: '' }),
  BUCKET_ENDPOINT: e.str({ default: '' }),
  BUCKET_NAME: e.str({ default: '' }),
  BUCKET_PUBLIC_URL: e.str({ default: '' }),

  STRIPE_SECRET_KEY: e.str(),
  STRIPE_WEBHOOK_SECRET: e.str(),
  CORS_ORIGIN: e.str({
    default: "",
    desc: "Additional comma-separated CORS origins (e.g. https://comprehendme.vercel.app)",
  }),
  GEMINI_API_KEY: e.str({
    desc: "Google AI Studio API key (https://aistudio.google.com/apikey)",
    transform: normalizeGeminiApiKey,
  }),
  /** When true, skips Gemini and returns simulated patient replies (local dev). */
  GEMINI_MOCK: e.bool({ default: false }),

  CLOUDINARY_CLOUD_NAME: e.str(),
  CLOUDINARY_API_KEY: e.str(),
  CLOUDINARY_API_SECRET: e.str(),
})
