import { ReviewService } from '../modules/review/service';

export async function queueReviewGeneration(chatId: bigint) {
	await ReviewService.generateReviewForChat(chatId);
}
