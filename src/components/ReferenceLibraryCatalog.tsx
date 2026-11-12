import React, { useEffect, useMemo, useState } from 'react';
import { Search, ExternalLink, BookOpen, Scissors, Image as ImageIcon, AlertTriangle, Ruler, Sparkles } from 'lucide-react';

type ReferenceRecord = {
  id: string;
  displayTitleAr: string;
  categoryId: string;
  categoryAr: string;
  familyShape: string;
  sourceTitle: string;
  sourcePageCount: number | null;
  sourceClassification: string;
  contentGroup: 'design_candidate' | 'pattern_reference' | 'tutorial_pattern' | 'technique';
  contentGroupAr: string;
  featureTagsAr: string[];
  extractedTagsAr: string[];
  designDetailsAr: string[];
  evidenceLevel: string;
  requiresPageReview: boolean;
  isEditablePattern: boolean;
  rightsStatus: string;
  originalIllustration: boolean;
  sourceUrl: string;
};
type Catalog = {
  totalRecords: number;
  summary: Record<string, number>;
  noticeAr: string;
  rightsPolicyAr: string;
  records: ReferenceRecord[];
};
type Props = { mode: 'models' | 'patterns' };

const categoryOrder = ['بلوزات_وتوبات','فساتين','بناطيل','تنانير','معاطف_وسترات','أفرولات','شورتات','ملابس_داخلية','أنماط_أخرى'];
const categoryNames: Record<string,string> = {
  'بلوزات_وتوبات':'بلوزات وتوبات','فساتين':'فساتين','بناطيل':'بناطيل','تنانير':'تنانير',
  'معاطف_وسترات':'معاطف وسترات','أفرولات':'أفرولات','شورتات':'شورتات',
  'ملابس_داخلية':'ملابس داخلية','أنماط_أخرى':'متنوعات وتقنيات'
};

