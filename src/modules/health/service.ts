import { app } from "../../app";
import { dragonfly } from "../../common/dragonfly";

export class HealthService {
  public static async check() {
    const { timestamp } = HealthService;
    const { db: prisma, readyAt: readyNum } = app.decorator;

    const [db, cache] = await Promise.allSettled([
      timestamp(() => dragonfly.ping()),
      timestamp(() => prisma.$queryRaw`SELECT 'salve'`),
    ]);


    if (db.status === "rejected") console.log(db.reason);

    if (cache.status === "rejected") console.log(cache.reason);

    const readyAt = new Date(readyNum);
    return {
      readyAt: readyAt.toISOString(),
      cache:
        cache.status === "fulfilled"
          ? { ok: true, ...cache.value }
          : { ok: false },
      db:
        db.status === "fulfilled"
          ? { ok: true, ...db.value }
          : { ok: false },
      uptime: Date.now() - readyAt.getTime(),
      ok:
        cache.status === "fulfilled" &&
        db.status === "fulfilled",
    };
  }

  public static async timestamp<T>(func: () => Promise<T>) {
    const start = performance.now();

    await func();

    return {
      start,
      timestamp: performance.now() - start
    }
  }
}
