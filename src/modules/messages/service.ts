import { createSystemPrompt, type PatientInfo } from '../../common/gemini';
import { prisma } from '../../common/prisma';
import { aiQueue } from '../../common/queue';
import { dragonfly } from '../../common/dragonfly';
import { exception, http, httpCodes } from '../../common/request';
import { genSnow } from '../../common/snow';

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
		}));
	}

	public static async send(chatId: bigint, userId: bigint, content: string) {
		try {
			const chat = await this.getAuthorizedChat(chatId, userId);
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

			await Promise.all([
				prisma.chat.update({
					where: { id: chatId },
					data: { updatedAt: new Date() },
				}),
				dragonfly.del(`user:${chat.userId}:chats`),
			]).catch((err) => console.error('Erro ao atualizar chat/cache:', err));

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
						startDate: 'Desconhecida',
						endDate: 'o momento atual',
					},
				],
			};
			const systemInstruction = createSystemPrompt(personaInfo);

			console.log(`[Queue] Adding job for Chat ${chatId}`);

			await aiQueue.add('generate-response', {
				chatId: chatId.toString(),
				history: formattedHistory,
				systemInstruction,
				lastUserMessage: content,
			});

			console.log('[Queue] Job added successfully');

			return {
				status: 'queued',
				userMessageId: userMessageId.toString(),
			};
		} catch (error: any) {
			console.error('[MessageService] Error sending message:', error);

			if (error?.status) throw error;

			throw new Error(`Failed to process message: ${error.message}`);
		}
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
