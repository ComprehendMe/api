import { app } from "../../app";

export const route = async (elysia: typeof app) => {
  //@ts-expect-error
  elysia.group("/sessions", (group) => {
    group.post("/signup", async () => {
      return "OK"
    })
  })
}
