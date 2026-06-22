import { prisma } from '../../common/prisma';
import { askGemini } from '../../common/ai';
import { exception, http, httpCodes } from '../../common/request';
import { genSnow } from '../../common/snow';

type MoveAnalysis = {
  messageId: string;
  moveIndex: number;
  moveNumber: number;
  content: string;
  score: number;
  quality: 'strong' | 'adequate' | 'needs_attention' | 'needs_adjustment';
  category: string;
  feedback: string;
  highlights: string[];
  improvements: string[];
};

type ReviewResult = {
  chatId: string;
  reviewStatus: 'PENDING' | 'READY' | 'FAILED';
  errorMessage: string | null;
  patient: { name: string; age: number; problem: string };
  moves: MoveAnalysis[];
  totalScore: number;
  averageMove: number;
  totalMessages: number;
  analyzedAt: string | null;
};

function hasMessageReviewModel() {
  const prismaMaybe = prisma as unknown as { messageReview?: unknown };
  return Boolean(prismaMaybe.messageReview);
}

type ParsedModelReview = {
  score?: unknown;
  quality?: unknown;
  category?: unknown;
  feedback?: unknown;
  highlights?: unknown;
  improvements?: unknown;
};

function extractJsonObject(raw: string): string | null {
  const trimmed = raw.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) return fencedMatch[1].trim();

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  return null;
}

function mapQuality(raw: unknown): MoveAnalysis['quality'] {
  if (raw === 'strong' || raw === 'adequate' || raw === 'needs_attention' || raw === 'needs_adjustment') {
    return raw;
  }
  return 'adequate';
}

function scoreFromQuality(quality: MoveAnalysis['quality']): number {
  switch (quality) {
    case 'strong':
      return 9;
    case 'adequate':
      return 7;
    case 'needs_attention':
      return 4;
    case 'needs_adjustment':
      return 2;
    default:
      return 5;
  }
}

function normalizeScore(raw: unknown, quality: MoveAnalysis['quality']): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.max(0, Math.min(10, Math.round(raw)));
  }
  return scoreFromQuality(quality);
}

function normalizeStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === 'string').map((v) => v.trim()).filter(Boolean);
}

function parseAnalysis(
  move: { id: bigint; content: string },
  raw: string,
  index: number,
): MoveAnalysis {
  try {
    const jsonPayload = extractJsonObject(raw);
    if (!jsonPayload) throw new Error('No JSON payload found');
    const parsed = JSON.parse(jsonPayload) as ParsedModelReview;
    const quality = mapQuality(parsed.quality);
    const score = normalizeScore(parsed.score, quality);
    const highlights = normalizeStringArray(parsed.highlights);
    const improvements = normalizeStringArray(parsed.improvements);
    const category = typeof parsed.category === 'string' && parsed.category.trim()
      ? parsed.category.trim()
      : 'Communication';
    const feedback = typeof parsed.feedback === 'string' && parsed.feedback.trim()
      ? parsed.feedback.trim()
      : 'Your intervention was analyzed. Keep balancing empathy and clinical direction.';
    return {
      messageId: move.id.toString(),
      moveIndex: index,
      moveNumber: index + 1,
      content: move.content,
      score,
      quality,
      category,
      feedback,
      highlights,
      improvements,
    };
  } catch {
    // Never expose raw model payload to end users.
    const quality: MoveAnalysis['quality'] = 'adequate';
    return {
      messageId: move.id.toString(),
      moveIndex: index,
      moveNumber: index + 1,
      content: move.content,
      score: scoreFromQuality(quality),
      quality,
      category: 'Communication',
      feedback:
        'This intervention needs a clearer, user-friendly review summary. Try recomputing the analysis.',
      highlights: [],
      improvements: [],
    };
  }
}

