import { afterAll, describe, expect, it } from 'bun:test';
import { prisma } from 'src/common/prisma';
import { SessionService } from './service';

describe('SessionService', () => {
	const email = `magic-link-${Date.now()}@test.com`;
	let userId: bigint | undefined;

	afterAll(async () => {
		if (userId) {
			await prisma.session.deleteMany({
				where: { userId },
			});
			await prisma.user.deleteMany({
				where: { id: userId },
			});
		}
	});

	it('should sign up with a magic link token', async () => {
		const { token } = await SessionService.requestMagicLink({
			email,
			intent: 'signup',
		});

		const session = await SessionService.verifyMagicLink({
			token,
			ip: '127.0.0.1',
			os: 'Test OS',
			browser: 'Test Browser',
		});

		expect(session.intent).toBe('signup');
		expect(typeof session.access).toBe('string');
		expect(typeof session.refresh).toBe('string');
		expect(session.user.email).toBe(email);

		userId = session.user.id;

		const persistedUser = await prisma.user.findUnique({
			where: { email },
			select: { id: true, email: true },
		});
		expect(persistedUser?.id).toBe(userId);
	});

	it('should log in an existing user with a magic link token', async () => {
		expect(userId).toBeDefined();

		const { token } = await SessionService.requestMagicLink({
			email,
			intent: 'login',
		});

		const session = await SessionService.verifyMagicLink({
			token,
			ip: '127.0.0.1',
			os: 'Test OS',
			browser: 'Test Browser',
		});

		expect(session.intent).toBe('login');
		expect(session.user.id).toBe(userId!);

		const sessions = await prisma.session.count({
			where: { userId: userId! },
		});
		expect(sessions).toBeGreaterThan(0);
	});
});
