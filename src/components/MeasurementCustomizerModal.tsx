import React, { useState } from 'react';
import { X, Sliders, RotateCcw, User, Check, Info, Sparkles, Ruler } from 'lucide-react';
import { AppState, Gender, getBaseMeasurements, getSizeList } from '../lib/pattern-logic';
import { womenSizes, menSizes, kidsSizes } from '../lib/measurements';

interface MeasurementCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: AppState;
  onUpdateState: (updates: Partial<AppState>) => void;
}

interface MeasurementField {
  key: string;
  labelAr: string;
  hintAr: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}

export function MeasurementCustomizerModal({
  isOpen,
  onClose,
  state,
  onUpdateState
}: MeasurementCustomizerModalProps) {
  if (!isOpen) return null;

  const isWomen = state.gender === 'women';
  const isMen = state.gender === 'men';
  const isKids = state.gender === 'kids' || state.gender === 'infant';

  const currentStandardMeas = getBaseMeasurements(state.gender, state.size);
  const currentMeas = {
    ...currentStandardMeas,
    ...state.customMeasurements
  };

  const fields: MeasurementField[] = [
    {
      key: isWomen ? 'bust' : 'chest',
      labelAr: isWomen ? 'محيط الصدر (Bust)' : 'محيط الصدر (Chest)',
      hintAr: 'يقاس أفقياً حول أوسع وأبرز نقطة في الصدر مع ارتداء الملابس الداخلية المناسبة.',
      min: isKids ? 40 : 70,
      max: isKids ? 95 : 150,
      step: 0.5,
      unit: state.unit
    },
    {
      key: 'waist',
      labelAr: 'محيط الخصر (Waist)',
      hintAr: 'يقاس حول أضيق منطقة في الجذع الطبيعي (فوق السرة بقليل).',
      min: isKids ? 38 : 55,
      max: isKids ? 85 : 140,
      step: 0.5,
      unit: state.unit
    },
    {
      key: 'hip',
      labelAr: 'محيط الورك / الأرداف (Hips)',
      hintAr: 'يقاس أفقياً حول أبرز نقطة في الأرداف والوركين مع ضم القدمين.',
      min: isKids ? 42 : 75,
      max: isKids ? 100 : 160,
      step: 0.5,
      unit: state.unit
    },
    {
      key: 'backLength',
      labelAr: 'طول الظهر (Back Length)',
      hintAr: 'من الفقرة البارزة أسفل العنق (الفقرة السابعة) رأسياً حتى خط الخصر.',
      min: isKids ? 15 : 32,
      max: isKids ? 45 : 55,
      step: 0.5,
      unit: state.unit
    },
    {
      key: 'backWidth',
      labelAr: 'عرض الظهر (Back Width)',
      hintAr: 'يقاس أفقياً عبر الظهر بين نقطتي اتصال الذراع بالجذع تحت الإبطين.',
      min: isKids ? 16 : 28,
      max: isKids ? 38 : 56,
      step: 0.5,
      unit: state.unit
    },
    {
      key: 'shoulder',
      labelAr: 'طول الكتف (Shoulder Length)',
      hintAr: 'من قاعدة الرقبة الجانبية حتى عظمة طرف الكتف.',
      min: isKids ? 5 : 8,
      max: isKids ? 13 : 22,
      step: 0.5,
      unit: state.unit
    },
    {
      key: 'sleeveLength',
      labelAr: 'طول الكم (Sleeve Length)',
      hintAr: 'من عظمة طرف الكتف مروراً بالمرفق المنحني قليلاً حتى عظمة الرسغ.',
      min: isKids ? 18 : 45,
      max: isKids ? 60 : 75,
      step: 0.5,
      unit: state.unit
    },
    {
      key: 'armholeCirc',
      labelAr: 'محيط حردة الإبط (Armhole)',
      hintAr: 'دوران شريط القياس حول الإبط والكتف بوضعية مريحة.',
      min: isKids ? 20 : 36,
      max: isKids ? 50 : 70,
      step: 0.5,
      unit: state.unit
    },
    {
      key: 'neckCirc',
      labelAr: 'محيط الرقبة (Neck Circumference)',
      hintAr: 'حول قاعدة الرقبة عند عظمة الترقوة.',
      min: isKids ? 20 : 30,
      max: isKids ? 38 : 52,
      step: 0.5,
      unit: state.unit
    },
    {
      key: 'skirtLength',
      labelAr: 'طول الزي / التنورة (Garment Length)',
      hintAr: 'من خط الخصر رأسياً حتى الطول النهائي المطلوب للتصميم.',
      min: isKids ? 15 : 40,
      max: isKids ? 70 : 120,
      step: 1.0,
      unit: state.unit
    }
  ];

  const handleGenderChange = (newGender: Gender) => {
    const list = getSizeList(newGender);
    onUpdateState({
      gender: newGender,
      size: list[0],
      customMeasurements: {}
    });
  };

  const handleSizeChange = (newSize: any) => {
    onUpdateState({
      size: newSize,
      customMeasurements: {}
    });
  };

  const handleCustomFieldChange = (key: string, value: number) => {
    onUpdateState({
      useCustomMode: true,
      customMeasurements: {
        ...state.customMeasurements,
        [key]: value
      }
    });
  };

  const handleResetToStandard = () => {
    onUpdateState({
      useCustomMode: false,
      customMeasurements: {}
    });
  };

  const sizeList = getSizeList(state.gender);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-500 text-white shadow-lg">
              <Ruler className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">تخصيص القياسات والأنماط الجسمانية</h2>
              <p className="text-xs text-slate-400">تحديث أبعاد الباترون ثنائي الأبعاد ومورفولوجيا المانيكان ثلاثي الأبعاد فورياً</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Gender Archetype Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2.5">
              1. الفئة والنمط الجسماني الأساسي:
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'women', label: 'عارضة نسائية (Women)', desc: 'قوام أنثوي بتجسيم الصدر والخصر والورك' },
                { id: 'men', label: 'عارض رجالي (Men)', desc: 'قوام رجالي بأكتاف عريضة وخصر مستقيم' },
                { id: 'kids', label: 'أطفال ورضع (Children)', desc: 'نسب طفولية قياسية من عمر شهر حتى 14 سنة' },
              ].map(item => {
                const isSelected = state.gender === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleGenderChange(item.id as Gender)}
                    className={`p-3.5 rounded-xl border text-right transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-indigo-950/60 border-indigo-500 ring-2 ring-indigo-500/30 text-white'
                        : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="font-bold text-sm mb-1">{item.label}</div>
                    <div className="text-[11px] text-slate-400 leading-relaxed">{item.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Standard Size Selector */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-xs font-bold text-slate-300">
                2. المقاس القياسي الجاهز:
              </label>
              <span className="text-[11px] text-indigo-400 font-medium">
                المقاس المختار: {state.size}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {sizeList.map(s => {
                const isSelected = String(state.size) === String(s);
                return (
                  <button
                    key={String(s)}
                    onClick={() => handleSizeChange(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-slate-700/60'
                    }`}
                  >
                    {isKids ? `${s}` : `EU ${s}`}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-px bg-slate-800" />

          {/* Custom Made-to-Measure Sliders */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-400" />
                  <span>3. تخصيص القياسات الفردية الدقيقة (Made-to-Measure)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  حرك المؤشرات لتعديل أي قياس خاص، وسيتغير شكل الباترون والمجسم ثلاثي الأبعاد في الحال.
                </p>
              </div>

              {state.useCustomMode && (
                <button
                  onClick={handleResetToStandard}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs text-amber-400 hover:text-amber-300 bg-amber-950/40 border border-amber-800/50 rounded-lg transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>استعادة المقاس القياسي</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {fields.map(field => {
                const rawVal = currentMeas[field.key] ?? field.min;
                const displayVal = state.unit === 'in' ? rawVal / 2.54 : rawVal;

                return (
                  <div
                    key={field.key}
                    className="p-3.5 bg-slate-800/50 rounded-xl border border-slate-700/60 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200">{field.labelAr}</span>
                      <div className="flex items-center gap-1 bg-slate-900/80 px-2 py-0.5 rounded-md border border-slate-700 font-mono text-xs text-indigo-300">
                        <span>{displayVal.toFixed(1)}</span>
                        <span className="text-[10px] text-slate-400">{state.unit === 'in' ? 'إنش' : 'سم'}</span>
                      </div>
                    </div>

                    <input
                      type="range"
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      value={rawVal}
                      onChange={(e) => handleCustomFieldChange(field.key, parseFloat(e.target.value))}
                      className="w-full accent-indigo-500 cursor-pointer"
                    />

                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      {field.hintAr}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-800 bg-slate-950/60">
          <div className="text-xs text-slate-400">
            {state.useCustomMode ? (
              <span className="text-indigo-400 font-semibold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                <span>تم تطبيق قياسات مخصصة بنجاح</span>
              </span>
            ) : (
              <span>يتم استخدام جدول المقاسات القياسي</span>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-sm text-white shadow-lg transition-colors"
          >
            تطبيق وإغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
