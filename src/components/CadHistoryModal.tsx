import React from 'react';
import { X, History, RotateCcw, RotateCw, CheckCircle2, Clock } from 'lucide-react';
import { CadPiece } from '../lib/pattern-cad-engine';

export interface HistoryEntry {
  id: string;
  timestamp: number;
  actionNameAr: string;
  pieces: CadPiece[];
}

interface CadHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  historyStack: HistoryEntry[];
  currentIndex: number;
  onJumpToStep: (index: number) => void;
  onUndo: () => void;
  onRedo: () => void;
}

export function CadHistoryModal({
  isOpen,
  onClose,
  historyStack,
  currentIndex,
  onJumpToStep,
  onUndo,
  onRedo
}: CadHistoryModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in font-['Tajawal']" dir="rtl">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold">سجل التعديلات والخطوات (History)</h3>
              <p className="text-[11px] text-slate-400">التراجع والتقديم والانتقال لأي خطوة سابقة</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Undo / Redo Quick Bar */}
        <div className="bg-slate-100 dark:bg-slate-800/80 p-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <button
            onClick={onUndo}
            disabled={currentIndex <= 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>تراجع (Undo)</span>
          </button>

          <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
            الخطوة {currentIndex + 1} من {historyStack.length}
          </span>

          <button
            onClick={onRedo}
            disabled={currentIndex >= historyStack.length - 1}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-all"
          >
            <span>تقديم (Redo)</span>
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* History Timeline List */}
        <div className="p-4 overflow-y-auto flex-1 divide-y divide-slate-100 dark:divide-slate-800">
          {historyStack.map((step, idx) => {
            const isCurrent = idx === currentIndex;
            const timeStr = new Date(step.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            return (
              <button
                key={step.id}
                onClick={() => onJumpToStep(idx)}
                className={`w-full text-right p-3 rounded-xl flex items-center justify-between transition-all my-1 ${
                  isCurrent
                    ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-500/40 text-blue-900 dark:text-blue-100 font-bold'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold ${
                    isCurrent ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                  }`}>
                    {idx + 1}
                  </div>
                  <div>
                    <span className="text-xs sm:text-sm block">{step.actionNameAr}</span>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {timeStr}
                    </span>
                  </div>
                </div>

                {isCurrent && (
                  <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="bg-slate-100 dark:bg-slate-800 p-3 border-t border-slate-200 dark:border-slate-700 text-center">
          <button
            onClick={onClose}
            className="w-full py-2 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
          >
            إغلاق اللوحة
          </button>
        </div>

      </div>
    </div>
  );
}
