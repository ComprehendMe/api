import { Elysia } from "elysia";
//import { env } from "../common / env";
import { PrismaClient } from "@prisma/client";
import { Auth } from "../config/auth";

//TODO: VER ESSA FITA DO PRISMA, N SEI MAIS USAR ESSA PORRA

export const createApp = async () => {
  const app = new Elysia()
    .decorate("readyAt", 0)
    .decorate("db", new PrismaClient())

    .derive(({ request, cookie: { access } }) => {
      const NON_AUTH_ROUTES = [
        '/sessions/signup',
        '/sessions/login',
      ];

      if (NON_AUTH_ROUTES.includes(request.url)) return;
      if (!access.value) return 'Unauthorized';

      //@ts-expect-error
      const user = Auth.verify(access);
      if (!user) return 'Unauthorized';

      return { user };
    });

  return app;
}


