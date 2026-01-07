import { t } from 'elysia';
import { app } from '../../app';
import { SessionService } from './service';
import { prisma } from '../../common/prisma';
import { dragonfly, FIVE_MINUTES_IN_SECONDS } from '../../common/dragonfly';
import { Auth, FIFTEEN_DAYS_IN_MS, FIFTEEN_MIN_IN_MS } from '../../config/auth';
import { mail } from '../../common/mail';
import { SessionModel } from './model';
import { ID_SCHEMA } from '../../common/snow';
import { isProd } from '../../entry';
import { http, httpCodes, exception } from '../../common/request';
import { env } from '../../common/env';

export const route = (elysia: typeof app) => {
	elysia.group('/sessions', (group) => {
		group.post(
			'/signup',
			async ({ body, request, set }) => {
				await Auth.verifyAgent(request.headers.get('user-agent') || '');

				const { email } = body;
				const PENDING_KEY = `signup:${email}`;
				const isPending = await dragonfly.get(PENDING_KEY);

				if (isPending) {
					throw exception(
						httpCodes[http.BadRequest],
						http.BadRequest,
						'A magic link has already been sent to this email. Please check your inbox.',
					);
				}

				const hasEmailTaken = await prisma.user.findUnique({
					where: { email },
					select: { id: true },
				});

				if (hasEmailTaken) {
					throw exception(httpCodes[http.BadRequest], http.BadRequest, {
						message: 'Email already taken',
					});
				}

				const token = SessionService.genMagicToken();
				const SIGNUP_DATA_KEY = `signup:${token}`;
				const magicLink = new URL(
					`/sessions/verify?token=${token}`,
					env.APP_URL,
				);

				await Promise.all([
					dragonfly.setex(SIGNUP_DATA_KEY, FIVE_MINUTES_IN_SECONDS, email),
					dragonfly.setex(PENDING_KEY, FIVE_MINUTES_IN_SECONDS, '1'),
					mail({
						to: email,
						subject: 'Welcome to Comprehend Me - Verify your email',
						text: `Click this link to complete your signup: <a href="${magicLink.href}">Verify Email</a>. This link will expire in 5 minutes.`,
					}),
				]);

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
			async ({ redirect, query, request, cookie, ip, set }) => {
				const { token } = query;
				if (!token)
					throw exception(httpCodes[http.BadRequest], http.BadRequest, {
						message: 'Missing token.',
					});

				const { os, browser } = await Auth.verifyAgent(
					request.headers.get('user-agent') || '',
				);

				const { access, refresh } = await SessionService.signup({
					token,
					os,
					browser,
					ip,
				});

				cookie.refresh.set({
					value: refresh,
					httpOnly: true,
					secure: isProd,
					maxAge: FIFTEEN_DAYS_IN_MS,
				});

				cookie.access.set({
					value: access,
					httpOnly: true,
					secure: isProd,
					maxAge: FIFTEEN_MIN_IN_MS,
				});

				set.status = 201;
				return;
			},
			{
				query: t.Object({
					token: t.String(),
				}),
				detail: {
					summary: 'Verify Signup Token',
					description:
						'Verifies the magic link token to complete the signup process.',
					tags: ['Sessions'],
				},
			},
		);

		group.post(
			'/login',
			async ({ body, request, cookie, ip, set }) => {
				try {
					const { os, browser } = await Auth.verifyAgent(
						request.headers.get('user-agent') || '',
					);

					const { access, refresh } = await SessionService.login({
						...body,
						os,
						browser,
						ip,
					});

					cookie.refresh.set({
						value: refresh,
						httpOnly: true,
						secure: isProd,
						maxAge: FIFTEEN_DAYS_IN_MS,
					});

					cookie.access.set({
						value: access,
						httpOnly: true,
						secure: isProd,
						maxAge: FIFTEEN_MIN_IN_MS,
					});

					set.status = httpCodes[http.Success];
				} catch (e: any) {
					throw exception(httpCodes[http.Unauthorized], http.Unauthorized, {
						message: e.message,
					});
				}
			},
			{
				body: t.Object({ email: t.String({ format: 'email' }) }),
				detail: {
					summary: 'User Login',
					description: 'Logs in a user and returns session tokens.',
					tags: ['Sessions'],
				},
			},
		);

		group.post(
			'/refresh',
			async ({ cookie, set }) => {
				try {
					const { access, refresh } = await SessionService.refresh(
						cookie.refresh.value,
					);

					cookie.refresh.set({
						value: refresh,
						httpOnly: true,
						secure: isProd,
						maxAge: FIFTEEN_DAYS_IN_MS,
					});

					cookie.access.set({
						value: access,
						httpOnly: true,
						secure: isProd,
						maxAge: FIFTEEN_MIN_IN_MS,
					});

					set.status = httpCodes[http.Success];
				} catch (e) {
					throw exception(httpCodes[http.Unauthorized], http.Unauthorized, {
						//@ts-expect-error
						message: e.message,
					});
				}
			},
			{
				cookie: t.Object({
					access: t.String(),
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
				const { id } = params;

				const me = await prisma.session.findFirst({
					where: { userId: user?.id, id },
					select: {
						userId: true,
						os: true,
						browser: true,
					},
				});

				if (!me) throw exception(httpCodes[http.NotFound], http.NotFound);

				set.status = httpCodes[http.Success];
				return me;
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
				try {
					await SessionService.logout(cookie.refresh.value);

					cookie.access.remove();
					cookie.refresh.remove();

					set.status = httpCodes[http.Success];
				} catch (e: any) {
					throw exception(httpCodes[http.Unauthorized], http.Unauthorized, {
						message: e.message,
					});
				}
			},
			{
				cookie: t.Object({
					access: t.String(),
					refresh: t.String(),
				}),
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

					const { access, refresh } = await SessionService.handleAuth0Callback({
						code: query.code as string,
						ip,
						os,
						browser,
					});

					cookie.refresh.set({
						value: refresh,
						httpOnly: true,
						secure: isProd,
						maxAge: FIFTEEN_DAYS_IN_MS,
					});

					cookie.access.set({
						value: access,
						httpOnly: true,
						secure: isProd,
						maxAge: FIFTEEN_MIN_IN_MS,
					});

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
					state: t.String(),
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
