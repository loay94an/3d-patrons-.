import React, { useState, useEffect } from 'react';
import {
  Moon, Sun, DraftingCompass, Info, Copy, Check, FileSpreadsheet, FolderOpen, ImagePlus,
  FileText, Shirt, Sparkles, Sliders, Palette, Layers, Box, Scissors,
  Ruler, Download, ArrowRight, UserCheck, ChevronLeft, ChevronRight, BookOpen, Code2, Home, MoreHorizontal
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  AppState, Gender, SizeSystem, Unit, GarmentType, School, FabricType, SleeveType,
  getSizeList, mapSizeBySystem, getMeasurements, computePatternValues, getGarmentLabel,
  getBaseMeasurements
} from '../lib/pattern-logic';
import { DEFAULT_MANNEQUIN_MEASUREMENTS } from '../lib/mannequin-builder';
import {
  FabricCustomState, DEFAULT_FABRIC_STATE, FABRIC_PRESETS,
  FabricCategory, PatternPrintType, FabricDefinition
} from '../lib/fabric-engine';
import { PatternVisualizer } from './PatternVisualizer';
import { PatternCatalog } from './PatternCatalog';
import { ReferenceLibraryCatalog } from './ReferenceLibraryCatalog';
import { PatternEncyclopedia } from './PatternEncyclopedia';
import { ParametricStudio } from './ParametricStudio';
import { Pattern3DViewer } from './Pattern3DViewer';
import { GarmentImageWorkbench } from './GarmentImageWorkbench';
import { PdfExportModal } from './PdfExportModal';
import { PWAInstallButton } from './PWAInstallButton';
import { ProjectWorkspace } from './ProjectWorkspace';
import { createMeasurementProfile, validateStudioProfile } from '../lib/measurement-profile';
import { cn } from '../lib/utils';
import type { BasicSkirtDraftResult } from '../lib/basic-skirt-pattern';
import { createStudioProject, loadProjects, persistProjects, type ProjectGarment, type ProjectMeasurements, type ProjectEase } from '../lib/project-store';

