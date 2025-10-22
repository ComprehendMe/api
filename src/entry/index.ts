import { Elysia } from "elysia";
//import { env } from "../common / env";
import { PrismaClient } from "@prisma/client";

export const createApp = async () => {
  const app = new Elysia()
    .decorate("readyAt", Date.now())
    .decorate("db", new PrismaClient())

  return app;
}


