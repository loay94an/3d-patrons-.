import React, { useMemo, useState } from 'react';
import { ArrowUpRight, BookOpen, Ruler, Shirt, Scissors, Layers3, Baby, CheckCircle2, ArrowRight, BriefcaseBusiness, Dumbbell, Home, Moon, ShieldCheck } from 'lucide-react';
import { Gender, GarmentType } from '../lib/pattern-logic';

interface PatternCatalogProps {
  onSelect: (garment: GarmentType, gender: Gender) => void;
}

type Category = {
  id: string;
  title: string;
  description: string;
  garments: GarmentType[];
  icon: React.ReactNode;
  gender?: Gender;
};

const categories: Category[] = [
  { id: 'blouses', title: 'بلوزات', description: 'بلوزات وقصّات الجزء العلوي', garments: ['blouse'], icon: <Shirt className="w-6 h-6" /> },
  { id: 'dresses', title: 'فساتين', description: 'فساتين يومية وسهرة', garments: ['dress'], icon: <Layers3 className="w-6 h-6" /> },
  { id: 'trousers', title: 'بناطيل', description: 'بناطيل وقوالب الساق', garments: ['pants'], icon: <Ruler className="w-6 h-6" /> },
  { id: 'jackets', title: 'جاكيتات ومعاطف', description: 'جاكيت وبليزر ومعطف', garments: ['coat', 'blazer'], icon: <BriefcaseBusiness className="w-6 h-6" /> },
  { id: 'jumpsuits', title: 'أفرولات', description: 'قطع متصلة للجزء العلوي والسفلي', garments: [] , icon: <Layers3 className="w-6 h-6" /> },
  { id: 'underwear', title: 'ملابس داخلية', description: 'ملابس داخلية وقوالبها', garments: [], icon: <ShieldCheck className="w-6 h-6" /> },
  { id: 'children', title: 'ملابس أطفال', description: 'موديلات الأطفال حسب الفئة العمرية', garments: ['tshirt'], gender: 'kids', icon: <Baby className="w-6 h-6" /> },
  { id: 'sportswear', title: 'ملابس رياضية', description: 'ملابس الحركة والتمارين', garments: [], icon: <Dumbbell className="w-6 h-6" /> },
  { id: 'workwear', title: 'ملابس عمل', description: 'ملابس مهنية وملابس موحدة', garments: [], icon: <BriefcaseBusiness className="w-6 h-6" /> },
  { id: 'homewear', title: 'ملابس منزل', description: 'ملابس مريحة للاستخدام المنزلي', garments: [], icon: <Home className="w-6 h-6" /> },
  { id: 'sleepwear', title: 'ملابس نوم', description: 'بيجامات وملابس النوم', garments: [], icon: <Moon className="w-6 h-6" /> },
  { id: 'shirts', title: 'قمصان', description: 'قمصان رجالية ونسائية', garments: ['shirt'], icon: <Shirt className="w-6 h-6" /> },
  { id: 'skirts', title: 'تنانير', description: 'تنانير مستقيمة وقصّات متنوعة', garments: ['skirt'], icon: <Layers3 className="w-6 h-6" /> },
  { id: 'tshirts', title: 'تيشيرتات', description: 'تيشيرتات وقصّات محبوكة', garments: ['tshirt'], icon: <Shirt className="w-6 h-6" /> }
];

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
  source: string;
}> = [
  {
    id: 'basic-tshirt', title: 'تيشيرت أساسي', subtitle: 'قصة مريحة برقبة دائرية', garment: 'tshirt', gender: 'women',
    level: 'مبتدئ', time: '30–45 دقيقة', pieces: ['الأمام', 'الخلف', 'الكم', 'شريط الرقبة'],
    steps: ['تحديد محيط الصدر والراحة', 'رسم الأمام والخلف', 'تشكيل حردة الإبط والكتف', 'مطابقة رأس الكم مع حردة الإبط'],
    description: 'نموذج تدريبي لبناء قطعة علوية أساسية، مع إمكانية تعديل القياسات والراحة قبل الانتقال إلى محرر CAD.',
    icon: <Shirt className="w-6 h-6" />, source: 'قالب تعليمي مدمج — يحتاج مراجعة عينة قبل الإنتاج'
  },
  {
    id: 'classic-blouse', title: 'بلوزة نسائية', subtitle: 'جذع أساسي قابل للتعديل', garment: 'blouse', gender: 'women',
    level: 'متوسط', time: '45–60 دقيقة', pieces: ['أمام', 'خلف', 'كم أساسي'],
    steps: ['إدخال الصدر والخصر والورك', 'تحديد عرض الرقبة وميل الكتف', 'رسم حردتي الأمام والخلف', 'مراجعة خطوط الجنب والكتف'],
    description: 'قاعدة تعليمية لتطوير البلوزات؛ ابدأ بالقياسات الأساسية ثم عدّل تفاصيل القصة داخل محرر CAD.',
    icon: <Scissors className="w-6 h-6" />, source: 'قالب تعليمي مدمج — يحتاج مراجعة عينة قبل الإنتاج'
  },
  {
    id: 'basic-pants', title: 'بنطال أساسي', subtitle: 'قصة مستقيمة', garment: 'pants', gender: 'women',
    level: 'متوسط', time: '60–75 دقيقة', pieces: ['أمام البنطال', 'خلف البنطال', 'حزام الخصر'],
    steps: ['إدخال الخصر والورك والفخذ', 'تحديد عمق الحجر والارتفاع', 'تكوين خط الجنب والداخل', 'مراجعة توازن الأمام والخلف'],
    description: 'نموذج تأسيسي للبنطال يركز على قياسات الورك والفخذ والحجر وطول الساق.',
    icon: <Ruler className="w-6 h-6" />, source: 'قالب تعليمي مدمج — يحتاج مراجعة عينة قبل الإنتاج'
  },
  {
    id: 'straight-skirt', title: 'تنورة مستقيمة', subtitle: 'خصر وورك مع ضبط الطول', garment: 'skirt', gender: 'women',
    level: 'مبتدئ', time: '30–45 دقيقة', pieces: ['أمام التنورة', 'خلف التنورة', 'حزام اختياري'],
    steps: ['قياس الخصر والورك', 'تحديد طول التنورة وارتفاع الورك', 'توزيع الفرق بين الخصر والورك', 'إضافة سماحات الخياطة'],
    description: 'أبسط مدخل لفهم نقل القياسات إلى قطع مسطحة قابلة للقص والخياطة.',
    icon: <Layers3 className="w-6 h-6" />, source: 'قالب تعليمي مدمج — يحتاج مراجعة عينة قبل الإنتاج'
  },
  {
    id: 'kids-tshirt', title: 'تيشيرت أطفال', subtitle: 'قصة عملية للصغار', garment: 'tshirt', gender: 'kids',
    level: 'مبتدئ', time: '30–45 دقيقة', pieces: ['الأمام', 'الخلف', 'الكم', 'شريط الرقبة'],
    steps: ['اختيار فئة الأطفال والمقاس', 'مراجعة الصدر والطول', 'تكوين القطع الأساسية', 'تجربة الراحة والحركة'],
    description: 'نسخة تعليمية للأطفال تستخدم قياسات فئة الأطفال المتاحة في التطبيق.',
    icon: <Baby className="w-6 h-6" />, source: 'قالب تعليمي مدمج — يحتاج مراجعة عينة قبل الإنتاج'
  },
  {
    id: 'button-shirt', title: 'قميص بأزرار', subtitle: 'قاعدة القميص الكلاسيكي', garment: 'shirt', gender: 'men',
    level: 'متقدم', time: '90–120 دقيقة', pieces: ['أمامان مع مرد', 'خلف', 'كم', 'ياقة', 'كف'],
    steps: ['ضبط الصدر والرقبة والكتف', 'تحديد مرد الأزرار', 'تكوين الياقة والكم', 'مراجعة أطوال درزات التجميع'],
    description: 'نموذج تعليمي لتطوير القميص؛ تفاصيل الياقة والمرد والكف تستكمل داخل المحرر.',
    icon: <BookOpen className="w-6 h-6" />, source: 'قالب تعليمي مدمج — يحتاج مراجعة عينة قبل الإنتاج'
  }
];

