import chalk from 'chalk';
import { env } from './common/env';
import { listAuth0CallbackUrlsForSetup } from './common/oauth-callback';
import { isPlausibleGeminiApiKey } from './common/gemini-key';
import { prisma } from './common/prisma';
import { routify } from './common/routify';
import { createApp } from './entry';

export const app = await createApp();

await routify(app);

app.listen(env.PORT, async () => {
	app.decorator.readyAt = Date.now();
	prisma.$connect();

	console.log(chalk.blueBright(`ComprehendMe API is running on ${env.PORT}`));
	if (env.NODE_ENV !== 'production') {
		console.log(chalk.yellow('Auth0: add ALL of these to Allowed Callback URLs:'));
		for (const url of listAuth0CallbackUrlsForSetup()) {
			console.log(chalk.yellow(`  → ${url}`));
		}
	}
	if (env.GEMINI_MOCK) {
		console.warn(
			chalk.yellow(
				'GEMINI_MOCK=true — patient replies are simulated. Set a valid GEMINI_API_KEY and GEMINI_MOCK=false for real AI.',
			),
		);
	} else if (!isPlausibleGeminiApiKey(env.GEMINI_API_KEY)) {
		console.warn(
			chalk.red(
				'GEMINI_API_KEY looks invalid — set GEMINI_MOCK=true for local dev or add a key from https://aistudio.google.com/apikey',
			),
		);
	}
});
