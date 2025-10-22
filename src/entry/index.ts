import { Elysia } from "elysia";
//import { env } from "../common / env";
import { PrismaClient } from "@prisma/client";

//TODO: VER ESSA FITA DO PRISMA, N SEI MAIS USAR ESSA PORRA

export const createApp = async () => {
  const app = new Elysia()
    .decorate("readyAt", Date.now())
    .decorate("db", new PrismaClient())

  return app;
}


