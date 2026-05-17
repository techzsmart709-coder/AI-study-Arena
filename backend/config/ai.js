import 'dotenv/config';
import OpenAI from 'openai';

// ── Dynamic AI Client (OpenRouter, NVIDIA, or Nexum/Dialagram) ───────────
// Single source of truth — imported by server.js, quizController.js, etc.
const activeKey = process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;

export const isNvidia = activeKey?.startsWith('nvapi-');
export const isOpenRouter = activeKey?.startsWith('sk-or-v1-');
export const isNexum = activeKey?.startsWith('dgr_');

export const openai = new OpenAI({
  apiKey: activeKey,
  baseURL: isNvidia ? 'https://integrate.api.nvidia.com/v1' : 
           isNexum  ? 'https://www.dialagram.me/router/v1' : 
           'https://openrouter.ai/api/v1',
  defaultHeaders: (isNvidia || isNexum) ? undefined : {
    "HTTP-Referer": "http://localhost:5173",
    "X-Title": "AI Study Arena",
  }
});

export const modelName = isNvidia ? 'meta/llama-3.1-8b-instruct' : 
                          isNexum  ? 'qwen-3.5-plus' : 
                          'openai/gpt-4o-mini';
