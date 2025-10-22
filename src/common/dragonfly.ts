import Redis, { type Redis as RedisClient } from "ioredis";
import { env } from "./env";

export const FIVE_MINUTES_IN_SECONDS = 5 * 60;
export const ONE_MINUTE_IN_SECONDS = 60;

class Dragonfly {
  private pub: RedisClient;
  private sub: RedisClient;
  private isClosing = false;

  constructor() {
    const opt = {
      port: env.REDIS_PORT,
      host: env.REDIS_HOST,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    };

    this.pub = new Redis(opt);
    this.sub = new Redis(opt);

    this.pub.on("error", (err) => console.error("Redis Pub Error", err));
    this.sub.on("error", (err) => console.error("Redis Sub Error", err));
  }

  public async ping(): Promise<string> {
    return this.pub.ping();
  }

  public subscribe(channel: string, cb: (err: Error | null | undefined) => void) {
    this.sub.subscribe(channel, cb);
  };

  public on(evt: string, cb: (param: string) => void) {
    this.sub.on(evt, cb);
  }

  public onMessage(
    channel: string,
    cb: (message: Record<string, unknown>) => void,
  ) {
    this.sub.subscribe(channel, (err) => {
      if (err) {
        console.error(`Failed to subscribe to channel ${channel}`, err);
      }
    });

    this.sub.on("message", (ch, raw) => {
      if (ch === channel) {
        try {
          const message = JSON.parse(raw);
          cb(message);
        } catch (error) {
          console.error("Failed to parse message from channel", {
            channel: ch,
            raw,
            error,
          });
        }
      }
    });
  }

  public async publish(channel: string, data: unknown): Promise<void> {
    await this.pub.publish(channel, JSON.stringify(data));
  }

  public async setex(
    key: string,
    seconds: number,
    value: unknown,
  ): Promise<void> {
    await this.pub.setex(key, String(seconds), JSON.stringify(value));
  }

  public async get<T>(key: string): Promise<T | null> {
    const data = await this.pub.get(key);
    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data) as T;
    } catch (error) {
      console.error("Failed to parse JSON from Redis", { key, data, error });
      return null;
    }
  }

  public async exists(key: string): Promise<boolean> {
    const result = await this.pub.exists(key);
    return result === 1;
  }

  public async disconnect(): Promise<void> {
    if (this.isClosing) return;

    this.isClosing = true;
    await this.pub.quit();
    await this.sub.quit();
  }

  public async del(key: string) {
    await dragonfly.del(key);
  }
}

export const dragonfly = new Dragonfly();
