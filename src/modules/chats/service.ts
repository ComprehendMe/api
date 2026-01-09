import { dragonfly, FIVE_MINUTES_IN_SECONDS } from '../../common/dragonfly';
import { createSystemPrompt, type PatientInfo } from '../../common/gemini';
import { prisma } from '../../common/prisma';
import { aiQueue } from '../../common/queue';
import { genSnow } from '../../common/snow';

type CreateChat = { userId: bigint; patientId: bigint; title: string };

export class ChatService {
	public static async create(body: CreateChat) {
		const { userId, patientId, title } = body;
		const REDIS_KEY_LIST = `user:${userId}:chats`;

		const id = genSnow();
		const chat = await prisma.chat.create({
			data: {
				id,
				userId,
				patientId,
				title,
			},
		});

		await dragonfly.del(REDIS_KEY_LIST);

		return {
			...chat,
			id: chat.id.toString(),
			userId: chat.userId.toString(),
			patientId: chat.patientId.toString(),
		};
	}

	public static async list(userId: bigint) {
		const REDIS_KEY = `user:${userId}:chats`;

		const cached = await dragonfly.get(REDIS_KEY);
		if (cached) return cached;

		const chats = await prisma.chat.findMany({
			where: { userId },
			include: { patient: true },
			orderBy: { updatedAt: 'desc' },
		});

		const serialized = chats.map((chat) => ({
			...chat,
			id: chat.id.toString(),
			userId: chat.userId.toString(),
			patientId: chat.patientId.toString(),
			patient: {
				...chat.patient,
				id: chat.patient.id.toString(),
			},
		}));

		await dragonfly.setex(REDIS_KEY, FIVE_MINUTES_IN_SECONDS, serialized);
		return serialized;
	}

	public static async delete(userId: bigint, chatId: bigint) {
		const REDIS_KEY_LIST = `user:${userId}:chats`;

		await prisma.chat.delete({
			where: { id: chatId },
		});

		await dragonfly.del(REDIS_KEY_LIST);
	}

	public static async findByPatientName(userId: bigint, patientName: string) {
		const chats = await prisma.chat.findMany({
			where: {
				userId,
				patient: {
					name: { contains: patientName, mode: 'insensitive' },
				},
			},
			include: { patient: true },
		});

		return chats.map((chat) => ({
			...chat,
			id: chat.id.toString(),
			userId: chat.userId.toString(),
			patientId: chat.patientId.toString(),
			patient: {
				...chat.patient,
				id: chat.patient.id.toString(),
			},
		}));
	}
}
