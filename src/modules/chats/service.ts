import { prisma } from '../../common/prisma';
import { exception, http, httpCodes } from '../../common/request';
import { dragonfly, FIVE_MINUTES_IN_SECONDS } from '../../common/dragonfly';
import { genSnow, getSnowCreation } from '../../common/snow';
import { queueReviewGeneration } from '../../common/queue';

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
			where: {
				userId,
				messages: { some: {} },
				endedAt: null,
			},
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

	public static async listHistory(userId: bigint) {
		const chats = await prisma.chat.findMany({
			where: {
				userId,
				messages: { some: {} },
			},
			include: {
				patient: true,
				report: { select: { id: true } },
				messages: {
					orderBy: { id: 'asc' },
					select: { id: true },
				},
			},
			orderBy: { updatedAt: 'desc' },
		});

		return chats.map((chat) => {
			const messageIds = chat.messages.map((m) => m.id);
			const startedMs = messageIds.length
				? getSnowCreation(messageIds[0]!)
				: chat.updatedAt.getTime();
			const lastMs = messageIds.length
				? getSnowCreation(messageIds[messageIds.length - 1]!)
				: chat.updatedAt.getTime();
			const endMs = chat.endedAt?.getTime() ?? chat.pausedAt?.getTime() ?? lastMs;
			const durationMinutes = Math.max(
				1,
				Math.round((endMs - startedMs) / 60_000),
			);

			return {
				id: chat.id.toString(),
				chatId: chat.id.toString(),
				patientId: chat.patientId.toString(),
				name: chat.patient.name,
				problem: chat.patient.problem,
				difficulty: chat.patient.difficulty,
				endedAt: (chat.endedAt ?? chat.pausedAt ?? chat.updatedAt).toISOString(),
				pausedAt: chat.pausedAt?.toISOString() ?? null,
				durationMinutes,
				hasReport: Boolean(chat.report),
			};
		});
	}

	public static async pause(userId: bigint, chatId: bigint) {
		const chat = await this.getOwnedChat(userId, chatId);

		if (chat.endedAt) {
			throw exception(httpCodes[http.BadRequest], http.BadRequest, {
				message: 'Chat already ended',
			});
		}

		await prisma.chat.update({
			where: { id: chatId },
			data: { pausedAt: new Date() },
		});

		await dragonfly.del(this.getUserChatsCacheKey(userId));
		return { ok: true };
	}

	public static async end(userId: bigint, chatId: bigint) {
		const chat = await this.getOwnedChat(userId, chatId);

		if (chat.endedAt) {
			return { ok: true };
		}

		await ChatService.endChatWithReviewCompat(chatId);
		try {
			await queueReviewGeneration(chatId);
		} catch (error) {
			// Queue failures should not block ending the conversation.
			// If advanced review fields are available, mark as FAILED to avoid hanging PENDING state.
			const message = error instanceof Error ? error.message : 'Review enqueue failed';
			try {
				await prisma.chat.update({
					where: { id: chatId },
					data: {
						reviewStatus: 'FAILED',
						reviewError: message.slice(0, 500),
						reviewedAt: new Date(),
					},
				});
			} catch {
				// Compatibility mode: schema/client may not expose reviewStatus yet.
			}
		}

		await dragonfly.del(this.getUserChatsCacheKey(userId));
		return { ok: true };
	}

	public static async resume(userId: bigint, chatId: bigint) {
		await this.getOwnedChat(userId, chatId);

		await prisma.chat.update({
			where: { id: chatId },
			data: { pausedAt: null },
		});

		await dragonfly.del(this.getUserChatsCacheKey(userId));
		return { ok: true };
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
			prisma.messageReview.deleteMany({
				where: { chatId: chat.id },
			}),
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

	private static async getOwnedChat(userId: bigint, chatId: bigint) {
		const chat = await prisma.chat.findFirst({
			where: { id: chatId, userId },
		});

		if (!chat) {
			throw exception(httpCodes[http.NotFound], http.NotFound, {
				message: 'Chat not found',
			});
		}

		return chat;
	}

	private static serializeChat(chat: any) {
		return {
			...chat,
			id: chat.id.toString(),
			userId: chat.userId.toString(),
			patientId: chat.patientId.toString(),
			endedAt: chat.endedAt?.toISOString() ?? null,
			pausedAt: chat.pausedAt?.toISOString() ?? null,
			updatedAt: chat.updatedAt.toISOString(),
			patient: {
				...chat.patient,
				id: chat.patient.id.toString(),
			},
		};
	}

	private static getUserChatsCacheKey(userId: bigint) {
		return `user:${userId}:chats`;
	}

	private static async endChatWithReviewCompat(chatId: bigint) {
		try {
			await prisma.chat.update({
				where: { id: chatId },
				data: {
					endedAt: new Date(),
					pausedAt: null,
					reviewStatus: 'PENDING',
					reviewError: null,
				},
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (message.includes('Unknown argument reviewStatus')) {
				await prisma.chat.update({
					where: { id: chatId },
					data: {
						endedAt: new Date(),
						pausedAt: null,
					},
				});
				return;
			}
			throw error;
		}
	}
}
