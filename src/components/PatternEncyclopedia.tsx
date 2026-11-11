import React, { useMemo, useState } from 'react';
import { BookOpen, Ruler, Scissors, Layers3, Sparkles, Search, CheckCircle2, Info } from 'lucide-react';

type Topic = {
  id: string;
  title: string;
  group: string;
  summary: string;
  details: string[];
  sourcePages: string;
};

const topics: Topic[] = [
  {
    id: 'skirt-types',
    title: 'أنواع الجونلات',
    group: 'الجونلات',
    summary: 'تصنيف الموديلات كما تعرضه الموسوعة في بداية باب الجونلات.',
    details: [
      'الجونلة العادية: يكون محيط الذيل مساوياً لمحيط الهنش وفق الوصف الوارد للموديل.',
      'الجونلة الضيقة: يضيق الذيل بالمقدار الذي يحدده الموديل.',
      'الجونلة الواسعة: تتسع عند الذيل، وقد تتسع عند الهنش أيضاً، ومنها موديلات الكسرات والكشكشة.',
      'الجونلة ذات القصات: تقسم إلى أجزاء طولية، ويُشار إلى الموديل بعدد القصات.',
      'الكلوش وجونلة الزفاف: توصف الموسوعة بأشكال نصف الدائرة أو الدائرة الكاملة.'
    ],
    sourcePages: 'ص 3'
  },
  {
    id: 'simple-skirt',
    title: 'قصّ الجونلة العادية بدون باترون',
    group: 'الجونلات',
    summary: 'طريقة تنفيذ مباشرة بالقماش للموديل البسيط كما تشرحها الموسوعة.',
    details: [
      'طول قطعة القماش = طول الجونلة المطلوب + 1 سم لثنية الذيل + 1 سم لخياطة الكسر.',
      'عرض قطعة القماش = محيط الهنش + 4 سم لخياطة الخلف، بواقع 2 سم لكل ناحية.',
      'بعد ثني الذيل، تُجهّز كشكشة الوسط بالخيط أو بالأستيك، ثم يركّب الكمر.',
      'طول قطعة الكمر = محيط الوسط + 4 سم. وتذكر الموسوعة عرضاً قدره 8 سم للكمر، مع توزيع بدل الخياطة والثنية داخله.'
    ],
    sourcePages: 'ص 4'
  },
  {
    id: 'pattern-skirt',
    title: 'الانتقال إلى الباترون الأساسي للجونلة',
    group: 'الباترون',
    summary: 'توضح الموسوعة متى لا يكفي القص المباشر وتلزم قاعدة باترون.',
    details: [
      'الجونلات ذات القصات الدائرية أو المنحنية تحتاج إلى إعداد باترون أساسي أولاً.',
      'تطلب الموسوعة أربعة قياسات للجونلة: محيط الوسط، محيط الهنش، طول الجونلة، والمسافة من الوسط إلى الهنش.',
      'تعرض الموسوعة الجزء الأمامي والجزء الخلفي منفصلين في خطوات بناء الباترون.',
      'تعرّف الموسوعة الباترون بأنه رسم على ورق شفاف وفق مقاسات مأخوذة أو نموذجية.'
    ],
    sourcePages: 'ص 12–14'
  },
  {
    id: 'draft-lines',
    title: 'خطوط إنشاء باترون الجونلة',
    group: 'الباترون',
    summary: 'مصطلحات خطوط البناء الواردة في شرح الجزء الخلفي.',
    details: [
      'الخط الأفقي العلوي يمثل خط الوسط.',
      'الخط الأفقي التالي يمثل خط الهنش.',
      'الخط الأفقي السفلي يمثل خط ثنية الذيل.',
      'الخط الرأسي الأول يمثل خط نصف الظهر.',
      'الخط الرأسي المقابل يمثل خط الجنب.',
      'هذه الخطوط مرجع لتحديد مواضع البناء قبل رسم حدود القطعة.'
    ],
    sourcePages: 'ص 15'
  },
  {
    id: 'production',
    title: 'من التصميم إلى التنفيذ',
    group: 'التصنيع',
    summary: 'نطاق العمل الذي تعلنه الموسوعة في مقدمتها.',
    details: [
      'تتناول الموسوعة ملابس النساء والرجال والأطفال والملابس المنزلية.',
      'تشمل التفصيل الخاص وكذلك إنتاج الملابس الجاهزة في المشروعات الصغيرة والمصانع.',
      'تؤكد المقدمة على التطبيق العملي من وضع الباترون على القماش حتى التشطيب والكي.'
    ],
    sourcePages: 'المقدمة، ص 2'
  },
  {
    id: 'embroidery',
    title: 'التطريز والزخرفة',
    group: 'التطريز والحرف',
    summary: 'أبواب التطريز المذكورة في مقدمة الموسوعة.',
    details: [
      'التطريز بالخيط والسيرما.',
      'التطريز بالخرز واللؤلؤ والأحجار.',
      'رسم أشكال التطريز على الورق ثم نقلها إلى القماش.',
      'اختيار الخامات والألوان اللازمة للتنفيذ.'
    ],
    sourcePages: 'المقدمة، ص 2'
  },
  {
    id: 'knit-crochet',
    title: 'التريكو والكروشيه',
    group: 'التطريز والحرف',
    summary: 'تذكر المقدمة تخصيص أبواب للتريكو والكروشيه.',
    details: [
      'تتضمن الموسوعة أبواباً مخصصة لفن التريكو والكروشيه.',
      'لم تُستخرج بعد تفاصيل تقنيات هذه الأبواب؛ ستُضاف بعد مراجعة صفحاتها المصورة.'
    ],
    sourcePages: 'المقدمة، ص 2'
  }
];

