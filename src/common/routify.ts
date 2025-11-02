import type { AnyElysia } from 'elysia';

export const routify = async (app: AnyElysia) => {
  const scanned = new Bun.Glob('src/modules/**/index.ts').scan({
    absolute: true,
  });

  for await (const path of scanned) {
    const { route } = await import(path);

    route(app);
  }
};