function GarmentIllustration({item}:{item:ReferenceRecord}) {
  const stroke = { fill: 'none', stroke: '#c7d2fe', strokeWidth: 2.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const tags = item.featureTagsAr.join(' ');
  const sleeveless = /بلا أكمام|حمالات/.test(tags);
  const longSleeve = /أكمام طويلة/.test(tags);
  const vNeck = /ياقة V/.test(tags);
  const collar = /ياقة/.test(tags) && !vNeck;
  const flare = /واسعة|متسع|دائرية|A/.test(tags);
  const frill = /كشكشة|تجميعات/.test(tags);
  const asym = /غير متماثل/.test(tags);
  const upperBody = !['trousers','shorts','skirt'].includes(item.familyShape);
  const arms = !upperBody || sleeveless ? null : <path {...stroke} d={longSleeve ? "M39 29 L20 45 L11 79 L20 82 L34 54 M77 29 L96 45 L105 79 L96 82 L82 54" : "M39 29 L21 42 L29 56 L40 49 M77 29 L95 42 L87 56 L76 49"} />;
  let body: React.ReactNode;
  switch (item.familyShape) {
    case 'dress':
      body = <path {...stroke} d={flare ? "M43 18 L57 18 L63 33 L76 39 L96 96 L20 96 L40 39 L51 33 Z" : "M43 18 L57 18 L63 33 L75 39 L82 96 L34 96 L41 39 L51 33 Z"} />;
      break;
    case 'skirt':
      body = <path {...stroke} d={flare ? "M42 23 L74 23 L97 96 L19 96 Z" : "M42 23 L74 23 L83 96 L33 96 Z"} />;
      break;
    case 'trousers':
      body = <path {...stroke} d="M34 22 L82 22 L78 96 L61 96 L58 52 L55 96 L38 96 Z" />;
      break;
    case 'shorts':
      body = <path {...stroke} d="M34 22 L82 22 L78 63 L63 63 L58 48 L53 63 L38 63 Z" />;
      break;
    case 'outerwear':
      body = <path {...stroke} d="M41 18 L58 27 L75 18 L91 39 L79 49 L76 96 L40 96 L37 49 L25 39 Z M58 27 L58 96 M47 42 L54 51 M69 42 L62 51" />;
      break;
    case 'jumpsuit':
      body = <path {...stroke} d="M40 18 L76 18 L84 37 L75 46 L72 96 L61 96 L58 54 L55 96 L44 96 L41 46 L32 37 Z M44 18 L47 34 L69 34 L72 18" />;
      break;
    case 'intimates':
      body = <path {...stroke} d="M34 38 Q42 18 55 38 Q68 18 80 38 L86 56 L72 60 L67 48 L64 78 L48 78 L45 48 L40 60 L27 56 Z" />;
      break;
    default:
      body = <path {...stroke} d="M41 18 L58 27 L75 18 L91 39 L79 49 L76 96 L40 96 L37 49 L25 39 Z" />;
  }
  const neckline = !upperBody ? null : vNeck
    ? <path {...stroke} d="M48 29 L58 43 L68 29" />
    : collar
      ? <path {...stroke} d="M48 28 L58 39 L68 28 M58 39 L58 53" />
      : <path {...stroke} d="M49 28 Q58 37 67 28" />;
  const decorative = <g {...stroke}>
    {frill && <path d="M43 42 Q49 36 55 42 T67 42 T79 42" strokeDasharray="2 3" />}
    {asym && <path d="M43 61 L74 76" />}
    {item.familyShape === 'outerwear' && <path d="M68 50 L68 75 M64 58 L72 58" />}
  </g>;
  return <div className="relative flex h-36 items-center justify-center overflow-hidden rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900">
    <svg viewBox="0 0 116 110" role="img" aria-label={`رسم تصوري أصلي: ${item.displayTitleAr}`} className="h-32 w-32">
      <defs><linearGradient id={`g-${item.id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#a5b4fc" stopOpacity=".18"/><stop offset="100%" stopColor="#818cf8" stopOpacity=".02"/></linearGradient></defs>
      <circle cx="58" cy="55" r="47" fill={`url(#g-${item.id})`} />
      {body}{arms}{neckline}{decorative}
      <path d="M15 101 H101" stroke="#475569" strokeWidth="1.3" strokeDasharray="3 4" />
    </svg>
    <span className="absolute bottom-2 left-2 rounded-md border border-indigo-400/20 bg-slate-950/75 px-2 py-1 text-[9px] text-indigo-200">رسم تصوري أصلي</span>
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
      const isPattern = item.contentGroup === 'pattern_reference' || item.contentGroup === 'tutorial_pattern';
      if (mode === 'patterns' && !isPattern) return false;
      if (mode === 'models' && item.contentGroup !== 'design_candidate' && item.contentGroup !== 'technique') return false;
      if (category !== 'all' && item.categoryId !== category) return false;
      if (kind !== 'all' && item.contentGroup !== kind) return false;
      const haystack = [item.displayTitleAr,item.categoryAr,item.sourceTitle,item.contentGroupAr,...item.featureTagsAr,...item.extractedTagsAr,...item.designDetailsAr].join(' ').toLowerCase();
      return haystack.includes(query.trim().toLowerCase());
    });
  },[catalog,mode,category,kind,query]);

  useEffect(() => { setPage(1); },[mode,category,kind,query]);
  const pageCount = Math.max(1,Math.ceil(records.length/pageSize));
  const visible = records.slice((page-1)*pageSize,page*pageSize);
  const patternCount = catalog ? (catalog.summary.pattern_reference||0)+(catalog.summary.tutorial_pattern||0) : 0;
  const modelCount = catalog ? (catalog.summary.design_candidate||0)+(catalog.summary.technique||0) : 0;

  return <section dir="rtl" className="h-full overflow-y-auto bg-slate-950 p-4 text-slate-100 sm:p-6">
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold text-indigo-300">{mode==='models'?<ImageIcon className="h-4 w-4"/>:<Scissors className="h-4 w-4"/>}{mode==='models'?'مكتبة التصميمات والموديلات':'مراجع الباترونات وتقنيات إعدادها'}</div>
          <h1 className="text-xl font-black sm:text-2xl">{mode==='models'?'مكتبة موديلات وتصميمات الملابس':'فهرس مراجع الباترونات'}</h1>
          <p className="mt-2 max-w-3xl text-xs leading-6 text-slate-400">{mode==='models'?'تصنيف عربي للموديلات المرشحة والتقنيات. الرسومات تصورات أصلية مولّدة من الفئة والسمات النصية، وليست صورًا للمصدر أو توثيقًا مطابقًا له.':'مراجع مرشحة للاستفادة في تطوير قواعد باترونات مستقلة. هذه ليست ملفات باترون قابلة للقص أو التحرير؛ يلزم التحقق الهندسي من كل نموذج قبل اعتماده.'}</p>
        </div>
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/30 px-4 py-3 text-center">
          <div className="text-2xl font-black tabular-nums">{catalog ? (mode==='models'?modelCount:patternCount) : '—'}</div>
          <div className="text-[10px] text-slate-400">{mode==='models'?'تصميم وتقنية مفهرسة':'مرجع باترون مرشح'}</div>
        </div>
      </header>

      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="flex flex-1 items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5"><Search className="h-4 w-4 text-slate-500"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ابحث باسم التصميم أو تفاصيله..." className="w-full bg-transparent text-sm outline-none"/></label>
        <select value={category} onChange={e=>setCategory(e.target.value)} className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm">
          <option value="all">كل الفئات</option>{categoryOrder.map(id=><option key={id} value={id}>{categoryNames[id]}</option>)}
        </select>
        <select value={kind} onChange={e=>setKind(e.target.value)} className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm">
          {mode==='models' ? <><option value="all">كل التصميمات والتقنيات</option><option value="design_candidate">تصميمات مرشحة</option><option value="technique">تقنيات وشروحات</option></> : <><option value="all">كل مراجع الباترونات</option><option value="pattern_reference">مرجع مصنف للباترون</option><option value="tutorial_pattern">شرح يتضمن باترونًا</option></>}
        </select>
      </div>

      {catalog&&<div className="flex flex-wrap gap-2 text-[10px] text-slate-400">
        <span className="rounded-lg bg-slate-900 px-3 py-2">كل السجلات: {catalog.totalRecords}</span>
        <span className="rounded-lg bg-slate-900 px-3 py-2">نتائج هذا القسم: {records.length}</span>
        <span className="rounded-lg bg-slate-900 px-3 py-2">تصميمات مرشحة: {catalog.summary.design_candidate||0}</span>
        <span className="rounded-lg bg-slate-900 px-3 py-2">تقنيات: {catalog.summary.technique||0}</span>
        <span className="rounded-lg bg-slate-900 px-3 py-2">مراجع باترونات: {patternCount}</span>
      </div>}

      {error&&<p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 text-sm text-rose-200">{error}</p>}
      {!catalog&&!error&&<p className="py-12 text-center text-sm text-slate-400">جارٍ تحميل المكتبة…</p>}
      {catalog&&visible.length===0&&<p className="rounded-xl border border-dashed border-slate-700 p-10 text-center text-sm text-slate-400">لا توجد نتائج مطابقة.</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visible.map(item=><article key={item.id} className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
          <GarmentIllustration item={item}/>
          <div className="mt-3 flex items-start justify-between gap-2"><div className="min-w-0"><h2 className="line-clamp-2 text-sm font-extrabold leading-6">{item.displayTitleAr}</h2><p className="mt-1 text-[10px] text-indigo-300">{item.categoryAr}</p></div><span className="shrink-0 rounded-md bg-slate-800 px-2 py-1 text-[9px] text-slate-300">{item.sourcePageCount?item.sourcePageCount+' صفحة':'مرجع'}</span></div>
          {item.featureTagsAr.length>0&&<p className="mt-2 text-[10px] text-slate-300">سمات التصميم: {item.featureTagsAr.join('، ')}</p>}
          {item.extractedTagsAr.length>0&&<p className="mt-1 text-[10px] leading-5 text-slate-400">وسوم الفهرس: {item.extractedTagsAr.join('، ')}</p>}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="rounded-md bg-indigo-950/60 px-2 py-1 text-[9px] text-indigo-200">{item.contentGroupAr}</span>
            {item.contentGroup==='pattern_reference'&&<span className="rounded-md bg-emerald-950/60 px-2 py-1 text-[9px] text-emerald-300">مرجع باترون</span>}
            {item.contentGroup==='tutorial_pattern'&&<span className="rounded-md bg-amber-950/60 px-2 py-1 text-[9px] text-amber-200">شرح مع باترون</span>}
            <span className="rounded-md bg-slate-800 px-2 py-1 text-[9px] text-slate-400">العنوان فقط — يحتاج مراجعة صفحات</span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-800 pt-3">
            <span className="text-[9px] text-slate-500">لا يمثل رسم المصدر</span>
            <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-indigo-600/20 px-2.5 py-2 text-[10px] font-bold text-indigo-200 hover:bg-indigo-600/40"><BookOpen className="h-3 w-3"/> بيانات المرجع <ExternalLink className="h-3 w-3"/></a>
          </div>
        </article>)}
      </div>

      {catalog&&pageCount>1&&<div className="flex items-center justify-center gap-3 py-3">
        <button disabled={page===1} onClick={()=>setPage(p=>p-1)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs disabled:opacity-40">السابق</button>
        <span className="text-xs text-slate-400">صفحة {page} من {pageCount}</span>
        <button disabled={page===pageCount} onClick={()=>setPage(p=>p+1)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs disabled:opacity-40">التالي</button>
      </div>}

      <aside className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-3 text-[10px] leading-6 text-amber-100/80">
        <div className="mb-1 flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4"/> سياسة المحتوى والحقوق</div>
        {catalog?.noticeAr} {catalog?.rightsPolicyAr}
      </aside>
      {mode==='patterns'&&<p className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-xs leading-6 text-slate-400"><Ruler className="ml-1 inline h-4 w-4"/> لا يُعرض أي مرجع على أنه باترون قابل للتحرير. إنشاء الباترون الأصلي يتطلب اشتقاق قاعدة مستقلة من القياسات العامة، بناء قطع CAD، ضبط المقياس والبدلات واتجاه النسيج، ثم اختبار توازن الحواف والدرزات والتدريج قبل نشره.</p>}
      {mode==='models'&&<p className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-xs leading-6 text-slate-400"><Sparkles className="ml-1 inline h-4 w-4"/> يمكن تحويل هذه التصورات إلى موديلات تطبيقية أصلية بعد مراجعة التفاصيل المطلوبة وتحديد القياسات والراحة والخامة، ثم ربطها بمحرك الباترون والمعاينة ثلاثية الأبعاد.</p>}
    </div>
  </section>;
}
