import chalk from 'chalk';
import { env } from './common/env';
import { listAuth0CallbackUrlsForSetup } from './common/oauth-callback';
import { isPlausibleApiKey } from './common/ai-key';
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
	if (env.AI_MOCK) {
		console.warn(
			chalk.yellow(
				'AI_MOCK=true — patient replies are simulated. Set AI_MOCK=false for real AI.',
			),
		);
	} else if (!isPlausibleApiKey(env.GROQ_API_KEY)) {
		console.warn(
			chalk.red(
				'GROQ_API_KEY looks invalid — create a key at https://console.groq.com/keys and set it in your env.',
			),
		);
	}
});
