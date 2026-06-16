import { describe, it } from 'bun:test';
import { GoogleGenAI } from '@google/genai';
import chalk from 'chalk';
import { env } from '../common/env';

describe('Gemini Models', () => {
	it('should list available models', async () => {
		const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
		try {
			const response = await ai.models.list();
			console.log('DEBUG RESPONSE:', JSON.stringify(response, null, 2));

			console.log('--- AVAILABLE GEMINI MODELS ---');
			if (response && Array.isArray(response)) {
				console.log(chalk.red('aqui estou'));
				for (const m of response) {
					console.log(`- ${m.name}`);
				}

				return;
			}

			if (response && 'models' in response) {
				console.log(chalk.blue('aqui estou'));

				//@ts-expect-error
				for (const model of response.models) {
					console.log(chalk.yellow('aqui estou'));
					console.log(
						`- ${model.name} (Methods: ${model.supportedGenerationMethods})`,
					);
				}

				return;
			}

			console.log('Estrutura de resposta desconhecida:', response);
			console.log('-------------------------------');
		} catch (e) {
			console.error('Error listing models:', e);
		}
	});
});
