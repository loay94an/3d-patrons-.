import React, { useState, useRef } from 'react';
import { X, Printer, Grid, Layers, Download, Check, HelpCircle, FileDown } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { CadPiece, WorkFrameConfig } from '../lib/pattern-cad-engine';
import { getCadPieceContourPoints } from '../lib/tile-print-geometry';

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

  // Reserve a 10 mm border, a 60 mm header/calibration band, and the selected overlap.
  const pageMarginCm = 1;
  const headerBandCm = 6;
  const overlapCm = overlapMarginMm / 10;
  const effectivePageW = pageDim.w - pageMarginCm * 2 - overlapCm;
  const effectivePageH = pageDim.h - headerBandCm - pageMarginCm - overlapCm;
  const validContours = pieces.map(piece => ({ piece, points: getCadPieceContourPoints(piece) }))
    .filter((item): item is { piece: CadPiece; points: { x: number; y: number }[] } => Boolean(item.points));
  const allPoints = validContours.flatMap(item => item.points);
  const minX = allPoints.length ? Math.min(...allPoints.map(point => point.x)) : 0;
  const minY = allPoints.length ? Math.min(...allPoints.map(point => point.y)) : 0;
  const maxX = allPoints.length ? Math.max(...allPoints.map(point => point.x)) : workFrame.widthCm;
  const maxY = allPoints.length ? Math.max(...allPoints.map(point => point.y)) : workFrame.heightCm;
  const patternWidthCm = Math.max(0, maxX - minX);
  const patternHeightCm = Math.max(0, maxY - minY);
  const cols = Math.max(1, Math.ceil(patternWidthCm / effectivePageW));
  const rows = Math.max(1, Math.ceil(patternHeightCm / effectivePageH));
  const totalPages = cols * rows;

  const handlePrintTiles = () => {
    window.print();
  };

  const handleExportTilePdf = async () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF({ orientation, unit: 'mm', format: pageSize.toLowerCase() as any, compress: true });
      const pageWMm = pageDim.w * 10;
      const pageHMm = pageDim.h * 10;
      const stepWMm = effectivePageW * 10;
      const stepHMm = effectivePageH * 10;
      if (!validContours.length) throw new Error('لا توجد قطع مغلقة صالحة للطباعة. أكمل حدود القطع أولاً.');

      for (let row = 0; row < rows; row++) {
        for (let column = 0; column < cols; column++) {
          const pageIndex = row * cols + column + 1;
          if (pageIndex > 1) doc.addPage(pageSize.toLowerCase(), orientation);
          doc.setDrawColor(190, 190, 190);
          doc.setLineWidth(0.25);
          doc.rect(5, 5, pageWMm - 10, pageHMm - 10);
          doc.setFontSize(9);
          doc.setTextColor(45, 55, 72);
          doc.text(`صفحة ${pageIndex} من ${totalPages} • صف ${row + 1} • عمود ${column + 1}`, 10, 10);

          if (pageIndex === 1 && showTestSquare) {
            const squareX = pageWMm - 60;
            doc.setDrawColor(25, 25, 25);
            doc.setLineWidth(0.5);
            doc.rect(squareX, 5, 50, 50);
            doc.setFontSize(7);
            doc.text('اختبار المقياس', squareX + 5, 27);
            doc.text('50 × 50 mm', squareX + 5, 34);
          }

          if (showAssemblyGrid) {
            const drawCross = (x: number, y: number) => {
              doc.setDrawColor(220, 38, 38);
              doc.setLineWidth(0.2);
              doc.line(x - 3, y, x + 3, y);
              doc.line(x, y - 3, x, y + 3);
            };
            drawCross(10, 60);
            drawCross(pageWMm - 10, 60);
            drawCross(10, pageHMm - 10);
            drawCross(pageWMm - 10, pageHMm - 10);
          }

          // Draw full-size vector contours; page boundaries clip each overlapping tile.
          const offsetX = pageMarginCm * 10 - minX * 10 - column * stepWMm;
          const offsetY = headerBandCm * 10 - minY * 10 - row * stepHMm;
          validContours.forEach(({ piece, points }) => {
            doc.setDrawColor(25, 45, 80);
            doc.setLineWidth(0.45);
            for (let i = 1; i < points.length; i++) {
              const a = points[i - 1];
              const b = points[i];
              doc.line(offsetX + a.x * 10, offsetY + a.y * 10, offsetX + b.x * 10, offsetY + b.y * 10);
            }
            doc.setDrawColor(190, 35, 45);
            doc.setLineWidth(0.35);
            piece.notches.forEach(notch => {
              const angle = notch.angleDeg * Math.PI / 180;
              const half = Math.max(0.2, notch.depthCm) * 5;
              const x = offsetX + notch.point.x * 10;
              const y = offsetY + notch.point.y * 10;
              doc.line(x - Math.cos(angle) * half, y - Math.sin(angle) * half, x + Math.cos(angle) * half, y + Math.sin(angle) * half);
            });
            doc.setDrawColor(30, 120, 170);
            doc.setLineWidth(0.3);
            piece.grainlines.forEach(line => {
              doc.line(offsetX + line.p1.x * 10, offsetY + line.p1.y * 10, offsetX + line.p2.x * 10, offsetY + line.p2.y * 10);
            });
          });
        }
      }
      doc.save(`pattern-tiles-${pageSize}-${totalPages}pages.pdf`);
    } catch (error) {
      console.error('Tile PDF export failed:', error);
      window.alert(error instanceof Error ? error.message : 'تعذر إنشاء ملف الطباعة.');
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
                امتداد القطع: {patternWidthCm.toFixed(1)} × {patternHeightCm.toFixed(1)} سم
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
