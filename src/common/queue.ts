import { ReviewService } from '../modules/review/service';

export async function queueReviewGeneration(chatId: bigint, language = 'en') {
	await ReviewService.generateReviewForChat(chatId, undefined, language);
}
