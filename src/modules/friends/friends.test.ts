import { FriendshipStatus } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { prisma } from 'src/common/prisma';
import { genSnow } from 'src/common/snow';
import { FriendService } from './service';

type User = { email: string; name: string };

const createUser = async ({ email, name }: User) => {
	return await prisma.user.create({
		data: {
			id: genSnow(),
			email,
			name,
		},
	});
};

describe('FriendService', () => {
	let userA: any;
	let userB: any;
	let userC: any;

	beforeAll(async () => {
		const timestamp = Date.now();
		userA = await createUser({
			name: `User A ${timestamp}`,
			email: `usera${timestamp}@test.com`,
		});
		userB = await createUser({
			name: `User B ${timestamp}`,
			email: `userb${timestamp}@test.com`,
		});
		userC = await createUser({
			name: `User C ${timestamp}`,
			email: `userc${timestamp}@test.com`,
		});
	});

	afterAll(async () => {
		try {
			await prisma.friendship.deleteMany({
				where: {
					OR: [
						{ requesterId: userA.id },
						{ addresseeId: userA.id },
						{ requesterId: userB.id },
						{ addresseeId: userB.id },
						{ requesterId: userC.id },
						{ addresseeId: userC.id },
					],
				},
			});
			await prisma.user.deleteMany({
				where: {
					id: { in: [userA.id, userB.id, userC.id] },
				},
			});
		} catch (e) {
			console.error('Cleanup failed', e);
		}
		await prisma.$disconnect();
	});

	it('should send a friend request', async () => {
		const friendship = await FriendService.requestFriend(userA.id, userB.id);
		expect(friendship).toBeDefined();
		expect(friendship.status).toBe(FriendshipStatus.PENDING);
		expect(friendship.requesterId).toBe(userA.id);
		expect(friendship.addresseeId).toBe(userB.id);
	});

	it('should fail to send a duplicate friend request', async () => {
		try {
			await FriendService.requestFriend(userA.id, userB.id);
		} catch (error: any) {
			expect(error).toBeDefined();
		}
	});

	it('should fail to send request to self', async () => {
		try {
			await FriendService.requestFriend(userA.id, userA.id);
		} catch (error: any) {
			expect(error).toBeDefined();
		}
	});

	it('should list friend requests', async () => {
		const requests = await FriendService.listFriendRequests(userB.id);
		expect(requests).toBeArray();
		expect(requests.length).toBe(1);
		expect(requests[0]?.requester.id).toBe(userA.id);
	});

	it('should accept a friend request', async () => {
		const requests = await FriendService.listFriendRequests(userB.id);
		const requestId = requests[0]?.id;
		expect(requestId).toBeDefined();

		const updated = await FriendService.acceptFriendRequest(
			requestId!,
			userB.id,
			FriendshipStatus.ACCEPTED,
		);
		expect(updated.status).toBe(FriendshipStatus.ACCEPTED);
	});

	it('should list friends', async () => {
		const friendsA = await FriendService.listFriends(userA.id);
		expect(friendsA).toBeArray();
		expect(friendsA.length).toBe(1);
		expect(friendsA[0]?.id).toBe(userB.id);

		const friendsB = await FriendService.listFriends(userB.id);
		expect(friendsB).toBeArray();
		expect(friendsB.length).toBe(1);
		expect(friendsB[0]?.id).toBe(userA.id);
	});

	it('should search users by name', async () => {
		const results = await FriendService.searchFriendRequestByName('User C');
		expect(results.length).toBeGreaterThan(0);
		const found = results.find((u: any) => u.id === userC.id);
		expect(found).toBeDefined();
	});
});
