import { t } from "elysia";
import { app } from "../../app";
import { SessionService } from "./service";
import { prisma } from "../../common/prisma";
import { dragonfly, FIVE_MINUTES_IN_SECONDS } from "../../common/dragonfly";
import useragent from "useragent";
import { Auth } from "../../config/auth";
import { mail } from "../../common/mail";

export const route = (elysia: typeof app) => {
  elysia.group("/sessions", (group) => {
    group.post(
      "/signup",
      async ({ body, request }) => {
        await Auth.verifyAgent(request.headers.get("user-agent") || "");

        const { email } = body;
        const REDIS_KEY = `codes:${email}`;
        const existingCode = await dragonfly.get<string>(REDIS_KEY);

        if (existingCode) return { status: 400, body: { message: "Code already sent. Please check your email." } };

        const hasEmailTaken = await prisma.user.findUnique({
          where: { email },
          select: { id: true },
        });

        if (hasEmailTaken) {
          return { status: http.BadRequest, body: { message: "Email already taken" } };
        }

        const code = SessionService.genCode();

        await Promise.all([
          dragonfly.setex(REDIS_KEY, FIVE_MINUTES_IN_SECONDS, code),
          mail({
            to: email,
            subject: "Your Signup Code",
            text: `Your signup code is: ${code}. It will expire in 5 minutes.`,
          }),
        ]);

        return { status: http.Success, body: { ok: true } };
      },
      {
        body: t.Object({
          firstName: t.String(),
          lastName: t.String(),
          email: t.String({ format: 'email' }),
          password: t.String(), //TODO: add password validation
        })
      }
    )

    group.post(
      "/signup/:code",
      async ({ params, body, request, cookie, ip }) => {
        const { os, browser } = await Auth.verifyAgent(request.headers.get("user-agent") || "");

        const { code } = params;
        const { email, firstName, lastName, password } = body;

        const { access, refresh } = await SessionService.signup({
          email,
          firstName,
          lastName,
          password,
          code,
          os,
          browser,
          ip,
        });

        cookie.refresh.value = refresh;
        cookie.accesss.value = access;
      },
      {
        body: t.Object({
          firstName: t.String(),
          lastName: t.String(),
          email: t.String({ format: 'email' }),
          password: t.String(), //TODO: add password validation
        })
      }
    )

    group.post(
      "/login",
      async ({ body, request, cookie, ip }) => {
        const { os, browser } = await Auth.verifyAgent(
          request.headers.get("user-agent") || ""
        );

        const { access, refresh } = await SessionService.login({
          ...body,
          os,
          browser,
          ip,
        });

        cookie.refresh.value = refresh;
        cookie.access.value = access;
      },
      {
        body: t.Object({
          email: t.String({ format: "email" }),
          password: t.String(),
        }),
      }
    );

    group.post(
      "/refresh",
      async ({ cookie }) => {
        const { access, refresh } = await SessionService.refresh(
          cookie.refresh.value
        );

        cookie.refresh.value = refresh;
        cookie.access.value = access;
      },
      {
        cookie: t.Object({
          access: t.String(),
          refresh: t.String(),
        }),
      }
    );

    group.get("/me", async ({ user }) => user);

    group.delete(
      "/logout",
      async ({ cookie }) => {
        await SessionService.logout(cookie.refresh.value);

        cookie.access.remove();
        cookie.refresh.remove();
      },
      {
        cookie: t.Object({
          access: t.String(),
          refresh: t.String(),
        }),
      }
    );

    return group;
  });
};
