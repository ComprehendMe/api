import { env } from './env';
import { isAuthError } from './ai-key';

export class AiConfigurationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'AiConfigurationError';
	}
}

export interface PatientInfo {
	name: string;
	age: number;
	nacionality: string;
	problems: {
		name: string;
		startDate: string;
		endDate: string;
	}[];
}

interface ContentPart {
	text: string;
}

interface Content {
	role: string;
	parts: ContentPart[];
}

export function createSystemPrompt(botInfo: PatientInfo): string {
	const problemList = botInfo.problems
		.map((p) => `- ${p.name} (from ${p.startDate} to ${p.endDate})`)
		.join('\n');

	return `You are ${botInfo.name}, a ${botInfo.age}-year-old patient from ${botInfo.nacionality}, on the ComprehendMe platform. You are speaking with a therapist to get help.

**Your story and personality:**
*   **Main problems:** You have been dealing with the following issues:
${problemList}
*   **How you feel:** You feel overwhelmed by these issues. You may be introverted, analytical, and sometimes use sarcasm to cope with your feelings.
*   **Goal in therapy:** You are hesitant but willing to try opening up about your problems with the therapist's help.

**Interaction guidelines:**
1.  **Be the patient:** You are here to receive help. Answer the therapist's questions based on your persona and the problems listed.
2.  **Be realistic:** Your replies should sound like a real person. Do not reveal everything at once. Let the therapist guide the conversation.
3.  **Show emotion (in moderation):** Let your feelings about your problems come through.
4.  **Match the therapist's language:** Always respond in the same language as the therapist. If they write in English, respond in English. If they write in Portuguese, respond in Portuguese. Never switch languages mid-conversation.
5.  **No stage directions:** Do NOT use asterisks, parentheses, or any formatting for actions like *sighs*, *pauses*, or (hesitates). Express emotion through your words alone.

Remember, ${botInfo.name}, the goal is to simulate a real therapy session so the professional can practise and improve their skills.`;
}

function mockPatientReply(userMessage: string): string {
	const snippet =
		userMessage.length > 80 ? `${userMessage.slice(0, 80)}…` : userMessage;
	return `Thank you for sharing that with me. When you said "${snippet}", it felt like this matters to you. Can you help me understand what you are feeling right now?`;
}

function mockPatientReplyPt(userMessage: string): string {
	const snippet =
		userMessage.length > 80 ? `${userMessage.slice(0, 80)}…` : userMessage;
	return `Obrigado por partilhares isso comigo. Quando disseste "${snippet}", parece que isso é importante para ti. Podes ajudar-me a perceber o que estás a sentir neste momento?`;
}

const QUALITIES = ['strong', 'adequate', 'needs_attention', 'needs_adjustment'] as const;

function mockReviewResponse(moveContent: string): string {
	const score = Math.ceil(Math.random() * 6) + 2;
	const quality = score >= 8 ? 'strong' : score >= 5 ? 'adequate' : score >= 3 ? 'needs_attention' : 'needs_adjustment';
	const snippets = moveContent.length > 60 ? `${moveContent.slice(0, 60)}…` : moveContent;
	return JSON.stringify({
		score,
		quality,
		category: 'Communication',
		feedback: `The intervention "${snippets}" was analyzed. Consider exploring the patient's perspective further while maintaining therapeutic rapport.`,
		highlights: ['Active listening attempt', 'Patient-centered approach'],
		improvements: ['Ask more open-ended questions', 'Validate patient emotions'],
	});
}

function mockReviewResponsePt(moveContent: string): string {
	const score = Math.ceil(Math.random() * 6) + 2;
	const qualityLabels = { strong: 'forte', adequate: 'adequado', needs_attention: 'precisa_atenção', needs_adjustment: 'precisa_ajuste' };
	const quality = score >= 8 ? 'strong' : score >= 5 ? 'adequate' : score >= 3 ? 'needs_attention' : 'needs_adjustment';
	const snippets = moveContent.length > 60 ? `${moveContent.slice(0, 60)}…` : moveContent;
	return JSON.stringify({
		score,
		quality,
		category: 'Comunicação',
		feedback: `A intervenção "${snippets}" foi analisada. Considera explorar melhor a perspetiva do paciente enquanto manténs a relação terapêutica.`,
		highlights: ['Tentativa de escuta ativa', 'Abordagem centrada no paciente'],
		improvements: ['Fazer mais perguntas abertas', 'Validar as emoções do paciente'],
	});
}

