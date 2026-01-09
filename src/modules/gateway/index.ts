import { app } from '../../app';
import { wsManager, WsMessageSchema } from '../../common/websocket';
import { Auth } from '../../config/auth';

export const route = (elysia: typeof app) => {
	elysia.ws('/ws', {
		body: WsMessageSchema,
		//@ts-expect-error
		query: (t) =>
			t.Object({
				token: t.String(),
			}),
		async open(ws) {
			const { token } = ws.data.query;

			let user = null;
			try {
				//@ts-expect-error
				const payload = Auth.verify(token);
				if (payload) {
					user = payload;
				}
			} catch (_) {
				ws.close();
				return;
			}

			if (!user) {
				ws.close();
				return;
			}

			const userId = user.id;
			//@ts-expect-error
			ws.data.user = user;

			console.log(`WS: User ${userId} connected`);

			const topic = `user:${userId}`;

      // Inscreve o usuário no seu canal privado para receber notificações/mensagens
      const topic = `user:${userId}`;
      
      // Armazena a função de unsubscribe no ws.data para cleanup
      // @ts-ignore
      ws.data.unsubscribe = await wsManager.subscribe(topic, (msg) => {
        ws.send(msg);
      });
    },

		message(ws, message) {
			console.log('WS Message received:', message);
		},

		close(ws) {
			console.log(`WS: User disconnected`);
			// @ts-expect-error
			if (ws.data.unsubscribe) {
				// @ts-expect-error
				ws.data.unsubscribe();
			}
		},
	});
};
