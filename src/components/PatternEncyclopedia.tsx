import React, { useMemo, useState } from 'react';
import { BookOpen, Ruler, Scissors, Layers3, Search, CheckCircle2, Info, ExternalLink, ClipboardCheck } from 'lucide-react';

type Topic = { id: string; title: string; group: string; summary: string; details: string[]; sourcePages: string };

const topics: Topic[] = [
  { id: 'skirt-types', title: 'أنواع الجونلات', group: 'الجونلات', summary: 'تصنيف الموديلات كما تعرضه الموسوعة في بداية باب الجونلات.', details: ['الجونلة العادية: يكون محيط الذيل مساوياً لمحيط الهنش وفق وصف الموديل.', 'الجونلة الضيقة: يضيق الذيل بالمقدار الذي يحدده الموديل.', 'الجونلة الواسعة: تتسع عند الذيل، وقد تتسع عند الهنش أيضاً، ومنها موديلات الكسرات والكشكشة.', 'الجونلة ذات القصات: تقسم إلى أجزاء طولية، ويشار إلى الموديل بعدد القصات.', 'الكلوش وجونلة الزفاف: توصف الموسوعة بأشكال نصف الدائرة أو الدائرة الكاملة.'], sourcePages: 'موسوعة الأجيال، ص 3' },
  { id: 'simple-skirt', title: 'قصّ الجونلة العادية بدون باترون', group: 'الجونلات', summary: 'طريقة تنفيذ مباشرة بالقماش للموديل البسيط كما تشرحها الموسوعة.', details: ['طول قطعة القماش = طول الجونلة المطلوب + 1 سم لثنية الذيل + 1 سم لخياطة الكسر.', 'عرض قطعة القماش = محيط الهنش + 4 سم لخياطة الخلف، بواقع 2 سم لكل ناحية.', 'بعد ثني الذيل، تُجهّز كشكشة الوسط بالخيط أو بالأستيك، ثم يركّب الكمر.', 'طول قطعة الكمر = محيط الوسط + 4 سم. وتذكر الموسوعة عرضاً قدره 8 سم للكمر، مع توزيع بدل الخياطة والثنية داخله.'], sourcePages: 'موسوعة الأجيال، ص 4' },
  { id: 'pattern-skirt', title: 'الانتقال إلى الباترون الأساسي للجونلة', group: 'الباترون', summary: 'متى لا يكفي القص المباشر وتلزم قاعدة باترون.', details: ['الجونلات ذات القصات الدائرية أو المنحنية تحتاج إلى إعداد باترون أساسي أولاً.', 'تطلب الموسوعة أربعة قياسات: محيط الوسط، محيط الهنش، طول الجونلة، والمسافة من الوسط إلى الهنش.', 'تعرض الموسوعة الجزء الأمامي والخلفي منفصلين في خطوات بناء الباترون.', 'تعرّف الموسوعة الباترون بأنه رسم على ورق شفاف وفق مقاسات مأخوذة أو نموذجية.'], sourcePages: 'موسوعة الأجيال، ص 12–14' },
  { id: 'draft-lines', title: 'خطوط إنشاء باترون الجونلة', group: 'الباترون', summary: 'مصطلحات خطوط البناء الواردة في شرح الجزء الخلفي.', details: ['الخط الأفقي العلوي يمثل خط الوسط.', 'الخط الأفقي التالي يمثل خط الهنش.', 'الخط الأفقي السفلي يمثل خط ثنية الذيل.', 'الخط الرأسي الأول يمثل خط نصف الظهر.', 'الخط الرأسي المقابل يمثل خط الجنب.'], sourcePages: 'موسوعة الأجيال، ص 15' },
  { id: 'production', title: 'من التصميم إلى التنفيذ', group: 'التصنيع', summary: 'نطاق العمل الذي تعلنه الموسوعة في مقدمتها.', details: ['تتناول الموسوعة ملابس النساء والرجال والأطفال والملابس المنزلية.', 'تشمل التفصيل الخاص وإنتاج الملابس الجاهزة في المشروعات الصغيرة والمصانع.', 'تؤكد المقدمة على التطبيق العملي من وضع الباترون على القماش حتى التشطيب والكي.'], sourcePages: 'موسوعة الأجيال، المقدمة وص 2' },
  { id: 'embroidery', title: 'التطريز والزخرفة', group: 'التطريز والحرف', summary: 'أبواب التطريز المذكورة في مقدمة الموسوعة.', details: ['التطريز بالخيط والسيرما.', 'التطريز بالخرز واللؤلؤ والأحجار.', 'رسم أشكال التطريز على الورق ثم نقلها إلى القماش.', 'اختيار الخامات والألوان اللازمة للتنفيذ.'], sourcePages: 'موسوعة الأجيال، المقدمة وص 2' },
  { id: 'knit-crochet', title: 'التريكو والكروشيه', group: 'التطريز والحرف', summary: 'تذكر المقدمة تخصيص أبواب للتريكو والكروشيه.', details: ['تتضمن الموسوعة أبواباً مخصصة لفن التريكو والكروشيه.', 'لم تُستخرج بعد تفاصيل تقنيات هذه الأبواب؛ ستضاف بعد مراجعة صفحاتها المصورة.'], sourcePages: 'موسوعة الأجيال، المقدمة وص 2' },
  { id: 'iso-measurement', title: 'تعريف قياسات الجسم ونقاط الاستدلال', group: 'القياسات والملاءمة', summary: 'مرجع معياري لتعريف القياسات الأنثروبومترية المستخدمة في تطوير الملابس وقواعد بيانات المقاسات.', details: ['يفصل ISO 8559-1 تعريفات قياسات الجسم ونقاط الاستدلال والخطوط والمستويات التشريحية.', 'من نقاط الاستدلال: نقطة الكتف، نقطة الصدر، مستوى الخصر، مستوى الورك، ومستوى أعلى الفخذ.', 'يشمل نطاق القياسات أطوالاً رأسية، وعروضاً وأعماقاً، ومحيطات، ومسافات على سطح الجسم، وقياسات محسوبة.', 'يهدف المعيار إلى توحيد وصف القياسات وبناء قواعد بيانات جسمية قابلة للمقارنة؛ ولا يفرض جدول مقاسات تجارياً واحداً لكل البلدان.'], sourcePages: 'ISO 8559-1:2017، أكدت ISO سريانه بعد مراجعة 2026' },
  { id: 'measurement-practice', title: 'تسجيل القياسات بطريقة قابلة للتكرار', group: 'القياسات والملاءمة', summary: 'إرشادات تشغيلية لتنظيم سجل القياسات بالاستناد إلى أهمية توحيد تعريف القياس.', details: ['سجّل اسم القياس وتعريف نقطة بدايته ونهايته، ولا تكتفِ باسم مختصر قد يختلف تفسيره.', 'استخدم وحدة واحدة في سجل القياسات، ودوّن الوحدة بوضوح مع كل مجموعة.', 'ميّز بين القياس المحيطي والطولي والعرض أو العمق؛ فهي أنواع مختلفة.', 'أعد القياس عند ظهور قيمة غير منطقية أو اختلاف ملحوظ، وسجّل القياس الفعلي بدلاً من تغييره ليلائم مقاساً جاهزاً.', 'هذه إرشادات تشغيلية داخل الاستوديو وليست نقلاً حرفياً عن ISO؛ راجع نص المعيار الكامل عند إعداد بروتوكول رسمي.'], sourcePages: 'إرشاد تطبيقي مبني على ISO 8559-1' },
  { id: 'blocks-library', title: 'البلوكات الأساسية ومسارات التعلم', group: 'الباترون', summary: 'موارد تعليمية مفتوحة تبدأ بالبلوكات الأساسية ثم تنتقل إلى تفاصيل التصميم.', details: ['تتضمن موارد التعليم بلوك التنورة الأساسي وبلوك الجذع الأساسي وتطوير تصميم الجذع.', 'تشمل موضوعات التدريب أنماط الأكمام والياقات والجيوب وتقنيات الخياطة الأساسية والمتقدمة.', 'ابدأ ببلوك أساسي واضح، ثم نفّذ تحويلات التصميم على نسخة منفصلة حتى يبقى الأصل محفوظاً للمقارنة.', 'وجود عنوان تعليمي في فهرس المورد لا يعني أن قواعده الحسابية أُدخلت في محرك التوليد الحالي.'], sourcePages: 'Education Bureau، موارد Clothing Technology' },
  { id: 'draping-fit', title: 'التشكيل على المانيكان وفحص العينة', group: 'القياسات والملاءمة', summary: 'يعرض مورد جامعة كورنيل خطوات التشكيل وموازنة القطعة وفحص عينة القماش على الجسم.', details: ['يشرح المورد التشكيل على المانيكان لفهم علاقة القماش بالشكل ثلاثي الأبعاد للجسم.', 'يتضمن مسار العمل موازنة القطعة بعد التشكيل ثم فحص العينة التجريبية على الجسم.', 'قبل اعتماد الباترون، افحص توازن الأمام والخلف، وموقع خطوط الوسط والورك، وراحة الحركة، وتطابق الدرزات.', 'قائمة الفحص توصية تشغيلية للاستوديو؛ ولا يحدد المورد قيماً رقمية موحدة لهذه الاختبارات.'], sourcePages: 'Cornell University، Patternmaking / Draping' },
  { id: 'pattern-validation', title: 'فحص الباترون قبل القص', group: 'التصنيع', summary: 'قائمة تحقق هندسية مقترحة للاستوديو قبل نقل القطع إلى القماش.', details: ['تأكد من اتصال حدود كل قطعة وإغلاقها عندما تكون قطعة القص مغلقة.', 'افحص عدم وجود حواف صفرية الطول أو تقاطعات ذاتية أو زوايا حادة تولّد سماحات غير مستقرة.', 'طابق أطوال الدرزات التي ستخاط معاً، وحدد مواضع التوسيع أو الكشكشة المقصودة.', 'أظهر خط النسيج، وخط الثني، وعلامات التطابق، وعدد القطع، واسم القطعة قبل الطباعة.', 'اطبع مربع معايرة معلوم الأبعاد، وقِس الناتج على الورق قبل قص القماش.', 'نفّذ عينة تجريبية من قماش قريب في السلوك من القماش النهائي؛ لا تعتمد الشكل الرقمي وحده لإثبات الملاءمة.'], sourcePages: 'قائمة تحقق هندسية داخل الاستوديو؛ ليست معيار ISO' }
];