export function PatternCatalog({ onSelect }: PatternCatalogProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const activeCategory = categories.find(category => category.id === selectedCategory);
  const visibleModels = useMemo(() => {
    if (!activeCategory) return [];
    return models.filter(model =>
      activeCategory.garments.includes(model.garment) &&
      (!activeCategory.gender || model.gender === activeCategory.gender)
    );
  }, [activeCategory]);

  return (
    <section dir="rtl" className="h-full overflow-y-auto bg-slate-950 text-slate-100 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-5">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-bold text-indigo-300 mb-2"><BookOpen className="w-4 h-4" /> مكتبة التصميم والمراجع</div>
            <h1 className="text-xl sm:text-2xl font-black">{activeCategory ? activeCategory.title : 'اختر فئة الملابس'}</h1>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              {activeCategory ? activeCategory.description : 'ابدأ بنوع القطعة. ستظهر الموديلات المتاحة فعلياً في المكتبة لهذه الفئة.'}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2"><Ruler className="w-4 h-4 text-indigo-300" /><span>قياسات بالسنتيمتر أو الإنش</span></div>
        </header>

        {!activeCategory ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {categories.map(category => {
              const count = models.filter(model => category.garments.includes(model.garment) && (!category.gender || model.gender === category.gender)).length;
              return (
                <button key={category.id} type="button" onClick={() => setSelectedCategory(category.id)}
                  className="min-h-36 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-right transition hover:border-indigo-500/70 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-300">{category.icon}</span>
                  <span className="mt-3 block text-sm font-extrabold">{category.title}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-400">{category.description}</span>
                  <span className="mt-3 inline-flex rounded-full bg-slate-800 px-2 py-1 text-[10px] text-slate-300">{count ? `${count} موديل متاح` : 'قيد الإضافة'}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <>
            <button type="button" onClick={() => setSelectedCategory(null)} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800"><ArrowRight className="w-4 h-4" /> جميع الفئات</button>
            {visibleModels.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 p-7 text-center">
                <BookOpen className="mx-auto h-9 w-9 text-slate-500" />
                <h2 className="mt-3 text-base font-extrabold">لا توجد موديلات هندسية متاحة لهذه الفئة بعد</h2>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">سنضيف الموديلات بعد ربط المراجع المناسبة والتحقق من بياناتها وقوالبها الهندسية. لن نعرض نموذجاً غير موجود أو غير مختبر على أنه جاهز.</p>
                <span className="mt-4 inline-flex rounded-full bg-slate-800 px-3 py-1.5 text-xs text-slate-300">هذه الفئة محفوظة ضمن تصنيفات المكتبة</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {visibleModels.map(model => (
                  <article key={model.id} className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden flex flex-col">
                    <div className="p-4 bg-gradient-to-l from-indigo-950/70 to-slate-900 border-b border-slate-800">
                      <div className="flex items-start justify-between gap-3">
                        <div className="w-11 h-11 rounded-xl bg-indigo-500/15 text-indigo-300 flex items-center justify-center">{model.icon}</div>
                        <div className="flex gap-2 text-[10px]"><span className="rounded-full bg-slate-800 px-2 py-1 text-slate-300">{model.level}</span><span className="rounded-full bg-slate-800 px-2 py-1 text-slate-400">{model.time}</span></div>
                      </div>
                      <h2 className="font-extrabold text-lg mt-3">{model.title}</h2>
                      <p className="text-xs text-indigo-200/80 mt-1">{model.subtitle}</p>
                    </div>
                    <div className="p-4 flex-1 space-y-4">
                      <p className="text-sm leading-6 text-slate-300">{model.description}</p>
                      <div><h3 className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-2"><Scissors className="w-3.5 h-3.5" /> القطع المتوقعة</h3><div className="flex flex-wrap gap-1.5">{model.pieces.map(piece => <span key={piece} className="text-[11px] rounded-lg bg-slate-800 px-2 py-1 text-slate-300">{piece}</span>)}</div></div>
                      <div><h3 className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5" /> مسار العمل</h3><ol className="space-y-1.5">{model.steps.map((step, index) => <li key={step} className="flex gap-2 text-xs text-slate-400"><span className="w-5 h-5 shrink-0 rounded-full bg-slate-800 text-indigo-300 flex items-center justify-center font-bold">{index + 1}</span><span className="pt-0.5">{step}</span></li>)}</ol></div>
                      <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 text-[10px] leading-5 text-amber-200/80">{model.source}</p>
                    </div>
                    <div className="p-4 pt-0"><button type="button" onClick={() => onSelect(model.garment, model.gender)} className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold text-sm py-3 px-4 flex items-center justify-center gap-2 transition-colors">اختيار هذا الموديل <ArrowUpRight className="w-4 h-4" /></button></div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
        <p className="text-[11px] text-slate-500 leading-5">الموديلات المعروضة حالياً قوالب تعليمية مدمجة في التطبيق، وليست كل ملفات المراجع. سيتم ربط النماذج المرجعية بعد التحقق من المصدر والترخيص والبيانات الهندسية. يجب فحص تطابق أطوال الدرزات وتجربة العينة القماشية قبل اعتماد أي باترون للإنتاج.</p>
      </div>
    </section>
  );
}
