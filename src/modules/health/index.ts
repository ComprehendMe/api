import { app } from "../../app";
import { handler } from "../../common/request";
import { HealthService } from "./service";

export const route = async (elysia: typeof app) => {
  elysia
    .get("/health", async () => await HealthService.check())
}
