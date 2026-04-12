import { t } from 'elysia';
import type { app } from '../../app';
import { env } from '../../common/env';
import { mail } from '../../common/mail';
import { exception, http, httpCodes } from '../../common/request';
import { ID_SCHEMA } from '../../common/snow';
import {
	loginTemplate,
	signupTemplate,
} from '../../common/templates/mail';
import { Auth, FIFTEEN_DAYS_IN_MS, FIFTEEN_MIN_IN_MS } from '../../config/auth';
import { isProd } from '../../entry';
import { SessionModel } from './model';
import { SessionService } from './service';

const setSessionCookies = (
	cookie: Record<string, any>,
	{
		access,
		refresh,
	}: {
		access: string;
		refresh: string;
	},
) => {
	if (!cookie.refresh || !cookie.access) {
		throw new Error('Cookie store is not available');
	}

	cookie.refresh.set({
		value: refresh,
		httpOnly: true,
		secure: isProd,
		path: '/',
		sameSite: 'lax',
		expires: new Date(Date.now() + FIFTEEN_DAYS_IN_MS),
	});

	cookie.access.set({
		value: access,
		httpOnly: true,
		secure: isProd,
		path: '/',
		sameSite: 'lax',
		expires: new Date(Date.now() + FIFTEEN_MIN_IN_MS),
	});
};

export const route = (elysia: typeof app) => {
	elysia.group('/sessions', (group) => {
		group.post(
			'/signup',
			async ({ body, request, set }) => {
				await Auth.verifyAgent(request.headers.get('user-agent') || '');

				const { token } = await SessionService.requestMagicLink({
					email: body.email,
					intent: 'signup',
				});
				const magicLink = new URL(`/sessions/verify?token=${token}`, env.APP_URL);

				await mail({
					to: body.email,
					subject: 'Welcome to Comprehend Me - Verify your email',
					html: signupTemplate(magicLink.href),
					text: `Verify your email by clicking here: ${magicLink.href}`,
				});

				set.status = httpCodes[http.Created];
				return { ok: true, message: 'Magic link sent to your email.' };
			},
			{
				body: SessionModel.SIGNUP_SCHEMA,
				detail: {
					summary: 'User Signup',
					description:
						"Initiates the signup process by sending a magic link to the user's email.",
					tags: ['Sessions'],
				},
			},
		);

		group.get(
			'/verify',
			async ({ query, request, cookie, ip, set }) => {
				const { token } = query;
				if (!token) {
					throw exception(httpCodes[http.BadRequest], http.BadRequest, {
						message: 'Missing token.',
					});
				}

				const { os, browser } = await Auth.verifyAgent(
					request.headers.get('user-agent') || '',
				);

				const session = await SessionService.verifyMagicLink({
					token,
					os,
					browser,
					ip,
				});

				setSessionCookies(cookie, session);

				set.status = httpCodes[http.Created];
				return {
					ok: true,
					intent: session.intent,
					user: {
						id: session.user.id.toString(),
						email: session.user.email,
					},
				};
			},
			{
				query: t.Object({
					token: t.String(),
				}),
				detail: {
					summary: 'Verify Signup Token',
					description:
						'Verifies the magic link token to complete the signup or login process.',
					tags: ['Sessions'],
				},
			},
		);

		group.post(
			'/login',
			async ({ body, request, set }) => {
				await Auth.verifyAgent(request.headers.get('user-agent') || '');

				const { token } = await SessionService.requestMagicLink({
					email: body.email,
					intent: 'login',
				});
				const magicLink = new URL(`/sessions/verify?token=${token}`, env.APP_URL);

				await mail({
					to: body.email,
					subject: 'Your Comprehend Me magic link',
					html: loginTemplate(magicLink.href),
					text: `Sign in by clicking here: ${magicLink.href}`,
				});

				set.status = httpCodes[http.Success];
				return { ok: true, message: 'Magic link sent to your email.' };
			},
			{
				body: SessionModel.SIGNUP_SCHEMA,
				detail: {
					summary: 'User Login',
					description: 'Sends a magic link to authenticate an existing user.',
					tags: ['Sessions'],
				},
			},
		);

		group.post(
			'/refresh',
			async ({ cookie, set }) => {
				try {
					const session = await SessionService.refresh(
						typeof cookie.refresh?.value === 'string'
							? cookie.refresh.value
							: undefined,
					);
					setSessionCookies(cookie, session);

					set.status = httpCodes[http.Success];
					return { ok: true };
				} catch (e: any) {
					throw exception(httpCodes[http.Unauthorized], http.Unauthorized, {
						message: e.message,
					});
				}
			},
			{
				cookie: t.Object({
					refresh: t.String(),
				}),
				detail: {
					summary: 'Refresh Access Token',
					description:
						'Refreshes an expired access token using a valid refresh token.',
					tags: ['Sessions'],
				},
			},
		);

		group.get(
			'/:id',
			async ({ user, params, set }) => {
				if (!user) throw new Error('Unauthorized');

				const { id } = params;

				const me = await SessionService.list(user.id);
				const session = me.find((item) => item.id === id);

				if (!session) {
					throw exception(httpCodes[http.NotFound], http.NotFound);
				}

				set.status = httpCodes[http.Success];
				return {
					id: session.id.toString(),
					userId: session.userId.toString(),
					os: session.os,
					browser: session.browser,
					expiresAt: session.expiresAt,
				};
			},
			{
				params: t.Object({
					id: ID_SCHEMA,
				}),
				detail: {
					summary: 'Get Session by ID',
					description: 'Retrieves details for a specific user session.',
					tags: ['Sessions'],
				},
			},
		);

		group.delete(
			'/logout',
			async ({ cookie, set }) => {
				await SessionService.logout(
					typeof cookie.refresh?.value === 'string'
						? cookie.refresh.value
						: undefined,
				);

				cookie.access?.remove();
				cookie.refresh?.remove();

				set.status = httpCodes[http.Success];
				return { ok: true };
			},
			{
				detail: {
					summary: 'User Logout',
					description: 'Logs out the user by invalidating the refresh token.',
					tags: ['Sessions'],
				},
			},
		);

		group.get(
			'/oauth/google',
			async ({ set, redirect }) => {
				const url = await SessionService.authWithProvider('google');

				set.status = 307;
				return redirect(url);
			},
			{
				detail: {
					summary: 'Google OAuth Login',
					description: 'Initiates the Google OAuth2 login flow.',
					tags: ['Sessions'],
				},
			},
		);

		group.get(
			'/oauth/cb',
			async ({ query, request, cookie, ip, set }) => {
				try {
					const { os, browser } = await Auth.verifyAgent(
						request.headers.get('user-agent') || '',
					);

					const session = await SessionService.handleAuth0Callback({
						code: query.code,
						ip,
						os,
						browser,
					});

					setSessionCookies(cookie, session);

					set.status = httpCodes[http.Created];
					set.redirect = '/';
				} catch (e: any) {
					throw exception(
						httpCodes[http.InternalServerError],
						http.InternalServerError,
						{ message: e.message },
					);
				}
			},
			{
				query: t.Object({
					code: t.String(),
					state: t.Optional(t.String()),
				}),
				detail: {
					summary: 'OAuth Callback',
					description: 'Handles the callback from the OAuth provider.',
					tags: ['Sessions'],
				},
			},
		);

		return group;
	});
};
