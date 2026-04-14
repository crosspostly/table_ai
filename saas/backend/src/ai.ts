import { GoogleGenerativeAI } from "@google/generative-ai";

export async function analyzeContent(apiKey: string, prompt: string, maxTokens: number = 12500, temperature: number = 0.7) {
  console.log('[ai] Initiating Gemini analysis');
  
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is required');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  // Используем ту же модель, что в GAS версии: gemini-2.5-flash-lite или аналогичную актуальную
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash", // Обновлено до стабильной 1.5 Flash
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: temperature,
    }
  });

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    console.log('[ai] Analysis completed successfully');
    return text;
  } catch (error: any) {
    console.error('[ai] Gemini API Error:', error.message);
    throw new Error(`AI_ANALYSIS_FAILED: ${error.message}`);
  }
}
