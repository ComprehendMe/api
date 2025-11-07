import { app } from "../../app";
import { Minio } from "../../common/bucket";

export const route = (elysia: typeof app) => {
  elysia.group("/users", (gp) => {
    gp.get(
      '/',
      async () => {
        return 'SALVE';
      }
    )

    gp.post(
      '/avatar',
      async ({ }) => {
        const url = await Minio.genPresignedUrl('');
        return url;
      }
    )

    return gp;
  })
}
