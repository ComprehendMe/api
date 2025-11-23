import { app } from "../../app";
import { Bucket } from "../../common/bucket";
import { prisma } from "../../common/prisma";
import { http, httpCodes, exception } from "../../common/request";
import { env } from "../../common/env";

export const route = (elysia: typeof app) => {
  elysia.group("/users", (gp) => {
    gp.get(
      "/@me",
      async ({ user: { id: userId }, set }) => {
        const user = await prisma.user.findFirst({
          where: {
            id: userId,
          },
          select: {
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
            updatedAt: true,
          },
        });

        if (!user) {
          throw exception(httpCodes[http.NotFound], http.NotFound, {
            message: "User not found",
          });
        }
        const { email, firstName, lastName, avatar } = user;

        set.status = httpCodes[http.Success];
        return {
          avatar: `${env.BUCKET_PUBLIC_URL}/avatars/${avatar}.webp`,
          email,
          firstName,
          lastName,
        };
      },
      {
        detail: {
          summary: "Get Current User",
          description:
            "Retrieves the profile information of the currently authenticated user.",
          tags: ["Users"],
        },
      }
    );

    gp.post(
      "/avatar",
      async ({ user: { id: userId }, set }) => {
        const { hash, route } = await Bucket.genPresignedUrl(
          `avatars/${userId}`
        );
        await prisma.user.update({
          data: {
            avatar: hash,
          },
          where: {
            id: userId,
          },
        });

        set.status = httpCodes[http.Success];
        return { route };
      },
      {
        detail: {
          summary: "Generate Avatar Upload URL",
          description:
            "Generates a presigned URL for uploading a new user avatar.",
          tags: ["Users"],
        },
      }
    );

    gp.delete(
      "/avatar",
      async ({ user: { id: userId }, set }) => {
        const user = await prisma.user.findFirst({
          select: {
            avatar: true,
          },
          where: {
            id: userId,
          },
        });

        if (!user) {
          throw exception(httpCodes[http.NotFound], http.NotFound, {
            message: "User not found",
          });
        }

        if (!user.avatar) {
          throw exception(httpCodes[http.BadRequest], http.BadRequest, {
            message: "User has no avatar",
          });
        }

        const { ok } = await Bucket.remove(
          `avatars/${userId}/${user.avatar}.webp`
        );
        if (!ok) {
          throw exception(
            httpCodes[http.InternalServerError],
            http.InternalServerError,
            { message: "Failed to remove avatar from bucket" }
          );
        }

        set.status = httpCodes[http.Success];
        return { ok };
      },
      {
        detail: {
          summary: "Delete User Avatar",
          description: "Deletes the current user's avatar.",
          tags: ["Users"],
        },
      }
    );
    gp.put(
      "/@me",
      async ({ user: { id: userId }, set }) => {
        const emailExists = await prisma.user.findFirst({
          where: {
            email,
          },
        });
        if (emailExists) return "Email already in use";

        const updateUser = await prisma.user.update({
          where: {
            id: userId,
          },
          data: {},
        });
        const { email, firstName, lastName } = updateUser;

        set.status = httpCodes[http.Success];
        return { updateUser };
      },
      {
        detail: {
          summary: "Update Current User",
          description:
            "Updates the profile information of the currently authenticated user.",
          tags: ["Users"],
        },
      }
    );

    return gp;
  });
};
