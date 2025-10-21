import { Elysia } from "elysia";

export const createApp = async () => {
  const app = new Elysia()
    .decorate("readyAt", Date.now())
    .get("/", () => "Hello Elysia");

  return app;
}


