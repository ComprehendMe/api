import { Queue, Worker } from 'bullmq';
import { env } from './env';
import { askGemini } from './gemini';
import { prisma } from './prisma';
import { genSnow } from './snow';

const connection = {
	host: env.REDIS_HOST,
	port: env.REDIS_PORT,
};

export const AI_QUEUE_NAME = 'ai-queue';
export const aiQueue = new Queue(AI_QUEUE_NAME, {
	connection,
	defaultJobOptions: {
		attempts: 3,
		backoff: {
			type: 'exponential',
			delay: 1000,
		},
		removeOnComplete: true,
	},
});

const worker = new Worker(AI_QUEUE_NAME, async (job) => {
	try {
		const { chatId, lastUserMessage, systemInstruction, history } = job.data;

		const response = await askGemini(
			systemInstruction,
			history,
			lastUserMessage,
		);

		if (!response) throw new Error('Empty response for AI');
		const messageId = genSnow();

		await prisma.message.create({
			data: {
				id: messageId,
				chatId,
				role: 'model',
				content: response,
			},
		});

		if (env.NODE_ENV === 'development')
			console.log(`[WORKER] message ${messageId} saved!!`);

		return { ok: true };
	} catch (error) {
		console.log(error);
		throw error;
	}
});
