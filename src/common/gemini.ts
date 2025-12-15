import { GoogleGenAI } from "@google/genai";
import { env } from "./env";

const ai = new GoogleGenAI({
  apiKey: env.GEMINI_API_KEY,
});

async function askGemini(prompt: string) {
  const contents = `
faz o seguinte:
${prompt}
`

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents,
  });
  console.log(response.text);
}

