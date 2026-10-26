import React, { useState, useRef } from 'react';
import { X, Printer, Grid, Layers, Download, Check, HelpCircle, FileDown } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { CadPiece, WorkFrameConfig } from '../lib/pattern-cad-engine';

interface TilePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  pieces: CadPiece[];
  workFrame: WorkFrameConfig;
  svgRef: React.RefObject<SVGSVGElement | null>;
}

export function TilePrintModal({
  isOpen,
  onClose,
  pieces,
  workFrame,
  svgRef
}: TilePrintModalProps) {
  const [pageSize, setPageSize] = useState<'A4' | 'Letter'>('A4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [overlapMarginMm, setOverlapMarginMm] = useState(10); // 10mm overlap for gluing
  const [showAssemblyGrid, setShowAssemblyGrid] = useState(true);
  const [showTestSquare, setShowTestSquare] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  // Page Dimensions in cm
  const pageDim = pageSize === 'A4'
    ? (orientation === 'portrait' ? { w: 21.0, h: 29.7 } : { w: 29.7, h: 21.0 })
    : (orientation === 'portrait' ? { w: 21.59, h: 27.94 } : { w: 27.94, h: 21.59 });

  const effectivePageW = pageDim.w - (overlapMarginMm / 10);
  const effectivePageH = pageDim.h - (overlapMarginMm / 10);

  const cols = Math.max(1, Math.ceil(workFrame.widthCm / effectivePageW));
  const rows = Math.max(1, Math.ceil(workFrame.heightCm / effectivePageH));
  const totalPages = cols * rows;

  const handlePrintTiles = () => {
    window.print();
  };

  const handleExportTilePdf = async () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF({
        orientation: orientation,
        unit: 'mm',
        format: pageSize.toLowerCase() as any
      });

      // Simple multi-page tile generation
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const pageIndex = r * cols + c + 1;
          if (pageIndex > 1) {
            doc.addPage(pageSize.toLowerCase(), orientation);
          }

          const pageWMm = pageDim.w * 10;
          const pageHMm = pageDim.h * 10;

          // Border & Cut lines
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.3);
          doc.rect(5, 5, pageWMm - 10, pageHMm - 10);

          // Header
          doc.setFontSize(10);
          doc.setTextColor(50, 50, 50);
          doc.text(`الصفحة ${pageIndex} من ${totalPages} [صف ${r + 1}, عمود ${c + 1}] - باترون موكاي`, 10, 10);

          // 5x5 cm Test Calibration Square on page 1
          if (pageIndex === 1 && showTestSquare) {
            doc.setDrawColor(30, 30, 30);
            doc.setLineWidth(0.5);
            doc.rect(15, 20, 50, 50);
            doc.setFontSize(8);
            doc.text("مربع اختبار المقياس", 25, 42);
            doc.text("5cm x 5cm (100% Scale)", 20, 50);
          }

          // Registration Crosshairs at corners
          const drawCross = (cx: number, cy: number) => {
            doc.setDrawColor(220, 38, 38);
            doc.setLineWidth(0.2);
            doc.line(cx - 3, cy, cx + 3, cy);
            doc.line(cx, cy - 3, cx, cy + 3);
          };

          drawCross(10, 10);
          drawCross(pageWMm - 10, 10);
          drawCross(10, pageHMm - 10);
          drawCross(pageWMm - 10, pageHMm - 10);
        }
      }

      doc.save(`pattern-tiles-${pageSize}-${totalPages}pages.pdf`);
    } catch (e) {
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in font-['Tajawal']" dir="rtl">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center">
              <Printer className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-wide">طباعة الباترون المجزأ على صفحات (Tile Print)</h3>
              <p className="text-xs text-emerald-100">تقسيم مساحة العمل إلى صفحات A4 أو Letter للتجميع والقص اليدوي</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/20 active:scale-95 transition-colors text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          
          {/* Settings Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
            {/* Page Size */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">حجم الورق</label>
              <div className="flex bg-slate-200 dark:bg-slate-700 p-1 rounded-xl">
                <button
                  onClick={() => setPageSize('A4')}
                  className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all ${pageSize === 'A4' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-300'}`}
                >
                  A4 (21×29.7 سم)
                </button>
                <button
                  onClick={() => setPageSize('Letter')}
                  className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all ${pageSize === 'Letter' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-300'}`}
                >
                  Letter (أمريكي)
                </button>
              </div>
            </div>

            {/* Orientation */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">اتجاه الورقة</label>
              <div className="flex bg-slate-200 dark:bg-slate-700 p-1 rounded-xl">
                <button
                  onClick={() => setOrientation('portrait')}
                  className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all ${orientation === 'portrait' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-300'}`}
                >
                  طولي (Portrait)
                </button>
                <button
                  onClick={() => setOrientation('landscape')}
                  className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all ${orientation === 'landscape' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-300'}`}
                >
                  عرضي (Landscape)
                </button>
              </div>
            </div>

            {/* Overlap Margin */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                هامش التداخل للصق: {overlapMarginMm} مم
              </label>
              <input
                type="range"
                min="5"
                max="25"
                step="5"
                value={overlapMarginMm}
                onChange={(e) => setOverlapMarginMm(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-300 dark:bg-slate-600 rounded-lg accent-emerald-600"
              />
            </div>
          </div>

          {/* Assembly Map Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Grid className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>مخطط تجميع الصفحات: {cols} أعمدة × {rows} صفوف ({totalPages} صفحة إجمالاً)</span>
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                إطار العمل: {workFrame.widthCm} × {workFrame.heightCm} سم
              </span>
            </div>

            <div className="bg-slate-100 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto flex justify-center">
              <div 
                className="grid gap-1.5 p-2 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 shadow-inner"
                style={{
                  gridTemplateColumns: `repeat(${cols}, minmax(40px, 60px))`,
                  gridTemplateRows: `repeat(${rows}, minmax(50px, 75px))`
                }}
              >
                {Array.from({ length: totalPages }).map((_, idx) => {
                  const r = Math.floor(idx / cols) + 1;
                  const c = (idx % cols) + 1;
                  return (
                    <div
                      key={idx}
                      className="border border-emerald-400/40 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-lg flex flex-col items-center justify-center text-[10px] font-mono text-emerald-700 dark:text-emerald-400 relative group hover:border-emerald-500 transition-all p-1"
                    >
                      <span className="font-bold text-xs">{idx + 1}</span>
                      <span className="text-[9px] text-slate-400">R{r}C{c}</span>
                      {idx === 0 && showTestSquare && (
                        <div className="absolute top-1 left-1 w-2.5 h-2.5 border border-red-500 bg-red-500/20 rounded-xs" title="مربع الاختبار 5×5 سم"></div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Options Toggles */}
          <div className="flex flex-wrap gap-4 text-xs font-bold text-slate-700 dark:text-slate-300">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showTestSquare}
                onChange={(e) => setShowTestSquare(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span>إدراج مربع اختبار القياس 5×5 سم (Scale Test Box)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showAssemblyGrid}
                onChange={(e) => setShowAssemblyGrid(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span>طباعة علامات المحاذاة والترقيم عند الزوايا</span>
            </label>
          </div>

        </div>

        {/* Footer */}
        <div className="bg-slate-100 dark:bg-slate-800 p-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs sm:text-sm"
          >
            إغلاق
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintTiles}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white font-bold rounded-xl text-xs sm:text-sm transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة مباشرة</span>
            </button>

            <button
              onClick={handleExportTilePdf}
              disabled={isExporting}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black rounded-xl text-xs sm:text-sm shadow-lg shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-50"
            >
              <FileDown className="w-4 h-4" />
              <span>{isExporting ? 'جاري التوليد...' : `تحميل PDF مجزأ (${totalPages} صفحة)`}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
