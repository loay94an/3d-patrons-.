import React, { useMemo, useState } from 'react';
import { ArrowUpRight, BookOpen, Code2, Download, Info, Ruler, Scissors, Shirt, Sparkles } from 'lucide-react';
import { buildKtrSource, EaseProfile, GarmentFamily, StudioMeasurements } from '../lib/ktr-bridge';
import { GarmentType } from '../lib/pattern-logic';
import { createMeasurementProfile, validateStudioProfile, MeasurementProfile } from '../lib/measurement-profile';

type Props = {
  onOpenCad: (garment: GarmentType, profile: MeasurementProfile, ease: EaseProfile) => void;
  onOpenEncyclopedia: () => void;
};

const initialMeasurements: StudioMeasurements = {
  bust: 88, waist: 70, hip: 96, backLength: 40, sleeveLength: 58, upperArm: 30
};
const initialEase: EaseProfile = { bust: 4, waist: 2, hip: 4, upperArm: 3 };

const families: { id: GarmentFamily; title: string; detail: string; garment: GarmentType }[] = [
  { id: 'bodice', title: 'الجذع والبلوزة', detail: 'الأمام والخلف والكتف وحردة الإبط', garment: 'blouse' },
  { id: 'skirt', title: 'التنورة', detail: 'الوسط والورك والطول والبنس', garment: 'skirt' },
  { id: 'trousers', title: 'البنطال', detail: 'الورك والحجر والفخذ والساق', garment: 'pants' },
  { id: 'jacket', title: 'الجاكيت', detail: 'بلوك أساسي ثم سماحات وعناصر تصميم', garment: 'blazer' }
];

const measurementFields: { key: keyof StudioMeasurements; label: string; min: number; max: number }[] = [
  { key: 'bust', label: 'محيط الصدر', min: 60, max: 160 },
  { key: 'waist', label: 'محيط الخصر', min: 45, max: 150 },
  { key: 'hip', label: 'محيط الورك', min: 65, max: 175 },
  { key: 'backLength', label: 'طول الظهر', min: 25, max: 60 },
  { key: 'sleeveLength', label: 'طول الكم', min: 20, max: 85 },
  { key: 'upperArm', label: 'محيط أعلى الذراع', min: 18, max: 65 }
];

const easeFields: { key: keyof EaseProfile; label: string; hint: string }[] = [
  { key: 'bust', label: 'راحة الصدر', hint: 'تؤثر في اتساع منطقة الصدر' },
  { key: 'waist', label: 'راحة الخصر', hint: 'تتحكم في مقدار الاتساع عند الخصر' },
  { key: 'hip', label: 'راحة الورك', hint: 'تراعي الجلوس والحركة' },
  { key: 'upperArm', label: 'راحة أعلى الذراع', hint: 'تؤثر في سهولة حركة الذراع' }
];

const sourceNotes = [
  { title: 'KTR — لغة الباترون البارامترية', detail: 'نستخدم حالياً المدخلات والوحدات والدوال والهندسة النقطية المدعومة في الإصدار المبكر. لا ندّعي تشغيل المترجم داخل الموقع بعد.' },
  { title: 'Kim & Park (2025)', detail: 'منهج تحويل الباترون الأساسي ذي السماحة الصفرية إلى باترون إنتاج بإضافة سماحات ثابتة ثم عناصر التصميم، مع مقارنة النتائج بالتدريج التقليدي.' },
  { title: 'EASE (2026)', detail: 'يعامل الراحة كمتغير تصميم محلي ومتباين الاتجاهات على سطح الجسم، ثم يوازن بين توزيعها وقيود الدرز والهندسة. هذا مبدأ معماري، وليس محاكاة مفعّلة هنا.' },
  { title: 'Winifred Aldrich', detail: 'بلوكات الجذع والتنورة والبنطال والأكمام والياقات، ثم التعديلات والتدريج وCAD؛ مع فصل الملابس المنسوجة عن المطاطة والسهلة.' },
  { title: 'Armstrong وIl Modellismo والمراجع السابقة', detail: 'تُستخدم لتوثيق القياسات ونقاط الاستدلال والبنس والتحويلات والملاءمة وإكمال الباترون، مع مراجعة كل قاعدة قبل تحويلها إلى معادلة.' }
];

