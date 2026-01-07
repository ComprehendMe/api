import { t } from "elysia";
import { app } from "../../app";
import { ID_SCHEMA } from "../../common/snow";
import { FriendService } from "./service";
import { FriendshipStatus } from "@prisma/client";

export const route = (elysia: typeof app) => {
  elysia.group("/friends", (gp) => {
    gp.get("/", ({ user }) => {
      return FriendService.listFriends(BigInt(user.id));
    });

    gp.get("/requests", ({ user }) => {
      return FriendService.listFriendRequests(BigInt(user.id));
    });

    gp.post(
      "/requests",
      ({ user, body }) => {
        return FriendService.requestFriend(BigInt(user.id), body.userId);
      },
      {
        body: t.Object({
          userId: ID_SCHEMA,
        }),
      },
    );

    gp.put(
      "/requests/:requestId",
      ({ user, params, body }) => {
        return FriendService.acceptFriendRequest(
          params.requestId,
          BigInt(user.id),
          body.status,
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

    gp.get("/search", ({ query }) => {
      return FriendService.searchFriendRequestByName(query.name);
    }, {
      query: t.Object({
        name: t.String()
      })
    });

    return gp;
  });
};