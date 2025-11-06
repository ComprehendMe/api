import { Elysia } from "elysia";
//import { env } from "../common / env";
import { PrismaClient } from "@prisma/client";
import { Auth } from "../config/auth";

//TODO: VER ESSA FITA DO PRISMA, N SEI MAIS USAR ESSA PORRA

export const createApp = async () => {
  const app = new Elysia()
    .decorate("readyAt", 0)

    .derive(({ request, cookie: { access }, set }) => {
      const path = new URL(request.url).pathname;

      const NON_AUTH_ROUTES = [
        '/sessions/signup',
        '/sessions/login',
      ];

      // Se for uma rota pública, não faz nada e continua.
      if (NON_AUTH_ROUTES.includes(path)) {
        return {};
      }

      // Se o cookie de acesso não existir, lança um erro 401.
      if (!access.value) {
        set.status = 401;
        throw new Error('Unauthorized');
      }

      // Verifica o token.
      //@ts-expect-error
      const user = Auth.verify(access.value); // Assuming Auth.verify is synchronous
      if (!user) {
        set.status = 401;
        throw new Error('Unauthorized');
      }

      // Se a verificação for bem-sucedida, adiciona o 'user' ao contexto.
      return { user };
    });

  return app;
}