export type MainViewTab = 'home' | 'encyclopedia' | 'catalog' | 'models' | 'pattern_library' | 'parametric' | 'cad2d' | 'view3d' | 'garment_image' | 'measurements' | 'fabrics' | 'export_guide' | 'projects';

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
  const [userMode, setUserMode] = useState<'beginner' | 'expert'>('beginner');
  const [activeTab, setActiveTab] = useState<MainViewTab>('home');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [cadInitialDraft, setCadInitialDraft] = useState<BasicSkirtDraftResult | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  // 3D Fabric Physical & Visual State
  const [fabricState, setFabricState] = useState<FabricCustomState>(DEFAULT_FABRIC_STATE);
  const [selectedFabricCategory, setSelectedFabricCategory] = useState<FabricCategory | 'all'>('all');

  useEffect(() => {
    try { const savedMode = localStorage.getItem('pattern-user-mode'); if (savedMode === 'beginner' || savedMode === 'expert') setUserMode(savedMode); } catch { /* optional persistence */ }
  }, []);
  useEffect(() => { try { localStorage.setItem('pattern-user-mode', userMode); } catch { /* session fallback */ } }, [userMode]);
  const switchUserMode = (mode: 'beginner' | 'expert') => {
    setUserMode(mode);
    setShowMoreMenu(false);
    if (mode === 'beginner' && activeTab === 'garment_image') {
      setActiveTab('home');
    }
  };
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
      const genderChanged = Boolean(updates.gender && updates.gender !== prev.gender);
      const sizeChanged = updates.size !== undefined && updates.size !== prev.size;

      // A new body archetype or standard size invalidates measurements from the
      // previous profile. Clear both stores so the 2D pattern and 3D body stay in sync.
      if (genderChanged) next.size = getSizeList(updates.gender as Gender)[0];
      if (genderChanged || sizeChanged) {
        next.customMeasurements = updates.customMeasurements ?? {};
        next.measurementProfile = updates.measurementProfile;
        next.useCustomMode = updates.useCustomMode ?? false;
      } else if (updates.useCustomMode === false ||
        (updates.customMeasurements && Object.keys(updates.customMeasurements).length === 0)) {
        next.measurementProfile = updates.measurementProfile;
        if (updates.useCustomMode === undefined) next.useCustomMode = false;
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
    height: state.customMeasurements.height ?? DEFAULT_MANNEQUIN_MEASUREMENTS[state.gender].height,
    ...state.customMeasurements
  };

  const startProjectForCad = (garment: GarmentType, measurements: ProjectMeasurements, ease: ProjectEase) => {
    const supportedGarments: ProjectGarment[] = ['blouse', 'dress', 'shirt', 'skirt', 'pants', 'tshirt', 'abaya', 'coat', 'hoodie', 'blazer'];
    const projectGarment: ProjectGarment = supportedGarments.includes(garment as ProjectGarment)
      ? garment as ProjectGarment : 'blouse';
    const project = createStudioProject(
      `مشروع ${getGarmentLabel(garment)} - ${new Date().toLocaleDateString('ar')}`,
      projectGarment, measurements, ease
    );
    const saved = typeof window !== 'undefined'
      && persistProjects(window.localStorage, [project, ...loadProjects(window.localStorage)]);
    setActiveProjectId(saved ? project.id : null);
    if (!saved && typeof window !== 'undefined') {
      window.alert('تعذر حفظ المشروع محلياً؛ يمكنك متابعة الرسم لكن احفظ نسخة احتياطية قبل إغلاق الصفحة.');
    }
    return project;
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
      key: 'height',
      labelAr: 'الطول الكلي للجسم',
      hintAr: 'من أعلى الرأس حتى الأرض؛ يؤثر مباشرة في تناسب المانيكان ثلاثي الأبعاد',
      min: isKids ? 45 : 140,
      max: isKids ? 160 : 210,
      step: 1
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
    },
    {
      key: 'legLength',
      labelAr: 'طول البنطال الخارجي',
      hintAr: 'من خط الخصر إلى أسفل الساق؛ يستخدم لقالب البنطال',
      min: isKids ? 25 : 65,
      max: isKids ? 90 : 125,
      step: 0.5
    },
    {
      key: 'crotchHeight',
      labelAr: 'عمق الحجر',
      hintAr: 'من خط الخصر إلى مستوى التقاء الساقين أثناء الجلوس',
      min: isKids ? 12 : 18,
      max: isKids ? 32 : 42,
      step: 0.5
    },
    {
      key: 'thighCirc',
      labelAr: 'محيط الفخذ',
      hintAr: 'حول أعرض منطقة أعلى الفخذ',
      min: isKids ? 20 : 38,
      max: isKids ? 55 : 85,
      step: 0.5
    },
    {
      key: 'waistToHip',
      labelAr: 'عمق الورك',
      hintAr: 'من خط الخصر إلى خط أعرض منطقة الورك',
      min: isKids ? 8 : 14,
      max: isKids ? 28 : 32,
      step: 0.5
    },
    {
      key: 'waistToKnee',
      labelAr: 'طول الخصر إلى الركبة',
      hintAr: 'من خط الخصر حتى منتصف الركبة',
      min: isKids ? 20 : 35,
      max: isKids ? 55 : 75,
      step: 0.5
    },
    {
      key: 'frontLength',
      labelAr: 'طول الأمام حتى الخصر',
      hintAr: 'الطول الأمامي الكامل من نقطة الرقبة إلى خط الخصر؛ أدخله وفق طريقة التفصيل',
      min: isKids ? 25 : 38,
      max: isKids ? 55 : 75,
      step: 0.5
    }
  ];

  const filteredFabrics = selectedFabricCategory === 'all'
    ? FABRIC_PRESETS
    : FABRIC_PRESETS.filter(f => f.category === selectedFabricCategory);

  const journeySteps: { id: MainViewTab; title: string }[] = [
    { id: 'catalog', title: 'الموديل' }, { id: 'measurements', title: 'القياسات' },
    { id: 'parametric', title: 'التوليد' }, { id: 'cad2d', title: 'تعديل 2D' },
    { id: 'view3d', title: 'معاينة 3D' }, { id: 'export_guide', title: 'التصدير' }
  ];
  const journeyIndex = journeySteps.findIndex(step => step.id === activeTab);
  const goToJourneyStep = (index: number) => {
    const step = journeySteps[index];
    if (step) { setShowMoreMenu(false); setActiveTab(step.id); }
  };

  return (
    <div className="app-shell h-screen w-screen overflow-hidden bg-slate-900 text-slate-100 flex flex-col font-['Cairo',sans-serif] select-none" dir="rtl">
      
{/* 1. COMPACT SLEEK TOP BAR (ارتفاع مدروس ومناسب تماماً للهواتف دون مزاحمة) */}
      <header className="h-12 bg-slate-950 border-b border-slate-800 px-3 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow">
            <Shirt className="w-4 h-4" />
          </div>
          <span className="font-bold text-xs sm:text-sm tracking-tight text-white">
            استوديو الباترون 3D
          </span>

          <div className="flex items-center rounded-lg border border-slate-700 bg-slate-900 p-0.5" role="group" aria-label="مستوى الواجهة">
            <button type="button" aria-pressed={userMode === 'beginner'} onClick={() => switchUserMode('beginner')} className={cn("rounded-md px-2 py-1 text-[10px] font-bold", userMode === 'beginner' ? "bg-blue-600 text-white" : "text-slate-400")}>مبتدئ</button>
            <button type="button" aria-pressed={userMode === 'expert'} onClick={() => switchUserMode('expert')} className={cn("rounded-md px-2 py-1 text-[10px] font-bold", userMode === 'expert' ? "bg-blue-600 text-white" : "text-slate-400")}>متخصص</button>
          </div>
          {/* Archetype Quick Badge */}
          <span className="hidden text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 sm:inline-flex">
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
      <main className="flex-1 w-full min-h-0 relative overflow-hidden bg-slate-950">
        

        {activeTab === 'home' && (userMode === 'beginner' ? (
          <div className="h-full overflow-y-auto p-4 pb-8 sm:p-7"><div className="mx-auto max-w-5xl space-y-5">
            <section className="rounded-3xl border border-indigo-300/20 bg-gradient-to-br from-slate-900 to-indigo-950 p-5 text-white sm:p-8">
              <span className="rounded-full border border-indigo-300/30 bg-indigo-300/10 px-3 py-1 text-[11px] font-bold text-indigo-200">تصميم سهل خطوة بخطوة</span>
              <h1 className="mt-4 text-2xl font-black sm:text-4xl">لنصمم قطعتك الأولى</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">اختر نوع الملابس، أدخل المقاسات، أنشئ الباترون، ثم شاهد النتيجة. يمكنك تعديل أي خطوة في أي وقت.</p>
              <button onClick={() => setActiveTab('catalog')} className="mt-5 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-extrabold text-white">ابدأ تصميمًا جديدًا <ArrowRight className="mr-1 inline h-4 w-4"/></button>
            </section>
            <section className="space-y-3"><div><h2 className="text-lg font-extrabold text-white">رحلة التصميم</h2><p className="mt-1 text-xs text-slate-400">ست مراحل مترابطة من اختيار الموديل حتى تصدير الباترون</p></div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  {id:'catalog',n:'١',title:'اختر فئة وموديل الملابس',desc:'استعرض الموديلات المتاحة فعلياً في المكتبة.',icon:<Shirt className="h-5 w-5"/>},
                  {id:'measurements',n:'٢',title:'حدد الجسم والمقاسات',desc:'اختر الفئة العمرية والمقاس أو أدخل قياساتك.',icon:<Ruler className="h-5 w-5"/>},
                  {id:'parametric',n:'٣',title:'ولّد الباترون',desc:'حوّل الموديل والقياسات إلى مسودة هندسية.',icon:<Sparkles className="h-5 w-5"/>},
                  {id:'cad2d',n:'٤',title:'راجع وعدّل الباترون',desc:'افتح محرر CAD لمراجعة القطع وتعديلها.',icon:<DraftingCompass className="h-5 w-5"/>},
                  {id:'view3d',n:'٥',title:'عاين ثلاثي الأبعاد',desc:'شاهد الجسم والخامة والنتيجة المتاحة.',icon:<Box className="h-5 w-5"/>},
                  {id:'export_guide',n:'٦',title:'صدّر عملك',desc:'جهّز ملف PDF أو جدول القياسات Excel.',icon:<Download className="h-5 w-5"/>}
                ].map(item=><button key={item.id} onClick={()=>setActiveTab(item.id as MainViewTab)} className="flex min-h-24 items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-right hover:border-indigo-500/60">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-sm font-black text-slate-200">{item.n}</span>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-indigo-300">{item.icon}</span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold text-white">{item.title}</span><span className="mt-1 block text-xs leading-5 text-slate-400">{item.desc}</span></span><ChevronLeft className="h-4 w-4 text-slate-500"/>
                </button>)}
              </div>
            </section>
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button onClick={() => setActiveTab('models')} className="rounded-2xl border border-indigo-500/30 bg-indigo-950/20 p-4 text-right hover:border-indigo-400"><span className="text-sm font-extrabold text-white">مكتبة الموديلات المرجعية</span><span className="mt-1 block text-xs leading-5 text-slate-400">استعراض التصاميم المستوردة وتصنيفها مع الرسومات التوضيحية.</span></button>
              <button onClick={() => setActiveTab('pattern_library')} className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4 text-right hover:border-emerald-400"><span className="text-sm font-extrabold text-white">فهرس الباترونات المرجعية</span><span className="mt-1 block text-xs leading-5 text-slate-400">مراجعة الملفات المرشحة لإعادة الرسم والتحويل إلى CAD.</span></button>
            </section>
            <section className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div><h2 className="text-sm font-extrabold text-white">تحتاج تحكمًا كاملًا؟</h2><p className="mt-1 text-xs text-slate-400">افتح أدوات الرسم والهندسة المتقدمة.</p></div>
              <button onClick={()=>{setUserMode('expert');setActiveTab('cad2d');}} className="rounded-xl border border-slate-600 px-4 py-2.5 text-xs font-bold text-slate-100">فتح أدوات المتخصص</button>
            </section>
            <p className="text-[11px] leading-6 text-slate-500">المعاينة ثلاثية الأبعاد للعرض والخامات المتاحة، وليست محاكاة فيزيائية كاملة للقماش.</p>
          </div></div>
        ) : (

          <div className="h-full overflow-y-auto p-4 pb-6 sm:p-7">
            <div className="mx-auto max-w-6xl space-y-6">
              <section className="overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 p-5 sm:p-8">
                <div className="max-w-2xl">
                  <span className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-400/10 px-3 py-1 text-[11px] font-bold text-indigo-200">منصة تصميم وهندسة الأزياء</span>
                  <h1 className="mt-4 text-2xl font-black leading-tight text-white sm:text-4xl">من القياسات إلى باترونك التالي</h1>
                  <p className="mt-3 max-w-xl text-sm leading-7 text-slate-300">ابدأ بمشروع جديد، أو واصل التصميم، أو تعلّم قاعدة ثم طبّقها مباشرة داخل الاستوديو.</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <button onClick={() => setActiveTab('parametric')} className="rounded-xl bg-indigo-500 px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-indigo-950/40 transition hover:bg-indigo-400">إنشاء باترون من القياسات <ArrowRight className="mr-1 inline h-4 w-4" /></button>
                    <button onClick={() => setActiveTab('cad2d')} className="rounded-xl border border-slate-600 bg-slate-800/70 px-4 py-3 text-sm font-bold text-slate-100 transition hover:bg-slate-700">فتح استوديو الرسم</button>
                  </div>
                </div>
              </section>
              <section className="space-y-3">
                <div><h2 className="text-lg font-extrabold text-white">ابدأ من هنا</h2><p className="mt-1 text-xs text-slate-400">اختر المهمة التي تريد إنجازها</p></div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {[
                    { id: 'measurements', title: 'إعداد القياسات', desc: 'أدخل قياسات الجسم وراجعها قبل التصميم.', icon: <Ruler className="h-5 w-5" />, color: 'text-cyan-300' },
                    { id: 'projects', title: 'المشاريع وملفات القياسات', desc: 'احفظ مشاريع متعددة واستعد نسخها الاحتياطية.', icon: <FolderOpen className="h-5 w-5" />, color: 'text-emerald-300' },
                    { id: 'parametric', title: 'توليد باترون', desc: 'ابدأ بقطعة وقياسات وراحة تصميمية.', icon: <Sliders className="h-5 w-5" />, color: 'text-indigo-300' },
                    { id: 'cad2d', title: 'الرسم ثنائي الأبعاد', desc: 'افتح محرر القطع والنقاط والمنحنيات.', icon: <DraftingCompass className="h-5 w-5" />, color: 'text-emerald-300' },
                    { id: 'view3d', title: 'المعاينة ثلاثية الأبعاد', desc: 'اعرض النموذج والخامة المتاحة.', icon: <Box className="h-5 w-5" />, color: 'text-violet-300' },
                    { id: 'catalog', title: 'استكشاف الموديلات', desc: 'تعرّف على أنواع القطع وابدأ من نموذج.', icon: <Shirt className="h-5 w-5" />, color: 'text-amber-300' },
                    { id: 'encyclopedia', title: 'التعلم والمراجع', desc: 'اقرأ الشرح ثم انتقل إلى التطبيق.', icon: <BookOpen className="h-5 w-5" />, color: 'text-rose-300' },
                    { id: 'models', title: 'مكتبة موديلات المراجع', desc: '687 سجل تصميم مصنفاً مع رسومات توضيحية.', icon: <ImagePlus className="h-5 w-5" />, color: 'text-cyan-300' },
                    { id: 'pattern_library', title: 'فهرس الباترونات', desc: '54 ملفاً مرشحاً للفحص وإعادة الرسم.', icon: <Scissors className="h-5 w-5" />, color: 'text-emerald-300' }
                  ].map(item => (
                    <button key={item.id} onClick={() => setActiveTab(item.id as MainViewTab)} className="group flex min-h-28 items-start gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-right transition hover:-translate-y-0.5 hover:border-indigo-500/60 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                      <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-800", item.color)}>{item.icon}</span>
                      <span className="min-w-0"><span className="block text-sm font-extrabold text-white">{item.title}</span><span className="mt-1 block text-xs leading-6 text-slate-400">{item.desc}</span></span>
                      <ChevronLeft className="mr-auto mt-1 h-4 w-4 shrink-0 text-slate-600 transition group-hover:text-indigo-300" />
                    </button>
                  ))}
                </div>
              </section>
              <p className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 text-[11px] leading-6 text-slate-400">ملاحظة: المعاينة ثلاثية الأبعاد الحالية للعرض والخامات المتاحة؛ لا تمثل بعد محاكاة فيزيائية كاملة لسقوط القماش وملاءمته.</p>
            </div>
          </div>
          )
        )}
        {activeTab === 'projects' && <ProjectWorkspace onOpenCad={(project) => {
          setActiveProjectId(project.id);
          setCadInitialDraft(null);
          const profile = createMeasurementProfile(project.measurements);
          updateState({
            garment: project.garment,
            useCustomMode: true,
            measurementProfile: profile,
            customMeasurements: {
              bust: project.measurements.bust, waist: project.measurements.waist,
              hip: project.measurements.hip, backLength: project.measurements.backLength,
              sleeveLength: project.measurements.sleeveLength, armCirc: project.measurements.upperArm,
              bustEase: project.ease.bust, waistEase: project.ease.waist,
              hipEase: project.ease.hip, upperArmEase: project.ease.upperArm
            }
          });
          setActiveTab('cad2d');
        }} />}

        {activeTab === 'models' && <ReferenceLibraryCatalog mode="models" />}
        {activeTab === 'pattern_library' && <ReferenceLibraryCatalog mode="patterns" />}

        {activeTab === 'encyclopedia' && (
          <div className="w-full h-full">
            <PatternEncyclopedia />
          </div>
        )}

        {activeTab === 'parametric' && (
          <div className="w-full h-full">
            <ParametricStudio
              initialMeasurements={{
                bust: currentMeas.bust ?? currentMeas.chest ?? 88,
                waist: currentMeas.waist ?? 70,
                hip: currentMeas.hip ?? 94,
                backLength: currentMeas.backLength ?? 40,
                sleeveLength: currentMeas.sleeveLength ?? 58,
                upperArm: currentMeas.armCirc ?? 30
              }}
              initialEase={{
                bust: state.customMeasurements.bustEase ?? 4,
                waist: state.customMeasurements.waistEase ?? 2,
                hip: state.customMeasurements.hipEase ?? 4,
                upperArm: state.customMeasurements.upperArmEase ?? 3
              }}
              onDraftChange={(measurements, ease) => {
                if (validateStudioProfile(measurements, ease).errors.length > 0) return;
                const profile = createMeasurementProfile(measurements);
                updateState({
                  useCustomMode: true,
                  measurementProfile: profile,
                  customMeasurements: {
                    bust: measurements.bust,
                    waist: measurements.waist,
                    hip: measurements.hip,
                    backLength: measurements.backLength,
                    sleeveLength: measurements.sleeveLength,
                    armCirc: measurements.upperArm,
                    bustEase: ease.bust,
                    waistEase: ease.waist,
                    hipEase: ease.hip,
                    upperArmEase: ease.upperArm
                  }
                });
              }}
              onOpenCad={(garment, profile, ease, draft) => {
                const measurements = profile.values;
                startProjectForCad(garment, measurements, {
                  bust: ease.bust, waist: ease.waist, hip: ease.hip, upperArm: ease.upperArm
                });
                setCadInitialDraft(draft ?? null);
                updateState({
                  garment,
                  useCustomMode: true,
                  measurementProfile: profile,
                  customMeasurements: {
                    bust: measurements.bust,
                    waist: measurements.waist,
                    hip: measurements.hip,
                    backLength: measurements.backLength,
                    sleeveLength: measurements.sleeveLength,
                    armCirc: measurements.upperArm,
                    bustEase: ease.bust,
                    waistEase: ease.waist,
                    hipEase: ease.hip,
                    upperArmEase: ease.upperArm
                  }
                });
                setActiveTab('cad2d');
              }}
              onOpenEncyclopedia={() => setActiveTab('encyclopedia')}
            />
          </div>
        )}

        {activeTab === 'catalog' && (
          <div className="w-full h-full">
            <PatternCatalog onSelect={(garment, gender) => {
              // Preserve the selected model and body profile in shared app state.
              // Measurement entry comes next; CAD project creation follows validation.
              setCadInitialDraft(null);
              updateState({ garment, gender });
              setActiveTab('measurements');
            }} />
          </div>
        )}

        {/* VIEW 1: FULLSCREEN 2D PATTERN CAD (مربع الرسم ثنائي الأبعاد كاملاً) */}
        {activeTab === 'cad2d' && (
          <div className="w-full h-full relative overflow-hidden">
            <PatternVisualizer
              state={state}
              initialDraft={cadInitialDraft}
              projectId={activeProjectId}
              onGarmentChange={(garment) => updateState({ garment })}
            />
          </div>
        )}

        {activeTab === 'garment_image' && (
          <div className="h-full w-full overflow-hidden">
            <GarmentImageWorkbench />
          </div>
        )}

        {/* VIEW 2: FULLSCREEN 3D SIMULATION (مربع العرض ثلاثي الأبعاد كاملاً) */}
        {activeTab === 'view3d' && (
          <div className="w-full h-full relative overflow-hidden bg-slate-950">
            <Pattern3DViewer
              state={state}
              projectId={activeProjectId}
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
                  const rawVal = currentMeas[f.key] ?? (f.key === 'frontLength' ? 62 : f.min);
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

      {userMode === 'beginner' && journeyIndex >= 0 && (
        <section aria-label="التقدم في رحلة التصميم" className="z-20 shrink-0 border-t border-slate-800 bg-slate-950 px-2 py-2 sm:px-4">
          <div className="mx-auto flex max-w-5xl items-center gap-2">
            <button type="button" onClick={() => goToJourneyStep(journeyIndex - 1)} disabled={journeyIndex === 0}
              className="rounded-lg border border-slate-700 px-2.5 py-2 text-[11px] font-bold text-slate-200 disabled:cursor-not-allowed disabled:opacity-35">السابق</button>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between gap-2 text-[10px]">
                <span className="font-bold text-slate-200">المرحلة {journeyIndex + 1} من 6 · {journeySteps[journeyIndex].title}</span>
                <span className="text-slate-500">{Math.round(((journeyIndex + 1) / journeySteps.length) * 100)}٪</span>
              </div>
              <div className="flex gap-1" role="list" aria-label="مراحل التصميم">
                {journeySteps.map((step, index) => (
                  <button key={step.id} type="button" role="listitem" aria-label={`المرحلة ${index + 1}: ${step.title}`}
                    aria-current={index === journeyIndex ? 'step' : undefined} onClick={() => goToJourneyStep(index)}
                    className={cn("h-1.5 min-w-0 flex-1 rounded-full transition-colors", index <= journeyIndex ? "bg-indigo-500" : "bg-slate-700")} />
                ))}
              </div>
            </div>
            <button type="button" onClick={() => goToJourneyStep(journeyIndex + 1)} disabled={journeyIndex === journeySteps.length - 1}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-[11px] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-35">التالي</button>
          </div>
        </section>
      )}

{/* Primary navigation: five high-frequency destinations plus a compact tools menu. */}
      <nav aria-label="التنقل الرئيسي" className="relative z-30 flex h-16 shrink-0 items-center justify-around border-t border-slate-800/90 bg-slate-950 px-1 sm:px-3">
        {(userMode === 'beginner' ? [
          {id:'home',label:'الرئيسية',icon:<Home className="h-5 w-5"/>},{id:'catalog',label:'الموديلات',icon:<Shirt className="h-5 w-5"/>},{id:'measurements',label:'المقاسات',icon:<Ruler className="h-5 w-5"/>},{id:'projects',label:'مشاريعي',icon:<FolderOpen className="h-5 w-5"/>},{id:'view3d',label:'المعاينة',icon:<Box className="h-5 w-5"/>}
        ] : [
          {id:'home',label:'الرئيسية',icon:<Home className="h-5 w-5"/>},{id:'catalog',label:'الموديلات',icon:<Shirt className="h-5 w-5"/>},{id:'parametric',label:'المعمل',icon:<Code2 className="h-5 w-5"/>},{id:'cad2d',label:'الرسم 2D',icon:<DraftingCompass className="h-5 w-5"/>},{id:'view3d',label:'عرض 3D',icon:<Box className="h-5 w-5"/>}
        ]).map(item=><button key={item.id} aria-current={activeTab===item.id?'page':undefined} onClick={()=>{setActiveTab(item.id as MainViewTab);setShowMoreMenu(false);}} className={cn("flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl py-2 text-[10px] transition sm:text-xs",activeTab===item.id?"font-extrabold text-blue-400":"text-slate-400 hover:text-slate-100")}>{item.icon}<span>{item.label}</span></button>)}
        <button aria-expanded={showMoreMenu} aria-label="المزيد من الأدوات" onClick={()=>setShowMoreMenu(v=>!v)} className={cn("flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl py-2 text-[10px] sm:text-xs",showMoreMenu || (userMode === 'beginner' ? ['parametric','cad2d','fabrics','encyclopedia'].includes(activeTab) : ['encyclopedia','measurements','fabrics','export_guide','projects','garment_image'].includes(activeTab)) ? "font-extrabold text-blue-400" : "text-slate-400")}><MoreHorizontal className="h-5 w-5"/><span>المزيد</span></button>
      </nav>
      {showMoreMenu && (
        <div className="absolute bottom-16 left-2 right-2 z-40 rounded-2xl border border-slate-700 bg-slate-900 p-2 shadow-2xl sm:left-auto sm:right-4 sm:w-72" role="menu" aria-label="أدوات إضافية">
          {userMode === 'beginner' ? <>
            {[
              {id:'parametric',label:'إنشاء الباترون',icon:<Sparkles className="h-4 w-4"/>},{id:'cad2d',label:'الرسم والتعديل المتقدم',icon:<DraftingCompass className="h-4 w-4"/>},{id:'models',label:'مكتبة موديلات المراجع',icon:<ImagePlus className="h-4 w-4"/>},{id:'pattern_library',label:'فهرس الباترونات المرجعية',icon:<Scissors className="h-4 w-4"/>},{id:'fabrics',label:'اختيار القماش',icon:<Palette className="h-4 w-4"/>},{id:'encyclopedia',label:'تعلم أساسيات التفصيل',icon:<BookOpen className="h-4 w-4"/>}
            ].map(item=><button key={item.id} role="menuitem" onClick={()=>{setActiveTab(item.id as MainViewTab);setShowMoreMenu(false);}} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right text-sm font-semibold text-slate-200 hover:bg-slate-800">{item.icon}<span>{item.label}</span><ChevronLeft className="mr-auto h-4 w-4 text-slate-500"/></button>)}
            <button role="menuitem" onClick={()=>{setUserMode('expert');setShowMoreMenu(false);}} className="mt-1 flex w-full items-center gap-3 rounded-xl border-t border-slate-700 px-3 py-3 text-right text-sm font-bold text-indigo-300 hover:bg-slate-800"><Code2 className="h-4 w-4"/><span>الانتقال إلى وضع المتخصص</span></button>
          </> : <>
            {[
              {id:'garment_image',label:'تحليل صورة الملابس والمعالم',icon:<ImagePlus className="h-4 w-4"/>},{id:'models',label:'مكتبة موديلات المراجع',icon:<Shirt className="h-4 w-4"/>},{id:'pattern_library',label:'فهرس الباترونات المرجعية',icon:<Scissors className="h-4 w-4"/>},{id:'projects',label:'المشاريع وملفات القياسات',icon:<FolderOpen className="h-4 w-4"/>},{id:'encyclopedia',label:'الموسوعة والمراجع',icon:<BookOpen className="h-4 w-4"/>},{id:'measurements',label:'ملف القياسات',icon:<Ruler className="h-4 w-4"/>},{id:'fabrics',label:'الأقمشة والخامات',icon:<Palette className="h-4 w-4"/>},{id:'export_guide',label:'التصدير والإنتاج',icon:<FileText className="h-4 w-4"/>}
            ].map(item=><button key={item.id} role="menuitem" onClick={()=>{setActiveTab(item.id as MainViewTab);setShowMoreMenu(false);}} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right text-sm font-semibold text-slate-200 hover:bg-slate-800">{item.icon}<span>{item.label}</span><ChevronLeft className="mr-auto h-4 w-4 text-slate-500"/></button>)}
          </>}
        </div>
      )}

      {/* PDF Export Modal */}
      <PdfExportModal
        state={state}
        isOpen={showPdfModal}
        onClose={() => setShowPdfModal(false)}
      />
    </div>
  );
}
