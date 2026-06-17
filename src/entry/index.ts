import openapi from '@elysiajs/openapi';
import { Elysia } from 'elysia';
import { ip } from 'elysia-ip';
import { env } from '../common/env';
import { Auth } from '../config/auth';
import '../common/queue.ts';

export const isProd = env.NODE_ENV === 'production';

const corsOrigins = [
	'http://localhost:3000',
	'http://127.0.0.1:3000',
	env.APP_URL.replace(/\/$/, ''),
	...env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean),
];

export const createApp = async () => {
	const app = new Elysia({ name: 'ComprehendMe' })
		.onRequest(({ set, request }) => {
			if (request.method === 'OPTIONS') {
				const origin = request.headers.get('origin');
				if (origin && corsOrigins.includes(origin)) {
					return new Response(null, {
						status: 204,
						headers: {
							'access-control-allow-origin': origin,
							'access-control-allow-credentials': 'true',
							'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
							'access-control-allow-headers': 'Content-Type, Authorization',
							'vary': 'Origin',
						},
					});
				}
			}
		})
		.use(ip())
		.use(
			openapi({
				path: '/docs',
				documentation: {
					info: {
						title: 'ComprehendMe API Documentation',
						version: '1.0.0',
						description: 'API documentation for the ComprehendMe project.',
					},
					tags: [
						{
							name: 'Sessions',
							description:
								'Endpoints related to user sessions and authentication.',
						},
						{
							name: 'Users',
							description: 'Endpoints related to user management.',
						},
						{
							name: 'Chats',
							description: 'Endpoints related to project management.',
						},
						{
							name: 'Patients',
							description: 'Endpoints related to patient personas.',
						},
						{
							name: 'Messages',
							description:
								'Endpoints related to message handling within chats.',
						},
						{
							name: 'AI',
							description: 'Endpoints related to AI model interactions.',
						},
						{
							name: 'Health',
							description: 'Endpoint related to Application Health.',
						},
					],
				},
			}),
		)
		.decorate('readyAt', 0)
		.derive(({ request, cookie: { access }, set }) => {
			const path = new URL(request.url).pathname;

			const NON_AUTH_ROUTES = [
				'/health',
				'/sessions/signup',
				'/sessions/login',
				'/sessions/oauth/google',
				'/sessions/oauth/cb',
				'/sessions/verify',
				'/sessions/refresh',
				'/sessions/logout',
				'/ws',
			];

			if (path.startsWith('/docs') || NON_AUTH_ROUTES.includes(path)) return {};

			const authHeader = request.headers.get('authorization');
			const token =
				authHeader?.startsWith('Bearer ')
					? authHeader.slice(7)
					: access?.value;

			if (!token) {
				set.status = 401;
				throw new Error('Unauthorized');
			}

			//@ts-expect-error
			const user = Auth.verify(token);
			if (!user) {
				set.status = 401;
				throw new Error('Unauthorized');
			}

			return { user };
		})
		.mapResponse((response, { request, set }) => {
			const origin = request.headers.get('origin');
			if (origin && corsOrigins.includes(origin)) {
				set.headers['access-control-allow-origin'] = origin;
				set.headers['access-control-allow-credentials'] = 'true';
				set.headers['vary'] = 'Origin';
			}
			return response;
		})
		.onError(({ request, set }) => {
			const origin = request.headers.get('origin');
			if (origin && corsOrigins.includes(origin)) {
				set.headers['access-control-allow-origin'] = origin;
				set.headers['access-control-allow-credentials'] = 'true';
				set.headers['vary'] = 'Origin';
			}
		});

	return app;
};
