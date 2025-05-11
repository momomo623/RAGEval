import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions/completions';

export interface LLMRequestParams {
  baseUrl: string;
  apiKey: string;
  modelName: string;
  messages: ChatCompletionMessageParam[];
  additionalParams?: Record<string, any>;
}

export async function requestLLM(params: LLMRequestParams) {
  const { baseUrl, apiKey, modelName, messages, additionalParams } = params;
  try {
    const openai = new OpenAI({
      apiKey,
      baseURL: baseUrl,
      dangerouslyAllowBrowser: true,
    });
    const reqParams = {
      model: modelName,
      messages,
      ...((additionalParams && typeof additionalParams === 'object') ? additionalParams : {})
    };
    const completion = await openai.chat.completions.create(reqParams);
    return { success: true, data: completion };
  } catch (err: any) {
    return { success: false, error: err.message || '请求异常' };
  }
}

export type { ChatCompletionMessageParam };