const groups = ['الكل', 'الجونلات', 'القياسات والملاءمة', 'الباترون', 'التصنيع', 'التطريز والحرف'];
const references = [
  { title: 'ISO 8559-1:2017 — تعريفات قياسات الجسم', org: 'المنظمة الدولية للتوحيد القياسي ISO', kind: 'معيار', desc: 'تعريف القياسات ونقاط الجسم؛ تؤكد صفحة ISO أن الإصدار تمت مراجعته في 2026 وما زال سارياً.', url: 'https://www.iso.org/standard/61686.html' },
  { title: 'Patternmaking / Draping', org: 'جامعة كورنيل', kind: 'مورد جامعي', desc: 'دروس في التشكيل على المانيكان، موازنة القطعة، وفحص العينة والملاءمة.', url: 'https://fit.cit.cornell.edu/textiles/index.html' },
  { title: 'Clothing Technology — Pattern and Garment Construction', org: 'Education Bureau, Hong Kong', kind: 'موارد تعليمية', desc: 'مواد عن بلوك التنورة والجذع والأكمام والياقات والجيوب وتقنيات الخياطة.', url: 'https://www.edb.gov.hk/en/curriculum-development/kla/technology-edu/resources/technology-and-living/Clothing_Technology.html' },
  { title: 'Fashion Design: Construction & Textiles', org: 'مكتبة جامعة VCU', kind: 'دليل مكتبة', desc: 'دليل ببليوغرافي لمراجع بناء الباترون والخياطة والتفصيل وتقنيات النسيج.', url: 'https://guides.library.vcu.edu/fashion-design/construction' }
];
const checks = ['تأكيد أسماء القطع واتجاه الأمام والخلف', 'تأكيد وحدة القياس ومقياس الطباعة 100%', 'فحص إغلاق الحدود وعدم وجود تقاطعات ذاتية', 'مطابقة أطوال الدرزات المتقابلة', 'إظهار خط النسيج وخط الثني وعلامات التطابق', 'تجربة مربع المعايرة بعد الطباعة', 'خياطة عينة تجريبية وفحص الحركة والراحة'];

