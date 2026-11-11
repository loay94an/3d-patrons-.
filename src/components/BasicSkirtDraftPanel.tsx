import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Ruler, Scissors } from 'lucide-react';
import { generateBasicSkirtDraft } from '../lib/basic-skirt-pattern';
import { segmentToSvgPath } from '../lib/pattern-cad-engine';

const initial = {
  waistCircumferenceCm: 70,
  hipCircumferenceCm: 96,
  waistToHipCm: 20,
  skirtLengthCm: 60,
  waistEaseCm: 2,
  hipEaseCm: 2
};

const fields: { key: keyof typeof initial; label: string; min: number; max: number; step: number }[] = [
  { key: 'waistCircumferenceCm', label: 'محيط الخصر', min: 45, max: 150, step: 0.5 },
  { key: 'hipCircumferenceCm', label: 'محيط الورك', min: 65, max: 175, step: 0.5 },
  { key: 'waistToHipCm', label: 'عمق الورك', min: 10, max: 35, step: 0.5 },
  { key: 'skirtLengthCm', label: 'طول التنورة', min: 25, max: 120, step: 0.5 },
  { key: 'waistEaseCm', label: 'راحة الخصر الكلية', min: 0, max: 12, step: 0.5 },
  { key: 'hipEaseCm', label: 'راحة الورك الكلية', min: 0, max: 16, step: 0.5 }
];

function PanelPreview({ piece, originX }: { piece: ReturnType<typeof generateBasicSkirtDraft>['pieces'][number]; originX: number }) {
  const cutting = piece.segments.filter(segment => segment.layer === 'cutting');
  const guides = piece.segments.filter(segment => segment.layer === 'guideline');
  const viewMinX = originX * 2.5 - 10;
  return (
    <svg viewBox={`${viewMinX} 0 100 180`} role="img" aria-label={piece.nameAr} className="h-64 w-full rounded-xl border border-slate-700 bg-slate-950">
      {cutting.map(segment => <path key={segment.id} d={segmentToSvgPath(segment, 2.5)} fill="none" stroke="#67e8f9" strokeWidth="0.65" vectorEffect="non-scaling-stroke" />)}
      {guides.map(segment => <path key={segment.id} d={segmentToSvgPath(segment, 2.5)} fill="none" stroke="#fbbf24" strokeWidth="0.45" strokeDasharray="2 1" vectorEffect="non-scaling-stroke" />)}
      {piece.grainlines.map(grain => <line key={grain.id} x1={grain.p1.x * 2.5} y1={grain.p1.y * 2.5} x2={grain.p2.x * 2.5} y2={grain.p2.y * 2.5} stroke="#a78bfa" strokeWidth="0.45" strokeDasharray="3 1" vectorEffect="non-scaling-stroke" />)}
      <text x={originX * 2.5 + 3} y="8" fill="#e2e8f0" fontSize="3.2">{piece.nameAr}</text>
    </svg>
  );
}

export function BasicSkirtDraftPanel() {
  const [measurements, setMeasurements] = useState(initial);
  const result = useMemo(() => generateBasicSkirtDraft(measurements), [measurements]);
  const update = (key: keyof typeof initial, value: number) => setMeasurements(current => ({ ...current, [key]: value }));

  return (
    <section className="space-y-4 rounded-2xl border border-cyan-500/20 bg-slate-900/70 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-cyan-400/10 p-2 text-cyan-200"><Scissors className="h-5 w-5" /></div>
        <div>
          <h2 className="font-bold">بلوك التنورة المستقيمة الأساسي</h2>
          <p className="mt-1 text-xs leading-6 text-slate-400">مسودة هندسية أولية من الأمام على الثنية والخلف بمنتصف مخيط، مع بنستين مستقلتين وبدلات حواف منفصلة.</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {fields.map(field => (
          <label key={field.key} className="space-y-1.5">
            <span className="block text-xs font-semibold text-slate-300">{field.label} <span className="text-slate-500">(سم)</span></span>
            <input type="number" min={field.min} max={field.max} step={field.step} value={measurements[field.key]} onChange={event => update(field.key, Number(event.target.value))} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-bold text-white outline-none focus:border-cyan-400" />
          </label>
        ))}
      </div>

      <div className={`rounded-xl border p-3 text-xs leading-6 ${result.validation.valid ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-200' : 'border-rose-500/30 bg-rose-500/5 text-rose-200'}`} role={result.validation.valid ? 'status' : 'alert'}>
        <div className="flex items-center gap-2 font-bold">
          {result.validation.valid ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {result.validation.valid ? 'اجتاز فحوص الاتساق الحسابي والهندسي الأولية' : 'تعذر توليد البلوك بهذه القيم'}
        </div>
        {result.validation.errors.map(error => <p key={error}>• {error}</p>)}
        {result.validation.warnings.map(warning => <p key={warning} className="mt-1 text-amber-200">• {warning}</p>)}
      </div>

      {result.validation.valid && result.pieces.length === 2 && (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-200"><Ruler className="h-4 w-4 text-cyan-300" /> الأمام — قص على الثنية</div>
              <PanelPreview piece={result.pieces[0]} originX={5} />
              <p className="mt-2 text-[11px] leading-5 text-slate-400">منتصف الأمام بلا بدل خياطة. البنسة تُغلق عند الخياطة.</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-200"><Ruler className="h-4 w-4 text-sky-300" /> الخلف — قطعتان مع منتصف مخيط</div>
              <PanelPreview piece={result.pieces[1]} originX={48} />
              <p className="mt-2 text-[11px] leading-5 text-slate-400">منتصف الخلف مهيأ لخياطة السحاب؛ بدل منتصف الخلف مستقل عن الجنب.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['محيط الخصر بعد إغلاق البنس', result.validation.measurements.finishedWaistCm],
              ['محيط الورك', result.validation.measurements.finishedHipCm],
              ['جنب الأمام', result.validation.measurements.frontSideSeamCm],
              ['فرق طولي الجنبين', result.validation.measurements.sideSeamDifferenceCm]
            ].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-slate-700 bg-slate-950/60 p-3"><div className="text-lg font-black text-white">{Number(value).toFixed(2)} <span className="text-[10px] font-medium text-slate-500">سم</span></div><div className="mt-1 text-[10px] leading-5 text-slate-400">{label}</div></div>)}
          </div>
        </>
      )}
      <p className="text-[11px] leading-6 text-slate-500">حدود هذه النسخة: بلوك مستقيم أولي، وليس باترون إنتاج معتمداً. لم تُضف بعد تحويلات البنَس إلى قصّات، أو التدريج، أو فحص عينة فعلية، أو اختبار توازن القماش والملاءمة على الجسم.</p>
    </section>
  );
}
