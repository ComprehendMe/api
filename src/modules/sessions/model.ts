import { t } from 'elysia';

export namespace SessionModel {
	export const SIGNUP_SCHEMA = t.Object({
		email: t.String({ format: 'email' }),
	});

	export const SIGNUP_STEP_2_RESPONSE = t.Void();
	export const SIGNUP_STEP_1_RESPONSE = t.Object({
		status: t.Number(),
		body: t.Object({
			message: t.Optional(t.String()),
			ok: t.Boolean(),
		}),
	});

	export const LOGIN_SCHEMA = t.Object({
		email: t.String({ format: 'email' }),
	});
	export type Provider = 'google';

	export type PayloadOptions = {
		email: string;
		firstName: string;
		lastName: string;
	};

	export type SignupOptions = {
		token: string;
		ip: string;
		os: string;
		browser: string;
	};

	export type LoginOptions = {
		email: string;
		ip: string;
		os: string;
		browser: string;
	};
}
