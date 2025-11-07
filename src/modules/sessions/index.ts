import { t } from "elysia";
import { app } from "../../app";
import { FIVE_MINUTES_IN_SECONDS } from "../../common/dragonfly";

export const route = (elysia: typeof app) => {
  elysia.group("/sessions", (group) => {
    group.post("/signup", async () => {
      return "OK"
    }, {
      body: t.Object({
        firs
        email: t.String({ format: 'email' }),
        password: t.String(),
      })
    })

    group.post("/signup/:code", async () => {
      return "OK"
    })
    return group;
  })
}
