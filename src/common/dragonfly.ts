import Redis, { type Redis as RedisClient } from 'ioredis';
import { env } from './env';
import { da } from '@faker-js/faker';

export const FIVE_MINUTES_IN_SECONDS = 5 * 60;
export const ONE_MINUTE_IN_SECONDS = 60;

export class Dragonfly {
	private pub: RedisClient;
	private sub: RedisClient;
	private subscribers = new Map<string, Set<Function>>();
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

		this.pub.on('error', (err) => console.error('Redis Pub Error', err));
		this.sub.on('error', (err) => console.error('Redis Sub Error', err));

		this.sub.on('message', (chan, raw) => {
			const callbacks = this.subscribers.get(chan);

			if (callbacks) {
				try {
					const payload = JSON.parse(raw);
					for (const cb of callbacks) {
						cb(payload);
					}
				} catch (error) {
					console.log(error);
				}
			}
		});
	}

	public async connect() {
		await this.sub.connect();
	}

	public get status() {
		return this.sub.status;
	}

	public async ping(): Promise<string> {
		return this.pub.ping();
	}

	public async unsubscribe(topic: string) {
		return this.sub.unsubscribe(topic);
	}

	public async subscribe(topic: string) {
		return await this.sub.subscribe(topic);
	}

	public on(channel: string, cb: (...args: any[]) => void) {
		if (!this.subscribers.has(channel)) {
			this.subscribers.set(channel, new Set());

			this.sub.subscribe(channel);
		}

		this.subscribers.get(channel)?.add(cb);

		return () => {
			const set = this.subscribers.get(channel);
			set?.delete(cb);

			if (set?.size === 0) {
				this.subscribers.delete(channel);
			}
		};
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
			console.error('Failed to parse JSON from Redis', { key, data, error });
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
		await this.pub.del(key);
	}
}

export const dragonfly = new Dragonfly();
