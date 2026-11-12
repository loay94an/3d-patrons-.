import React, { useEffect, useMemo, useState } from 'react';
import { Search, ExternalLink, BookOpen, Scissors, Image as ImageIcon, AlertTriangle, ChevronDown } from 'lucide-react';

type ReferenceRecord = {
  id: string; sourceId: string; title: string; category: string; categoryAr: string;
  pageCount: number | null; contentType: string; tagsAr: string[]; detailsAr: string[];
  hasPattern: boolean; tutorialWithPattern: boolean; needsReview: boolean;
  classificationBasis: string; previewKind: string; rightsStatus: string; sourceUrl: string;
};
type Catalog = { total: number; noticeAr: string; records: ReferenceRecord[] };
type Props = { mode: 'models' | 'patterns' };

const categoryOrder = ['بلوزات_وتوبات','فساتين','بناطيل','تنانير','معاطف_وسترات','أفرولات','شورتات','ملابس_داخلية','أنماط_أخرى'];
const categoryNames: Record<string,string> = {
  'بلوزات_وتوبات':'بلوزات وتوبات','فساتين':'فساتين','بناطيل':'بناطيل','تنانير':'تنانير',
  'معاطف_وسترات':'معاطف وسترات','أفرولات':'أفرولات','شورتات':'شورتات',
  'ملابس_داخلية':'ملابس داخلية','أنماط_أخرى':'أنماط أخرى'
};

