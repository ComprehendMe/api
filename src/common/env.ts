import * as e from "envalid"

export const env = e.cleanEnv(process.env, {
  PORT: e.port(),
  DATABASE_URL: e.url(),

  REDIS_HOST: e.str(),
  REDIS_PORT: e.num(),
})
