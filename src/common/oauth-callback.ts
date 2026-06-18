import { env } from './env';

const OAUTH_CB_PATH = '/api/sessions/oauth/cb';

/** Dev origins that must also be registered in Auth0 Allowed Callback URLs. */
export const AUTH0_CALLBACK_URL_HINTS = [
	'http://localhost:3000/api/sessions/oauth/cb',
	'http://127.0.0.1:3000/api/sessions/oauth/cb',
] as const;

export function defaultOAuthCallbackUrl() {
	const base = env.APP_URL.replace(/\/$/, '');
	return env.AUTH0_CALLBACK_URL?.trim() || `${base}${OAUTH_CB_PATH}`;
}

function isAllowedDevOrigin(origin: string) {
	try {
		const { hostname, protocol } = new URL(origin);
		if (protocol !== 'http:' && protocol !== 'https:') return false;
		if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
		const app = new URL(env.APP_URL);
		return hostname === app.hostname;
	} catch {
		return false;
	}
}

/** Resolve callback URL from the browser origin (via proxy headers or Referer). */
export function resolveOAuthCallbackUrl(request: Request): string {
	// When AUTH0_CALLBACK_URL is explicitly set, prefer it over dynamic resolution.
	// This is essential when frontend (Vercel) and backend (Tailscale) are on different origins.
	const configured = defaultOAuthCallbackUrl();

	if (env.AUTH0_CALLBACK_URL?.trim()) {
		return env.AUTH0_CALLBACK_URL.trim();
	}

	const forwardedHost = request.headers.get('x-forwarded-host');
	const forwardedProto =
		request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'http';

	if (forwardedHost) {
		const origin = `${forwardedProto}://${forwardedHost.split(',')[0].trim()}`;
		if (isAllowedDevOrigin(origin)) {
			return `${origin}${OAUTH_CB_PATH}`;
		}
	}

	const origin = request.headers.get('origin');
	if (origin && isAllowedDevOrigin(origin)) {
		return `${origin}${OAUTH_CB_PATH}`;
	}

	const referer = request.headers.get('referer');
	if (referer) {
		try {
			const refOrigin = new URL(referer).origin;
			if (isAllowedDevOrigin(refOrigin)) {
				return `${refOrigin}${OAUTH_CB_PATH}`;
			}
		} catch {
			// ignore invalid referer
		}
	}

	return configured;
}

export function listAuth0CallbackUrlsForSetup(): string[] {
	const urls = new Set<string>([
		defaultOAuthCallbackUrl(),
		...AUTH0_CALLBACK_URL_HINTS,
	]);
	return [...urls];
}
