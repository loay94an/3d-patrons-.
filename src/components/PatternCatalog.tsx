import React from 'react';
import { ArrowUpRight, BookOpen, Ruler, Shirt, Scissors, Layers3, Baby, CheckCircle2 } from 'lucide-react';
import { Gender, GarmentType } from '../lib/pattern-logic';

interface PatternCatalogProps {
  onSelect: (garment: GarmentType, gender: Gender) => void;
}

const models: Array<{
  id: string;
  title: string;
  subtitle: string;
  garment: GarmentType;
  gender: Gender;
  level: string;
  time: string;
  pieces: string[];
  steps: string[];
  description: string;
  icon: React.ReactNode;
}> = [
  {
    id: 'basic-tshirt',
    title: 'تيشيرت أساسي',
    subtitle: 'قصة مريحة برقبة دائرية',
    garment: 'tshirt',
    gender: 'women',
    level: 'مبتدئ',
    time: '30–45 دقيقة',
    pieces: ['الأمام', 'الخلف', 'الكم', 'شريط الرقبة'],
    steps: ['تحديد محيط الصدر والراحة', 'رسم الأمام والخلف', 'تشكيل حردة الإبط والكتف', 'مطابقة رأس الكم مع حردة الإبط'],
    description: 'نموذج تدريبي لبناء قطعة علوية أساسية، مع إمكانية تعديل القياسات والراحة قبل الانتقال إلى محرر الباترون.',
    icon: <Shirt className="w-6 h-6" />
  },
  {
    id: 'classic-blouse',
    title: 'بلوزة نسائية',
    subtitle: 'جذع أساسي قابل للتعديل',
    garment: 'blouse',
    gender: 'women',
    level: 'متوسط',
    time: '45–60 دقيقة',
    pieces: ['أمام', 'خلف', 'كم أساسي'],
    steps: ['إدخال الصدر والخصر والورك', 'تحديد عرض الرقبة وميل الكتف', 'رسم حردتي الأمام والخلف', 'مراجعة خطوط الجنب والكتف'],
    description: 'قاعدة تعليمية لتطوير البلوزات؛ ابدأي بالقياسات الأساسية ثم عدّلي تفاصيل القصة داخل محرر CAD.',
    icon: <Scissors className="w-6 h-6" />
  },
  {
    id: 'basic-pants',
    title: 'بنطال أساسي',
    subtitle: 'قصة مستقيمة',
    garment: 'pants',
    gender: 'women',
    level: 'متوسط',
    time: '60–75 دقيقة',
    pieces: ['أمام البنطال', 'خلف البنطال', 'حزام الخصر'],
    steps: ['إدخال الخصر والورك والفخذ', 'تحديد عمق الحجر والارتفاع', 'تكوين خط الجنب والداخل', 'مراجعة توازن الأمام والخلف'],
    description: 'نموذج تأسيسي للبنطال يركز على قياسات الورك والفخذ والحجر وطول الساق.',
    icon: <Ruler className="w-6 h-6" />
  },
  {
    id: 'straight-skirt',
    title: 'تنورة مستقيمة',
    subtitle: 'خصر وورك مع ضبط الطول',
    garment: 'skirt',
    gender: 'women',
    level: 'مبتدئ',
    time: '30–45 دقيقة',
    pieces: ['أمام التنورة', 'خلف التنورة', 'حزام اختياري'],
    steps: ['قياس الخصر والورك', 'تحديد طول التنورة وارتفاع الورك', 'توزيع الفرق بين الخصر والورك', 'إضافة سماحات الخياطة'],
    description: 'أبسط مدخل لفهم نقل القياسات إلى قطع مسطحة قابلة للقص والخياطة.',
    icon: <Layers3 className="w-6 h-6" />
  },
  {
    id: 'kids-tshirt',
    title: 'تيشيرت أطفال',
    subtitle: 'قصة عملية للصغار',
    garment: 'tshirt',
    gender: 'kids',
    level: 'مبتدئ',
    time: '30–45 دقيقة',
    pieces: ['الأمام', 'الخلف', 'الكم', 'شريط الرقبة'],
    steps: ['اختيار فئة الأطفال والمقاس', 'مراجعة الصدر والطول', 'تكوين القطع الأساسية', 'تجربة الراحة والحركة'],
    description: 'نسخة تعليمية للأطفال تستخدم قياسات فئة الأطفال المتاحة في التطبيق.',
    icon: <Baby className="w-6 h-6" />
  },
  {
    id: 'button-shirt',
    title: 'قميص بأزرار',
    subtitle: 'قاعدة القميص الكلاسيكي',
    garment: 'shirt',
    gender: 'men',
    level: 'متقدم',
    time: '90–120 دقيقة',
    pieces: ['أمامان مع مرد', 'خلف', 'كم', 'ياقة', 'كف'],
    steps: ['ضبط الصدر والرقبة والكتف', 'تحديد مرد الأزرار', 'تكوين الياقة والكم', 'مراجعة أطوال درزات التجميع'],
    description: 'مسار متقدم لتجميع قطع القميص؛ تفاصيل الياقة والمرد والكف تستكمل تدريجياً داخل المحرر.',
    icon: <BookOpen className="w-6 h-6" />
  }
];

