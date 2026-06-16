import { FriendshipStatus } from "@prisma/client";
import { prisma } from "../../common/prisma";
import { exception, http, httpCodes } from "../../common/request";
import { genSnow } from "../../common/snow";
import { resolveUserAvatarUrl } from "../../common/user-avatar";
import { wsManager } from "../../common/websocket";

type UserPreview = {
  id: string;
  name: string | null;
  avatar: string | null;
  email?: string;
};

type FriendInfo = {
  id: string;
  friendshipId: string;
  nickname: string | null;
  name: string | null;
  avatar: string | null;
};

const realAccountFilter = {
  deletedAt: null,
  sessions: { some: {} },
} as const;

const serializeUser = (user: {
  id: bigint;
  name: string | null;
  avatar: string | null;
  email?: string;
}): UserPreview => ({
  id: user.id.toString(),
  name: user.name,
  avatar: resolveUserAvatarUrl(user.id, user.avatar),
  ...(user.email !== undefined ? { email: user.email } : {}),
});

export class FriendService {
  public static async requestFriend(requesterId: bigint, addresseeId: bigint) {
    if (requesterId === addresseeId) {
      throw exception(
        httpCodes[http.BadRequest],
        http.BadRequest,
        "Cannot send friend request to yourself",
      );
    }

    const addressee = await prisma.user.findFirst({
      where: { id: addresseeId, ...realAccountFilter },
      select: { id: true, name: true },
    });

    if (!addressee) {
      throw exception(
        httpCodes[http.NotFound],
        http.NotFound,
        "User not found",
      );
    }

    const existing = await prisma.friendship.findUnique({
      where: {
        requesterId_addresseeId: {
          requesterId,
          addresseeId,
        },
      },
    });

    if (existing) {
      throw exception(
        httpCodes[http.BadRequest],
        http.BadRequest,
        "Friend request already sent",
      );
    }

    const reverse = await prisma.friendship.findUnique({
      where: {
        requesterId_addresseeId: {
          requesterId: addresseeId,
          addresseeId: requesterId,
        },
      },
    });

    if (reverse) {
      if (reverse.status === FriendshipStatus.PENDING) {
        throw exception(
          httpCodes[http.BadRequest],
          http.BadRequest,
          "This user has already sent you a request. Please accept it.",
        );
      }
      if (reverse.status === FriendshipStatus.BLOCKED) {
        throw exception(
          httpCodes[http.BadRequest],
          http.BadRequest,
          "Cannot send request to this user",
        );
      }
      throw exception(
        httpCodes[http.BadRequest],
        http.BadRequest,
        "Friendship status already exists",
      );
    }

    const friendship = await prisma.friendship.create({
      data: {
        id: genSnow(),
        requesterId,
        addresseeId,
        status: FriendshipStatus.PENDING,
      },
      include: {
        requester: {
          select: { id: true, name: true, avatar: true, email: true },
        },
      },
    });

    await wsManager.publish(`user:${addresseeId}`, {
      type: 'FRIEND_REQUEST',
      payload: {
        id: friendship.id.toString(),
        requester: serializeUser(friendship.requester),
        createdAt: new Date().toISOString(),
      },
    });

    return {
      ok: true,
      request: {
        id: friendship.id.toString(),
        requester: serializeUser(friendship.requester),
      },
    };
  }

  public static async listFriendRequests(userId: bigint) {
    const requests = await prisma.friendship.findMany({
      where: {
        addresseeId: userId,
        status: FriendshipStatus.PENDING,
        requester: realAccountFilter,
      },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            avatar: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return requests.map((r) => ({
      id: r.id.toString(),
      requester: serializeUser(r.requester),
      createdAt: r.createdAt.toISOString(),
    }));
  }

  public static async listFriends(userId: bigint) {
    const friends = await prisma.friendship.findMany({
      where: {
        OR: [{ requesterId: userId }, { addresseeId: userId }],
        status: FriendshipStatus.ACCEPTED,
        requester: realAccountFilter,
        addressee: realAccountFilter,
      },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            avatar: true,
            email: true,
          },
        },
        addressee: {
          select: {
            id: true,
            name: true,
            avatar: true,
            email: true,
          },
        },
      },
    });

