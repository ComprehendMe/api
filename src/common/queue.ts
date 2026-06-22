import { ReviewService } from '../modules/review/service';

export async function queueReviewGeneration(chatId: bigint) {
	try {
		await ReviewService.generateReviewForChat(chatId);
	} catch (error) {
		console.error('[queue] Review generation failed:', error);
	}
}