const groups = ['الكل', 'الجونلات', 'الباترون', 'التصنيع', 'التطريز والحرف'];

export function PatternEncyclopedia() {
  const [group, setGroup] = useState('الكل');
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => topics.filter(topic => {
    const inGroup = group === 'الكل' || topic.group === group;
    const text = [topic.title, topic.summary, topic.group, ...topic.details].join(' ');
    return inGroup && text.toLowerCase().includes(query.trim().toLowerCase());
  }), [group, query]);

  return (
    <section dir="rtl" className="h-full overflow-y-auto bg-slate-950 text-slate-100 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-5">
        <header className="border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-300 mb-2">
            <BookOpen className="w-4 h-4" /> مكتبة المراجع التعليمية
          </div>
          <h1 className="text-xl sm:text-2xl font-black">موسوعة الأجيال للتفصيل</h1>
          <p className="text-sm text-slate-400 mt-2 max-w-3xl leading-6">
            قاعدة معرفة أولية مستخلصة من الصفحات التي تمت مراجعتها. تُعرض القواعد بصياغة تعليمية مع أرقام الصفحات، ولا تُعامل المعادلات غير الواضحة في النسخة المصورة على أنها قواعد معتمدة.
          </p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
            <Ruler className="w-5 h-5 text-indigo-300 mb-2" />
            <div className="font-bold text-sm">القياسات والباترون</div>
            <p className="text-xs text-slate-400 mt-1">قياسات الوسط والهنش والأطوال وخطوط الإنشاء.</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
            <Scissors className="w-5 h-5 text-indigo-300 mb-2" />
            <div className="font-bold text-sm">القص والتنفيذ</div>
            <p className="text-xs text-slate-400 mt-1">مقاسات القماش وبدلات الخياطة والكمر والثنيات.</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
            <Layers3 className="w-5 h-5 text-indigo-300 mb-2" />
            <div className="font-bold text-sm">مجالات الموسوعة</div>
            <p className="text-xs text-slate-400 mt-1">ملابس متنوعة، تصنيع جاهز، تطريز، تريكو وكروشيه.</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="ابحث في موضوعات الموسوعة..." className="w-full rounded-xl bg-slate-900 border border-slate-800 pr-10 pl-3 py-3 text-sm outline-none focus:border-indigo-500" />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {groups.map(item => (
              <button key={item} onClick={() => setGroup(item)} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold border transition-colors ${group === item ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {filtered.map(topic => (
            <article key={topic.id} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] text-indigo-300 font-bold">{topic.group}</span>
                  <h2 className="font-extrabold text-base mt-1">{topic.title}</h2>
                </div>
                <span className="text-[10px] text-slate-500 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1">المرجع: {topic.sourcePages}</span>
              </div>
              <p className="text-sm text-slate-400 leading-6 mt-2">{topic.summary}</p>
              <ul className="mt-3 space-y-2">
                {topic.details.map((detail, index) => (
                  <li key={index} className="flex gap-2 text-sm text-slate-300 leading-6">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-1" />
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
          {filtered.length === 0 && <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-500">لا توجد موضوعات مطابقة للبحث.</div>}
        </div>

        <div className="rounded-xl border border-amber-900/60 bg-amber-950/20 p-4 flex gap-3">
          <Info className="w-5 h-5 shrink-0 text-amber-300" />
          <div className="text-xs text-amber-100/80 leading-6">
            <strong className="text-amber-200">تنبيه هندسي:</strong> هذه النسخة فهرسة تعليمية أولية وليست مولّد باترونات. بعض صفحات الموسوعة مصورة دون نص قابل للاستخراج؛ لذلك لن نُدخل أرقاماً أو معادلات غير مقروءة. تُراجع القواعد رقمياً وتُختبر قبل ربطها بمحرّك CAD أو اعتمادها للقص.
          </div>
        </div>
      </div>
    </section>
  );
}
