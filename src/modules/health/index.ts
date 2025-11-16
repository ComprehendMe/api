import { app } from "../../app";
import { http, httpCodes, exception } from "../../common/request";
import { HealthService } from "./service";

export const route = async (elysia: typeof app) => {
  elysia
    .get(
      "/health",
      async ({ set }) => {
        const health = await HealthService.check();
        if (!health.ok) throw exception(
          httpCodes[http.InternalServerError],
          http.InternalServerError,
          //@ts-expect-error
          health
        );

        set.status = httpCodes[http.Success];
        return health;
      }
    )
}

