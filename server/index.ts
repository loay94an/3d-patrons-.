/**
 * Optional server-side helper for the pattern studio.
 *
 * It is the only place that talks to Respan: the Gemini request runs through the
 * Respan hosted gateway (https://api.respan.ai/api/google/gemini) with the
 * server-side RESPAN_API_KEY, so no key reaches the browser bundle.
 */
import process from 'node:process';
import dotenv from 'dotenv';
import express from 'express';
import { GoogleGenAI } from '@google/genai';
import {
  PATTERN_GUIDANCE_PATH,
  PATTERN_GUIDANCE_SYSTEM_INSTRUCTION,
  buildPatternGuidancePrompt,
  parsePatternGuidanceRequest,
} from '../src/lib/pattern-guidance';

dotenv.config({ quiet: true });

const PORT = Number(process.env.PATTERN_GUIDANCE_PORT ?? 8787);
const RESPAN_BASE_URL = 'https://api.respan.ai/api/google/gemini';
const MODEL = process.env.RESPAN_GEMINI_MODEL?.trim() || 'gemini-2.5-flash';

let client: GoogleGenAI | null = null;

/** Initialized once, after the server-side Respan key is known to exist. */
function getClient(): GoogleGenAI | null {
  const apiKey = process.env.RESPAN_API_KEY?.trim();
  if (!apiKey) return null;
  if (!client) {
    client = new GoogleGenAI({ apiKey, httpOptions: { baseUrl: RESPAN_BASE_URL } });
  }
  return client;
}

const app = express();
app.use(express.json({ limit: '64kb' }));

app.post(PATTERN_GUIDANCE_PATH, async (req, res) => {
  const request = parsePatternGuidanceRequest(req.body);
  if (!request) {
    res.status(400).json({ error: 'invalid_request', message: 'بيانات الباترون غير صالحة.' });
    return;
  }

  const gateway = getClient();
  if (!gateway) {
    res.status(503).json({
      error: 'missing_respan_key',
      message: 'خدمة الإرشادات غير مهيأة: أضف RESPAN_API_KEY إلى بيئة الخادم.',
    });
    return;
  }

  try {
    const response = await gateway.models.generateContent({
      model: MODEL,
      contents: buildPatternGuidancePrompt(request),
      config: {
        systemInstruction: PATTERN_GUIDANCE_SYSTEM_INSTRUCTION,
        temperature: 0.4,
        maxOutputTokens: 720,
      },
    });

    const guidance = response.text?.trim();
    if (!guidance) {
      res.status(502).json({ error: 'empty_response', message: 'لم تُعد البوابة نصاً قابلاً للعرض.' });
      return;
    }

    res.json({ guidance, model: MODEL });
  } catch (error) {
    const status = typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status?: unknown }).status)
      : undefined;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[pattern-guidance] gateway request failed${status ? ` (${status})` : ''}: ${message.slice(0, 300)}`);

    const needsAccount = status === 401 || status === 403 || status === 429;
    res.status(502).json({
      error: needsAccount ? 'gateway_unavailable' : 'gateway_error',
      message: needsAccount
        ? 'بوابة Respan رفضت الطلب: تحقق من تفعيل الحساب أو الرصيد أو صلاحية مفتاح Gemini.'
        : 'تعذّر إكمال طلب الإرشادات عبر بوابة Respan.',
    });
  }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(
    `[pattern-guidance] listening on http://127.0.0.1:${PORT}${PATTERN_GUIDANCE_PATH} ` +
      `(model: ${MODEL}, RESPAN_API_KEY ${process.env.RESPAN_API_KEY ? 'configured' : 'missing'})`,
  );
});
