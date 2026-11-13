import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import {
  PATTERN_GUIDANCE_PATH,
  type PatternGuidanceFailure,
  type PatternGuidanceRequest,
  type PatternGuidanceSuccess,
} from '../lib/pattern-guidance';

type PanelStatus = 'idle' | 'loading' | 'done' | 'error';

/**
 * Requests short Arabic construction notes from the optional server-side
 * workflow. The pattern numbers are already computed here; the Respan gateway
 * key never leaves the server.
 */
export function PatternGuidancePanel({ request }: { request: PatternGuidanceRequest }) {
  const [status, setStatus] = useState<PanelStatus>('idle');
  const [lines, setLines] = useState<string[]>([]);
  const [message, setMessage] = useState('');

  const generate = async () => {
    setStatus('loading');
    setMessage('');
    try {
      const response = await fetch(PATTERN_GUIDANCE_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      const payload = (await response.json().catch(() => null)) as
        | (PatternGuidanceSuccess & PatternGuidanceFailure)
        | null;

      if (!response.ok || !payload || typeof payload.guidance !== 'string') {
        setMessage(payload?.message ?? 'تعذّر توليد ملاحظات التنفيذ.');
        setStatus('error');
        return;
      }

      setLines(payload.guidance.split('\n').map(line => line.trim()).filter(Boolean));
      setStatus('done');
    } catch {
      setMessage('تعذّر الاتصال بخدمة الإرشادات. شغّل npm run api بجانب npm run dev.');
      setStatus('error');
    }
  };

  return (
    <div className="space-y-2 border-t border-slate-800 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="flex items-center gap-1.5 text-xs font-bold text-white">
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
            <span>ملاحظات تنفيذ مولدة بالذكاء الاصطناعي</span>
          </h4>
          <p className="text-[10px] text-slate-500">
            تُرسل قيم الباترون المحسوبة إلى بوابة Respan وتعود بنقاط تنفيذ أولية تحتاج فحص عينة.
          </p>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={status === 'loading'}
          className="flex items-center gap-1.5 rounded-lg border border-indigo-500/40 bg-indigo-600/30 px-3 py-1.5 text-xs font-bold text-indigo-200 transition-colors hover:bg-indigo-600/50 disabled:opacity-60"
        >
          {status === 'loading' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          <span>{status === 'loading' ? 'جارٍ التوليد…' : 'توليد الملاحظات'}</span>
        </button>
      </div>

      <div aria-live="polite" className="space-y-1 text-xs leading-relaxed text-slate-300">
        {status === 'error' && <p className="text-amber-300">{message}</p>}
        {status === 'done' && (
          <ul className="list-disc space-y-1 pr-4">
            {lines.map((line, index) => (
              <li key={index}>{line.replace(/^[-•]\s*/, '')}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
