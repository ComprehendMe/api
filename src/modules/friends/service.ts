import { FriendshipStatus } from "@prisma/client";
import { prisma } from "../../common/prisma";
import { exception, http, httpCodes } from "../../common/request";
import { genSnow } from "../../common/snow";

export class FriendService {
  public static async requestFriend(requesterId: bigint, addresseeId: bigint) {
    if (requesterId === addresseeId) {
      throw exception(
        httpCodes[http.BadRequest],
        http.BadRequest,
        "Cannot send friend request to yourself",
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

    return prisma.friendship.create({
      data: {
        id: genSnow(),
        requesterId,
        addresseeId,
        status: FriendshipStatus.PENDING,
      },
    });
  }

  public static async listFriendRequests(userId: bigint) {
    return prisma.friendship.findMany({
      where: {
        addresseeId: userId,
        status: FriendshipStatus.PENDING,
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
    });
  }

  public static async listFriends(userId: bigint) {
    const friends = await prisma.friendship.findMany({
      where: {
        OR: [{ requesterId: userId }, { addresseeId: userId }],
        status: FriendshipStatus.ACCEPTED,
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
      if (f.requesterId === userId) {
        return f.addressee;
      }
      return f.requester;
    });
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

    return prisma.friendship.update({
      where: { id: requestId },
      data: { status },
    });
  }

  public static async searchFriendRequestByName(name: string) {
    return prisma.user.findMany({
      where: {
        name: {
          contains: name,
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
  }
}