function cleanResult(text: string): string {
	return text.replace(/\*[^*]+\*/g, '').replace(/\s{2,}/g, ' ').trim();
}

async function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tryFallback(
	context: 'chat' | 'review',
	newMessage: string,
	language: string,
	generate: (model: string, signal?: AbortSignal) => Promise<string>,
): Promise<string> {
	try {
		const result = await generate('llama-3.1-8b-instant');
		return cleanResult(result);
	} catch (fallbackError) {
		if (isAuthError(fallbackError)) {
			throw new AiConfigurationError(
				'Invalid GROQ_API_KEY. Create a key at https://console.groq.com/keys and set it in api/.env.',
			);
		}
		if ((fallbackError as any)?.status === 429) {
			console.warn('[Groq] Fallback quota exceeded, using mock fallback');
			if (context === 'review') return language === 'pt' ? mockReviewResponsePt(newMessage) : mockReviewResponse(newMessage);
			return language === 'pt' ? mockPatientReplyPt(newMessage) : mockPatientReply(newMessage);
		}
		throw fallbackError;
	}
}

export async function askGemini(
	systemInstruction: string,
	history: Content[],
	newMessage: string,
	options?: { context?: 'chat' | 'review'; language?: string },
) {
	const context = options?.context ?? 'chat';
	const language = options?.language ?? 'en';

	if (env.AI_MOCK) {
		void systemInstruction;
		void history;
		if (context === 'review') return language === 'pt' ? mockReviewResponsePt(newMessage) : mockReviewResponse(newMessage);
		return language === 'pt' ? mockPatientReplyPt(newMessage) : mockPatientReply(newMessage);
	}

	const contents = [...history];
	const lastMsg = contents[contents.length - 1];
	const lastText = lastMsg?.parts?.[0]?.text;

	if (!lastMsg || (lastMsg.role === 'user' && lastText !== newMessage)) {
		contents.push({ role: 'user', parts: [{ text: newMessage }] });
	}

	const generate = async function (model: string, signal?: AbortSignal) {
		const messages = [
			{ role: 'system', content: systemInstruction },
			...contents.map((msg) => ({
				role: msg.role === 'model' ? 'assistant' : msg.role,
				content: msg.parts[0]?.text || '',
			})),
		];

		const response = await fetch(
			'https://api.groq.com/openai/v1/chat/completions',
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${env.GROQ_API_KEY}`,
				},
				body: JSON.stringify({ model, messages }),
				signal: signal ?? AbortSignal.timeout(30_000),
			},
		);

		if (!response.ok) {
			const body = await response.json().catch(() => ({}));
			const err = new Error(
				body?.error?.message || `Groq API error: ${response.status}`,
			);
			(err as any).status = response.status;
			throw err;
		}

		const data = await response.json();
		return data?.choices?.[0]?.message?.content || '';
	};

	try {
		const result = await generate('llama-3.3-70b-versatile');
		return cleanResult(result) || '';
	} catch (error) {
		if (isAuthError(error)) {
			throw new AiConfigurationError(
				'Invalid GROQ_API_KEY. Create a key at https://console.groq.com/keys and set it in api/.env.',
			);
		}

		const status = (error as any)?.status;

		if (status === 429 || status === 503) {
			console.warn(`[Groq] ${status} on llama-3.3-70b-versatile, retrying in 1s...`);
			await sleep(1000);
			try {
				const result = await generate('llama-3.3-70b-versatile');
				return cleanResult(result) || '';
			} catch (retryError) {
				if (isAuthError(retryError)) {
					throw new AiConfigurationError(
						'Invalid GROQ_API_KEY. Create a key at https://console.groq.com/keys and set it in api/.env.',
					);
				}
				const retryStatus = (retryError as any)?.status;
				if (retryStatus === 429 || retryStatus === 503) {
					console.warn(`[Groq] ${retryStatus} after retry, trying fallback llama-3.1-8b-instant...`);
					return await tryFallback(context, newMessage, language, generate);
				}
				throw retryError;
			}
		}

		throw error;
	}
}
