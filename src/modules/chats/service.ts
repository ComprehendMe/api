import { prisma } from '../../common/prisma';
import { exception, http, httpCodes } from '../../common/request';
import { dragonfly, FIVE_MINUTES_IN_SECONDS } from '../../common/dragonfly';
import { genSnow } from '../../common/snow';

type CreateChat = {
	userId: bigint;
	patientId: bigint;
	title?: string;
};

export class ChatService {
	public static async create(body: CreateChat) {
		const { userId, patientId, title } = body;
		const patient = await prisma.patient.findUnique({
			where: { id: patientId },
		});

		if (!patient) {
			throw exception(httpCodes[http.NotFound], http.NotFound, {
				message: 'Patient not found',
			});
		}

		const chat = await prisma.chat.create({
			data: {
				id: genSnow(),
				userId,
				patientId,
				title: title?.trim() || `Session with ${patient.name}`,
			},
			include: {
				patient: true,
			},
		});

		await dragonfly.del(this.getUserChatsCacheKey(userId));

		return this.serializeChat(chat);
	}

	public static async list(userId: bigint) {
		const cacheKey = this.getUserChatsCacheKey(userId);
		const cached = await dragonfly.get<any[]>(cacheKey);
		if (cached) return cached;

		const chats = await prisma.chat.findMany({
			where: { userId },
			include: { patient: true },
			orderBy: { updatedAt: 'desc' },
		});

		const serialized = chats.map((chat) => this.serializeChat(chat));

		await dragonfly.setex(cacheKey, FIVE_MINUTES_IN_SECONDS, serialized);
		return serialized;
	}

	public static async getById(userId: bigint, chatId: bigint) {
		const chat = await prisma.chat.findFirst({
			where: {
				id: chatId,
				userId,
			},
			include: {
				patient: true,
			},
		});

		if (!chat) {
			throw exception(httpCodes[http.NotFound], http.NotFound, {
				message: 'Chat not found',
			});
		}

		return this.serializeChat(chat);
	}

	public static async delete(userId: bigint, chatId: bigint) {
		const chat = await prisma.chat.findFirst({
			where: {
				id: chatId,
				userId,
			},
			select: {
				id: true,
				userId: true,
			},
		});

		if (!chat) {
			throw exception(httpCodes[http.NotFound], http.NotFound, {
				message: 'Chat not found',
			});
		}

		await prisma.$transaction([
			prisma.message.deleteMany({
				where: { chatId: chat.id },
			}),
			prisma.report.deleteMany({
				where: { chatId: chat.id },
			}),
			prisma.chat.delete({
				where: { id: chat.id },
			}),
		]);

		await dragonfly.del(this.getUserChatsCacheKey(chat.userId));
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
			orderBy: { updatedAt: 'desc' },
		});

		return chats.map((chat) => this.serializeChat(chat));
	}

	private static serializeChat(chat: any) {
		return {
			...chat,
			id: chat.id.toString(),
			userId: chat.userId.toString(),
			patientId: chat.patientId.toString(),
			patient: {
				...chat.patient,
				id: chat.patient.id.toString(),
			},
		};
	}

	private static getUserChatsCacheKey(userId: bigint) {
		return `user:${userId}:chats`;
	}
}
