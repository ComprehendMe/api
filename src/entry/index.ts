import { Elysia } from "elysia";
import { PrismaCached } from "../common/cache";
import { env } from "../common/env";

export const createApp = async () => {
  const app = new Elysia()
    .decorate("readyAt", Date.now())
    .decorate("db", new PrismaCached(env.REDIS_HOST, env.REDIS_PORT))

  return app;
}


