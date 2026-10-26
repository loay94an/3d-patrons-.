import React, { useState, useEffect } from 'react';
import {
  Moon, Sun, DraftingCompass, Info, Copy, Check, FileSpreadsheet,
  FileText, Shirt, Sparkles, Sliders, Palette, Layers, Box,
  Ruler, Download, ArrowRight, UserCheck, ChevronLeft, ChevronRight
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  AppState, Gender, SizeSystem, Unit, GarmentType, School, FabricType, SleeveType,
  getSizeList, mapSizeBySystem, getMeasurements, computePatternValues, getGarmentLabel,
  getBaseMeasurements
} from '../lib/pattern-logic';
import {
  FabricCustomState, DEFAULT_FABRIC_STATE, FABRIC_PRESETS,
  FabricCategory, PatternPrintType, FabricDefinition
} from '../lib/fabric-engine';
import { PatternVisualizer } from './PatternVisualizer';
import { Pattern3DViewer } from './Pattern3DViewer';
import { PdfExportModal } from './PdfExportModal';
import { PWAInstallButton } from './PWAInstallButton';
import { cn } from '../lib/utils';

export type MainViewTab = 'cad2d' | 'view3d' | 'measurements' | 'fabrics' | 'export_guide';

const detailedNames = ["عرض الظهر","طول الكتف","طول الظهر","طول الكم","محيط الذراع","محيط الأسوارة","محيط الرقبة","محيط الصدر","محيط الخصر","محيط الورك","المسافة من الخصر إلى الورك","المسافة من الخصر إلى الركبة","طول الساق من الخصر إلى أسفل القدم","طول التنورة","طول الصدر (من أعلى الكتف مروراً فوق الصدر)","محيط الإبط (دوران الإبط)","المسافة من الخصر إلى الإبط","المسافة من أعلى الكتف إلى الثدي","المسافة بين الثديين","محيط الفخذ","محيط الركبة","محيط الكاحل","ارتفاع السرج","طول الجنب"];
const detailedHelps = ["يقاس أفقياً من منتصف الظهر بين الإبطين.","من نقطة الرقبة إلى طرف الكتف.","من الفقرة السابعة إلى خط الخصر.","من طرف الكتف إلى الرسغ.","حول أوسع نقطة في الذراع.","حول الرسغ.","حول قاعدة الرقبة.","حول أوسع نقطة في الصدر.","حول أضيق نقطة.","حول أوسع نقطة في الأرداف.","عمودياً من الخصر إلى الورك.","عمودياً إلى منتصف الركبة.","من الخصر إلى الأرض.","من الخصر إلى الطول المطلوب.","من الكتف إلى أعلى الصدر.","حول الإبط عند خط الصدر.","عمودياً إلى الإبط.","من الكتف إلى أعلى الصدر.","أفقياً بين نقطتي الصدر.","حول أوسع نقطة في الفخذ.","حول الركبة.","حول الكاحل.","من الخصر إلى المقعد.","من الإبط إلى الخصر."];
const patternNames = ["طول الظهر","عرض الظهر (نصف)","طول الكتف","ميلان الكتف","ربع محيط الرقبة","عرض حفرة الرقبة الأمامية","عرض حفرة الرقبة الخلفية","نزول الرقبة الأمامية","نزول الرقبة الخلفية","طول حردة الإبط (تقديري)","عمق حردة الإبط","ربع محيط الصدر","عرض الصدر الأمامي","عرض الصدر الخلفي","ربع محيط الخصر","ربع محيط الورك","ارتفاع الورك","طول الصدر","المسافة من الخصر إلى الإبط","المسافة بين الثديين","طول البنطلون","طول التنورة","ربع محيط الفخذ","ربع محيط الركبة","ربع محيط الكاحل","ارتفاع السرج","عرض خط السرج الأمامي","عرض خط السرج الخلفي","طول الساق","المسافة من الخصر إلى الركبة","طول الكم","نصف محيط الذراع","ارتفاع رأس الكم","نصف عرض الكم","نصف محيط الأسوارة","طول الرسغ إلى المرفق","طول المرفق إلى الكتف"];