function GarmentIllustration({category}:{category:string}) {
  const common = { fill: 'none', stroke: '#c7d2fe', strokeWidth: 3.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  let shape: React.ReactNode;
  if (category === 'بناطيل' || category === 'شورتات') shape = <path {...common} d={category==='شورتات'?'M34 25 L86 25 L82 59 L66 59 L60 42 L54 59 L38 59 Z':'M35 22 L85 22 L80 91 L62 91 L59 48 L56 91 L38 91 Z'} />;
  else if (category === 'تنانير') shape = <path {...common} d="M42 24 L78 24 L91 91 L29 91 Z" />;
  else if (category === 'فساتين') shape = <path {...common} d="M43 18 L57 18 L62 34 L73 40 L91 92 L29 92 L47 40 L58 34 Z" />;
  else if (category === 'معاطف_وسترات') shape = <path {...common} d="M42 18 L58 27 L74 18 L88 34 L78 45 L75 92 L41 92 L38 45 L28 34 Z M58 27 L58 92 M48 40 L54 48 M68 40 L62 48" />;
  else if (category === 'أفرولات') shape = <path {...common} d="M40 18 L76 18 L82 34 L75 43 L72 91 L61 91 L58 52 L55 91 L44 91 L41 43 L34 34 Z M43 18 L47 35 L69 35 L73 18" />;
  else if (category === 'ملابس_داخلية') shape = <path {...common} d="M35 37 Q42 18 55 38 Q68 18 79 37 L84 53 L72 57 L68 47 L65 72 L49 72 L46 47 L42 57 L30 53 Z" />;
  else if (category === 'أنماط_أخرى') shape = <path {...common} d="M40 20 L76 20 L87 40 L74 48 L70 91 L46 91 L42 48 L29 40 Z" />;
  else shape = <path {...common} d="M42 18 L58 27 L74 18 L89 38 L77 47 L72 91 L44 91 L39 47 L27 38 Z M58 27 L58 44" />;
  return <div className="flex h-36 items-center justify-center rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900 to-indigo-950/50">
    <svg viewBox="0 0 116 110" role="img" aria-label={`رسم توضيحي لفئة ${categoryNames[category]||category}`} className="h-32 w-32">
      <circle cx="58" cy="55" r="47" fill="#6366f1" opacity=".08" />
      {shape}
      <path d="M18 99 H98" stroke="#475569" strokeWidth="1.5" strokeDasharray="3 4" />
    </svg>
  </div>;
}

export function ReferenceLibraryCatalog({mode}:Props) {
  const [catalog,setCatalog] = useState<Catalog|null>(null);
  const [error,setError] = useState('');
  const [query,setQuery] = useState('');
  const [category,setCategory] = useState('all');
  const [kind,setKind] = useState('all');
  const [page,setPage] = useState(1);
  const pageSize = 24;

  useEffect(() => {
    let active = true;
    fetch(`${import.meta.env.BASE_URL}data/reference-garment-catalog.json`)
      .then(response => { if (!response.ok) throw new Error('تعذر تحميل فهرس المراجع'); return response.json(); })
      .then((value:Catalog) => { if (active) setCatalog(value); })
      .catch((reason:unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'تعذر تحميل الفهرس'); });
    return () => { active = false; };
  }, []);

  const records = useMemo(() => {
    if (!catalog) return [];
    return catalog.records.filter(item => {
      const isPattern = item.hasPattern || item.tutorialWithPattern;
      if (mode === 'patterns' && !isPattern) return false;
      if (category !== 'all' && item.category !== category) return false;
      if (kind === 'direct' && !item.hasPattern) return false;
      if (kind === 'tutorial' && !item.tutorialWithPattern) return false;
      if (kind === 'review' && !item.needsReview) return false;
      const haystack = [item.title,item.categoryAr,...item.tagsAr,...item.detailsAr].join(' ').toLowerCase();
      return haystack.includes(query.trim().toLowerCase());
    });
  },[catalog,mode,category,kind,query]);

  useEffect(() => { setPage(1); },[mode,category,kind,query]);
  const pageCount = Math.max(1,Math.ceil(records.length/pageSize));
  const visible = records.slice((page-1)*pageSize,page*pageSize);

  return <section dir="rtl" className="h-full overflow-y-auto bg-slate-950 p-4 text-slate-100 sm:p-6">
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold text-indigo-300">{mode==='models'?<ImageIcon className="h-4 w-4"/>:<Scissors className="h-4 w-4"/>}{mode==='models'?'مكتبة موديلات الملابس المرجعية':'فهرس مراجع الباترونات'}</div>
          <h1 className="text-xl font-black sm:text-2xl">{mode==='models'?'الموديلات المستوردة من المراجع':'الباترونات المرشحة لإعادة الرسم'}</h1>
          <p className="mt-2 max-w-3xl text-xs leading-6 text-slate-400">{mode==='models'?'تصفح التصاميم المصنفة حسب نوع الملابس. الرسومات الظاهرة توضيحية للفئة وليست صوراً أصلية من ملفات المصدر.':'هذه الملفات مرشحة لاستخراج هندستها وإعادة رسمها. لا تُعرض كباترونات قابلة للتحرير قبل تتبع القطع ومراجعة القياسات والدرزات.'}</p>
        </div>
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/30 px-4 py-3 text-center">
          <div className="text-2xl font-black tabular-nums">{catalog ? (mode==='models'?catalog.total:catalog.records.filter(x=>x.hasPattern||x.tutorialWithPattern).length) : '—'}</div>
          <div className="text-[10px] text-slate-400">{mode==='models'?'سجل مرجعي':'ملف مرشح للباترون'}</div>
        </div>
      </header>

      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="flex flex-1 items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5"><Search className="h-4 w-4 text-slate-500"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ابحث باسم الموديل أو نوعه..." className="w-full bg-transparent text-sm outline-none"/></label>
        <select value={category} onChange={e=>setCategory(e.target.value)} className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm">
          <option value="all">كل الفئات</option>{categoryOrder.map(id=><option key={id} value={id}>{categoryNames[id]}</option>)}
        </select>
        {mode==='patterns'&&<select value={kind} onChange={e=>setKind(e.target.value)} className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm">
          <option value="all">كل المرشحات</option><option value="direct">باترون مصنف مباشرة</option><option value="tutorial">شرح يتضمن باتروناً</option><option value="review">يحتاج مراجعة</option>
        </select>}
      </div>

      {catalog&&<div className="flex flex-wrap gap-2 text-[10px] text-slate-400">
        <span className="rounded-lg bg-slate-900 px-3 py-2">إجمالي الفهرس: {catalog.total}</span>
        <span className="rounded-lg bg-slate-900 px-3 py-2">النتائج: {records.length}</span>
        {mode==='patterns'&&<span className="rounded-lg bg-slate-900 px-3 py-2">التصنيف المباشر: {catalog.records.filter(x=>x.hasPattern).length}</span>}
      </div>}

      {error&&<p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 text-sm text-rose-200">{error}</p>}
      {!catalog&&!error&&<p className="py-12 text-center text-sm text-slate-400">جارٍ تحميل فهرس المراجع…</p>}
      {catalog&&visible.length===0&&<p className="rounded-xl border border-dashed border-slate-700 p-10 text-center text-sm text-slate-400">لا توجد نتائج مطابقة.</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visible.map(item=><article key={item.id} className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
          <GarmentIllustration category={item.category}/>
          <div className="mt-3 flex items-start justify-between gap-2"><div className="min-w-0"><h2 className="line-clamp-2 text-sm font-extrabold leading-6">{item.title}</h2><p className="mt-1 text-[10px] text-indigo-300">{item.categoryAr}</p></div><span className="shrink-0 rounded-md bg-slate-800 px-2 py-1 text-[9px] text-slate-300">{item.pageCount?item.pageCount+' صفحة':'مرجع'}</span></div>
          {item.tagsAr.length>0&&<p className="mt-2 text-[10px] text-slate-300">النوع: {item.tagsAr.join('، ')}</p>}
          {item.detailsAr.length>0&&<p className="mt-1 text-[10px] leading-5 text-slate-400">{item.detailsAr.slice(0,3).join(' · ')}</p>}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {item.hasPattern&&<span className="rounded-md bg-emerald-950/60 px-2 py-1 text-[9px] text-emerald-300">مصنف كباترون</span>}
            {item.tutorialWithPattern&&<span className="rounded-md bg-amber-950/60 px-2 py-1 text-[9px] text-amber-200">شرح مع باترون</span>}
            {item.needsReview&&<span className="rounded-md bg-slate-800 px-2 py-1 text-[9px] text-slate-400">يحتاج مراجعة</span>}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-800 pt-3">
            <span className="text-[9px] text-slate-500">رسم توضيحي للفئة</span>
            <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-indigo-600/20 px-2.5 py-2 text-[10px] font-bold text-indigo-200 hover:bg-indigo-600/40"><BookOpen className="h-3 w-3"/> المصدر الأصلي <ExternalLink className="h-3 w-3"/></a>
          </div>
        </article>)}
      </div>

      {catalog&&pageCount>1&&<div className="flex items-center justify-center gap-3 py-3">
        <button disabled={page===1} onClick={()=>setPage(p=>p-1)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs disabled:opacity-40">السابق</button>
        <span className="text-xs text-slate-400">صفحة {page} من {pageCount}</span>
        <button disabled={page===pageCount} onClick={()=>setPage(p=>p+1)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs disabled:opacity-40">التالي</button>
      </div>}

      <aside className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-3 text-[10px] leading-6 text-amber-100/80">
        <div className="mb-1 flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4"/> حدود الاستيراد والحقوق</div>
        {catalog?.noticeAr} ملفات المصدر في المستودع الخاص وتتطلب صلاحية GitHub. لم تُنشر ملفات PDF أو صور صفحاتها. التصنيف الآلي مبني جزئياً على أسماء الملفات؛ لذلك لا يُعد توثيقاً هندسياً.
      </aside>
      {mode==='patterns'&&<p className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-xs leading-6 text-slate-400">المرحلة التالية لإتاحة التحرير: فحص صفحات كل مرجع، تحديد قطع الأمام والخلف والكم والياقة، تتبع الحدود إلى مسارات SVG بمقياس معلوم، تحويلها إلى CadPiece، ثم اختبار أطوال الدرزات والعلامات والبدلات قبل اعتمادها.</p>}
    </div>
  </section>;
}