export function ParametricStudio({ onOpenCad, onOpenEncyclopedia }: Props) {
  const [family, setFamily] = useState<GarmentFamily>('bodice');
  const [measurements, setMeasurements] = useState(initialMeasurements);
  const [ease, setEase] = useState(initialEase);
  const [showSources, setShowSources] = useState(false);
  const source = useMemo(() => buildKtrSource(measurements, ease), [measurements, ease]);
  const validation = useMemo(() => validateStudioProfile(measurements, ease), [measurements, ease]);
  const isValid = validation.errors.length === 0;
  const selected = families.find(item => item.id === family)!;

  const downloadSource = () => {
    const blob = new Blob([source], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `pattern-studio-${family}.ktr`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full w-full overflow-y-auto bg-slate-950 text-slate-100" dir="rtl">
      <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
        <section className="relative overflow-hidden rounded-3xl border border-indigo-400/20 bg-gradient-to-br from-slate-900 via-indigo-950/70 to-slate-900 p-5 sm:p-7">
          <div className="absolute -left-12 -top-16 h-56 w-56 rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-300/20 bg-indigo-300/10 px-3 py-1 text-xs text-indigo-200"><Sparkles className="h-3.5 w-3.5" /> مختبر التصميم البارامتري</div>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">من القياس إلى قاعدة باترون قابلة لإعادة التوليد</h1>
              <p className="text-sm leading-7 text-slate-300">مساحة عمل لتجميع القياسات، وضبط الراحة حسب المنطقة، وإعداد مواصفات أولية بلغة KTR. هذه المرحلة تبني طبقة التعريف والتحقق؛ أما توليد القطع الإنتاجية وربط المترجم الأصلي فسيأتيان بعد اختبارات المحرك.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={onOpenEncyclopedia} className="inline-flex items-center gap-2 rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-bold hover:bg-white/5"><BookOpen className="h-4 w-4" /> المراجع</button>
              <button onClick={() => onOpenCad(selected.garment, createMeasurementProfile(measurements), ease)} disabled={!isValid} className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-400"><Scissors className="h-4 w-4" /> فتح محرر 2D</button>
            </div>
          </div>
          <div className="relative mt-6 grid grid-cols-2 gap-2 md:grid-cols-4">
            {[
              ['04', 'عائلات باترون أولية'],
              [String(Object.keys(measurements).length).padStart(2, '0'), 'قياسات أساسية'],
              [String(Object.keys(ease).length).padStart(2, '0'), 'مناطق راحة مستقلة'],
              ['KTR', 'صياغة مصدر قابلة للتصدير']
            ].map(([value, label]) => <div key={label} className="rounded-2xl border border-white/10 bg-black/15 p-3"><div className="text-xl font-black text-white">{value}</div><div className="mt-1 text-[11px] text-slate-400">{label}</div></div>)}
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
          <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3"><div><h2 className="font-bold">1. عائلة الباترون</h2><p className="mt-1 text-xs text-slate-400">اختيار نوع العمل يحدد نقطة البداية في محرر الرسم.</p></div><Shirt className="h-5 w-5 text-indigo-300" /></div>
            <div className="grid grid-cols-2 gap-2">
              {families.map(item => <button key={item.id} onClick={() => setFamily(item.id)} className={`rounded-xl border p-3 text-right transition ${family === item.id ? 'border-indigo-400 bg-indigo-500/15 ring-1 ring-indigo-400/30' : 'border-slate-700 bg-slate-950/60 hover:border-slate-500'}`}><div className="text-sm font-bold">{item.title}</div><div className="mt-1 text-[11px] leading-5 text-slate-400">{item.detail}</div></button>)}
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-slate-950/70 p-3 text-xs text-slate-300"><Info className="h-4 w-4 shrink-0 text-sky-300" />اختيار العائلة هنا يهيئ مواصفات التصميم ويفتح نوع القطعة المقابل في CAD؛ لا يعني أن كل تفاصيلها الهندسية أصبحت مكتملة.</div>
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5">
            <div className="flex items-center justify-between"><div><h2 className="font-bold">2. القياسات الأساسية</h2><p className="mt-1 text-xs text-slate-400">القيم بالسنتيمتر ويمكن تعديلها.</p></div><Ruler className="h-5 w-5 text-sky-300" /></div>
            <div className="grid grid-cols-2 gap-3">
              {measurementFields.map(field => <label key={field.key} className="space-y-1.5"><span className="block text-xs font-semibold text-slate-300">{field.label}</span><div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-2"><input type="number" min={field.min} max={field.max} step="0.5" value={measurements[field.key]} onChange={event => setMeasurements(prev => ({ ...prev, [field.key]: Number(event.target.value) }))} className="w-full min-w-0 bg-transparent py-2 text-sm font-bold outline-none" /><span className="text-[10px] text-slate-500">سم</span></div></label>)}
            </div>
            {validation.errors.length > 0 && <div role="alert" className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs leading-6 text-rose-200"><strong>لا يمكن إرسال هذه القياسات إلى المحرك قبل تصحيحها:</strong><ul className="mt-1 list-inside list-disc">{validation.errors.map(issue => <li key={issue.field}>{issue.label}: {issue.message}</li>)}</ul></div>}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold">3. توزيع الراحة حسب المنطقة</h2><p className="mt-1 text-xs leading-5 text-slate-400">قيم مستقلة بالسنتيمتر. فصل الراحة عن قياس الجسم يمنع خلط القياس التشريحي مع مقدار الاتساع التصميمي.</p></div><div className="rounded-xl bg-indigo-500/10 px-3 py-2 text-xs text-indigo-200">4 مناطق مستقلة قابلة للضبط</div></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {easeFields.map(field => <div key={field.key} className="rounded-xl border border-slate-700 bg-slate-950/70 p-3"><div className="flex items-center justify-between gap-2"><label htmlFor={`ease-${field.key}`} className="text-xs font-bold">{field.label}</label><span className="font-mono text-sm font-bold text-indigo-300">{ease[field.key].toFixed(1)} سم</span></div><input id={`ease-${field.key}`} type="range" min="-3" max="12" step="0.5" value={ease[field.key]} onChange={event => setEase(prev => ({ ...prev, [field.key]: Number(event.target.value) }))} className="mt-3 w-full accent-indigo-400" /><p className="mt-2 text-[10px] leading-5 text-slate-500">{field.hint}</p></div>)}
          </div>
          <p className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] leading-5 text-amber-200/80">تنبيه منهجي: القيم هنا سماحات إضافية بالسنتيمتر لكل منطقة، وليست معاملات EASE المنشورة. بحث EASE يعبّر عن الراحة بمقاييس محلية متباينة الاتجاهات لكل مثلث على سطح الجسم (مثل ρweft وρwarp)، ويحتاج إلى تحويل هندسي وتحسين وقيود درز قبل اعتباره مطبقاً. هذه القيم الأولية ليست توصيات قياسية، ويجب توزيعها على القطع وربطها بالقماش والموديل والحركة قبل اعتمادها.</p>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
          <div className="flex flex-col gap-3 border-b border-slate-800 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="flex items-center gap-2 font-bold"><Code2 className="h-4 w-4 text-emerald-300" /> 4. مصدر KTR الناتج</h2><p className="mt-1 text-xs text-slate-400">صياغة أولية باستخدام مدخلات ودوال ونقاط هندسية من مجموعة الميزات المعلنة في KTR v0.1.0.</p></div><button onClick={downloadSource} disabled={!isValid} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"><Download className="h-4 w-4" /> تنزيل ملف .ktr</button></div>
          <pre dir="ltr" className="max-h-80 overflow-auto bg-[#080d18] p-4 text-left text-xs leading-6 text-emerald-200"><code>{source}</code></pre>
          <div className="border-t border-slate-800 p-4 text-[11px] leading-5 text-slate-400">هذه أداة توليد نص للمواصفات وليست مترجم KTR مدمجاً. لم يتم إصدار ملف IR أو تشغيل solver، لأن ميزات التصدير والبحث والقيود في المستودع الأصلي ما زالت غير مكتملة وفق README الحالي.</div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5">
          <button onClick={() => setShowSources(value => !value)} className="flex w-full items-center justify-between text-right"><div className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-amber-300" /><div><h2 className="font-bold">منهجية ومصادر بناء المحرك</h2><p className="mt-1 text-xs text-slate-400">مصادر كتب، أبحاث، ولغة KTR — مع تمييز ما لم يُنفّذ بعد.</p></div></div><span className="text-xs text-indigo-300">{showSources ? 'إخفاء' : 'عرض المصادر'}</span></button>
          {showSources && <div className="mt-4 grid gap-3 md:grid-cols-2">{sourceNotes.map(note => <article key={note.title} className="rounded-xl border border-slate-700 bg-slate-950/70 p-3"><h3 className="text-xs font-bold text-slate-200">{note.title}</h3><p className="mt-2 text-[11px] leading-6 text-slate-400">{note.detail}</p></article>)}</div>}
        </section>
      </div>
    </div>
  );
}