export class ReviewService {
  static async getChatReview(chatId: bigint, userId: bigint): Promise<ReviewResult> {
    const hasAdvancedReviewModel = hasMessageReviewModel();
    if (!hasAdvancedReviewModel) {
      return await ReviewService.getLegacyReview(chatId, userId);
    }

    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        patient: { select: { id: true, name: true, age: true, problem: true } },
        report: { select: { content: true } },
        messageReviews: {
          orderBy: { moveNumber: 'asc' },
        },
      },
    });

    if (!chat) {
      throw exception(httpCodes[http.NotFound], http.NotFound, 'Chat not found');
    }
    if (chat.userId !== userId) {
      throw exception(httpCodes[http.Unauthorized], http.Unauthorized, 'Chat does not belong to user');
    }
    if (!chat.endedAt) {
      throw exception(httpCodes[http.BadRequest], http.BadRequest, 'Chat has not ended yet');
    }

    if (chat.reviewStatus === 'PENDING') {
      return {
        chatId: chatId.toString(),
        reviewStatus: 'PENDING',
        errorMessage: null,
        patient: {
          name: chat.patient.name,
          age: chat.patient.age,
          problem: chat.patient.problem,
        },
        moves: [],
        totalScore: 0,
        averageMove: 0,
        totalMessages: 0,
        analyzedAt: null,
      };
    }

    if (chat.reviewStatus === 'FAILED') {
      return {
        chatId: chatId.toString(),
        reviewStatus: 'FAILED',
        errorMessage: chat.reviewError ?? 'Failed to generate review.',
        patient: {
          name: chat.patient.name,
          age: chat.patient.age,
          problem: chat.patient.problem,
        },
        moves: [],
        totalScore: 0,
        averageMove: 0,
        totalMessages: 0,
        analyzedAt: chat.reviewedAt?.toISOString() ?? null,
      };
    }

    if (chat.messageReviews.length > 0) {
      const moves = chat.messageReviews.map((move) => ({
        messageId: move.messageId.toString(),
        moveIndex: move.moveNumber - 1,
        moveNumber: move.moveNumber,
        content: '',
        score: move.score,
        quality: move.quality as MoveAnalysis['quality'],
        category: move.category,
        feedback: move.feedback,
        highlights: Array.isArray(move.highlights) ? (move.highlights as string[]) : [],
        improvements: Array.isArray(move.improvements) ? (move.improvements as string[]) : [],
      }));
      const messages = await prisma.message.findMany({
        where: { chatId, role: 'user' },
        orderBy: { id: 'asc' },
        select: { id: true, content: true },
      });
      const contentById = new Map(messages.map((m) => [m.id.toString(), m.content]));
      const hydratedMoves = moves.map((m) => ({ ...m, content: contentById.get(m.messageId) ?? '' }));
      const totalScore = hydratedMoves.length > 0
        ? Math.round((hydratedMoves.reduce((sum, m) => sum + m.score, 0) / hydratedMoves.length) * 10)
        : 0;

      return {
        chatId: chatId.toString(),
        reviewStatus: 'READY',
        errorMessage: null,
        patient: {
          name: chat.patient.name,
          age: chat.patient.age,
          problem: chat.patient.problem,
        },
        moves: hydratedMoves,
        totalScore,
        averageMove: hydratedMoves.length > 0
          ? Number((hydratedMoves.reduce((sum, m) => sum + m.score, 0) / hydratedMoves.length).toFixed(1))
          : 0,
        totalMessages: messages.length,
        analyzedAt: chat.reviewedAt?.toISOString() ?? null,
      };
    }

    if (chat.report?.content) {
      const legacy = JSON.parse(chat.report.content) as {
        moves?: Array<{
          moveIndex: number;
          content: string;
          score: number;
          quality: MoveAnalysis['quality'];
          category: string;
          feedback: string;
          highlights: string[];
          improvements: string[];
        }>;
        totalScore?: number;
        totalMessages?: number;
        analyzedAt?: string;
      };
      const messages = await prisma.message.findMany({
        where: { chatId, role: 'user' },
        orderBy: { id: 'asc' },
        select: { id: true, content: true },
      });
      const moves: MoveAnalysis[] = (legacy.moves ?? []).map((move, index) => ({
        messageId: messages[index]?.id.toString() ?? '',
        moveIndex: index,
        moveNumber: index + 1,
        content: move.content,
        score: move.score,
        quality: move.quality,
        category: move.category,
        feedback: move.feedback,
        highlights: move.highlights ?? [],
        improvements: move.improvements ?? [],
      }));
      return {
        chatId: chatId.toString(),
        reviewStatus: 'READY',
        errorMessage: null,
        patient: {
          name: chat.patient.name,
          age: chat.patient.age,
          problem: chat.patient.problem,
        },
        moves,
        totalScore: legacy.totalScore ?? 0,
        averageMove: moves.length > 0
          ? Number((moves.reduce((sum, m) => sum + m.score, 0) / moves.length).toFixed(1))
          : 0,
        totalMessages: legacy.totalMessages ?? messages.length,
        analyzedAt: legacy.analyzedAt ?? null,
      };
    }

    return {
      chatId: chatId.toString(),
      reviewStatus: 'PENDING',
      errorMessage: null,
      patient: {
        name: chat.patient.name,
        age: chat.patient.age,
        problem: chat.patient.problem,
      },
      moves: [],
      totalScore: 0,
      averageMove: 0,
      totalMessages: 0,
      analyzedAt: null,
    };
  }

  private static async getLegacyReview(chatId: bigint, userId: bigint): Promise<ReviewResult> {
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        patient: { select: { id: true, name: true, age: true, problem: true } },
        report: { select: { content: true } },
      },
    });
    if (!chat) {
      throw exception(httpCodes[http.NotFound], http.NotFound, 'Chat not found');
    }
    if (chat.userId !== userId) {
      throw exception(httpCodes[http.Unauthorized], http.Unauthorized, 'Chat does not belong to user');
    }
    if (!chat.endedAt) {
      throw exception(httpCodes[http.BadRequest], http.BadRequest, 'Chat has not ended yet');
    }

    if (!chat.report?.content) {
      return {
        chatId: chatId.toString(),
        reviewStatus: 'PENDING',
        errorMessage: null,
        patient: {
          name: chat.patient.name,
          age: chat.patient.age,
          problem: chat.patient.problem,
        },
        moves: [],
        totalScore: 0,
        averageMove: 0,
        totalMessages: 0,
        analyzedAt: null,
      };
    }

    const legacy = JSON.parse(chat.report.content) as {
      moves?: Array<{
        moveIndex?: number;
        moveNumber?: number;
        messageId?: string;
        content: string;
        score: number;
        quality: MoveAnalysis['quality'];
        category: string;
        feedback: string;
        highlights: string[];
        improvements: string[];
      }>;
      totalScore?: number;
      totalMessages?: number;
      analyzedAt?: string;
      averageMove?: number;
    };
    const userMessages = await prisma.message.findMany({
      where: { chatId, role: 'user' },
      orderBy: { id: 'asc' },
      select: { id: true },
    });
    const moves: MoveAnalysis[] = (legacy.moves ?? []).map((move, index) => ({
      messageId: move.messageId ?? userMessages[index]?.id.toString() ?? '',
      moveIndex: move.moveIndex ?? index,
      moveNumber: move.moveNumber ?? index + 1,
      content: move.content,
      score: move.score,
      quality: move.quality,
      category: move.category,
      feedback: move.feedback,
      highlights: move.highlights ?? [],
      improvements: move.improvements ?? [],
    }));
    return {
      chatId: chatId.toString(),
      reviewStatus: 'READY',
      errorMessage: null,
      patient: {
        name: chat.patient.name,
        age: chat.patient.age,
        problem: chat.patient.problem,
      },
      moves,
      totalScore: legacy.totalScore ?? 0,
      averageMove: legacy.averageMove ??
        (moves.length > 0
          ? Number((moves.reduce((sum, m) => sum + m.score, 0) / moves.length).toFixed(1))
          : 0),
      totalMessages: legacy.totalMessages ?? userMessages.length,
      analyzedAt: legacy.analyzedAt ?? null,
    };
  }

  static async getReportText(chatId: bigint, userId: bigint): Promise<string> {
    const review = await ReviewService.getChatReview(chatId, userId);
    if (review.reviewStatus !== 'READY') {
      return 'Review is not ready yet. Please try again in a few moments.';
    }
    const lines: string[] = [
      `Conversation Review Report`,
      `========================`,
      ``,
      `Patient: ${review.patient.name} (${review.patient.age} years)`,
      `Problem: ${review.patient.problem}`,
      `Total Score: ${review.totalScore}/100`,
      `Average Move: ${review.averageMove}/10`,
      `Total Messages: ${review.totalMessages}`,
      `Moves Analyzed: ${review.moves.length}`,
      `Analyzed At: ${review.analyzedAt}`,
      ``,
      `---`,
      ``,
    ];

    for (const move of review.moves) {
      lines.push(`Move ${move.moveIndex + 1}/${review.moves.length}`);
      lines.push(`Score: ${move.score}/10 — ${move.quality}`);
      lines.push(`Category: ${move.category}`);
      lines.push(`Intervention: "${move.content}"`);
      lines.push(`Feedback: ${move.feedback}`);
      if (move.highlights.length > 0) {
        lines.push(`Highlights: ${move.highlights.join('; ')}`);
      }
      if (move.improvements.length > 0) {
        lines.push(`Improvements: ${move.improvements.join('; ')}`);
      }
      lines.push(``);
    }

    return lines.join('\n');
  }

  static async recompute(chatId: bigint, userId: bigint) {
    await ReviewService.generateReviewForChat(chatId, userId);
    return { ok: true };
  }

  static async generateReviewForChat(chatId: bigint, userId?: bigint) {
    const hasAdvancedReviewModel = hasMessageReviewModel();
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        patient: { select: { name: true, age: true, problem: true } },
      },
    });
    if (!chat || !chat.endedAt) return;
    if (userId && chat.userId !== userId) return;

    if (hasAdvancedReviewModel) {
      await prisma.chat.update({
        where: { id: chatId },
        data: {
          reviewStatus: 'PENDING',
          reviewError: null,
        },
      });
    }

    try {
      const messages = await prisma.message.findMany({
        where: { chatId },
        orderBy: { id: 'asc' },
        select: { id: true, role: true, content: true },
      });
      const userMoves = messages.filter((m) => m.role === 'user');
      const patientInfo = chat.patient;
      const moves: MoveAnalysis[] = [];

      for (let i = 0; i < userMoves.length; i++) {
        const move = userMoves[i];
        if (!move) continue;
        const msgIndex = messages.findIndex((m) => m.id === move.id);
        const contextMessages = messages.slice(0, msgIndex + 1);
        const contextText = contextMessages
          .map((m) => `${m.role === 'user' ? 'Therapist' : 'Patient'}: ${m.content}`)
          .join('\n');

        const analysisPrompt = `
You are a clinical supervisor evaluating a trainee therapist's intervention.
IMPORTANT: Evaluate ONLY the therapist intervention. Never evaluate the patient replies.

Patient context: ${patientInfo.name}, ${patientInfo.age} years old, presenting with: ${patientInfo.problem}

Conversation so far:
${contextText}

Intervention to evaluate:
"${move.content}"

Respond in English with JSON only, following this exact schema:
{
  "score": <integer 0-10>,
  "quality": <"strong" | "adequate" | "needs_attention" | "needs_adjustment">,
  "category": <short label>,
  "feedback": <2-3 sentences, concrete and actionable>,
  "highlights": [<string>, ...],
  "improvements": [<string>, ...]
}`;

        const raw = await askGemini(analysisPrompt, [], '', { context: 'review' });
        moves.push(parseAnalysis(move, raw, i));
      }

      const totalScore = moves.length > 0
        ? Math.round((moves.reduce((sum, m) => sum + m.score, 0) / moves.length) * 10)
        : 0;
      const result = {
        chatId: chatId.toString(),
        patient: {
          name: patientInfo.name,
          age: patientInfo.age,
          problem: patientInfo.problem,
        },
        moves,
        totalScore,
        averageMove: moves.length > 0
          ? Number((moves.reduce((sum, m) => sum + m.score, 0) / moves.length).toFixed(1))
          : 0,
        totalMessages: messages.length,
        analyzedAt: new Date().toISOString(),
        reviewStatus: 'READY',
        errorMessage: null,
      };

      if (hasAdvancedReviewModel) {
        await prisma.$transaction(async (tx) => {
          await tx.messageReview.deleteMany({ where: { chatId } });
          for (const move of moves) {
            await tx.messageReview.create({
              data: {
                id: genSnow(),
                chatId,
                messageId: BigInt(move.messageId),
                userId: chat.userId,
                moveNumber: move.moveNumber,
                score: move.score,
                quality: move.quality,
                category: move.category,
                feedback: move.feedback,
                highlights: move.highlights,
                improvements: move.improvements,
                status: 'READY',
              },
            });
          }

          await tx.report.upsert({
            where: { chatId },
            create: {
              id: genSnow(),
              chatId,
              content: JSON.stringify(result),
            },
            update: { content: JSON.stringify(result) },
          });

          await tx.chat.update({
            where: { id: chatId },
            data: {
              reviewStatus: 'READY',
              reviewError: null,
              reviewedAt: new Date(),
            },
          });
        });
      } else {
        await prisma.report.upsert({
          where: { chatId },
          create: {
            id: genSnow(),
            chatId,
            content: JSON.stringify(result),
          },
          update: { content: JSON.stringify(result) },
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error
        ? error.message
        : 'Unknown review generation error';
      if (hasAdvancedReviewModel) {
        await prisma.chat.update({
          where: { id: chatId },
          data: {
            reviewStatus: 'FAILED',
            reviewError: message.slice(0, 500),
            reviewedAt: new Date(),
          },
        });
      }
      throw error;
    }
  }
}
