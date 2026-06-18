import { Queue, Worker } from 'bullmq';
import { env } from './env';
import { askGemini, GeminiConfigurationError } from './gemini';
import { isGeminiAuthError } from './gemini-key';
import { prisma } from './prisma';
import { genSnow } from './snow';
import { ReviewService } from '../modules/review/service';

const connection = {
	host: env.REDIS_HOST,
	port: env.REDIS_PORT,
	password: env.REDIS_PASSWORD || undefined,
	tls: env.REDIS_PASSWORD ? {} : undefined,
};

export const AI_QUEUE_NAME = 'ai-queue';
export const aiQueue = new Queue(AI_QUEUE_NAME, {
	connection,
	defaultJobOptions: {
		attempts: 5,
		backoff: {
			type: 'exponential',
			delay: 2000,
		},
		removeOnComplete: true,
	},
});

export const worker = new Worker(
	AI_QUEUE_NAME,
	async (job) => {
		try {
			if (job.name === 'generate-review') {
				const { chatId } = job.data;
				await ReviewService.generateReviewForChat(BigInt(chatId));
				return { ok: true };
			}

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
					chatId: BigInt(chatId),
					role: 'model',
					content: response,
				},
			});

			if (env.NODE_ENV === 'development')
				console.log(`[WORKER] message ${messageId} saved!!`);

			return { ok: true };
		} catch (error) {
			if (error instanceof GeminiConfigurationError || isGeminiAuthError(error)) {
				console.error(
					'[WORKER] Gemini API key is missing or invalid. Set GEMINI_API_KEY in api/.env (https://aistudio.google.com/apikey).',
				);
			} else {
				console.error('[WORKER] AI job failed:', error);
			}

			const chatId = (job.data as any)?.chatId as string | undefined;
			if (chatId) {
				const isLastAttempt =
					job.attemptsMade >= (job.opts.attempts || 5) - 1;
				if (isLastAttempt && (error as any)?.status === 503) {
					await prisma.message
						.updateMany({
							where: {
								chatId: BigInt(chatId),
								role: 'user',
								status: 'DELIVERED',
							},
							data: { status: 'FAILED' },
						})
						.catch(() => {});
				}
			}

			throw error;
		}
	},
	{ connection },
);

export async function queueReviewGeneration(chatId: bigint) {
	await aiQueue.add(
		'generate-review',
		{ chatId: chatId.toString() },
		{
			jobId: `review-${chatId.toString()}`,
		},
	);
}
