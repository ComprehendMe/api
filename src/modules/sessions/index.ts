import { t } from "elysia";
import { app } from "../../app";
import { SessionService } from "./service";

export const route = (elysia: typeof app) => {
  elysia.group("/sessions", (group) => {
    group.post(
      "/signup",
      async ({ body }) => {
        const { email, firstName, lastName, password } = body;

        const salve = await SessionService

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

    group.post("/signup/:code", async () => {
      return "OK"
    })
    return group;
  })
}
