import type { Elysia } from 'elysia';
import { t } from 'elysia';
import { ID_SCHEMA } from '../../common/snow';
import { ReviewService } from './service';

export const route = (app: Elysia) => {
  app.group('/chats', (group) =>
    group
      .get(
        '/:id/review',
        async (context) => {
          const user = (context as typeof context & { user?: { id: bigint } }).user;
          if (!user) throw new Error('Unauthorized');
          return await ReviewService.getChatReview(context.params.id, user.id);
        },
        {
          params: t.Object({ id: ID_SCHEMA }),
          detail: { tags: ['Review'], summary: 'Get AI review of a completed chat' },
        },
      )
      .post(
        '/:id/review/recompute',
        async (context) => {
          const user = (context as typeof context & { user?: { id: bigint } }).user;
          if (!user) throw new Error('Unauthorized');
          return await ReviewService.recompute(context.params.id, user.id);
        },
        {
          params: t.Object({ id: ID_SCHEMA }),
          detail: { tags: ['Review'], summary: 'Recompute AI review for a chat' },
        },
      )
      .get(
        '/:id/review/report',
        async (context) => {
          const user = (context as typeof context & { user?: { id: bigint } }).user;
          if (!user) throw new Error('Unauthorized');
          const text = await ReviewService.getReportText(context.params.id, user.id);
          context.set.headers['Content-Type'] = 'text/plain; charset=utf-8';
          context.set.headers['Content-Disposition'] = `attachment; filename="review-${context.params.id}.txt"`;
          return text;
        },
        {
          params: t.Object({ id: ID_SCHEMA }),
          detail: { tags: ['Review'], summary: 'Download review report as text file' },
        },
      ),
  );
};
