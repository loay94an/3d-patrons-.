import React, { useState } from 'react';
import {
  ChevronDown, ChevronUp, ChevronRight, ChevronLeft,
  PenTool, MousePointer, Scissors, Copy, Wand2,
  Ruler, Sliders, Hash, Move, Sparkles,
  Layers, RotateCcw, RotateCw, History, FileSpreadsheet,
  HelpCircle, Eye, EyeOff, Check, Split
} from 'lucide-react';

export type CadActiveTool =
  | 'select_move'
  | 'draw_line'
  | 'draw_quad'
  | 'draw_bezier'
  | 'add_anchor'
  | 'remove_anchor'
  | 'split_trim'
  | 'mirror_dup'
  | 'smooth_simplify'
  | 'seam_allowance'
  | 'add_notch'
  | 'add_grainline'
  | 'measure_tool'
  | 'pan'
  | 'zoom_rotate';

interface CadSidePanelProps {
  isOpen: boolean;
  onToggle: () => void;
  activeTool: CadActiveTool;
  onSelectTool: (tool: CadActiveTool) => void;
  isAdvancedMode: boolean;
  onToggleAdvancedMode: () => void;
  seamAllowanceCm: number;
  onSeamAllowanceChange: (val: number) => void;
  onApplySeamAllowance: () => void;
  onOpenPatternByNumbers: () => void;
  onOpenHistory: () => void;
  onOpenTilePrint: () => void;
  onOpenTemplate: (templateId: string) => void;
}

