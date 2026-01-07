import { app } from "../../app";

export const route = (elysia: typeof app) => {
  elysia.group("/friends", (gp) => {
    elysia.get("/", () => {
      return "OK"
    })

    return gp
  })
}
