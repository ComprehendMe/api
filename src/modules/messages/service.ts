import { dragonfly } from '../../common/dragonfly';
import { createSystemPrompt, type PatientInfo } from '../../common/gemini';
import { prisma } from '../../common/prisma';
import { aiQueue } from '../../common/queue';
import { genSnow } from '../../common/snow';

export class MessageService {
	public static async list(chatId: bigint) {
		const messages = await prisma.message.findMany({
			where: { chatId },
			orderBy: { id: 'asc' }, // Ordem cronológica
		});

		return messages.map((msg) => ({
			...msg,
			id: msg.id.toString(),
			chatId: msg.chatId.toString(),
		}));
	}

	public static async send(chatId: bigint, content: string) {
		const chat = await prisma.chat.findUnique({
			where: { id: chatId },
			include: { patient: true },
		});

		if (!chat) throw new Error('Chat not found');

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

		await prisma.chat.update({
			where: { id: chatId },
			data: { updatedAt: new Date() },
		});

		await dragonfly.del(`user:${chat.userId}:chats`);

		const history = await prisma.message.findMany({
			where: { chatId },
			orderBy: { id: 'asc' },
			take: 20,
		});

		const formattedHistory = history.map((msg) => ({
			role: msg.role,
			parts: [{ text: msg.content }],
		}));

		        const personaInfo: PatientInfo = {
		            name: chat.patient.name,
		            age: chat.patient.age,
		            nacionality: chat.patient.nationality,
		            problems: [
		                {
		                    name: chat.patient.problem,
		                    startDate: 'Desconhecida',
		                    endDate: 'o momento atual',
		                },
		            ],
		        };
		const systemInstruction = createSystemPrompt(personaInfo);

		await aiQueue.add('generate-response', {
			chatId: chatId.toString(),
			history: formattedHistory,
			systemInstruction,
			lastUserMessage: content,
		});

		return {
			status: 'queued',
			userMessageId: userMessageId.toString(),
		};
	}
}

