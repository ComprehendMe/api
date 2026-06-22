/** Google Gemini API keys start with "AIza" (legacy) or "AQ." (auth key). */
export function normalizeGeminiApiKey(key: string): string {
	const trimmed = key.trim();
	// Common copy-paste typo: missing leading "A"
	if (trimmed.startsWith('IzaSy')) return `A${trimmed}`;
	return trimmed;
}

export function isPlausibleGeminiApiKey(key: string): boolean {
	return /^(AIza|AQ\.)[\w-]{20,}$/.test(key);
}

export function isGeminiAuthError(error: unknown): boolean {
	const message =
		error instanceof Error
			? error.message
			: typeof error === 'string'
				? error
				: JSON.stringify(error);
	return /API_KEY_INVALID|API key not valid|401|unauthorized/i.test(message);
}
