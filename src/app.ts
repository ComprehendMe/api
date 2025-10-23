import { createApp } from "./entry";
import { env } from "./common/env";
import { routify } from "./common/routify";
import chalk from "chalk";
import swagger from '@elysiajs/swagger';

export const app = await createApp();

await routify(app);
app.use(swagger());

app.listen(env.PORT, async () => {
  app.decorator.readyAt = Date.now();
  app.decorator.db.$connect();

  console.log(chalk.blueBright(`Cogni AI is running on ${env.PORT}`));
})
