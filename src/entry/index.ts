import { Elysia } from "elysia";
import { ip } from "elysia-ip";
import { Auth } from "../config/auth";
import openapi from "@elysiajs/openapi";
import { env } from "../common/env";

export const isProd = env.NODE_ENV === "prod";
export const createApp = async () => {
  const app = new Elysia({ name: 'cogniAI' })
    .use(ip())
    .use(
      openapi({
        path: "/docs",
        documentation: {
          info: {
            title: "Cogni AI API Documentation",
            version: "1.0.0",
            description: "API documentation for the Cogni AI project.",
          },
          tags: [
            { name: "Sessions", description: "Endpoints related to user sessions and authentication." },
            { name: "Users", description: "Endpoints related to user management." },
            { name: "Chats", description: "Endpoints related to project management." },
            { name: "Messages", description: "Endpoints related to message handling within chats." },
            { name: "AI", description: "Endpoints related to AI model interactions." },
          ]
        },
      })
    )
    .decorate("readyAt", 0)
    .derive(({ request, cookie: { access }, set }) => {
      const path = new URL(request.url).pathname;

      const NON_AUTH_ROUTES = [
        '/health',
        '/docs',
        '/sessions/signup',
        '/sessions/login',
      ];

      if (NON_AUTH_ROUTES.includes(path)) return {};

      if (!access.value) {
        set.status = 401;
        throw new Error('Unauthorized');
      }

      //@ts-expect-error
      const user = Auth.verify(access.value);
      if (!user) {
        set.status = 401;
        throw new Error('Unauthorized');
      }

      return { user };
    });

  return app;
}


