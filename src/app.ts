import chalk from 'chalk';
import { env } from './common/env';
import { prisma } from './common/prisma';
import { routify } from './common/routify';
import { createApp } from './entry';

export const app = await createApp();

await routify(app);

app.listen(env.PORT, async () => {
	app.decorator.readyAt = Date.now();
	prisma.$connect();

	console.log(chalk.blueBright(`Cogni AI is running on ${env.PORT}`));
});
