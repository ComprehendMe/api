import { app } from "../../app";
import { Bucket } from "../../common/bucket";
import { prisma } from "../../common/prisma";

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
      //@ts-expect-error
      async ({ user: { id: userId } }) => {
        const { hash, route } = await Bucket.genPresignedUrl(`avatars/${userId}`);
        await prisma.user.update({
          data: {
            avatar: route,
          }
        })
        return url;
      }
    )

    return gp;
  })
}