const COLOR_PALETTES = [
  { name: 'أزرق ملكي', hex: '#1e3a8a' },
  { name: 'أزرق سماوي', hex: '#38bdf8' },
  { name: 'كحلي ليلي', hex: '#0f172a' },
  { name: 'تراكوتا ترابي', hex: '#c2410c' },
  { name: 'أحمر قرمزي نبيذي', hex: '#881337' },
  { name: 'وردي دافئ', hex: '#fb7185' },
  { name: 'أخضر ميرمية', hex: '#15803d' },
  { name: 'زمردي داكن', hex: '#064e3b' },
  { name: 'أصفر خردلي', hex: '#d97706' },
  { name: 'بيج كشمير', hex: '#d6c7b2' },
  { name: 'أبيض عاجي', hex: '#f8fafc' },
  { name: 'رمادي حجري', hex: '#64748b' },
  { name: 'أسود ملكي', hex: '#18181b' },
  { name: 'لافندر هادئ', hex: '#818cf8' },
  { name: 'بني شوكولاتة', hex: '#451a03' },
  { name: 'جينز أزرق', hex: '#2563eb' },
];

const PATTERN_OPTIONS: { id: PatternPrintType; nameAr: string }[] = [
  { id: 'solid', nameAr: 'سادة نقي' },
  { id: 'pinstripe', nameAr: 'خطوط طولية رفيعة' },
  { id: 'breton', nameAr: 'خطوط بحرية' },
  { id: 'plaid', nameAr: 'كاروهات إسكتلندي' },
  { id: 'polka', nameAr: 'منقط راقي' },
  { id: 'houndstooth', nameAr: 'سن الفيل' },
  { id: 'damask', nameAr: 'جاكار زخرفي' }
];

const defaultState: AppState = {
  gender: 'women',
  system: 'eu',
  unit: 'cm',
  garment: 'blouse',
  school: 'italian',
  sleeve: 'basic',
  fabric: 'woven',
  stretchPercent: 15,
  size: 38,
  includeSeam: true,
  useCustomMode: false,
  customMeasurements: {}
};

