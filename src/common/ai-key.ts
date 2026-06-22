export function isPlausibleApiKey(key: string): boolean {
	return /^(gsk_)[\w-]{20,}$/.test(key);
}

export function isAuthError(error: unknown): boolean {
	const message =
		error instanceof Error
			? error.message
			: typeof error === 'string'
				? error
				: JSON.stringify(error);
	return /API_KEY_INVALID|API key not valid|401|unauthorized/i.test(message);
}
