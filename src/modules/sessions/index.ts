import { t } from "elysia";
import { app } from "../../app";
import { SessionService } from "./service";
import { prisma } from "../../common/prisma";
import { dragonfly, FIVE_MINUTES_IN_SECONDS } from "../../common/dragonfly";
import { Auth, FIFTEEN_DAYS_IN_MS, FIFTEEN_MIN_IN_MS } from "../../config/auth";
import { mail } from "../../common/mail";
import { SessionModel } from "./model";
import { ID_SCHEMA } from "../../common/snow";
import { http } from "../../common/request/codes";
import { isProd } from "../../entry";

export const route = (elysia: typeof app) => {
  elysia.group("/sessions", (group) => {
    group.post(
      "/signup",
      async ({ body, request, set }) => {
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

        set.status = http.Created;
        return { ok: true };
      },
      {
        body: SessionModel.SIGNUP_SCHEMA,
      }
    )

    group.post(
      "/signup/:code",
      async ({ params, body, request, cookie, ip, set }) => {
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


        cookie.refresh.set({
          value: refresh,
          httpOnly: true,
          secure: isProd,
          maxAge: FIFTEEN_DAYS_IN_MS
        });

        cookie.access.set({
          value: access,
          httpOnly: true,
          secure: isProd,
          maxAge: FIFTEEN_MIN_IN_MS
        });

        set.status = http.Created;
      },
      {
        body: SessionModel.SIGNUP_SCHEMA,
      }
    )

    group.post(
      "/login",
      async ({ body, request, cookie, ip, set }) => {
        const { os, browser } = await Auth.verifyAgent(
          request.headers.get("user-agent") || ""
        );

        const { access, refresh } = await SessionService.login({
          ...body,
          os,
          browser,
          ip,
        });

        cookie.refresh.set({
          value: refresh,
          httpOnly: true,
          secure: isProd,
          maxAge: FIFTEEN_DAYS_IN_MS
        });

        cookie.access.set({
          value: access,
          httpOnly: true,
          secure: isProd,
          maxAge: FIFTEEN_MIN_IN_MS
        });

        set.status = http.Created;
      },
      {
        body: SessionModel.LOGIN_SCHEMA
      }
    );

    group.post(
      "/refresh",
      async ({ cookie, set }) => {
        const { access, refresh } = await SessionService.refresh(
          cookie.refresh.value
        );

        cookie.refresh.set({
          value: refresh,
          httpOnly: true,
          secure: isProd,
          maxAge: FIFTEEN_DAYS_IN_MS
        });

        cookie.access.set({
          value: access,
          httpOnly: true,
          secure: isProd,
          maxAge: FIFTEEN_MIN_IN_MS
        });

        set.status = http.Success;
      },
      {
        cookie: t.Object({
          access: t.String(),
          refresh: t.String(),
        }),
      }
    );

    group.get(
      "/:id",
      async ({ user, params, set }) => {
        const { id } = params

        const me = await prisma.session.findFirst({
          where: { userId: user!.id, id },
          select: {
            userId: true,
            os: true,
            browser: true,
          }
        });

        set.status = http.NotFound;
        if (!me) throw new Error("Session not found");
      },
      {
        params: t.Object({
          id: ID_SCHEMA
        }),
      }
    )


    group.delete(
      "/logout",
      async ({ cookie, set }) => {
        await SessionService.logout(cookie.refresh.value);

        cookie.access.remove();
        cookie.refresh.remove();

        set.status = http.Success;
      },
      {
        cookie: t.Object({
          access: t.String(),
          refresh: t.String(),
        }),
      }
    );

    group.get("/oauth/google", async ({ set }) => {
      const redirectURL = await SessionService.authWithProvider("google");
      set.redirect = redirectURL;
    });

    group.get(
      "/oauth/cb",
      async ({ query, request, cookie, ip, set }) => {
        const { os, browser } = await Auth.verifyAgent(
          request.headers.get("user-agent") || ""
        );

        const { access, refresh } = await SessionService.handleAuth0Callback({
          code: query.code as string,
          ip,
          os,
          browser,
        });

        cookie.refresh.set({
          value: refresh,
          httpOnly: true,
          secure: isProd,
          maxAge: FIFTEEN_DAYS_IN_MS
        });

        cookie.access.set({
          value: access,
          httpOnly: true,
          secure: isProd,
          maxAge: FIFTEEN_MIN_IN_MS
        });

        set.status = http.Created;
        set.redirect = "/"; // Redirect to home page or a success page
      },
      {
        query: t.Object({
          code: t.String(),
          state: t.String(), // Auth0 sends a state parameter
        }),
      }
    );

    return group;
  });
};
