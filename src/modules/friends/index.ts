import { t } from "elysia";
import { app } from "../../app";
import { ID_SCHEMA } from "../../common/snow";
import { FriendService } from "./service";
import { FriendshipStatus } from "@prisma/client";

export const route = (elysia: typeof app) => {
  elysia.group("/friends", (gp) => {
    gp.get("/", (context) => {
      const user = (context as typeof context & { user?: { id: bigint } })
        .user;
      if (!user) throw new Error("Unauthorized");

      return FriendService.listFriends(BigInt(user.id));
    });

    gp.get("/requests", (context) => {
      const user = (context as typeof context & { user?: { id: bigint } })
        .user;
      if (!user) throw new Error("Unauthorized");

      return FriendService.listFriendRequests(BigInt(user.id));
    });

    gp.post(
      "/requests",
      (context) => {
        const user = (context as typeof context & { user?: { id: bigint } })
          .user;
        if (!user) throw new Error("Unauthorized");

        return FriendService.requestFriend(
          BigInt(user.id),
          context.body.userId,
        );
      },
      {
        body: t.Object({
          userId: ID_SCHEMA,
        }),
      },
    );

    gp.put(
      "/requests/:requestId",
      (context) => {
        const user = (context as typeof context & { user?: { id: bigint } })
          .user;
        if (!user) throw new Error("Unauthorized");

        return FriendService.acceptFriendRequest(
          context.params.requestId,
          BigInt(user.id),
          context.body.status,
        );
      },
      {
        params: t.Object({
          requestId: ID_SCHEMA,
        }),
        body: t.Object({
          status: t.Enum(FriendshipStatus),
        }),
      },
    );

    gp.put(
      "/:friendshipId/nickname",
      (context) => {
        const user = (context as typeof context & { user?: { id: bigint } })
          .user;
        if (!user) throw new Error("Unauthorized");

        return FriendService.updateNickname(
          context.params.friendshipId,
          BigInt(user.id),
          context.body.nickname,
        );
      },
      {
        params: t.Object({
          friendshipId: ID_SCHEMA,
        }),
        body: t.Object({
          nickname: t.Nullable(t.String()),
        }),
      },
    );

    gp.delete(
      "/:friendId",
      (context) => {
        const user = (context as typeof context & { user?: { id: bigint } })
          .user;
        if (!user) throw new Error("Unauthorized");

        return FriendService.removeFriend(
          BigInt(user.id),
          context.params.friendId,
        );
      },
      {
        params: t.Object({
          friendId: ID_SCHEMA,
        }),
      },
    );

    gp.get(
      "/search",
      (context) => {
        const user = (context as typeof context & { user?: { id: bigint } })
          .user;
        if (!user) throw new Error("Unauthorized");

        return FriendService.searchUsersByName(
          context.query.name,
          BigInt(user.id),
        );
      },
      {
        query: t.Object({
          name: t.String(),
        }),
      },
    );

    return gp;
  });
};
