import { app } from "../../app";

export const route = (elysia: typeof app) => {
  elysia.group("/sessions", (group) => {
    group.post("/signup", async () => {
      return "OK"
    })
    return group;
  })
}
