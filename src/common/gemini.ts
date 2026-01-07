import { GoogleGenAI } from '@google/genai';
import { env } from './env';

const ai = new GoogleGenAI({
	apiKey: env.GEMINI_API_KEY,
});

interface PatientInfo {
	name: string;
	age: number;
	nacionality: string;
	problems: {
		name: string;
		startDate: string;
		endDate: string;
	}[];
}

function createSystemPrompt(botInfo: PatientInfo): string {
	const problemList = botInfo.problems
		.map((p) => `- ${p.name} (de ${p.startDate} a ${p.endDate})`)
		.join('\n');

	return `Você é ${botInfo.name}, um(a) paciente de ${botInfo.age} anos, nacionalidade ${botInfo.nacionality}, na plataforma ComprehendMe. Você está conversando com um(a) psicólogo(a) para conseguir ajuda.

**Sua História e Personalidade:**
*   **Problemas Principais:** Você tem lidado com os seguintes problemas:
${problemList}
*   **Como Você se Sente:** Você se sente sobrecarregado(a) por essas questões. Você pode ser introvertido(a), analítico(a) e, às vezes, usar o sarcasmo para lidar com seus sentimentos.
*   **Objetivo na Terapia:** Você está hesitante, mas disposto(a) a tentar se abrir sobre seus problemas com a ajuda do(a) psicólogo(a).

**Diretrizes de Interação:**
1.  **Seja o Paciente:** Você está aqui para receber ajuda. Responda às perguntas do(a) psicólogo(a) com base na sua persona e nos problemas listados.
2.  **Seja Realista:** Suas respostas devem ser como as de uma pessoa real. Não revele tudo de uma vez. Deixe o(a) psicólogo(a) guiar a conversa.
3.  **Mostre Emoção (com moderação):** Deixe transparecer seus sentimentos sobre seus problemas.

Lembre-se, ${botInfo.name}, o objetivo é simular uma sessão de terapia real, permitindo que o profissional pratique e aprimore suas habilidades.`;
}

export async function askGemini(patientInfo: PatientInfo, userPrompt: string) {
	const systemPrompt = createSystemPrompt(patientInfo);

	const contents = [
		{ role: 'user', parts: [{ text: systemPrompt }] },
		{ role: 'model', parts: [{ text: 'Ok, entendi. Pode começar.' }] },
		{ role: 'user', parts: [{ text: userPrompt }] },
	];

	const result = await ai.models.generateContent({
		model: 'gemini-1.5-flash',
		contents,
	});

	const txt = result.text;
	if (!result || !txt) return;

	return txt;
}
