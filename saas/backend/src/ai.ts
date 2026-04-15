import { GoogleGenerativeAI } from "@google/generative-ai";

export async function analyzeContent(apiKey: string, prompt: string, maxTokens: number = 12500, temperature: number = 0.7, imageData?: { data: string, mimeType: string }) {
  console.log(`[ai] Initiating Gemini analysis (Mode: ${imageData ? 'Vision' : 'Text'})`);
  
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is required');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: temperature,
    }
  });

  try {
    let result;
    if (imageData) {
      // Пакетный запрос с картинкой (OCR + Анализ)
      result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: imageData.data,
            mimeType: imageData.mimeType
          }
        }
      ]);
    } else {
      result = await model.generateContent(prompt);
    }

    const response = await result.response;
    const text = response.text();
    console.log('[ai] Gemini response received');
    return text;
  } catch (error: any) {
    console.error('[ai] Gemini API Error:', error.message);
    throw new Error(`AI_ANALYSIS_FAILED: ${error.message}`);
  }
}