export function PatternCatalog({ onSelect }: PatternCatalogProps) {
  return (
    <section dir="rtl" className="h-full overflow-y-auto bg-slate-950 text-slate-100 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-5">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-bold text-indigo-300 mb-2">
              <BookOpen className="w-4 h-4" /> مكتبة التصميم والتعليم
            </div>
            <h1 className="text-xl sm:text-2xl font-black">كتالوج الباترونات</h1>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              اختر موديل الملابس لفتح محرر الباترون وربطه بقياسات الجسم. النماذج هنا نقطة بداية قابلة للتطوير وليست ملفات قص نهائية معتمدة.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2">
            <Ruler className="w-4 h-4 text-indigo-300" />
            <span>قياسات بالسنتيمتر أو الإنش</span>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {models.map((model) => (
            <article key={model.id} className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden flex flex-col">
              <div className="p-4 bg-gradient-to-l from-indigo-950/70 to-slate-900 border-b border-slate-800">
                <div className="flex items-start justify-between gap-3">
                  <div className="w-11 h-11 rounded-xl bg-indigo-500/15 text-indigo-300 flex items-center justify-center">{model.icon}</div>
                  <div className="flex gap-2 text-[10px]">
                    <span className="rounded-full bg-slate-800 px-2 py-1 text-slate-300">{model.level}</span>
                    <span className="rounded-full bg-slate-800 px-2 py-1 text-slate-400">{model.time}</span>
                  </div>
                </div>
                <h2 className="font-extrabold text-lg mt-3">{model.title}</h2>
                <p className="text-xs text-indigo-200/80 mt-1">{model.subtitle}</p>
              </div>

              <div className="p-4 flex-1 space-y-4">
                <p className="text-sm leading-6 text-slate-300">{model.description}</p>
                <div>
                  <h3 className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-2"><Scissors className="w-3.5 h-3.5" /> القطع المتوقعة</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {model.pieces.map(piece => <span key={piece} className="text-[11px] rounded-lg bg-slate-800 px-2 py-1 text-slate-300">{piece}</span>)}
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5" /> مسار العمل</h3>
                  <ol className="space-y-1.5">
                    {model.steps.map((step, index) => (
                      <li key={step} className="flex gap-2 text-xs text-slate-400">
                        <span className="w-5 h-5 shrink-0 rounded-full bg-slate-800 text-indigo-300 flex items-center justify-center font-bold">{index + 1}</span>
                        <span className="pt-0.5">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              <div className="p-4 pt-0">
                <button
                  type="button"
                  onClick={() => onSelect(model.garment, model.gender)}
                  className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold text-sm py-3 px-4 flex items-center justify-center gap-2 transition-colors"
                >
                  فتح الباترون في المحرر <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
            </article>
          ))}
        </div>
        <p className="text-[11px] text-slate-500 leading-5">
          ملاحظة فنية: اختيار الموديل يضبط نوع القطعة وفئة القياسات ثم يفتح محرر 2D الحالي. يجب فحص تطابق أطوال الدرزات وتجربة العينة القماشية قبل اعتماد أي باترون للإنتاج.
        </p>
      </div>
    </section>
  );
}
