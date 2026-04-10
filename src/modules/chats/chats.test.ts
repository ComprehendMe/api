import { Difficulty } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { prisma } from 'src/common/prisma';
import { genSnow } from 'src/common/snow';
import { MessageService } from '../messages/service';
import { ChatService } from './service';

describe('ChatService', () => {
	let userA: { id: bigint };
	let userB: { id: bigint };
	let patient: { id: bigint; name: string };
	let chatId: bigint;

	beforeAll(async () => {
		const timestamp = Date.now();

		userA = await prisma.user.create({
			data: {
				id: genSnow(),
				email: `chat-user-a-${timestamp}@test.com`,
				name: 'Chat User A',
			},
			select: { id: true },
		});

		userB = await prisma.user.create({
			data: {
				id: genSnow(),
				email: `chat-user-b-${timestamp}@test.com`,
				name: 'Chat User B',
			},
			select: { id: true },
		});

		patient = await prisma.patient.create({
			data: {
				id: genSnow(),
				name: 'Patricia Example',
				problem: 'Anxiety',
				age: 32,
				nationality: 'Portuguese',
				difficulty: Difficulty.MEDIUM,
			},
			select: { id: true, name: true },
		});
	});

	afterAll(async () => {
		const userIds = [userA?.id, userB?.id].filter(
			(id): id is bigint => typeof id === 'bigint',
		);

		if (chatId) {
			await prisma.message.deleteMany({
				where: { chatId },
			});
			await prisma.report.deleteMany({
				where: { chatId },
			});
			await prisma.chat.deleteMany({
				where: { id: chatId },
			});
		}

		if (patient?.id) {
			await prisma.patient.deleteMany({
				where: { id: patient.id },
			});
		}

		if (userIds.length > 0) {
			await prisma.session.deleteMany({
				where: { userId: { in: userIds } },
			});
			await prisma.user.deleteMany({
				where: { id: { in: userIds } },
			});
		}
	});

	it('should create, list and fetch a chat with a patient', async () => {
		const chat = await ChatService.create({
			userId: userA.id,
			patientId: patient.id,
		});

		expect(chat.id).toBeDefined();
		expect(chat.patient.id).toBe(patient.id.toString());
		expect(chat.title).toContain(patient.name);

		chatId = BigInt(chat.id);

		const chats = await ChatService.list(userA.id);
		expect(chats.some((entry) => entry.id === chat.id)).toBe(true);

		const storedChat = await ChatService.getById(userA.id, chatId);
		expect(storedChat.id).toBe(chat.id);
		expect(storedChat.patient.name).toBe(patient.name);
	});

	it('should list chat history only for the owner', async () => {
		await prisma.message.createMany({
			data: [
				{
					id: genSnow(),
					chatId,
					role: 'user',
					content: 'Hello',
				},
				{
					id: genSnow(),
					chatId,
					role: 'model',
					content: 'Hi there',
				},
			],
		});

		const history = await MessageService.list(chatId, userA.id);
		expect(history.length).toBe(2);
		expect(history[0]?.role).toBe('user');
		expect(history[1]?.role).toBe('model');

		try {
			await MessageService.list(chatId, userB.id);
			throw new Error('Expected ownership validation to fail');
		} catch (error) {
			expect(error).toBeDefined();
		}
	});

	it('should delete a chat and its messages', async () => {
		await ChatService.delete(userA.id, chatId);

		const storedChat = await prisma.chat.findUnique({
			where: { id: chatId },
		});
		const messageCount = await prisma.message.count({
			where: { chatId },
		});

		expect(storedChat).toBeNull();
		expect(messageCount).toBe(0);
	});
});
