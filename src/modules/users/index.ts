import { app } from "../../app";
import { Bucket } from "../../common/bucket";
import { prisma } from "../../common/prisma";
import { http } from "../../common/request/codes";

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
      async ({ user: { id: userId }, set }) => {
        const { hash, route } = await Bucket.genPresignedUrl(`avatars/${userId}`);
        await prisma.user.update({
          data: {
            avatar: hash,
          },
          where: {
            id: userId
          }
        });

        set.status = http.Success;
        return { route };

      }
    )

    gp.delete(
      '/avatar',
      //@ts-expect-error
      async ({ user: { id: userId }, set }) => {

        const user = await prisma.user.findFirst({
          select: {
            avatar: true,
          },
          where: {
            id: userId
          }
        });

        if (!user) {
          set.status = http.NotFound;
          throw new Error("User not found");
        }

        if (!user.avatar) {
          set.status = http.BadRequest;
          throw new Error("User has no avatar");
        }

        const { ok } = await Bucket.remove(`avatars/${userId}/${user.avatar}.webp`);
        if (!ok) {
          set.status = http.InternalServerError;
          throw new Error("Failed to remove avatar from bucket");
        }

        set.status = http.Success;
        return { ok };
      }
    )

    return gp;
  })
}
