export class HealthService {
  public static async check() {
    const { timestamp } = HealthService;

    const [db, cache] = await Promise.allSettled([
      timestamp(() => )
    ]);
  }

  public static async timestamp<T>(func: () => T) {
    const start = performance.now();

    await func();

    return {
      start,
      timestamp: performance.now() - start
    }
  }
}
