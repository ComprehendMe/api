/** Google Gemini API keys always start with "AIza". */
export function normalizeGeminiApiKey(key: string): string {
	const trimmed = key.trim();
	// Common copy-paste typo: missing leading "A"
	if (trimmed.startsWith('IzaSy')) return `A${trimmed}`;
	return trimmed;
}

export function isPlausibleGeminiApiKey(key: string): boolean {
	return /^AIza[\w-]{20,}$/.test(key);
}

export function isGeminiAuthError(error: unknown): boolean {
	const message =
		error instanceof Error
			? error.message
			: typeof error === 'string'
				? error
				: JSON.stringify(error);
	return /API_KEY_INVALID|API key not valid/i.test(message);
}