export default function PatternApp() {
  const [state, setState] = useState<AppState>(defaultState);
  const [darkMode, setDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState<MainViewTab>('cad2d');
  const [copied, setCopied] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);

  // 3D Fabric Physical & Visual State
  const [fabricState, setFabricState] = useState<FabricCustomState>(DEFAULT_FABRIC_STATE);
  const [selectedFabricCategory, setSelectedFabricCategory] = useState<FabricCategory | 'all'>('all');

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const initialDark = savedTheme ? savedTheme === 'dark' : prefersDark;
      setDarkMode(initialDark);
      if (initialDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {
      // Fallback
    }
  }, []);

  const toggleDark = () => {
    const nextDark = !darkMode;
    setDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      try {
        localStorage.setItem('theme', 'dark');
      } catch (e) {}
    } else {
      document.documentElement.classList.remove('dark');
      try {
        localStorage.setItem('theme', 'light');
      } catch (e) {}
    }
  };

  const updateState = (updates: Partial<AppState>) => {
    setState(prev => {
      const next = { ...prev, ...updates };
      // Reset size if gender changes
      if (updates.gender && updates.gender !== prev.gender) {
        next.size = getSizeList(updates.gender as Gender)[0];
      }
      return next;
    });
  };

  const updateFabricState = (updates: Partial<FabricCustomState>) => {
    setFabricState(prev => ({ ...prev, ...updates }));
  };

  const { values: patternValues, meas, ease, seam } = computePatternValues(state);

  const formatDim = (v: number | undefined) => {
    if (v === undefined || isNaN(v)) return '—';
    let val = state.unit === 'in' ? v / 2.54 : v;
    let unitSym = state.unit === 'cm' ? 'سم' : 'إنش';
    return val.toFixed(1) + ' ' + unitSym;
  };

  const getDetailedValues = () => [
    meas.backWidth, meas.shoulder, meas.backLength, meas.sleeveLength, meas.armCirc, meas.cuffCirc, meas.neckCirc, meas.bust ?? meas.chest, meas.waist, meas.hip, meas.waistToHip, meas.waistToKnee, meas.legLength, meas.skirtLength, meas.chestLength, meas.armholeCirc, meas.waistToArmpit, meas.shoulderToBust ?? meas.shoulderToChest, meas.bustPointDist ?? meas.chestPointDist, meas.thighCirc, meas.kneeCirc, meas.ankleCirc, meas.crotchHeight, meas.sideLength
  ];

  const exportToExcel = () => {
    let detailedValues = getDetailedValues();
    let detailedData = [["#", "القياس", `القيمة (${state.unit === 'cm' ? 'سم' : 'إنش'})`]];
    for (let i = 0; i < detailedNames.length; i++) {
      detailedData.push([String(i + 1), detailedNames[i], formatDim(detailedValues[i])]);
    }
    
    let patternData = [["#", "القياس", "القيمة"]];
    for (let i = 0; i < 37; i++) {
      patternData.push([String(i + 1), patternNames[i], formatDim(patternValues[i])]);
    }
    
    let wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(detailedData), "المقاسات التفصيلية");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(patternData), "مقاسات الباترون الأساسي");
    XLSX.writeFile(wb, `patterns_${state.gender}_${state.size}.xlsx`);
  };

  const handleCopyInstructions = () => {
    const textToCopy = `تعليمات رسم الباترون:
الموديل: ${getGarmentLabel(state.garment)} | المدرسة: ${state.school} | القماش: ${fabricState.presetId}
القياسات الأساسية:
- طول الظهر: ${formatDim(patternValues[0])}
- ربع محيط الصدر: ${formatDim(patternValues[11])}
- عمق حردة الإبط: ${formatDim(patternValues[10])}
- ربع محيط الخصر: ${formatDim(patternValues[14])}
- ربع محيط الورك: ${formatDim(patternValues[15])}
بدلات الخياطة:
جانبية ${formatDim(seam.side)}، كتف ${formatDim(seam.shoulder)}، رقبة/إبط ${formatDim(seam.neckArmhole)}، سفلية ${formatDim(seam.hem)}.`;

    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {});
  };

  const currentFabricPreset = FABRIC_PRESETS.find(f => f.id === fabricState.presetId) || FABRIC_PRESETS[0];

  const currentStandardMeas = getBaseMeasurements(state.gender, state.size);
  const currentMeas = {
    ...currentStandardMeas,
    ...state.customMeasurements
  };

  const isWomen = state.gender === 'women';
  const isKids = state.gender === 'kids' || state.gender === 'infant';

  const measurementFields = [
    {
      key: isWomen ? 'bust' : 'chest',
      labelAr: isWomen ? 'محيط الصدر' : 'محيط الصدر',
      hintAr: 'أوسع نقطة في الصدر',
      min: isKids ? 40 : 70,
      max: isKids ? 95 : 150,
      step: 0.5
    },
    {
      key: 'waist',
      labelAr: 'محيط الخصر',
      hintAr: 'أضيق نقطة في الجذع الطبيعي',
      min: isKids ? 38 : 55,
      max: isKids ? 85 : 140,
      step: 0.5
    },
    {
      key: 'hip',
      labelAr: 'محيط الورك / الأرداف',
      hintAr: 'أبرز نقطة في الأرداف والوركين',
      min: isKids ? 42 : 75,
      max: isKids ? 100 : 160,
      step: 0.5
    },
    {
      key: 'backLength',
      labelAr: 'طول الظهر',
      hintAr: 'من الفقرة السابعة حتى خط الخصر',
      min: isKids ? 15 : 32,
      max: isKids ? 45 : 55,
      step: 0.5
    },
    {
      key: 'shoulder',
      labelAr: 'طول الكتف',
      hintAr: 'من قاعدة الرقبة لعظمة الكتف',
      min: isKids ? 5 : 8,
      max: isKids ? 13 : 22,
      step: 0.5
    },
    {
      key: 'sleeveLength',
      labelAr: 'طول الكم',
      hintAr: 'من الكتف إلى الرسغ',
      min: isKids ? 18 : 45,
      max: isKids ? 60 : 75,
      step: 0.5
    },
    {
      key: 'armholeCirc',
      labelAr: 'دوران حردة الإبط',
      hintAr: 'محيط الإبط والكتف بوضعية مريحة',
      min: isKids ? 20 : 36,
      max: isKids ? 50 : 70,
      step: 0.5
    },
    {
      key: 'neckCirc',
      labelAr: 'محيط الرقبة',
      hintAr: 'حول قاعدة الرقبة',
      min: isKids ? 20 : 30,
      max: isKids ? 38 : 52,
      step: 0.5
    },
    {
      key: 'skirtLength',
      labelAr: 'طول الزي / التنورة',
      hintAr: 'من الخصر إلى الأسفل',
      min: isKids ? 15 : 40,
      max: isKids ? 70 : 120,
      step: 1.0
    }
  ];

  const filteredFabrics = selectedFabricCategory === 'all'
    ? FABRIC_PRESETS
    : FABRIC_PRESETS.filter(f => f.category === selectedFabricCategory);

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-900 text-slate-100 flex flex-col font-['Cairo',sans-serif] select-none" dir="rtl">
      
      {/* 1. COMPACT SLEEK TOP BAR (ارتفاع مدروس ومناسب تماماً للهواتف دون مزاحمة) */}
      <header className="h-12 bg-slate-950 border-b border-slate-800 px-3 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow">
            <Shirt className="w-4 h-4" />
          </div>
          <span className="font-bold text-xs sm:text-sm tracking-tight text-white">
            استوديو الباترون 3D
          </span>

          {/* Archetype Quick Badge */}
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
            {state.gender === 'women' ? 'نساء' : state.gender === 'men' ? 'رجال' : 'أطفال'} • {state.size}
          </span>
        </div>

        {/* Quick Controls: Garment Type & Unit & Dark Mode */}
        <div className="flex items-center gap-1.5">
          {/* Garment Selector Dropdown */}
          <select
            value={state.garment}
            onChange={(e) => updateState({ garment: e.target.value as GarmentType })}
            className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2 py-1 text-[11px] font-bold outline-none cursor-pointer"
          >
            <option value="blouse">بلوزة</option>
            <option value="dress">فستان</option>
            <option value="shirt">قميص</option>
            <option value="skirt">تنورة</option>
            <option value="pants">بنطلون</option>
            <option value="tshirt">تيشيرت</option>
            <option value="abaya">عباءة</option>
            <option value="coat">معطف</option>
            <option value="hoodie">هودي</option>
            <option value="blazer">بليزر</option>
          </select>

          {/* Unit Toggle */}
          <button
            onClick={() => updateState({ unit: state.unit === 'cm' ? 'in' : 'cm' })}
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-[10px] font-bold"
            title="تبديل الوحدة بين سم وإنش"
          >
            {state.unit === 'cm' ? 'سم' : 'إنش'}
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleDark}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700"
            title="تبديل الوضع الليلي / النهاري"
          >
            {darkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* 2. MAIN VIEW AREA (واجهات منفصلة بالكامل - كل واجهة تملأ الشاشة بنسبة 100%) */}
      <main className="flex-1 w-full h-[calc(100vh-104px)] relative overflow-hidden bg-slate-950">
        
        {/* VIEW 1: FULLSCREEN 2D PATTERN CAD (مربع الرسم ثنائي الأبعاد كاملاً) */}
        {activeTab === 'cad2d' && (
          <div className="w-full h-full relative overflow-hidden">
            <PatternVisualizer state={state} />
          </div>
        )}

        {/* VIEW 2: FULLSCREEN 3D SIMULATION (مربع العرض ثلاثي الأبعاد كاملاً) */}
        {activeTab === 'view3d' && (
          <div className="w-full h-full relative overflow-hidden bg-slate-950">
            <Pattern3DViewer
              state={state}
              fabricState={fabricState}
              onOpenFabricDrawer={() => setActiveTab('fabrics')}
              onOpenMeasurementsDrawer={() => setActiveTab('measurements')}
              isSplitView={false}
            />
          </div>
        )}

        {/* VIEW 3: DEDICATED MEASUREMENTS SCREEN (واجهة المقاسات والمانيكان المنفصلة السهلة) */}
        {activeTab === 'measurements' && (
          <div className="w-full h-full overflow-y-auto p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <Ruler className="w-5 h-5 text-indigo-400" />
                  <span>تخصيص القياسات ونمط الجسم</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  حدد النمط الجسماني وعدّل أي مقاس وسيتحدث الباترون والمجسم 3D فورياً
                </p>
              </div>

              {state.useCustomMode && (
                <button
                  onClick={() => updateState({ useCustomMode: false, customMeasurements: {} })}
                  className="px-3 py-1 bg-amber-950/40 border border-amber-700/50 text-amber-400 text-xs rounded-lg"
                >
                  استعادة القياسي
                </button>
              )}
            </div>

            {/* 1. Body Archetypes (نساء / رجال / أطفال) */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">1. اختيار النمط الجسماني:</label>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {[
                  { id: 'women', label: '👩 عارضة نساء', desc: 'تجسيم أنثوي كلاسيكي' },
                  { id: 'men', label: '👨 عارض رجال', desc: 'أكتاف عريضة وخصر مستقيم' },
                  { id: 'kids', label: '🧒 أطفال ورضع', desc: 'نسب طفولية قياسية' },
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                      const list = getSizeList(item.id as Gender);
                      updateState({ gender: item.id as Gender, size: list[0], customMeasurements: {} });
                    }}
                    className={cn(
                      "p-3 rounded-xl border text-right transition-all flex flex-col justify-between",
                      state.gender === item.id
                        ? "bg-indigo-950/60 border-indigo-500 ring-2 ring-indigo-500/30 text-white"
                        : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800/80"
                    )}
                  >
                    <span className="font-bold text-xs sm:text-sm">{item.label}</span>
                    <span className="text-[10px] text-slate-400 mt-1">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Standard Size Pills */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">2. المقاس الجاهز:</label>
              <div className="flex flex-wrap gap-1.5">
                {getSizeList(state.gender).map(s => (
                  <button
                    key={String(s)}
                    onClick={() => updateState({ size: s, customMeasurements: {} })}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all",
                      String(state.size) === String(s) && !state.useCustomMode
                        ? "bg-indigo-600 text-white shadow-md"
                        : "bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800"
                    )}
                  >
                    {isKids ? `${s}` : `EU ${s}`}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Sliders for Made-to-measure */}
            <div className="space-y-3 pt-2">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                <span>3. تعديل القياسات الفردية بالمنزلقات:</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {measurementFields.map(f => {
                  const rawVal = currentMeas[f.key] ?? f.min;
                  const displayVal = state.unit === 'in' ? rawVal / 2.54 : rawVal;

                  return (
                    <div key={f.key} className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-200">{f.labelAr}</span>
                        <span className="font-mono text-indigo-300 font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                          {displayVal.toFixed(1)} {state.unit === 'cm' ? 'سم' : 'إنش'}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={f.min}
                        max={f.max}
                        step={f.step}
                        value={rawVal}
                        onChange={(e) => updateState({
                          useCustomMode: true,
                          customMeasurements: {
                            ...state.customMeasurements,
                            [f.key]: parseFloat(e.target.value)
                          }
                        })}
                        className="w-full accent-indigo-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
                      />
                      <span className="text-[10px] text-slate-400 block">{f.hintAr}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions: View in 2D or 3D */}
            <div className="pt-4 flex items-center gap-3">
              <button
                onClick={() => setActiveTab('view3d')}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2"
              >
                <Box className="w-4 h-4" />
                <span>معاينة في المحاكاة ثلاثية الأبعاد (3D)</span>
              </button>

              <button
                onClick={() => setActiveTab('cad2d')}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2"
              >
                <DraftingCompass className="w-4 h-4" />
                <span>معاينة في رسم الباترون (2D)</span>
              </button>
            </div>
          </div>
        )}

        {/* VIEW 4: DEDICATED FABRIC & MATERIALS SCREEN (واجهة الأقمشة والألوان المنفصلة) */}
        {activeTab === 'fabrics' && (
          <div className="w-full h-full overflow-y-auto p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <Palette className="w-5 h-5 text-blue-400" />
                  <span>مكتبة الأقمشة والخامات التفاعلية</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  اختر نوع النسيج ولونه ونقشته، وستطبق الخصائص الفيزيائية فوراً على المانيكان
                </p>
              </div>

              <button
                onClick={() => setActiveTab('view3d')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5"
              >
                <Box className="w-3.5 h-3.5" />
                <span>عرض على المانيكان 3D</span>
              </button>
            </div>

            {/* 1. Category Filter Pills */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'all', label: 'كافة الخامات' },
                { id: 'everyday', label: 'أقمشة يومية' },
                { id: 'luxury', label: 'أقمشة فاخرة' },
                { id: 'heavy', label: 'أقمشة ثقيلة' },
                { id: 'light', label: 'خفيفة وشفافة' },
                { id: 'stretch', label: 'مطاطة' },
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedFabricCategory(cat.id as any)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                    selectedFabricCategory === cat.id
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800"
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* 2. Fabric Presets Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredFabrics.map(f => {
                const isSelected = fabricState.presetId === f.id;
                return (
                  <div
                    key={f.id}
                    onClick={() => updateFabricState({
                      presetId: f.id,
                      roughness: f.roughness,
                      sheen: f.sheen,
                      opacity: f.opacity,
                      stiffness: f.stiffness
                    })}
                    className={cn(
                      "p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3",
                      isSelected
                        ? "bg-blue-950/60 border-blue-500 ring-2 ring-blue-500/30"
                        : "bg-slate-900 border-slate-800 hover:bg-slate-800/80"
                    )}
                  >
                    <div
                      className="w-11 h-11 rounded-xl shrink-0 border border-white/20 shadow-inner flex items-center justify-center"
                      style={{ backgroundColor: f.defaultColor }}
                    >
                      {isSelected && <Check className="w-5 h-5 text-white stroke-[3] drop-shadow" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-white truncate">{f.nameAr}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{f.weightGsm}g</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                        {f.descriptionAr}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 3. Color Swatches */}
            <div className="space-y-3 pt-2">
              <label className="text-xs font-bold text-slate-300">ألوان القماش المقترحة:</label>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {COLOR_PALETTES.map(col => {
                  const isSelected = fabricState.color.toLowerCase() === col.hex.toLowerCase();
                  return (
                    <button
                      key={col.hex}
                      onClick={() => updateFabricState({ color: col.hex })}
                      className={cn(
                        "p-2 rounded-xl flex flex-col items-center gap-1 transition-all",
                        isSelected ? "bg-blue-950/80 border border-blue-500" : "bg-slate-900 border border-slate-800 hover:bg-slate-800"
                      )}
                    >
                      <div
                        className="w-8 h-8 rounded-full border border-white/30 shadow flex items-center justify-center"
                        style={{ backgroundColor: col.hex }}
                      >
                        {isSelected && <Check className="w-4 h-4 text-white stroke-[3]" />}
                      </div>
                      <span className="text-[9px] text-slate-400 truncate max-w-full">{col.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Color Input */}
              <div className="flex items-center gap-3 p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-300">لون مخصص:</span>
                <input
                  type="color"
                  value={fabricState.color}
                  onChange={(e) => updateFabricState({ color: e.target.value })}
                  className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                />
                <span className="text-xs font-mono text-white uppercase">{fabricState.color}</span>
              </div>
            </div>

            {/* 4. Pattern Prints */}
            <div className="space-y-3 pt-2">
              <label className="text-xs font-bold text-slate-300">النقوش والزخارف المطبوعة:</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PATTERN_OPTIONS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => updateFabricState({ pattern: p.id })}
                    className={cn(
                      "p-2.5 rounded-xl border text-center transition-all text-xs font-bold",
                      fabricState.pattern === p.id
                        ? "bg-blue-600 text-white border-blue-500 shadow-md"
                        : "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800"
                    )}
                  >
                    {p.nameAr}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 5: DEDICATED EXPORT & SPECS SCREEN (واجهة التقرير والتصدير ودليل الخياطة) */}
        {activeTab === 'export_guide' && (
          <div className="w-full h-full overflow-y-auto p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-400" />
                  <span>التقرير الهندسي ودليل الخياطة والتصدير</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  طباعة الباترون بالحجم الحقيقي 1:1، تصدير ملفات Excel، وإرشادات القص
                </p>
              </div>

              <button
                onClick={() => setShowPdfModal(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                <span>تصدير كارت PDF</span>
              </button>
            </div>

            {/* Quick Export Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span>تصدير كارت الباترون PDF</span>
                </h3>
                <p className="text-xs text-slate-400">
                  ملف PDF متكامل يتضمن مواصفات الموديل، الأبعاد، بدلات الخياطة، وخطوات التنفيذ.
                </p>
                <button
                  onClick={() => setShowPdfModal(true)}
                  className="w-full py-2 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-bold transition-colors"
                >
                  فتح نافذة تجهيز PDF
                </button>
              </div>

              <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-blue-400" />
                  <span>تصدير جدول القياسات Excel</span>
                </h3>
                <p className="text-xs text-slate-400">
                  تحميل ملف Excel رسمي يحتوي على كافة القياسات التفصيلية ومقاسات ربع القالب.
                </p>
                <button
                  onClick={exportToExcel}
                  className="w-full py-2 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/40 rounded-lg text-xs font-bold transition-colors"
                >
                  تحميل ملف XLSX
                </button>
              </div>
            </div>

            {/* Sewing Step-by-Step Instructions */}
            <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-white">إرشادات تنفيذ وقص الباترون ({getGarmentLabel(state.garment)})</h3>
                <button
                  onClick={handleCopyInstructions}
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'تم النسخ!' : 'نسخ النص'}</span>
                </button>
              </div>

              <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
                <p><strong>المستطيل الأساسي:</strong> العرض = <span className="font-mono text-blue-400 font-bold">{formatDim(patternValues[11])}</span>، الارتفاع = <span className="font-mono text-blue-400 font-bold">{formatDim(patternValues[0])}</span>.</p>
                <p><strong>عمق حردة الإبط:</strong> هبوط بمقدار <span className="font-mono text-blue-400 font-bold">{formatDim(patternValues[10])}</span> من أعلى الكتف.</p>
                <p><strong>حردة الرقبة:</strong> عرض = <span className="font-mono text-blue-400 font-bold">{formatDim(patternValues[5])}</span>، نزول أمامي = <span className="font-mono text-blue-400 font-bold">{formatDim(patternValues[7])}</span>، نزول خلفي = <span className="font-mono text-blue-400 font-bold">{formatDim(patternValues[8])}</span>.</p>
                <p><strong>بدلات الخياطة:</strong> الجوانب {formatDim(seam.side)}، الأكتاف {formatDim(seam.shoulder)}، الرقبة {formatDim(seam.neckArmhole)}، الحاشية {formatDim(seam.hem)}.</p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 3. MODERN MOBILE APP BOTTOM NAVIGATION BAR (شريط تنقل سفلي واضح وبسيط ومريح للإبهام) */}
      <nav className="h-14 bg-slate-950 border-t border-slate-800/90 px-2 flex items-center justify-around shrink-0 z-30">
        {[
          { id: 'cad2d', label: 'باترون 2D', icon: <DraftingCompass className="w-5 h-5" /> },
          { id: 'view3d', label: 'محاكاة 3D', icon: <Box className="w-5 h-5" /> },
          { id: 'measurements', label: 'المقاسات', icon: <Ruler className="w-5 h-5" /> },
          { id: 'fabrics', label: 'الأقمشة', icon: <Palette className="w-5 h-5" /> },
          { id: 'export_guide', label: 'التصدير', icon: <FileText className="w-5 h-5" /> },
        ].map(item => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as MainViewTab)}
              className={cn(
                "flex-1 flex flex-col items-center justify-center py-1 transition-all rounded-xl",
                isActive
                  ? "text-blue-400 font-bold scale-105"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              {item.icon}
              <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* PDF Export Modal */}
      <PdfExportModal
        state={state}
        isOpen={showPdfModal}
        onClose={() => setShowPdfModal(false)}
      />
    </div>
  );
}
