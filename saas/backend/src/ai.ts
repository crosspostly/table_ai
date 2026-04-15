import { GoogleGenerativeAI } from "@google/generative-ai";

export type AIProvider = 'google' | 'openai' | 'anthropic';

export interface AnalysisOptions {
  provider?: AIProvider;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  imageData?: { data: string, mimeType: string };
}

export async function analyzeContent(
  apiKey: string, 
  prompt: string, 
  options: AnalysisOptions = {}
) {
  const {
    provider = 'google',
    model = 'gemini-1.5-flash',
    maxTokens = 12500,
    temperature = 0.7,
    imageData
  } = options;

  console.log(`[ai] Initiating analysis (Provider: ${provider}, Model: ${model}, Mode: ${imageData ? 'Vision' : 'Text'})`);
  
  if (!apiKey) {
    throw new Error(`${provider.toUpperCase()}_API_KEY is required`);
  }

  if (provider === 'google') {
    const genAI = new GoogleGenerativeAI(apiKey);
    const genModel = genAI.getGenerativeModel({ 
      model: model,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: temperature,
      }
    });

    try {
      let result;
      if (imageData) {
        result = await genModel.generateContent([
          prompt,
          {
            inlineData: {
              data: imageData.data,
              mimeType: imageData.mimeType
            }
          }
        ]);
      } else {
        result = await genModel.generateContent(prompt);
      }

      const response = await result.response;
      return response.text();
    } catch (error: any) {
      console.error('[ai] Gemini API Error:', error.message);
      throw new Error(`AI_ANALYSIS_FAILED: ${error.message}`);
    }
  } 
  
  // Здесь можно добавить поддержку OpenAI/Anthropic в будущем
  throw new Error(`Provider ${provider} is not implemented yet`);
}

/**
 * Executes a chain of prompts
 * @param apiKey API Key
 * @param chain Array of prompts to execute sequentially
 * @param initialInput The initial text to analyze
 */
export async function executeChain(
  apiKey: string,
  chain: { prompt: string, options?: AnalysisOptions }[],
  initialInput: string
): Promise<string[]> {
  const results: string[] = [];
  let currentInput = initialInput;

  for (const step of chain) {
    const result = await analyzeContent(apiKey, step.prompt + "\n\nДАННЫЕ:\n" + currentInput, step.options);
    results.push(result);
    // Для следующего шага используем результат предыдущего
    currentInput = result;
  }

  return results;
}
