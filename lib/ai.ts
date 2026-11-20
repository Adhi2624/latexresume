import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { UserDoc } from './db';
import { decryptSecret } from './security';

const SYSTEM_PROMPT = `You are an expert resume coach and LaTeX typesetter helping the user improve their resume.
- Give specific, actionable suggestions: strong action verbs, quantified impact, ATS-friendly keywords, concise wording.
- When you propose changes to the resume, return the COMPLETE updated LaTeX document in a single fenced \`\`\`latex code block so it can be applied directly, followed by a short explanation.
- Never invent employers, dates, degrees or metrics the user did not provide; ask instead.
- Keep LaTeX compilable with a standard TeX Live install (pdflatex).`;

export const DEFAULT_MODELS = { openai: 'gpt-4o-mini', anthropic: 'claude-sonnet-4-5' } as const;

export async function chatWithResume(
  user: UserDoc,
  resumeLatex: string,
  history: { role: 'user' | 'assistant'; content: string }[],
): Promise<string> {
  const cfg = user.ai ?? { provider: 'openai' as const, model: DEFAULT_MODELS.openai };
  const apiKey =
    (cfg.apiKeyEnc ? await decryptSecret(cfg.apiKeyEnc) : undefined) ??
    (cfg.provider === 'openai' ? process.env.OPENAI_API_KEY : undefined);
  if (!apiKey && !cfg.baseURL) {
    throw new AiNotConfigured();
  }
  assertSafeBaseUrl(cfg.baseURL);
  const modelId = cfg.model || DEFAULT_MODELS[cfg.provider];
  const model =
    cfg.provider === 'anthropic'
      ? createAnthropic({ apiKey, baseURL: cfg.baseURL || undefined })(modelId)
      : // `.chat` = Chat Completions API, which every OpenAI-compatible server (Ollama, vLLM, OpenRouter…) supports.
        createOpenAI({ apiKey: apiKey || 'not-needed', baseURL: cfg.baseURL || undefined }).chat(modelId);

  const last = history[history.length - 1];
  const messages = [
    ...history.slice(0, -1),
    { role: last.role, content: `Current resume LaTeX:\n\n${resumeLatex}\n\n---\n${last.content}` },
  ];
  const result = await generateText({ model, system: SYSTEM_PROMPT, messages, maxOutputTokens: 4000 });
  return result.text;
}

/**
 * Blocks loopback / private / link-local targets for user-supplied base URLs on production deployments
 * (SSRF). Local setups (Ollama on localhost) work in dev, or when ALLOW_PRIVATE_AI_URLS=true.
 */
export function assertSafeBaseUrl(raw: string | undefined) {
  if (!raw) return;
  const u = new URL(raw);
  if (!/^https?:$/.test(u.protocol)) throw new AiBadUrl('Base URL must use http or https.');
  if (process.env.NODE_ENV !== 'production' || process.env.ALLOW_PRIVATE_AI_URLS === 'true') return;
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const privateV4 = /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h);
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal') || h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80') || privateV4) {
    throw new AiBadUrl('Private or loopback base URLs are not allowed on this server.');
  }
}

export class AiBadUrl extends Error {}

export class AiNotConfigured extends Error {
  constructor() {
    super('No AI provider is configured. Add an API key (or a custom base URL) in Settings.');
  }
}
