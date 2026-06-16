import { MeService } from '../modules/@me/service';

/** Resolves stored avatar hash to public bucket URL. External URLs are ignored. */
export function resolveUserAvatarUrl(
	userId: bigint,
	avatar: string | null,
): string | null {
	if (!avatar) return null;
	if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
		return null;
	}
	return MeService.avatarPublicUrl(userId, avatar);
}
