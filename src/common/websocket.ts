import { t } from 'elysia';
import { dragonfly, type Dragonfly } from './dragonfly';

export const WsMessageSchema = t.Object({
	type: t.String(),
	payload: t.Any(),
});

export type WsMessage = typeof WsMessageSchema.static;

export type SubscriptionCallback = (payload: any) => void;

class WebSocketManager {
	private sub: Dragonfly;
	private subscribers: Map<string, Set<SubscriptionCallback>> = new Map();

	constructor() {
		this.sub = dragonfly;
		this.setupMessageListener();
	}

	private setupMessageListener() {
		this.sub.on('message', (channel, messageRaw) => {
			const callbacks = this.subscribers.get(channel);

			if (callbacks && callbacks.size > 0) {
				try {
					const payload = JSON.parse(messageRaw);

					for (const cb of callbacks) {
						cb(payload);
					}
				} catch (e) {
					console.error(`WS: Failed to parse message on ${channel}`, e);
				}
			}
		});

		this.sub.on('error', (err) => {
			console.error('WS Redis Sub Error:', err);
		});
	}

	public async publish(topic: string, message: WsMessage) {
		await dragonfly.publish(topic, message);
	}

	public async subscribe(topic: string, callback: SubscriptionCallback) {
		if (this.sub.status !== 'ready' && this.sub.status !== 'connecting') {
			await this.sub.connect();
		}

		if (!this.subscribers.has(topic)) {
			this.subscribers.set(topic, new Set());
			await this.sub.subscribe(topic);
		}

		const callbacks = this.subscribers.get(topic)!;
		callbacks.add(callback);
	}

	public on(evt: string, cb: (...args: any[]) => void) {
		this.sub.on(evt, cb);
	}
}

export const wsManager = new WebSocketManager();