    return friends.map((f) => {
      const peer = f.requesterId === userId ? f.addressee : f.requester;
      const nickname =
        f.requesterId === userId
          ? f.requesterNickname
          : f.addresseeNickname;
      return {
        id: peer.id.toString(),
        friendshipId: f.id.toString(),
        nickname,
        name: peer.name,
        avatar: resolveUserAvatarUrl(peer.id, peer.avatar),
      };
    });
  }

  public static async updateNickname(
    friendshipId: bigint,
    userId: bigint,
    nickname: string | null,
  ) {
    const friendship = await prisma.friendship.findUnique({
      where: { id: friendshipId },
    });

    if (!friendship) {
      throw exception(
        httpCodes[http.NotFound],
        http.NotFound,
        "Friendship not found",
      );
    }

    if (
      friendship.requesterId !== userId &&
      friendship.addresseeId !== userId
    ) {
      throw exception(
        httpCodes[http.Unauthorized],
        http.Unauthorized,
        "Not a participant in this friendship",
      );
    }

    const data =
      friendship.requesterId === userId
        ? { requesterNickname: nickname || null }
        : { addresseeNickname: nickname || null };

    await prisma.friendship.update({
      where: { id: friendshipId },
      data,
    });

    return { ok: true };
  }

  public static async removeFriend(userId: bigint, friendId: bigint) {
    const friendship = await prisma.friendship.findFirst({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [
          { requesterId: userId, addresseeId: friendId },
          { requesterId: friendId, addresseeId: userId },
        ],
      },
    });

    if (!friendship) {
      throw exception(
        httpCodes[http.NotFound],
        http.NotFound,
        "Friendship not found",
      );
    }

    await prisma.friendship.delete({ where: { id: friendship.id } });
    return { ok: true };
  }

  public static async acceptFriendRequest(
    requestId: bigint,
    userId: bigint,
    status: FriendshipStatus,
  ) {
    const request = await prisma.friendship.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw exception(
        httpCodes[http.NotFound],
        http.NotFound,
        "Friend request not found",
      );
    }

    if (request.addresseeId !== userId) {
      throw exception(
        httpCodes[http.Unauthorized],
        http.Unauthorized,
        "Unauthorized to accept this request",
      );
    }

    if (request.status !== FriendshipStatus.PENDING) {
      throw exception(
        httpCodes[http.BadRequest],
        http.BadRequest,
        "Request is not pending",
      );
    }

    await prisma.friendship.update({
      where: { id: requestId },
      data: { status },
    });

    if (status === FriendshipStatus.ACCEPTED) {
      const requestWithUsers = await prisma.friendship.findUnique({
        where: { id: requestId },
        select: {
          requester: { select: { id: true, name: true, avatar: true } },
          addressee: { select: { id: true, name: true, avatar: true } },
        },
      });

      if (requestWithUsers) {
        await wsManager.publish(
          `user:${requestWithUsers.requester.id}`,
          {
            type: 'FRIEND_REQUEST_ACCEPTED',
            payload: {
              friendshipId: requestId.toString(),
              user: {
                id: requestWithUsers.addressee.id.toString(),
                name: requestWithUsers.addressee.name,
                avatar: requestWithUsers.addressee.avatar
                  ? resolveUserAvatarUrl(requestWithUsers.addressee.avatar)
                  : null,
              },
            },
          },
        );
      }
    }

    return { ok: true, status };
  }

  public static async searchUsersByName(name: string, currentUserId: bigint) {
    const trimmed = name.trim();
    if (!trimmed) return [];

    const users = await prisma.user.findMany({
      where: {
        id: { not: currentUserId },
        ...realAccountFilter,
        name: {
          contains: trimmed,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        name: true,
        avatar: true,
      },
      take: 20,
    });

    const ids = users.map((u) => u.id);
    if (ids.length === 0) return [];

    const relations = await prisma.friendship.findMany({
      where: {
        OR: [
          { requesterId: currentUserId, addresseeId: { in: ids } },
          { requesterId: { in: ids }, addresseeId: currentUserId },
        ],
      },
    });

    const relationByPeer = new Map<string, FriendshipStatus>();
    for (const rel of relations) {
      const peerId =
        rel.requesterId === currentUserId ? rel.addresseeId : rel.requesterId;
      relationByPeer.set(peerId.toString(), rel.status);
    }

    return users.map((user) => {
      const status = relationByPeer.get(user.id.toString());
      let relation: "none" | "pending" | "accepted" | "incoming" = "none";
      let requestId: string | undefined;

      if (status === FriendshipStatus.ACCEPTED) relation = "accepted";
      else if (status === FriendshipStatus.PENDING) {
        const rel = relations.find(
          (r) =>
            (r.requesterId === currentUserId &&
              r.addresseeId === user.id) ||
            (r.requesterId === user.id && r.addresseeId === currentUserId),
        );
        if (rel?.requesterId === user.id) {
          relation = "incoming";
          requestId = rel.id.toString();
        } else {
          relation = "pending";
          requestId = rel?.id.toString();
        }
      }

      return { ...serializeUser(user), relation, requestId };
    });
  }
}
