import openapi from '@elysiajs/openapi';
import { Elysia } from 'elysia';
import { ip } from 'elysia-ip';
import { env } from '../common/env';
import { Auth } from '../config/auth';
import '../common/queue.ts';

export const isProd = env.NODE_ENV === 'production';
export const createApp = async () => {
	const app = new Elysia({ name: 'cogniAI' })
		.use(ip())
		.use(
			openapi({
				path: '/docs',
				documentation: {
					info: {
						title: 'Cogni AI API Documentation',
						version: '1.0.0',
						description: 'API documentation for the Cogni AI project.',
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

			// Debug: Ver se o cookie está chegando
			if (env.NODE_ENV !== 'production') {
				console.log(`[Auth Debug] Path: ${path}, Access Cookie: ${access?.value ? 'Present' : 'Missing'}`);
			}

			const NON_AUTH_ROUTES = [
				'/health',
				'/sessions/signup',
				'/sessions/login',
				'/sessions/oauth/google',
				'/sessions/verify',
				'/sessions/refresh',
			];

			if (path.startsWith('/docs') || NON_AUTH_ROUTES.includes(path)) return {};

			if (!access.value) {
				set.status = 401;
				throw new Error('Unauthorized');
			}

			//@ts-expect-error
			const user = Auth.verify(access.value);
			if (!user) {
				set.status = 401;
				throw new Error('Unauthorized');
			}

			return { user };
		});

	return app;
};
