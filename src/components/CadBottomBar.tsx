import React from 'react';
import {
  MousePointer, PenTool, Wand2, Ruler, Sliders,
  RotateCcw, RotateCw, Sparkles, Magnet, Menu,
  Maximize2, Plus, Minus, Layers
} from 'lucide-react';
import { CadActiveTool } from './CadSidePanel';

interface CadBottomBarProps {
  activeTool: CadActiveTool;
  onSelectTool: (tool: CadActiveTool) => void;
  snapEnabled: boolean;
  onToggleSnap: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onOpenSidePanel: () => void;
  onOpenPatternByNumbers: () => void;
}

export function CadBottomBar({
  activeTool,
  onSelectTool,
  snapEnabled,
  onToggleSnap,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onOpenSidePanel,
  onOpenPatternByNumbers
}: CadBottomBarProps) {
  const primaryTools: { id: CadActiveTool; label: string; icon: React.ReactNode }[] = [
    { id: 'select_move', label: 'تحديد', icon: <MousePointer className="w-5 h-5" /> },
    { id: 'draw_line', label: 'خط', icon: <PenTool className="w-5 h-5" /> },
    { id: 'draw_quad', label: 'منحنى', icon: <Wand2 className="w-5 h-5" /> },
    { id: 'draw_bezier', label: 'بيزيه', icon: <Wand2 className="w-5 h-5 text-purple-400" /> },
    { id: 'measure_tool', label: 'قياس', icon: <Ruler className="w-5 h-5" /> },
    { id: 'seam_allowance', label: 'سماحة', icon: <Sliders className="w-5 h-5" /> }
  ];

  return (
    <div
      className="fixed bottom-3 left-1/2 -translate-x-1/2 z-30 max-w-4xl w-[96%] sm:w-auto bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-2xl p-1.5 flex items-center justify-between gap-1 text-white font-['Tajawal'] select-none transition-all"
      dir="rtl"
    >
      {/* Primary Tool Buttons */}
      <div className="flex items-center gap-1 overflow-x-auto py-0.5 px-1 scrollbar-none">
        {primaryTools.map(tool => {
          const isActive = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => onSelectTool(tool.id)}
              className={`min-h-[44px] min-w-[44px] px-3 rounded-xl flex flex-col sm:flex-row items-center justify-center gap-1 text-xs font-bold transition-all active:scale-95 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 ring-2 ring-blue-400/50'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
              title={tool.label}
              aria-label={tool.label}
            >
              {tool.icon}
              <span className="text-[10px] sm:text-xs tracking-tight">{tool.label}</span>
            </button>
          );
        })}
      </div>

      <div className="w-[1px] h-7 bg-slate-700 mx-0.5 shrink-0 hidden sm:block" />

      {/* Snap & History actions */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Smart Snap Toggle */}
        <button
          onClick={onToggleSnap}
          className={`min-h-[44px] min-w-[44px] px-2.5 rounded-xl flex items-center justify-center gap-1 text-xs font-bold transition-all ${
            snapEnabled
              ? 'bg-emerald-600/30 border border-emerald-500/50 text-emerald-300'
              : 'text-slate-400 hover:bg-slate-800'
          }`}
          title={snapEnabled ? 'الجذب الذكي مفعّل (Smart Snap ON)' : 'الجذب الذكي معطّل (Smart Snap OFF)'}
          aria-label="تبديل الجذب الذكي"
        >
          <Magnet className="w-4 h-4" />
          <span className="hidden md:inline text-[11px]">{snapEnabled ? 'Snap ON' : 'Snap'}</span>
        </button>

        {/* Undo / Redo */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title="تراجع (Undo)"
          aria-label="تراجع"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title="تقديم (Redo)"
          aria-label="تقديم"
        >
          <RotateCw className="w-4 h-4" />
        </button>
      </div>

      <div className="w-[1px] h-7 bg-slate-700 mx-0.5 shrink-0 hidden sm:block" />

      {/* Quick Pattern by Numbers & Menu Drawer buttons */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onOpenPatternByNumbers}
          className="min-h-[44px] px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
          title="فتح إدخال القياسات بالأرقام"
        >
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span className="hidden sm:inline">الأرقام</span>
        </button>

        <button
          onClick={onOpenSidePanel}
          className="min-h-[44px] min-w-[44px] p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl flex items-center justify-center transition-colors"
          title="فتح لوحة الأدوات الجانبية الشاملة"
          aria-label="القائمة الجانبية"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
