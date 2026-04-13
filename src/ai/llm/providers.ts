import { LLMConfig } from './index';

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export async function callLLM(
  prompt: string,
  config: LLMConfig
): Promise<LLMResponse> {
  const { provider, apiKey, baseUrl, model, temperature = 0.7 } = config;

  let endpoint = baseUrl;
  let body: Record<string, unknown> = {};
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

   if (provider === 'minimax') {
     endpoint = baseUrl || 'https://api.minimax.io/anthropic';
     headers['Authorization'] = `Bearer ${apiKey}`;
     body = {
       model: model || 'MiniMax-M2.7',
       messages: [{ role: 'user', content: prompt }],
       temperature,
       max_tokens: 500,
     };
   } else if (provider === 'openrouter') {
     endpoint = baseUrl || 'https://openrouter.ai/api/v1/chat/completions';
     headers['Authorization'] = `Bearer ${apiKey}`;
     headers['HTTP-Referer'] = 'https://mahjong.local';
     headers['x-title'] = 'Taiwan Mahjong AI';
     body = {
       model: model || 'google/gemini-2.0-flash-exp',
       messages: [
         { role: 'system', content: '/no_think' },
         { role: 'user', content: prompt }
       ],
       temperature,
       max_tokens: 500,
       response_format: { type: "json_object" },
       reasoning: { enabled: false },
     };
   } else if (provider === 'gemini') {
     endpoint = baseUrl || `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-2.0-flash'}:generateContent`;
     headers['x-goog-api-key'] = apiKey;
     body = {
       contents: [
         {
           parts: [{ text: prompt }],
         },
       ],
       generationConfig: {
         temperature,
         maxOutputTokens: 500,
         responseMimeType: "application/json",
       },
     };
   }

  try {
    const response = await fetch(endpoint!, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`LLM API error (${provider}): ${response.status}`, errorText);
      throw new Error(`LLM API error: ${response.status} - ${errorText.slice(0, 200)}`);
    }

    const data = await response.json();
    
    // Debug: Log full API response structure
    console.log(`[LLM Debug] ${provider} raw response:`, JSON.stringify(data, null, 2).slice(0, 1000));

    let content = '';
    if (provider === 'minimax' || provider === 'openrouter') {
      const message = data.choices?.[0]?.message;
      content = message?.content || '';
      // Some models (like nvidia/nemotron) output reasoning but no content
      // Try to extract JSON from reasoning field if content is empty
      if (!content && message?.reasoning) {
        const reasoning = message.reasoning;
        // Look for JSON pattern in reasoning
        const jsonMatch = reasoning.match(/\{[^{}]*\}/);
        if (jsonMatch) {
          content = jsonMatch[0];
          console.log(`[LLM Debug] Extracted JSON from reasoning: ${content}`);
        }
      }
      if (!content) {
        console.warn(`[LLM Debug] ${provider} empty content. choices:`, data.choices);
      }
    } else if (provider === 'gemini') {
      content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!content) {
        console.warn(`[LLM Debug] ${provider} empty content. candidates:`, data.candidates);
      }
    }

    return {
      content,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens || 0,
        completionTokens: data.usage.completion_tokens || 0,
        totalTokens: data.usage.total_tokens || 0,
      } : undefined,
    };
  } catch (error) {
    console.error('LLM call failed:', error);
    throw error;
  }
}
