import { FriendshipStatus } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { prisma } from 'src/common/prisma';
import { genSnow } from 'src/common/snow';
import { Auth } from 'src/config/auth';
import { FriendService } from './service';

type User = { email: string; name: string };

const createUser = async ({ email, name }: User) => {
	const user = await prisma.user.create({
		data: {
			id: genSnow(),
			email,
			name,
		},
	});

	const { hash } = Auth.genRefreshToken();
	await prisma.session.create({
		data: {
			id: genSnow(),
			userId: user.id,
			ip: '127.0.0.1',
			os: 'test',
			hash,
			expiresAt: new Date(Date.now() + 86_400_000),
		},
	});

	return user;
};

describe('FriendService', () => {
	let userA: Awaited<ReturnType<typeof createUser>>;
	let userB: Awaited<ReturnType<typeof createUser>>;
	let userC: Awaited<ReturnType<typeof createUser>>;

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
			await prisma.session.deleteMany({
				where: {
					userId: { in: [userA.id, userB.id, userC.id] },
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
		const result = await FriendService.requestFriend(userA.id, userB.id);
		expect(result.ok).toBe(true);
		expect(result.request.requester.id).toBe(userA.id.toString());
	});

	it('should fail to send a duplicate friend request', async () => {
		try {
			await FriendService.requestFriend(userA.id, userB.id);
			expect(true).toBe(false);
		} catch {
			expect(true).toBe(true);
		}
	});

	it('should fail to send request to self', async () => {
		try {
			await FriendService.requestFriend(userA.id, userA.id);
			expect(true).toBe(false);
		} catch {
			expect(true).toBe(true);
		}
	});

	it('should list friend requests', async () => {
		const requests = await FriendService.listFriendRequests(userB.id);
		expect(requests).toBeArray();
		expect(requests.length).toBe(1);
		expect(requests[0]?.requester.id).toBe(userA.id.toString());
	});

	it('should accept a friend request', async () => {
		const requests = await FriendService.listFriendRequests(userB.id);
		const requestId = BigInt(requests[0]!.id);
		expect(requestId).toBeDefined();

		const updated = await FriendService.acceptFriendRequest(
			requestId,
			userB.id,
			FriendshipStatus.ACCEPTED,
		);
		expect(updated.status).toBe(FriendshipStatus.ACCEPTED);
	});

	it('should list friends', async () => {
		const friendsA = await FriendService.listFriends(userA.id);
		expect(friendsA).toBeArray();
		expect(friendsA.length).toBe(1);
		expect(friendsA[0]?.id).toBe(userB.id.toString());

		const friendsB = await FriendService.listFriends(userB.id);
		expect(friendsB).toBeArray();
		expect(friendsB.length).toBe(1);
		expect(friendsB[0]?.id).toBe(userA.id.toString());
	});

	it('should search users by name', async () => {
		const results = await FriendService.searchUsersByName('User C', userA.id);
		expect(results.length).toBeGreaterThan(0);
		const found = results.find((u) => u.id === userC.id.toString());
		expect(found).toBeDefined();
	});
});
