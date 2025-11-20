import { createApp } from "./entry";
import { env } from "./common/env";
import { routify } from "./common/routify";
import chalk from "chalk";
import { prisma } from "./common/prisma";

const salve = 'salve';
export const app = await createApp();

await routify(app);

app.listen(env.PORT, async () => {
  app.decorator.readyAt = Date.now();
  prisma.$connect();

  console.log(chalk.blueBright(`Cogni AI is running on ${env.PORT}`));
})