export function CadSidePanel({
  isOpen,
  onToggle,
  activeTool,
  onSelectTool,
  isAdvancedMode,
  onToggleAdvancedMode,
  seamAllowanceCm,
  onSeamAllowanceChange,
  onApplySeamAllowance,
  onOpenPatternByNumbers,
  onOpenHistory,
  onOpenTilePrint,
  onOpenTemplate
}: CadSidePanelProps) {
  // Accordion open/close state
  const [openSections, setOpenSections] = useState({
    drawing: true,
    editing: true,
    measurement: true,
    control: true,
    patternByNumbers: true
  });

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toolDescriptions: Record<CadActiveTool, string> = {
    select_move: 'تحديد وتحريك النقاط أو المسارات باللمس أو السحب',
    draw_line: 'رسم خط مستقيم قياسي بين نقطتين',
    draw_quad: 'رسم منحنى قياسي بنقطة تحكم واحدة (QuadCurve)',
    draw_bezier: 'رسم منحنى احترافي بثلاث نقاط ومقابض توجيه (Bezier)',
    add_anchor: 'إضافة نقطة ارتكاز جديدة على أي مسار',
    remove_anchor: 'حذف نقطة من المسار وإعادة وصل الخط',
    split_trim: 'قص وتقسيم المسارات عند نقطة معينة',
    mirror_dup: 'عكس المسار بالمرآة أو مضاعفته',
    smooth_simplify: 'تنعيم المنحنيات وإلغاء التعرجات',
    seam_allowance: 'تحديد وتطبيق سماحات الخياطة حول القطعة',
    add_notch: 'إضافة علامة تطابق (Notch) على حواف القطعة',
    add_grainline: 'رسم سهم اتجاه النسيج الطولي',
    measure_tool: 'قياس المسافة الدقيقة بين أي نقطتين في إطار العمل',
    pan: 'تنقل وحرية سحب الكانفاس بدون التأثير على الباترون',
    zoom_rotate: 'تكبير وتدوير لوحة العمل'
  };

  return (
    <>
      {/* Drawer Toggle Tab for Mobile & Desktop */}
      <button
        onClick={onToggle}
        className={`fixed z-40 top-24 transition-all duration-300 flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-l-2xl shadow-xl border-l border-y border-white/20 font-bold text-xs active:scale-95 ${
          isOpen ? 'right-72 sm:right-80' : 'right-0'
        }`}
        title={isOpen ? 'إغلاق لوحة الأدوات' : 'فتح لوحة أدوات الرسم والتعديل'}
        aria-label="تبديل القائمة الجانبية"
      >
        {isOpen ? (
          <>
            <ChevronRight className="w-4 h-4" />
            <span className="hidden sm:inline">إخفاء</span>
          </>
        ) : (
          <>
            <ChevronLeft className="w-4 h-4" />
            <span>الأدوات</span>
          </>
        )}
      </button>

      {/* Side Panel Drawer */}
      <aside
        className={`fixed top-0 right-0 h-full w-72 sm:w-80 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-30 transition-transform duration-300 flex flex-col pt-16 font-['Tajawal'] select-none ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        dir="rtl"
      >
        {/* Panel Header */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div>
            <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>صندوق أدوات الباترون</span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">تحكم كامل برسم وتعديل المسارات</p>
          </div>

          {/* Mode Switcher */}
          <button
            onClick={onToggleAdvancedMode}
            className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all border ${
              isAdvancedMode
                ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600'
            }`}
            title="تبديل بين الوضع المبتدئ والمتقدم"
          >
            {isAdvancedMode ? 'متقدم Pro' : 'مبتدئ'}
          </button>
        </div>

        {/* Active Tool Banner */}
        <div className="bg-blue-50 dark:bg-blue-950/40 p-2.5 px-3 border-b border-blue-100 dark:border-blue-900/40 flex items-center gap-2 text-xs">
          <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="text-blue-900 dark:text-blue-200 font-medium line-clamp-1">
            {toolDescriptions[activeTool]}
          </span>
        </div>

        {/* Scrollable Tool Sections */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          
          {/* E. Pattern By Numbers (Highlighted at Top) */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl p-3 shadow-md">
            <div className="flex items-center justify-between mb-2">
              <span className="font-black text-xs flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>E. بناء الباترون بالأرقام</span>
              </span>
            </div>
            <p className="text-[11px] text-blue-100 mb-2 leading-relaxed">
              أدخل القياسات الـ 8 الأساسية لتوليد المسارات والنوتشات داخل الإطار آلياً.
            </p>
            <button
              onClick={onOpenPatternByNumbers}
              className="w-full py-2.5 bg-white hover:bg-blue-50 text-blue-700 font-black rounded-xl text-xs shadow transition-all active:scale-95 flex items-center justify-center gap-1.5 min-h-[44px]"
            >
              <Hash className="w-4 h-4" />
              <span>فتح نافذة PatternByNumbers</span>
            </button>
          </div>

          {/* A. Drawing Tools */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-800/30">
            <button
              onClick={() => toggleSection('drawing')}
              className="w-full p-3 flex items-center justify-between bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100"
            >
              <span className="flex items-center gap-2">
                <PenTool className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>A. أدوات الرسم (Drawing)</span>
              </span>
              {openSections.drawing ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {openSections.drawing && (
              <div className="p-2 grid grid-cols-2 gap-1.5">
                <ToolButton
                  active={activeTool === 'draw_line'}
                  onClick={() => onSelectTool('draw_line')}
                  label="خط مستقيم (Line)"
                  icon={<PenTool className="w-3.5 h-3.5" />}
                />
                <ToolButton
                  active={activeTool === 'draw_quad'}
                  onClick={() => onSelectTool('draw_quad')}
                  label="منحنى مقبض (Quad)"
                  icon={<Wand2 className="w-3.5 h-3.5" />}
                />
                <ToolButton
                  active={activeTool === 'draw_bezier'}
                  onClick={() => onSelectTool('draw_bezier')}
                  label="بيزيه (Bezier)"
                  icon={<Wand2 className="w-3.5 h-3.5" />}
                  advancedOnly
                  isAdvancedMode={isAdvancedMode}
                />
                <ToolButton
                  active={activeTool === 'add_anchor'}
                  onClick={() => onSelectTool('add_anchor')}
                  label="إضافة نقطة (Add)"
                  icon={<PenTool className="w-3.5 h-3.5" />}
                />
                <ToolButton
                  active={activeTool === 'remove_anchor'}
                  onClick={() => onSelectTool('remove_anchor')}
                  label="حذف نقطة (Remove)"
                  icon={<Scissors className="w-3.5 h-3.5" />}
                  advancedOnly
                  isAdvancedMode={isAdvancedMode}
                />
              </div>
            )}
          </div>

          {/* B. Editing Tools */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-800/30">
            <button
              onClick={() => toggleSection('editing')}
              className="w-full p-3 flex items-center justify-between bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100"
            >
              <span className="flex items-center gap-2">
                <MousePointer className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>B. أدوات التعديل (Editing)</span>
              </span>
              {openSections.editing ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {openSections.editing && (
              <div className="p-2 grid grid-cols-2 gap-1.5">
                <ToolButton
                  active={activeTool === 'select_move'}
                  onClick={() => onSelectTool('select_move')}
                  label="تحديد/تحريك (Move)"
                  icon={<MousePointer className="w-3.5 h-3.5" />}
                />
                <ToolButton
                  active={activeTool === 'split_trim'}
                  onClick={() => onSelectTool('split_trim')}
                  label="قص/تقسيم (Split)"
                  icon={<Split className="w-3.5 h-3.5" />}
                />
                <ToolButton
                  active={activeTool === 'mirror_dup'}
                  onClick={() => onSelectTool('mirror_dup')}
                  label="مرآة/نسخ (Mirror)"
                  icon={<Copy className="w-3.5 h-3.5" />}
                  advancedOnly
                  isAdvancedMode={isAdvancedMode}
                />
                <ToolButton
                  active={activeTool === 'smooth_simplify'}
                  onClick={() => onSelectTool('smooth_simplify')}
                  label="تنعيم (Smooth)"
                  icon={<Wand2 className="w-3.5 h-3.5" />}
                  advancedOnly
                  isAdvancedMode={isAdvancedMode}
                />
              </div>
            )}
          </div>

          {/* C. Measurements & Markers */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-800/30">
            <button
              onClick={() => toggleSection('measurement')}
              className="w-full p-3 flex items-center justify-between bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100"
            >
              <span className="flex items-center gap-2">
                <Ruler className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>C. القياسات والطباعات</span>
              </span>
              {openSections.measurement ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {openSections.measurement && (
              <div className="p-3 space-y-3 text-xs">
                {/* Seam Allowance Slider */}
                <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-slate-700 dark:text-slate-300">سماحة الخياطة (Seam):</span>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{seamAllowanceCm} سم</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="4"
                    step="0.5"
                    value={seamAllowanceCm}
                    onChange={(e) => onSeamAllowanceChange(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg accent-blue-600 mb-2"
                  />
                  <button
                    onClick={onApplySeamAllowance}
                    className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-[11px] transition-all active:scale-95"
                  >
                    تطبيق السماحة (Apply)
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <ToolButton
                    active={activeTool === 'add_notch'}
                    onClick={() => onSelectTool('add_notch')}
                    label="علامة نوتش (Notch)"
                    icon={<Scissors className="w-3.5 h-3.5" />}
                  />
                  <ToolButton
                    active={activeTool === 'add_grainline'}
                    onClick={() => onSelectTool('add_grainline')}
                    label="اتجاه النسيج"
                    icon={<Move className="w-3.5 h-3.5" />}
                  />
                  <ToolButton
                    active={activeTool === 'measure_tool'}
                    onClick={() => onSelectTool('measure_tool')}
                    label="أداة القياس (Measure)"
                    icon={<Ruler className="w-3.5 h-3.5" />}
                  />
                  <ToolButton
                    active={activeTool === 'seam_allowance'}
                    onClick={() => onSelectTool('seam_allowance')}
                    label="تعديل الحواف"
                    icon={<Sliders className="w-3.5 h-3.5" />}
                  />
                </div>
              </div>
            )}
          </div>

          {/* D. Display & Control */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-800/30">
            <button
              onClick={() => toggleSection('control')}
              className="w-full p-3 flex items-center justify-between bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100"
            >
              <span className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>D. أدوات العرض والتحكم</span>
              </span>
              {openSections.control ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {openSections.control && (
              <div className="p-3 space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-1.5">
                  <ToolButton
                    active={activeTool === 'pan'}
                    onClick={() => onSelectTool('pan')}
                    label="تنقل (Pan)"
                    icon={<Move className="w-3.5 h-3.5" />}
                  />
                  <button
                    onClick={onOpenHistory}
                    className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:border-blue-500 flex items-center justify-center gap-1.5 font-bold transition-all min-h-[44px]"
                  >
                    <History className="w-3.5 h-3.5 text-blue-500" />
                    <span>سجل التعديلات</span>
                  </button>
                </div>

                {/* Templates Menu */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1.5">مكتبة القوالب الجاهزة:</span>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { id: 'bodice', label: 'بلوزة' },
                      { id: 'dress', label: 'فستان' },
                      { id: 'pants', label: 'بنطلون' },
                      { id: 'sleeve', label: 'كم' },
                      { id: 'skirt', label: 'تنورة' },
                      { id: 'shirt', label: 'قميص' }
                    ].map(tpl => (
                      <button
                        key={tpl.id}
                        onClick={() => onOpenTemplate(tpl.id)}
                        className="p-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-blue-600 hover:text-white rounded-lg text-slate-800 dark:text-slate-200 text-center font-bold text-[11px] transition-colors"
                      >
                        {tpl.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tile Print Trigger */}
                <button
                  onClick={onOpenTilePrint}
                  className="w-full mt-2 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>طباعة مجزأة (Tile Print A4)</span>
                </button>
              </div>
            )}
          </div>

        </div>
      </aside>
    </>
  );
}

function ToolButton({
  active,
  onClick,
  label,
  icon,
  advancedOnly,
  isAdvancedMode
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
  advancedOnly?: boolean;
  isAdvancedMode?: boolean;
}) {
  if (advancedOnly && !isAdvancedMode) return null;

  return (
    <button
      onClick={onClick}
      className={`p-2.5 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-bold transition-all min-h-[44px] ${
        active
          ? 'bg-blue-600 border-blue-600 text-white shadow-md'
          : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-400'
      }`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}
