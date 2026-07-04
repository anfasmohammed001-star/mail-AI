import { db } from './db';
import { decrypt } from './crypto';

interface AIConfig {
  enabled: boolean;
  provider: 'ollama' | 'lm_studio' | 'openai' | 'gemini' | 'claude' | 'nvidia_nim';
  model: string;
  endpoint: string;
  apiKey: string;
}

async function getAIConfig(): Promise<AIConfig> {
  const configs = await db.emailConfig.findMany();
  const map: Record<string, string> = {};
  for (const c of configs) map[c.key] = c.value;

  const provider = (map.ai_provider || 'ollama') as AIConfig['provider'];
  const decryptedApiKey = map.ai_api_key ? decrypt(map.ai_api_key) : '';

  return {
    enabled: map.ai_enabled === 'true',
    provider,
    model: map.ai_model || getDefaultModel(provider),
    endpoint: map.ai_endpoint || getDefaultEndpoint(provider),
    apiKey: decryptedApiKey,
  };
}

function getDefaultModel(provider: string): string {
  switch (provider) {
    case 'ollama': return 'llama3';
    case 'lm_studio': return 'meta-llama-3-8b-instruct';
    case 'openai': return 'gpt-4o-mini';
    case 'gemini': return 'gemini-1.5-flash';
    case 'claude': return 'claude-3-5-sonnet-latest';
    case 'nvidia_nim': return 'z-ai/glm-5.2';
    default: return '';
  }
}

function getDefaultEndpoint(provider: string): string {
  switch (provider) {
    case 'ollama': return 'http://localhost:11434';
    case 'lm_studio': return 'http://localhost:1234';
    case 'openai': return 'https://api.openai.com';
    case 'gemini': return 'https://generativelanguage.googleapis.com';
    case 'claude': return 'https://api.anthropic.com';
    case 'nvidia_nim': return 'https://integrate.api.nvidia.com';
    default: return '';
  }
}

export async function generateAIResponse(
  systemPrompt: string,
  userPrompt: string,
  jsonMode: boolean = false
): Promise<string> {
  const config = await getAIConfig();
  if (!config.enabled) {
    throw new Error('AI features are disabled in settings.');
  }

  const { provider, model, endpoint, apiKey } = config;

  try {
    switch (provider) {
      case 'ollama':
        return await callOllama(endpoint, model, systemPrompt, userPrompt, jsonMode);
      case 'lm_studio':
        return await callOpenAICompatible(endpoint, model, systemPrompt, userPrompt, apiKey, jsonMode);
      case 'openai':
        return await callOpenAICompatible(endpoint || 'https://api.openai.com', model, systemPrompt, userPrompt, apiKey, jsonMode);
      case 'nvidia_nim':
        return await callOpenAICompatible(endpoint || 'https://integrate.api.nvidia.com', model, systemPrompt, userPrompt, apiKey, jsonMode);
      case 'gemini':
        return await callGemini(endpoint || 'https://generativelanguage.googleapis.com', model, systemPrompt, userPrompt, apiKey, jsonMode);
      case 'claude':
        return await callClaude(endpoint || 'https://api.anthropic.com', model, systemPrompt, userPrompt, apiKey, jsonMode);
      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
  } catch (err: any) {
    console.error(`AI generation error via ${provider}:`, err);
    throw new Error(`AI Service Error (${provider}): ${err.message || err}`);
  }
}

async function callOllama(
  endpoint: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  jsonMode: boolean
): Promise<string> {
  const cleanEndpoint = endpoint.replace(/\/$/, '');
  const res = await fetch(`${cleanEndpoint}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      stream: false,
      options: { temperature: 0.3 },
      format: jsonMode ? 'json' : undefined,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Ollama response error: ${res.status} - ${txt}`);
  }

  const data = await res.json();
  return data.message?.content || '';
}

async function callOpenAICompatible(
  endpoint: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  jsonMode: boolean
): Promise<string> {
  const cleanEndpoint = endpoint.replace(/\/$/, '');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const res = await fetch(`${cleanEndpoint}/v1/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      response_format: jsonMode ? { type: 'json_object' } : undefined,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenAI-compatible error: ${res.status} - ${txt}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callGemini(
  endpoint: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  jsonMode: boolean
): Promise<string> {
  if (!apiKey) throw new Error('API Key is required for Gemini');
  const cleanEndpoint = endpoint.replace(/\/$/, '');
  
  // Format model name for path if it doesn't already contain models/
  const finalModel = model.includes('models/') ? model : `models/${model}`;
  
  const url = `${cleanEndpoint}/v1beta/${finalModel}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\nUser Content:\n${userPrompt}` }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: jsonMode ? 'application/json' : 'text/plain',
      },
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Gemini API error: ${res.status} - ${txt}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callClaude(
  endpoint: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  jsonMode: boolean
): Promise<string> {
  if (!apiKey) throw new Error('API Key is required for Claude');
  const cleanEndpoint = endpoint.replace(/\/$/, '');
  
  const res = await fetch(`${cleanEndpoint}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Claude API error: ${res.status} - ${txt}`);
  }

  const data = await res.json();
  const content = data.content?.[0]?.text || '';
  return content;
}