export function PatternEncyclopedia() {
  const [group, setGroup] = useState('الكل');
  const [query, setQuery] = useState('');
  const [checked, setChecked] = useState<string[]>([]);
  const filtered = useMemo(() => topics.filter(topic => {
    const text = [topic.title, topic.summary, topic.group, ...topic.details, topic.sourcePages].join(' ');
    return (group === 'الكل' || topic.group === group) && text.toLowerCase().includes(query.trim().toLowerCase());
  }), [group, query]);
  const progress = Math.round(checked.length / checks.length * 100);

  return (
    <section dir="rtl" className="h-full overflow-y-auto bg-slate-950 text-slate-100 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-5">
        <header className="border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-300 mb-2"><BookOpen className="w-4 h-4" /> مكتبة المراجع التعليمية</div>
          <h1 className="text-xl sm:text-2xl font-black">موسوعة الباترون والتفصيل</h1>
          <p className="text-sm text-slate-400 mt-2 max-w-3xl leading-6">تجمع المكتبة ما تمت مراجعته من موسوعة الأجيال، وتضيف مراجع تعليمية مفتوحة ومعياراً لقياسات الجسم. نوضح مصدر كل معلومة وحدودها، ولا نحوّل الإرشادات العامة إلى معادلات توليد غير مختبرة.</p>
        </header>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3"><Ruler className="w-5 h-5 text-indigo-300 mb-2" /><div className="font-bold text-sm">القياسات والملاءمة</div><p className="text-xs text-slate-400 mt-1">تعريف نقاط الجسم، تسجيل القياسات، وفحص العينة.</p></div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3"><Scissors className="w-5 h-5 text-indigo-300 mb-2" /><div className="font-bold text-sm">القص والتنفيذ</div><p className="text-xs text-slate-400 mt-1">مقاسات القماش وبدلات الخياطة والكمر والثنيات.</p></div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3"><Layers3 className="w-5 h-5 text-indigo-300 mb-2" /><div className="font-bold text-sm">البلوكات والتصميم</div><p className="text-xs text-slate-400 mt-1">الجذع والتنورة والأكمام والياقات والجيوب.</p></div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1"><Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="ابحث في الموضوعات والمراجع..." className="w-full rounded-xl bg-slate-900 border border-slate-800 pr-10 pl-3 py-3 text-sm outline-none focus:border-indigo-500" /></div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">{groups.map(item => <button key={item} onClick={() => setGroup(item)} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold border transition-colors ${group === item ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>{item}</button>)}</div>
        </div>
        <div className="space-y-3">
          {filtered.map(topic => <article key={topic.id} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><span className="text-[10px] text-indigo-300 font-bold">{topic.group}</span><h2 className="font-extrabold text-base mt-1">{topic.title}</h2></div><span className="text-[10px] text-slate-500 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1">المصدر: {topic.sourcePages}</span></div>
            <p className="text-sm text-slate-400 leading-6 mt-2">{topic.summary}</p>
            <ul className="mt-3 space-y-2">{topic.details.map((detail, index) => <li key={index} className="flex gap-2 text-sm text-slate-300 leading-6"><CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-1" /><span>{detail}</span></li>)}</ul>
          </article>)}
          {filtered.length === 0 && <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-500">لا توجد موضوعات مطابقة للبحث.</div>}
        </div>
        <section className="rounded-2xl border border-indigo-900/60 bg-indigo-950/20 p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2"><ClipboardCheck className="w-5 h-5 text-indigo-300" /><h2 className="font-extrabold">قائمة فحص الباترون قبل القص</h2></div>
          <p className="text-xs text-slate-400 leading-5">علّم البنود بعد فحصها فعلياً. هذه القائمة لا تعتمد القطعة تلقائياً ولا تستبدل تجربة العينة.</p>
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden"><div className="h-full bg-indigo-500 transition-all" style={{ width: `${progress}%` }} /></div>
          <div className="flex items-center justify-between text-xs text-slate-400"><span>{checked.length} من {checks.length} بنود</span><span>{progress}%</span></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{checks.map(item => <label key={item} className="flex items-start gap-2 rounded-lg bg-slate-900/80 border border-slate-800 p-3 text-xs text-slate-300 leading-5 cursor-pointer"><input type="checkbox" checked={checked.includes(item)} onChange={event => setChecked(current => event.target.checked ? [...current, item] : current.filter(value => value !== item))} className="mt-0.5 accent-indigo-500" /><span>{item}</span></label>)}</div>
          {checked.length > 0 && <button onClick={() => setChecked([])} className="text-xs text-indigo-300 hover:text-indigo-200 font-bold">إعادة ضبط القائمة</button>}
        </section>
        <section className="space-y-3">
          <div className="flex items-center gap-2"><BookOpen className="w-5 h-5 text-indigo-300" /><h2 className="font-extrabold">المصادر المفتوحة والمعايير</h2></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{references.map(reference => <article key={reference.url} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center justify-between gap-2"><span className="text-[10px] rounded-full bg-slate-800 px-2 py-1 text-indigo-200">{reference.kind}</span><ExternalLink className="w-4 h-4 text-slate-500" /></div>
            <h3 className="font-bold text-sm mt-3">{reference.title}</h3><p className="text-[11px] text-indigo-300 mt-1">{reference.org}</p><p className="text-xs text-slate-400 leading-5 mt-2">{reference.desc}</p>
            <a href={reference.url} target="_blank" rel="noreferrer" className="inline-flex mt-3 text-xs font-bold text-indigo-300 hover:text-indigo-200 underline underline-offset-4">فتح المصدر</a>
          </article>)}</div>
        </section>
        <div className="rounded-xl border border-amber-900/60 bg-amber-950/20 p-4 flex gap-3"><Info className="w-5 h-5 shrink-0 text-amber-300" /><div className="text-xs text-amber-100/80 leading-6"><strong className="text-amber-200">حدود المحتوى:</strong> قواعد الجونلة المنسوبة إلى موسوعة الأجيال مرتبطة بالصفحات المشار إليها. أما ISO فيعرّف القياسات ونقاط الجسم ولا يحدد وحده طريقة رسم كل باترون. والموارد الجامعية والتعليمية مراجع للتعلم وليست اعتماداً هندسياً للمخرجات الحالية.</div></div>
      </div>
    </section>
  );
}
