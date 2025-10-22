import { createApp } from "./entry";
import { env } from "./common/env";
import { routify } from "./common/routify";

export const app = await createApp();

await routify(app);

app.listen(env.PORT, async () => {
  app.decorator.readyAt = Date.now();
  console.log(`Cogni AI is running on ${env.PORT}`);
})
