import React, { useState } from 'react';
import {
  Sliders, Lock, Unlock, ArrowRight, RotateCw,
  Compass, Scissors, Layers, Check, Copy, Wand2,
  Minimize2, Maximize2, X, Move, Split
} from 'lucide-react';
import { CadActiveTool } from './CadSidePanel';
import { CadSegment, CadPiece } from '../lib/pattern-cad-engine';

interface CadFloatingPropertiesProps {
  activeTool: CadActiveTool;
  selectedSegment: CadSegment | null;
  selectedPiece: CadPiece | null;
  onUpdateSegmentLength: (segId: string, newLengthCm: number) => void;
  onUpdateEdgeSeam: (edgeType: string, allowanceCm: number) => void;
  axisLock: 'none' | 'x' | 'y';
  onToggleAxisLock: (lock: 'none' | 'x' | 'y') => void;
  curvatureStrength: number;
  onCurvatureStrengthChange: (val: number) => void;
  mirrorSynced: boolean;
  onToggleMirrorSync: () => void;
  unit: 'cm' | 'in';
}

export function CadFloatingProperties({
  activeTool,
  selectedSegment,
  selectedPiece,
  onUpdateSegmentLength,
  onUpdateEdgeSeam,
  axisLock,
  onToggleAxisLock,
  curvatureStrength,
  onCurvatureStrengthChange,
  mirrorSynced,
  onToggleMirrorSync,
  unit
}: CadFloatingPropertiesProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [editLengthVal, setEditLengthVal] = useState<number | ''>('');

  const unitLabel = unit === 'in' ? 'إنش' : 'سم';

  return (
    <div
      className={`fixed top-20 left-4 z-20 w-72 sm:w-80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl transition-all font-['Tajawal'] select-none overflow-hidden ${
        isMinimized ? 'h-12' : 'max-h-[85vh]'
      }`}
      dir="rtl"
    >
      {/* Header */}
      <div className="bg-slate-100 dark:bg-slate-800/90 px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="text-xs font-black text-slate-800 dark:text-slate-100">
            لوحة الخصائص السريعة
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:text-slate-400 transition-colors"
            title={isMinimized ? 'توسيع' : 'تصغير'}
          >
            {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Body Content */}
      {!isMinimized && (
        <div className="p-3.5 space-y-3 text-xs overflow-y-auto max-h-[70vh]">
          
          {/* 1. Selected Segment Inspector if any */}
          {selectedSegment ? (
            <div className="bg-blue-50 dark:bg-blue-950/40 p-3 rounded-2xl border border-blue-200 dark:border-blue-900/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-900 dark:text-blue-200">
                  {selectedSegment.label || 'المسار المحدد'}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-200 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-mono font-bold">
                  {selectedSegment.type}
                </span>
              </div>

              {/* Direct Numeric Length Input Override */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  تعديل الطول بدقة ({unitLabel}):
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="0.1"
                    placeholder={`${selectedSegment.lengthCm}`}
                    value={editLengthVal}
                    onChange={(e) => setEditLengthVal(parseFloat(e.target.value) || '')}
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-2.5 py-1.5 font-mono font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => {
                      if (typeof editLengthVal === 'number' && editLengthVal > 0) {
                        onUpdateSegmentLength(selectedSegment.id, editLengthVal);
                        setEditLengthVal('');
                      }
                    }}
                    disabled={typeof editLengthVal !== 'number' || editLengthVal <= 0}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl font-bold transition-all"
                  >
                    تطبيق
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/30 p-2.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
              المس أي خط أو نقطة في الرسم لمعاينة وتعديل أبعادها المباشرة
            </div>
          )}

          {/* 2. Tool Specific Controls */}
          {/* Curve Tension Slider */}
          {(activeTool === 'draw_quad' || activeTool === 'draw_bezier' || activeTool === 'smooth_simplify') && (
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Wand2 className="w-3.5 h-3.5 text-purple-500" />
                  <span>قوة الانحناء (Curvature Tension):</span>
                </span>
                <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                  {Math.round(curvatureStrength * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={curvatureStrength}
                onChange={(e) => onCurvatureStrengthChange(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg accent-purple-600"
              />
            </div>
          )}

          {/* Axis Lock */}
          {(activeTool === 'select_move' || activeTool === 'draw_line') && (
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-1.5">
              <span className="font-bold text-slate-700 dark:text-slate-300 block">
                قفل المحاذاة والمحاور (Axis Lock):
              </span>
              <div className="grid grid-cols-3 gap-1">
                <button
                  onClick={() => onToggleAxisLock('none')}
                  className={`py-1.5 rounded-xl font-bold text-center transition-all ${
                    axisLock === 'none'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  حر (Free)
                </button>
                <button
                  onClick={() => onToggleAxisLock('x')}
                  className={`py-1.5 rounded-xl font-bold text-center transition-all ${
                    axisLock === 'x'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  أفقي (X)
                </button>
                <button
                  onClick={() => onToggleAxisLock('y')}
                  className={`py-1.5 rounded-xl font-bold text-center transition-all ${
                    axisLock === 'y'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  عمودي (Y)
                </button>
              </div>
            </div>
          )}

          {/* Smart Edge Seam Allowances */}
          {activeTool === 'seam_allowance' && (
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-2">
              <span className="font-bold text-slate-700 dark:text-slate-300 block">
                السماحات الذكية حسب نوع الحافة:
              </span>
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                <button
                  onClick={() => onUpdateEdgeSeam('neckline', 1.0)}
                  className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-400 text-right"
                >
                  <span className="font-bold block">حردة الرقبة:</span>
                  <span className="text-blue-600 dark:text-blue-400 font-mono">1.0 سم</span>
                </button>
                <button
                  onClick={() => onUpdateEdgeSeam('armhole', 1.0)}
                  className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-400 text-right"
                >
                  <span className="font-bold block">حردة الإبط:</span>
                  <span className="text-blue-600 dark:text-blue-400 font-mono">1.0 سم</span>
                </button>
                <button
                  onClick={() => onUpdateEdgeSeam('side', 1.5)}
                  className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-400 text-right"
                >
                  <span className="font-bold block">خط الجنب:</span>
                  <span className="text-blue-600 dark:text-blue-400 font-mono">1.5 سم</span>
                </button>
                <button
                  onClick={() => onUpdateEdgeSeam('hem', 3.0)}
                  className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-400 text-right"
                >
                  <span className="font-bold block">ثنية الذيل (Hem):</span>
                  <span className="text-blue-600 dark:text-blue-400 font-mono">3.0 سم</span>
                </button>
              </div>
            </div>
          )}

          {/* Mirror Sync Option */}
          {activeTool === 'mirror_dup' && (
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-2">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  تزامن المرآة التلقائي (Auto-Sync)
                </span>
                <input
                  type="checkbox"
                  checked={mirrorSynced}
                  onChange={onToggleMirrorSync}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
              </label>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                عند التفعيل، أي تعديل على النصف الأيمن ينعكس تلقائياً على النصف الأيسر المتطابق.
              </p>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
