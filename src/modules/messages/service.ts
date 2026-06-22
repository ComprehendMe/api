import { askGemini, createSystemPrompt, type PatientInfo, AiConfigurationError } from '../../common/ai';
import { prisma } from '../../common/prisma';
import { dragonfly } from '../../common/dragonfly';
import { exception, http, httpCodes } from '../../common/request';
import { genSnow, getSnowCreation } from '../../common/snow';
import { StatsService } from '../stats/service';

export class MessageService {
	public static async list(chatId: bigint, userId: bigint) {
		await this.getAuthorizedChat(chatId, userId);

		const messages = await prisma.message.findMany({
			where: { chatId },
			orderBy: { id: 'asc' },
		});

		return messages.map((msg) => ({
			...msg,
			id: msg.id.toString(),
			chatId: msg.chatId.toString(),
			createdAt: new Date(getSnowCreation(msg.id)).toISOString(),
		}));
	}

	public static async send(chatId: bigint, userId: bigint, content: string) {
		try {
			const chat = await this.getAuthorizedChat(chatId, userId);

			if (chat.endedAt) {
				throw exception(httpCodes[http.BadRequest], http.BadRequest, {
					message: 'This conversation has ended',
				});
			}
			const patient = chat.patient as typeof chat.patient & {
				age: number;
				nationality: string;
			};

			const userMessageId = genSnow();
			await prisma.message.create({
				data: {
					id: userMessageId,
					chatId,
					role: 'user',
					content,
					status: 'DELIVERED',
				},
			});

			await StatsService.recordMessage(userId).catch((err) =>
				console.error('Stats record failed:', err),
			);

			await Promise.all([
				prisma.chat.update({
					where: { id: chatId },
					data: { updatedAt: new Date(), pausedAt: null },
				}),
				dragonfly.del(`user:${chat.userId}:chats`),
			]).catch((err) => console.error('Erro ao atualizar chat/cache:', err));

			// Fire-and-forget: AI reply generation runs in background
			this.generateAiReply(chatId, patient, content).catch((err) =>
				console.error('[Messages] Background AI reply failed:', err),
			);

			return {
				status: 'sent',
				userMessageId: userMessageId.toString(),
			};
		} catch (error: any) {
			console.error('[MessageService] Error sending message:', error);

			if (error instanceof AiConfigurationError) {
				throw exception(httpCodes[http.InternalServerError], http.InternalServerError, {
					message: error.message,
				});
			}

			if (error?.status) throw error;

			throw new Error(`Failed to process message: ${error.message}`);
		}
	}

	private static async generateAiReply(
		chatId: bigint,
		patient: { name: string; age: number; nationality: string; problem: string },
		content: string,
	) {
		const recentHistory = await prisma.message.findMany({
			where: { chatId },
			orderBy: { id: 'desc' },
			take: 20,
		});
		const history = recentHistory.reverse();

		const formattedHistory = history.map((msg) => ({
			role: msg.role,
			parts: [{ text: msg.content }],
		}));

		const personaInfo: PatientInfo = {
			name: patient.name,
			age: patient.age,
			nacionality: patient.nationality,
			problems: [
				{
					name: patient.problem,
					startDate: 'Unknown',
					endDate: 'ongoing',
				},
			],
		};
		const systemInstruction = createSystemPrompt(personaInfo);

		console.log(`[Messages] Calling AI for Chat ${chatId}`);

		const response = await askGemini(
			systemInstruction,
			formattedHistory,
			content,
		);

		const modelMessageId = genSnow();
		await prisma.message.create({
			data: {
				id: modelMessageId,
				chatId,
				role: 'model',
				content: response || '',
			},
		});

		console.log('[Messages] Model response saved');
	}

	private static async getAuthorizedChat(chatId: bigint, userId: bigint) {
		const chat = await prisma.chat.findFirst({
			where: {
				id: chatId,
				userId,
			},
			include: { patient: true },
		});

		if (!chat) {
			throw exception(httpCodes[http.NotFound], http.NotFound, {
				message: 'Chat not found',
			});
		}

		return chat;
	}
}
