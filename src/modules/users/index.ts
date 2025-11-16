import { app } from "../../app";
import { Bucket } from "../../common/bucket";
import { prisma } from "../../common/prisma";
import { http, httpCodes, exception } from "../../common/request";
import { env } from "../../common/env";

export const route = (elysia: typeof app) => {
  elysia.group("/users", (gp) => {
    gp.get(
      '/@me',
      //@ts-expect-error
      async ({ user: { id: userId }, set }) => {
        const user = await prisma.user.findFirst({
          where: {
            id: userId
          },
          select: {
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
            updatedAt: true,
          }
        });

        if (!user) {
          throw exception(httpCodes[http.NotFound], http.NotFound, { message: "User not found" });
        }
        const { email, firstName, lastName, avatar } = user;

        set.status = httpCodes[http.Success];
        return { avatar: `${env.BUCKET_PUBLIC_URL}/avatars/${avatar}.webp`, email, firstName, lastName };
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

        set.status = httpCodes[http.Success];
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
          throw exception(httpCodes[http.NotFound], http.NotFound, { message: "User not found" });
        }

        if (!user.avatar) {
          throw exception(httpCodes[http.BadRequest], http.BadRequest, { message: "User has no avatar" });
        }

        const { ok } = await Bucket.remove(`avatars/${userId}/${user.avatar}.webp`);
        if (!ok) {
          throw exception(httpCodes[http.InternalServerError], http.InternalServerError, { message: "Failed to remove avatar from bucket" });
        }

        set.status = httpCodes[http.Success];
        return { ok };
      }
    )

    return gp;
  })
}
