import { t } from 'elysia';

export namespace SessionModel {
	export const SIGNUP_SCHEMA = t.Object({
		email: t.String({ format: 'email' }),
		name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
		dateOfBirth: t.Optional(t.String({ format: 'date' })),
		college: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
		referralSource: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
	});

	export const ONBOARDING_SCHEMA = t.Object({
		dateOfBirth: t.String({ format: 'date' }),
		college: t.String({ minLength: 1, maxLength: 200 }),
		referralSource: t.String({ minLength: 1, maxLength: 100 }),
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
