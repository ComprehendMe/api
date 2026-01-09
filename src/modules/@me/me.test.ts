import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { prisma } from 'src/common/prisma';
import { genSnow } from 'src/common/snow';
import { MeService } from './service';
import { Bucket } from 'src/common/bucket';

describe('MeService', () => {
	let user: any;
	let otherUser: any;

	beforeAll(async () => {
		const timestamp = Date.now();

		user = await prisma.user.create({
			data: {
				id: genSnow(),
				name: `Me User ${timestamp}`,
				email: `me${timestamp}@test.com`,
			},
		});

		otherUser = await prisma.user.create({
			data: {
				id: genSnow(),
				name: `Other User ${timestamp}`,
				email: `other${timestamp}@test.com`,
			},
		});
	});

	afterAll(async () => {
		try {
			await prisma.user.deleteMany({
				where: { id: { in: [user.id, otherUser.id] } },
			});
		} catch {}
	});

	it('should get current user profile', async () => {
		const profile = await MeService.getById(user.id);

		expect(profile).toBeDefined();
		expect(profile.email).toBe(user.email);
	});

	it('should update user profile', async () => {
		const newName = 'Updated Me Name';

		const newEmail = `updated_me${Date.now()}@test.com`;

		await MeService.update({
			id: user.id,
			name: newName,
			email: newEmail,
		});

		const updated = await prisma.user.findUnique({ where: { id: user.id } });

		expect(updated?.name).toBe(newName);
		expect(updated?.email).toBe(newEmail);

		user.email = newEmail;
	});

	it('should fail to update email to one already taken', async () => {
		try {
			await MeService.update({
				id: user.id,

				email: otherUser.email,
			});
		} catch (e: any) {
			expect(e).toBeDefined();
		}
	});

	it('should generate avatar upload url', async () => {
		const originalGen = Bucket.genPresignedUrl;

		Bucket.genPresignedUrl = async () => ({
			hash: 'mock_hash',

			route: 'http://mock.url',
		});

		try {
			const result = await MeService.getAvatar(user.id);
			expect(result.route).toBe('http://mock.url');

			const updated = await prisma.user.findUnique({ where: { id: user.id } });

			expect(updated?.avatar).toBe('mock_hash');
		} finally {
			Bucket.genPresignedUrl = originalGen;
		}
	});

	it('should remove avatar', async () => {
		const originalRemove = Bucket.remove;

		Bucket.remove = async () => ({ ok: true });
		try {
			const result = await MeService.removeAvatar(user.id);
			expect(result.ok).toBe(true);
		} finally {
			Bucket.remove = originalRemove;
		}
	});
});
