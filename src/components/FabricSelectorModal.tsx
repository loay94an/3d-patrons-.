import React, { useState } from 'react';
import { X, Sparkles, Check, Sliders, Layers, RefreshCw, Palette } from 'lucide-react';
import {
  FABRIC_PRESETS, FabricDefinition, FabricCategory, PatternPrintType,
  FabricCustomState
} from '../lib/fabric-engine';

interface FabricSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  fabricState: FabricCustomState;
  onUpdateFabric: (updates: Partial<FabricCustomState>) => void;
}

const COLOR_PALETTES = [
  { name: 'أزرق ملكي كلاسيكي', hex: '#1e3a8a' },
  { name: 'أزرق سماوي ناعم', hex: '#38bdf8' },
  { name: 'كحلي ليلي', hex: '#0f172a' },
  { name: 'تراكوتا ترابي', hex: '#c2410c' },
  { name: 'أحمر قرمزي نبيذي', hex: '#881337' },
  { name: 'وردي باودر دافئ', hex: '#fb7185' },
  { name: 'أخضر ميرمية وزيتوني', hex: '#15803d' },
  { name: 'زمردي غامق', hex: '#064e3b' },
  { name: 'أصفر خردلي راقي', hex: '#d97706' },
  { name: 'بيج كشمير طبيعي', hex: '#d6c7b2' },
  { name: 'أبيض عاجي نقي', hex: '#f8fafc' },
  { name: 'رمادي حجري دافئ', hex: '#64748b' },
  { name: 'أسود فحمي ملكي', hex: '#18181b' },
  { name: 'بنفسجي لافندر هادئ', hex: '#818cf8' },
  { name: 'بني شوكولاتة فاخر', hex: '#451a03' },
  { name: 'جينز أزرق مغسول', hex: '#2563eb' },
];

const PATTERN_OPTIONS: { id: PatternPrintType; nameAr: string }[] = [
  { id: 'solid', nameAr: 'سادة نقي (Solid)' },
  { id: 'pinstripe', nameAr: 'خطوط طولية رفيعة (Pinstripe)' },
  { id: 'breton', nameAr: 'خطوط بحرية كلاسيكية (Stripes)' },
  { id: 'plaid', nameAr: 'كاروهات إسكتلندي (Tartan Plaid)' },
  { id: 'polka', nameAr: 'منقط راقي (Polka Dots)' },
  { id: 'houndstooth', nameAr: 'نقشة سن الفيل (Houndstooth)' },
  { id: 'damask', nameAr: 'جاكار زخرفي (Damask Jacquard)' }
];

