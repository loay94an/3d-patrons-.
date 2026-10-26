import React, { useState, useEffect, useMemo } from 'react';
import {
  X, Sparkles, Save, FolderOpen, RotateCcw, Check, Sliders,
  Info, Ruler, Compass, Copy, Download, Upload, Layers,
  Code, Calculator, CheckCircle2, ChevronRight
} from 'lucide-react';
import {
  PatternByNumbersInput, DEFAULT_PATTERN_NUMBERS,
  DraftingRulesConfig, DEFAULT_DRAFTING_RULES,
  computeReferencePoints, ReferencePointInfo
} from '../lib/pattern-cad-engine';

interface PatternByNumbersModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentInput: PatternByNumbersInput;
  onApply: (values: PatternByNumbersInput, rules?: DraftingRulesConfig) => void;
  currentRules?: DraftingRulesConfig;
  unit: 'cm' | 'in';
  onUnitChange?: (unit: 'cm' | 'in') => void;
}

export function PatternByNumbersModal({
  isOpen,
  onClose,
  currentInput,
  onApply,
  currentRules = DEFAULT_DRAFTING_RULES,
  unit,
  onUnitChange
}: PatternByNumbersModalProps) {
  const [form, setForm] = useState<PatternByNumbersInput>(currentInput);
  const [rules, setRules] = useState<DraftingRulesConfig>(currentRules);
  const [activeTab, setActiveTab] = useState<'measurements' | 'points' | 'formulas' | 'presets'>('measurements');
  const [liveUpdate, setLiveUpdate] = useState(true);
  const [copiedPointId, setCopiedPointId] = useState<string | null>(null);
  const [savedPresets, setSavedPresets] = useState<Record<string, PatternByNumbersInput>>(() => {
    try {
      const stored = localStorage.getItem('cad_pattern_presets');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  const [presetName, setPresetName] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync initial input on open
  useEffect(() => {
    setForm(currentInput);
  }, [currentInput, isOpen]);

  // Compute reference points reactively
  const referencePoints = useMemo(() => {
    return computeReferencePoints(form, rules);
  }, [form, rules]);

  // Debounced live update to canvas
  useEffect(() => {
    if (!liveUpdate) return;
    const timer = setTimeout(() => {
      onApply(form, rules);
    }, 100);
    return () => clearTimeout(timer);
  }, [form, rules, liveUpdate, onApply]);

  if (!isOpen) return null;

  const handleChange = (key: keyof PatternByNumbersInput, val: number) => {
    setForm(prev => ({ ...prev, [key]: isNaN(val) ? 0 : val }));
  };

  const handleRuleChange = (key: keyof DraftingRulesConfig, val: string) => {
    setRules(prev => ({ ...prev, [key]: val }));
  };

  const handleCopyPoint = (pt: ReferencePointInfo) => {
    const text = `${pt.nameAr} (${pt.name}): X=${pt.x} سم, Y=${pt.y} سم`;
    navigator.clipboard.writeText(text);
    setCopiedPointId(pt.id);
    setTimeout(() => setCopiedPointId(null), 1500);
  };

  const handleSavePreset = () => {
    if (!presetName.trim()) return;
    const updated = { ...savedPresets, [presetName.trim()]: form };
    setSavedPresets(updated);
    try {
      localStorage.setItem('cad_pattern_presets', JSON.stringify(updated));
      setSaveSuccess(true);
      setPresetName('');
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleLoadStandardSize = (size: 'S' | 'M' | 'L' | 'XL') => {
    const sizeMap: Record<'S' | 'M' | 'L' | 'XL', PatternByNumbersInput> = {
      S: {
        backLength: 58,
        frontLength: 60,
        shoulderLength: 11.5,
        neckCircumference: 34,
        neckDepthFront: 7.0,
        neckDepthBack: 2.2,
        bustCircumference: 84,
        waistCircumference: 66,
        hipCircumference: 88,
        armholeCircumference: 38,
        sleeveLength: 57,
        crotchDepth: 25,
        rise: 23,
        thighCircumference: 53,
        additionalEase: 1.5,
        seamAllowanceDefault: 1.5
      },
      M: DEFAULT_PATTERN_NUMBERS,
      L: {
        backLength: 62,
        frontLength: 64,
        shoulderLength: 12.5,
        neckCircumference: 38,
        neckDepthFront: 8.0,
        neckDepthBack: 2.8,
        bustCircumference: 94,
        waistCircumference: 76,
        hipCircumference: 98,
        armholeCircumference: 42,
        sleeveLength: 59,
        crotchDepth: 27,
        rise: 25,
        thighCircumference: 59,
        additionalEase: 2.0,
        seamAllowanceDefault: 1.5
      },
      XL: {
        backLength: 64,
        frontLength: 66,
        shoulderLength: 13.0,
        neckCircumference: 40,
        neckDepthFront: 8.5,
        neckDepthBack: 3.0,
        bustCircumference: 102,
        waistCircumference: 84,
        hipCircumference: 106,
        armholeCircumference: 45,
        sleeveLength: 60,
        crotchDepth: 28.5,
        rise: 26,
        thighCircumference: 63,
        additionalEase: 2.5,
        seamAllowanceDefault: 1.5
      }
    };
    setForm(sizeMap[size]);
  };

  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ measurements: form, rules }, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `pattern_measurements_${new Date().toISOString().slice(0,10)}.json`);
    dlAnchorElem.click();
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (parsed.measurements) setForm(parsed.measurements);
        if (parsed.rules) setRules(parsed.rules);
      } catch (err) {
        alert('الملف غير صالح');
      }
    };
    reader.readAsText(file);
  };

  const measurementGroups = [
    {
      title: '1. قياسات الجذع والصدر (Torso & Bust)',
      fields: [
        { key: 'bustCircumference' as const, label: 'محيط الصدر (Bust)', help: 'المحيط الكامل عند أبرز نقطة في الصدر', step: 0.5 },
        { key: 'waistCircumference' as const, label: 'محيط الخصر (Waist)', help: 'المحيط حول أنحف جزء في البطن', step: 0.5 },
        { key: 'hipCircumference' as const, label: 'محيط الأرداف (Hip)', help: 'المحيط عند أعرض نقطة في الأرداف', step: 0.5 },
        { key: 'backLength' as const, label: 'طول الظهر (Back Length)', help: 'من مؤخرة العنق حتى خط الخصر', step: 0.5 },
        { key: 'frontLength' as const, label: 'طول الصدر للأمام (Front Length)', help: 'من حردة الرقبة الأمامية حتى الخصر', step: 0.5 }
      ]
    },
    {
      title: '2. الرقبة والأكتاف (Neck & Shoulder)',
      fields: [
        { key: 'neckCircumference' as const, label: 'محيط الرقبة (Neck)', help: 'محيط قاعدة الرقبة الكاملة', step: 0.5 },
        { key: 'shoulderLength' as const, label: 'طول الكتف (Shoulder)', help: 'من نقطة الرقبة إلى رأس الكتف', step: 0.5 },
        { key: 'neckDepthFront' as const, label: 'عمق حردة الأمام (Front Neck Depth)', help: 'نزول حفرة الرقبة في الأمام', step: 0.2 },
        { key: 'neckDepthBack' as const, label: 'عمق حردة الظهر (Back Neck Depth)', help: 'نزول حفرة الرقبة في الخلف', step: 0.2 }
      ]
    },
    {
      title: '3. الذراع والكم (Arm & Sleeve)',
      fields: [
        { key: 'armholeCircumference' as const, label: 'محيط حفرة الإبط (Armhole)', help: 'محيط الإبط مع راحة كافية للحركة', step: 0.5 },
        { key: 'sleeveLength' as const, label: 'طول الكم (Sleeve Length)', help: 'من رأس الكتف حتى عظمة الرسغ', step: 0.5 }
      ]
    },
    {
      title: '4. السراويل، الحجر، والسماحات (Pants & Allowances)',
      fields: [
        { key: 'crotchDepth' as const, label: 'عمق الحجر (Crotch Depth)', help: 'من خط الخصر حتى قاعدة الجلوس', step: 0.5 },
        { key: 'rise' as const, label: 'ارتفاع الخصر (Rise)', help: 'ارتفاع حزام الخصر', step: 0.5 },
        { key: 'thighCircumference' as const, label: 'محيط الفخذ (Thigh)', help: 'محيط أعلى الفخذ', step: 0.5 },
        { key: 'additionalEase' as const, label: 'سماحة الراحة (Ease cm)', help: 'سنتيمترات مضافة لحرية الحركة', step: 0.2 },
        { key: 'seamAllowanceDefault' as const, label: 'سماحة الخياطة (Seam Allowance)', help: 'عرض مسافة الخياطة الافتراضية', step: 0.1 }
      ]
    }
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 font-['Tajawal']"
      dir="rtl"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 backdrop-blur-md rounded-xl">
              <Sparkles className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-wide">
                لوحة إدخال القياسات وهندسة الباترون بالأرقام
              </h2>
              <p className="text-xs text-blue-100 opacity-90">
                16 حقلاً هندسياً مع تحديث فوري (Live Update ≤100ms) وتخصيص كامل للقواعد
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Live Update Toggle Indicator */}
            <button
              onClick={() => setLiveUpdate(!liveUpdate)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                liveUpdate
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                  : 'bg-white/10 text-white/60 border border-white/10'
              }`}
              title="تفعيل أو إيقاف التحديث اللحظي المباشر"
            >
              <span className={`w-2 h-2 rounded-full ${liveUpdate ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
              <span>تحديث مباشر</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-white/20 text-white transition-colors"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sub-Tabs Bar */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 px-4 py-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto text-xs font-bold">
          <button
            onClick={() => setActiveTab('measurements')}
            className={`px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all ${
              activeTab === 'measurements'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>القياسات الـ 16 الأساسية</span>
          </button>

          <button
            onClick={() => setActiveTab('points')}
            className={`px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all ${
              activeTab === 'points'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>جدول النقاط الإحداثية (Preview Points)</span>
          </button>

          <button
            onClick={() => setActiveTab('formulas')}
            className={`px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all ${
              activeTab === 'formulas'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>قواعد ومعادلات التفصيل (Drafting Rules)</span>
          </button>

          <button
            onClick={() => setActiveTab('presets')}
            className={`px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all ${
              activeTab === 'presets'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            <span>المقاسات الجاهزة والحفظ</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* TAB 1: 16 MEASUREMENTS */}
          {activeTab === 'measurements' && (
            <div className="space-y-6">
              {/* Quick Standard Size Selector */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-2xl border border-blue-200 dark:border-blue-900/50">
                <span className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                  <Ruler className="w-4 h-4" />
                  <span>تطبيق مقاس قياسي فوري:</span>
                </span>
                <div className="flex items-center gap-1.5">
                  {(['S', 'M', 'L', 'XL'] as const).map((sz) => (
                    <button
                      key={sz}
                      onClick={() => handleLoadStandardSize(sz)}
                      className="px-3 py-1 bg-white dark:bg-slate-800 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors shadow-sm"
                    >
                      مقاس {sz}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4 Measurement Groups */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {measurementGroups.map((grp, gIdx) => (
                  <div
                    key={gIdx}
                    className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 space-y-3"
                  >
                    <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 pb-2">
                      {grp.title}
                    </h3>
                    <div className="space-y-2.5">
                      {grp.fields.map((fld) => (
                        <div key={fld.key} className="space-y-1">
                          <div className="flex justify-between items-center text-xs">
                            <label className="font-bold text-slate-700 dark:text-slate-300">
                              {fld.label}
                            </label>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {unit === 'in' ? 'إنش' : 'سم'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleChange(fld.key, +(form[fld.key] - fld.step).toFixed(1))}
                              className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 font-bold flex items-center justify-center transition-colors"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              step={fld.step}
                              value={form[fld.key]}
                              onChange={(e) => handleChange(fld.key, parseFloat(e.target.value))}
                              className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-center font-mono font-bold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleChange(fld.key, +(form[fld.key] + fld.step).toFixed(1))}
                              className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 font-bold flex items-center justify-center transition-colors"
                            >
                              +
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">
                            {fld.help}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: PREVIEW REFERENCE POINTS */}
          {activeTab === 'points' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                    جدول النقاط الإحداثية المحسوبة هندسياً
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    جميع النقاط الأساسية (P0..P5) منسوبة إلى ورقة الرسم لإمكانية نسخها وتدقيقها
                  </p>
                </div>
                <button
                  onClick={() => {
                    const allTxt = referencePoints.map(p => `${p.nameAr}: X=${p.x} سم, Y=${p.y} سم (${p.descriptionAr})`).join('\n');
                    navigator.clipboard.writeText(allTxt);
                    setCopiedPointId('ALL');
                    setTimeout(() => setCopiedPointId(null), 1500);
                  }}
                  className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-900 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-blue-100 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedPointId === 'ALL' ? 'تم نسخ الجدول بالكامل!' : 'نسخ جميع الإحداثيات'}</span>
                </button>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-3">الرمز والنقطة</th>
                      <th className="p-3">القطعة</th>
                      <th className="p-3">الإحداثي X</th>
                      <th className="p-3">الإحداثي Y</th>
                      <th className="p-3 hidden sm:table-cell">الوصف والقاعدة</th>
                      <th className="p-3 text-center">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {referencePoints.map((pt) => (
                      <tr key={pt.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-3 font-bold text-slate-800 dark:text-slate-200">
                          <span className="font-mono text-blue-600 dark:text-blue-400 mr-1.5">{pt.id}</span>
                          <span>{pt.nameAr.split(':')[1] || pt.nameAr}</span>
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-400">
                          {pt.pieceNameAr}
                        </td>
                        <td className="p-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {pt.x} سم
                        </td>
                        <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {pt.y} سم
                        </td>
                        <td className="p-3 text-slate-500 dark:text-slate-400 hidden sm:table-cell text-[11px]">
                          {pt.descriptionAr}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleCopyPoint(pt)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white transition-colors"
                            title="نسخ إحداثي النقطة"
                          >
                            {copiedPointId === pt.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: DRAFTING RULES & FORMULAS */}
          {activeTab === 'formulas' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                    تخصيص قواعد ومعادلات التفصيل (Drafting Formulas)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    يمكنك تعديل النسب الهندسية لحساب حردة الرقبة، عمق الإبط، وميل الأكتاف
                  </p>
                </div>
                <button
                  onClick={() => setRules(DEFAULT_DRAFTING_RULES)}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>استعادة المعادلات الافتراضية</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block">
                    عرض حردة الرقبة (Neck Width):
                  </label>
                  <input
                    type="text"
                    value={rules.neckWidthFormula}
                    onChange={(e) => handleRuleChange('neckWidthFormula', e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono text-blue-600 dark:text-blue-400 font-bold"
                  />
                  <p className="text-[10px] text-slate-400">المتغيرات المتاحة: neckCirc, ease, shoulderLength</p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block">
                    عمق حردة الرقبة الأمامية (Front Neck Depth):
                  </label>
                  <input
                    type="text"
                    value={rules.frontNeckDepthFormula}
                    onChange={(e) => handleRuleChange('frontNeckDepthFormula', e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono text-blue-600 dark:text-blue-400 font-bold"
                  />
                  <p className="text-[10px] text-slate-400">الافتراضي: neckCirc / 10 + 2</p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block">
                    عمق حفرة الإبط (Armhole Depth):
                  </label>
                  <input
                    type="text"
                    value={rules.armholeDepthFormula}
                    onChange={(e) => handleRuleChange('armholeDepthFormula', e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono text-blue-600 dark:text-blue-400 font-bold"
                  />
                  <p className="text-[10px] text-slate-400">الافتراضي: armholeCirc * 0.45 + ease</p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block">
                    ميل نزول الكتف (Shoulder Drop):
                  </label>
                  <input
                    type="text"
                    value={rules.shoulderDropFormula}
                    onChange={(e) => handleRuleChange('shoulderDropFormula', e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono text-blue-600 dark:text-blue-400 font-bold"
                  />
                  <p className="text-[10px] text-slate-400">الافتراضي: shoulderLength * 0.1 + 2.8</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PRESETS & EXPORT */}
          {activeTab === 'presets' && (
            <div className="space-y-6">
              {/* Save New Preset */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <h3 className="text-xs font-black text-slate-800 dark:text-slate-200">
                  حفظ قياسات الزبون أو الموديل الحالي
                </h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="اسم الزبون أو الموديل (مثال: فستان سارة مقاس 38)"
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleSavePreset}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Save className="w-4 h-4" />
                    <span>حفظ في المتصفح</span>
                  </button>
                </div>
                {saveSuccess && (
                  <p className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تم حفظ القياسات بنجاح!</span>
                  </p>
                )}
              </div>

              {/* JSON Backup Export / Import */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={handleExportJson}
                  className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center justify-center gap-2 text-xs font-bold transition-colors"
                >
                  <Download className="w-4 h-4 text-blue-500" />
                  <span>تصدير ملف القياسات (JSON Export)</span>
                </button>

                <label className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center justify-center gap-2 text-xs font-bold cursor-pointer transition-colors">
                  <Upload className="w-4 h-4 text-emerald-500" />
                  <span>استيراد ملف قياسات (JSON Import)</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportJson}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Saved Presets List */}
              {Object.keys(savedPresets).length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-slate-700 dark:text-slate-300">
                    القياسات المحفوظة مسبقاً:
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Object.entries(savedPresets).map(([name, data]) => {
                      const presetData = data as PatternByNumbersInput;
                      return (
                        <div
                          key={name}
                          className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                        >
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {name}
                          </span>
                          <button
                            onClick={() => {
                              setForm(presetData);
                              onApply(presetData, rules);
                            }}
                            className="px-3 py-1 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-600 hover:text-white text-blue-600 dark:text-blue-300 rounded-lg text-xs font-bold transition-colors"
                          >
                            تطبيق
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-100 dark:bg-slate-800/90 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <button
            onClick={() => {
              setForm(DEFAULT_PATTERN_NUMBERS);
              setRules(DEFAULT_DRAFTING_RULES);
            }}
            className="px-3 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span>إعادة ضبط المصنع</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors"
            >
              إغلاق
            </button>
            <button
              onClick={() => {
                onApply(form, rules);
                onClose();
              }}
              className="px-6 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-black shadow-lg shadow-blue-500/25 transition-all active:scale-95 flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>توليد وتطبيق الباترون</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
