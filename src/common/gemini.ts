import { type Content, GoogleGenAI } from '@google/genai';
import { env } from './env';
import { isGeminiAuthError } from './gemini-key';

const ai = new GoogleGenAI({
	apiKey: env.GEMINI_API_KEY,
});

export class GeminiConfigurationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'GeminiConfigurationError';
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

Remember, ${botInfo.name}, the goal is to simulate a real therapy session so the professional can practise and improve their skills.`;
}

function mockPatientReply(userMessage: string): string {
	const snippet =
		userMessage.length > 80 ? `${userMessage.slice(0, 80)}…` : userMessage;
	return `Thank you for sharing that with me. When you said "${snippet}", it felt like this matters to you. Can you help me understand what you are feeling right now?`;
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

export async function askGemini(
	systemInstruction: string,
	history: Content[],
	newMessage: string,
	options?: { context?: 'chat' | 'review' },
) {
	const context = options?.context ?? 'chat';

	if (env.GEMINI_MOCK) {
		void systemInstruction;
		void history;
		if (context === 'review') return mockReviewResponse(newMessage);
		return mockPatientReply(newMessage);
	}

	let contents = [...history];
	const lastMsg = contents[contents.length - 1];
	const lastText = lastMsg?.parts?.[0]?.text;

	if (!lastMsg || (lastMsg.role === 'user' && lastText !== newMessage)) {
		contents.push({ role: 'user', parts: [{ text: newMessage }] });
	}

	async function generate(model: string) {
		return ai.models.generateContent({
			model,
			config: {
				systemInstruction: {
					parts: [{ text: systemInstruction }],
				},
			},
			contents,
		});
	}

	try {
		const result = await generate('gemini-2.0-flash');
		return result.text || '';
	} catch (error) {
		if (isGeminiAuthError(error)) {
			throw new GeminiConfigurationError(
				'Invalid GEMINI_API_KEY. Create a key at https://aistudio.google.com/apikey and set it in api/.env (must start with AIza).',
			);
		}

		if ((error as any)?.status === 429) {
			console.warn('[Gemini] Quota exceeded, using mock fallback');
			if (context === 'review') return mockReviewResponse(newMessage);
			return mockPatientReply(newMessage);
		}

		if ((error as any)?.status === 503) {
			console.warn(
				'[Gemini] Primary model 503, trying fallback gemini-2.5-flash...',
			);
			try {
				const result = await generate('gemini-2.5-flash');
				return result.text || '';
			} catch (fallbackError) {
				if (isGeminiAuthError(fallbackError)) {
					throw new GeminiConfigurationError(
						'Invalid GEMINI_API_KEY. Create a key at https://aistudio.google.com/apikey and set it in api/.env (must start with AIza).',
					);
				}
				if ((fallbackError as any)?.status === 429) {
					console.warn('[Gemini] Fallback quota exceeded, using mock fallback');
					if (context === 'review') return mockReviewResponse(newMessage);
					return mockPatientReply(newMessage);
				}
				throw fallbackError;
			}
		}

		throw error;
	}
}