export function FabricSelectorModal({
  isOpen,
  onClose,
  fabricState,
  onUpdateFabric
}: FabricSelectorModalProps) {
  if (!isOpen) return null;

  const [selectedCategory, setSelectedCategory] = useState<FabricCategory | 'all'>('all');
  const [activeTab, setActiveTab] = useState<'fabrics' | 'color_pattern' | 'physics'>('fabrics');

  const filteredPresets = selectedCategory === 'all'
    ? FABRIC_PRESETS
    : FABRIC_PRESETS.filter(f => f.category === selectedCategory);

  const currentPreset = FABRIC_PRESETS.find(f => f.id === fabricState.presetId) || FABRIC_PRESETS[0];

  const handleSelectPreset = (preset: FabricDefinition) => {
    onUpdateFabric({
      presetId: preset.id,
      color: preset.defaultColor,
      roughness: preset.roughness,
      sheen: preset.sheen,
      opacity: preset.opacity,
      stiffness: preset.stiffness
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">مكتبة خامات وأقمشة الأزياء</h2>
              <p className="text-xs text-slate-400">تغيير فوري لنوع النسيج، الملمس، البريق والفيزياء في العرض ثلاثي الأبعاد</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-800/80 bg-slate-900/40">
          <button
            onClick={() => setActiveTab('fabrics')}
            className={`pb-3 px-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'fabrics'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            أنواع الأقمشة والخامات ({FABRIC_PRESETS.length})
          </button>
          <button
            onClick={() => setActiveTab('color_pattern')}
            className={`pb-3 px-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'color_pattern'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            الألوان والنقوش المطبوعة
          </button>
          <button
            onClick={() => setActiveTab('physics')}
            className={`pb-3 px-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'physics'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            خصائص النسيج والانسيابية
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'fabrics' && (
            <div className="space-y-4">
              {/* Category Pills */}
              <div className="flex flex-wrap items-center gap-1.5 pb-2">
                {[
                  { id: 'all', label: 'كافة الخامات' },
                  { id: 'everyday', label: 'أقمشة يومية' },
                  { id: 'luxury', label: 'أقمشة فاخرة وسهرة' },
                  { id: 'heavy', label: 'أقمشة ثقيلة ومعاطف' },
                  { id: 'light', label: 'أقمشة خفيفة وشفافة' },
                  { id: 'stretch', label: 'أقمشة مطاطة وتريكو' },
                ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                      selectedCategory === cat.id
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Fabric Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredPresets.map(preset => {
                  const isSelected = fabricState.presetId === preset.id;
                  return (
                    <div
                      key={preset.id}
                      onClick={() => handleSelectPreset(preset)}
                      className={`relative p-4 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/30'
                          : 'bg-slate-800/60 border-slate-700/70 hover:bg-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Swatch circle with simulated texture preview */}
                        <div
                          className="w-12 h-12 rounded-xl flex-shrink-0 shadow-inner border border-white/20 relative overflow-hidden"
                          style={{ backgroundColor: preset.defaultColor }}
                        >
                          {preset.weaveType === 'satin' && (
                            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-transparent" />
                          )}
                          {preset.transmission && preset.transmission > 0 && (
                            <div className="absolute inset-0 bg-white/20 backdrop-blur-[1px]" />
                          )}
                          {isSelected && (
                            <div className="absolute inset-0 bg-blue-600/60 flex items-center justify-center text-white">
                              <Check className="w-5 h-5 stroke-[3]" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold truncate">{preset.nameAr}</h3>
                            <span className="text-[10px] text-slate-400 font-mono">{preset.weightGsm} gsm</span>
                          </div>
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                            {preset.descriptionAr}
                          </p>

                          {/* Attribute Tags */}
                          <div className="flex items-center gap-1.5 mt-2.5">
                            <span className="px-2 py-0.5 rounded-md text-[10px] bg-slate-900/80 text-slate-300 border border-slate-700/50">
                              ثبات: {Math.round(preset.stiffness * 100)}%
                            </span>
                            <span className="px-2 py-0.5 rounded-md text-[10px] bg-slate-900/80 text-slate-300 border border-slate-700/50">
                              مطاطية: {preset.stretchPercent}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'color_pattern' && (
            <div className="space-y-6">
              {/* Color Presets */}
              <div>
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                  <Palette className="w-4 h-4 text-blue-400" />
                  <span>لوحة الألوان المتناسقة</span>
                </h3>

                <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
                  {COLOR_PALETTES.map(col => {
                    const isSelected = fabricState.color.toLowerCase() === col.hex.toLowerCase();
                    return (
                      <button
                        key={col.hex}
                        onClick={() => onUpdateFabric({ color: col.hex })}
                        className={`group relative flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all ${
                          isSelected ? 'bg-blue-950/60 border border-blue-500' : 'hover:bg-slate-800'
                        }`}
                        title={col.name}
                      >
                        <div
                          className="w-10 h-10 rounded-full border-2 border-white/20 shadow-md group-hover:scale-105 transition-transform flex items-center justify-center"
                          style={{ backgroundColor: col.hex }}
                        >
                          {isSelected && <Check className="w-5 h-5 text-white stroke-[3] drop-shadow" />}
                        </div>
                        <span className="text-[10px] text-slate-400 truncate max-w-full text-center">
                          {col.name}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Color Input */}
                <div className="flex items-center gap-3 mt-4 p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
                  <label className="text-xs font-medium text-slate-300">أو اختر لوناً مخصصاً:</label>
                  <input
                    type="color"
                    value={fabricState.color}
                    onChange={(e) => onUpdateFabric({ color: e.target.value })}
                    className="w-9 h-9 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <input
                    type="text"
                    value={fabricState.color}
                    onChange={(e) => onUpdateFabric({ color: e.target.value })}
                    className="px-3 py-1 text-xs rounded-lg bg-slate-900 border border-slate-700 text-white font-mono w-28 uppercase"
                  />
                </div>
              </div>

              {/* Pattern Prints */}
              <div>
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-400" />
                  <span>النقوش والزخارف المطبوعة على النسيج</span>
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {PATTERN_OPTIONS.map(pattern => {
                    const isSelected = fabricState.pattern === pattern.id;
                    return (
                      <button
                        key={pattern.id}
                        onClick={() => onUpdateFabric({ pattern: pattern.id })}
                        className={`p-3 rounded-xl border text-right transition-all ${
                          isSelected
                            ? 'bg-blue-950/50 border-blue-500 text-blue-300'
                            : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <div className="text-xs font-bold">{pattern.nameAr}</div>
                      </button>
                    );
                  })}
                </div>

                {/* Pattern Scale Slider */}
                {fabricState.pattern !== 'solid' && (
                  <div className="mt-4 p-4 bg-slate-800/60 rounded-xl border border-slate-700/60 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-300">حجم وتكرار النقشة (Scale):</span>
                      <span className="font-mono text-blue-400">{fabricState.patternScale}x</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      step="0.5"
                      value={fabricState.patternScale}
                      onChange={(e) => onUpdateFabric({ patternScale: parseFloat(e.target.value) })}
                      className="w-full accent-blue-500"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'physics' && (
            <div className="space-y-6">
              <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-700/60 flex items-center gap-3">
                <Sliders className="w-5 h-5 text-indigo-400" />
                <p className="text-xs text-slate-300 leading-relaxed">
                  تؤثر هذه المعايير مباشرة على طريقة انسدال القماش (Draping)، تموجات الثنيات، انعكاس الإضاءة والبريق في المحاكاة ثلاثية الأبعاد.
                </p>
              </div>

              {/* Sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Stiffness / Rigidity */}
                <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/60 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-200">صلابة وثبات القماش (Stiffness):</span>
                    <span className="font-mono text-blue-400">{Math.round(fabricState.stiffness * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={fabricState.stiffness}
                    onChange={(e) => onUpdateFabric({ stiffness: parseFloat(e.target.value) })}
                    className="w-full accent-blue-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>منسدل طري (حرير/شيفون)</span>
                    <span>قاسي ومتماسك (جينز/جلد)</span>
                  </div>
                </div>

                {/* Sheen / Lustre */}
                <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/60 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-200">اللمعان والبريق (Sheen):</span>
                    <span className="font-mono text-blue-400">{Math.round(fabricState.sheen * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.05"
                    value={fabricState.sheen}
                    onChange={(e) => onUpdateFabric({ sheen: parseFloat(e.target.value) })}
                    className="w-full accent-blue-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>مطفي غير لامع</span>
                    <span>ساتان / حرير عاكس</span>
                  </div>
                </div>

                {/* Roughness */}
                <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/60 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-200">خشونة سطح النسيج (Roughness):</span>
                    <span className="font-mono text-blue-400">{Math.round(fabricState.roughness * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={fabricState.roughness}
                    onChange={(e) => onUpdateFabric({ roughness: parseFloat(e.target.value) })}
                    className="w-full accent-blue-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>فائق النعومة والملاسة</span>
                    <span>خشن وبارز (كتان/تويد)</span>
                  </div>
                </div>

                {/* Opacity */}
                <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/60 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-200">شفافية القماش (Opacity):</span>
                    <span className="font-mono text-blue-400">{Math.round(fabricState.opacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.4"
                    max="1.0"
                    step="0.05"
                    value={fabricState.opacity}
                    onChange={(e) => onUpdateFabric({ opacity: parseFloat(e.target.value) })}
                    className="w-full accent-blue-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>شبه شفاف (شيفون)</span>
                    <span>معتم بالكامل</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-800 bg-slate-950/60">
          <div className="text-xs text-slate-400">
            الخامة الحالية: <span className="font-bold text-white">{currentPreset.nameAr}</span>
          </div>

          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold text-sm text-white shadow-lg transition-colors"
          >
            تطبيق القماش على الموديل
          </button>
        </div>
      </div>
    </div>
  );
}
