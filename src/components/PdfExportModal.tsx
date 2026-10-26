import React, { useRef, useState } from 'react';
import { Download, Printer, X, FileText, Check, Loader2, Sparkles, Scissors, Layers, Ruler } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { 
  AppState, computePatternValues, detailedNames, patternNames, 
  getGarmentLabel, getSchoolLabel, getFabricLabel, getGenderLabel 
} from '../lib/pattern-logic';

interface PdfExportModalProps {
  state: AppState;
  isOpen: boolean;
  onClose: () => void;
}

export function PdfExportModal({ state, isOpen, onClose }: PdfExportModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const { values: patternValues, meas, seam, ease, s } = computePatternValues(state);

  const unitLabel = state.unit === 'cm' ? 'سم' : 'إنش';
  const unitFactor = state.unit === 'in' ? 2.54 : 1.0;

  const formatDim = (v: number | undefined) => {
    if (v === undefined || isNaN(v)) return '—';
    let val = v / unitFactor;
    return `${val.toFixed(1)} ${unitLabel}`;
  };

  const detailedValues = [
    meas.backWidth, meas.shoulder, meas.backLength, meas.sleeveLength, meas.armCirc, meas.cuffCirc, meas.neckCirc, meas.bust ?? meas.chest, meas.waist, meas.hip, meas.waistToHip, meas.waistToKnee, meas.legLength, meas.skirtLength, meas.chestLength, meas.armholeCirc, meas.waistToArmpit, meas.shoulderToBust ?? meas.shoulderToChest, meas.bustPointDist ?? meas.chestPointDist, meas.thighCirc, meas.kneeCirc, meas.ankleCirc, meas.crotchHeight, meas.sideLength
  ];

  const handleDownloadPdf = async () => {
    if (!printAreaRef.current) return;
    setIsGenerating(true);
    setDownloadSuccess(false);

    try {
      // Temporarily ensure high resolution rendering
      const element = printAreaRef.current;
      
      const canvas = await html2canvas(element, {
        scale: 2, // High DPI for clear text & vector rendering
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 1200
      });

      const imgData = canvas.toDataURL('image/png', 0.95);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const pdfWidth = 210; // A4 width mm
      const pageHeight = 297; // A4 height mm
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const fileName = `Pattern_Card_${state.garment}_${state.gender}_${state.size}.pdf`;
      pdf.save(fileName);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err) {
      console.error('PDF Generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/80 backdrop-blur-md overflow-y-auto font-['Tajawal']" dir="rtl">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-5xl my-auto overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl border border-white/20">
              <FileText className="w-6 h-6 text-blue-200" />
            </div>
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2">
                تصدير كارت الباترون والمقاسات (PDF Specification Document)
              </h3>
              <p className="text-xs text-blue-100">تقرير المخطط الشامل، جدول الحسابات الهندسية، وزيادات الخياطة</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={isGenerating}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all active:scale-95 disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري إنشاء PDF...</span>
                </>
              ) : downloadSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>تم التحميل بنجاح!</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>تحميل ملف PDF</span>
                </>
              )}
            </button>

            <button
              onClick={handlePrint}
              className="hidden sm:flex items-center gap-2 px-3.5 py-2 bg-white/15 hover:bg-white/25 active:bg-white/30 text-white rounded-xl text-xs sm:text-sm font-semibold border border-white/20 transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Preview Document Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100 dark:bg-slate-950">
          <div 
            ref={printAreaRef}
            className="bg-white text-slate-900 p-8 sm:p-10 rounded-xl shadow-lg border border-slate-300 max-w-4xl mx-auto space-y-8 font-['Tajawal'] print:shadow-none print:border-none print:p-0"
            style={{ width: '100%', minHeight: '1120px' }}
          >
            
            {/* Header / Document Identity */}
            <div className="flex justify-between items-start border-b-2 border-blue-600 pb-5">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-1 rounded-md">موسوعة الأجيال</span>
                  <span className="text-xs text-slate-500 font-mono">ID: {state.garment.toUpperCase()}-{state.gender.toUpperCase()}-{state.size}</span>
                </div>
                <h1 className="text-2xl font-black text-slate-900">كارت مواصفات وتفصيل الباترون (Pattern Spec Sheet)</h1>
                <p className="text-xs text-slate-600">جدول القياسات الهندسية ومخطط التفصيل للورشة والمصنع</p>
              </div>

              <div className="text-left font-mono text-xs text-slate-500 space-y-0.5">
                <div>التاريخ: {new Date().toLocaleDateString('ar-EG')}</div>
                <div>الوحدة: <strong className="text-slate-800">{state.unit === 'cm' ? 'سنتيمتر (cm)' : 'إنش (in)'}</strong></div>
                <div>حالة المقاس: <strong className="text-blue-700">{state.useCustomMode ? 'مخصص (إدخال يدوي)' : 'جدول قياسي'}</strong></div>
              </div>
            </div>

            {/* Pattern Settings & Metadata Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="space-y-0.5">
                <span className="text-slate-500 block">الموديل / القطعة:</span>
                <span className="font-bold text-slate-900 text-sm">{getGarmentLabel(state.garment)}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-slate-500 block">الجنس والمقاس:</span>
                <span className="font-bold text-slate-900 text-sm">{getGenderLabel(state.gender)} – {state.size}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-slate-500 block">طريقة المدرسة:</span>
                <span className="font-bold text-blue-700 text-sm">{getSchoolLabel(state.school)}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-slate-500 block">نوع القماش:</span>
                <span className="font-bold text-slate-900 text-sm">{getFabricLabel(state.fabric)} {state.fabric === 'stretchy' ? `(${state.stretchPercent}%)` : ''}</span>
              </div>
            </div>

            {/* Seam Allowances & Eases Summary Banner */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 flex flex-wrap justify-between items-center gap-3 text-xs">
              <div className="flex items-center gap-2 font-bold text-blue-900">
                <Scissors className="w-4 h-4 text-blue-600" />
                <span>زيادات الخياطة المعتمدة (Seam Allowances):</span>
              </div>
              <div className="flex gap-4 font-mono font-semibold text-slate-800">
                <span>الجنب: <strong className="text-blue-700">{formatDim(seam.side)}</strong></span>
                <span>الكتف: <strong className="text-blue-700">{formatDim(seam.shoulder)}</strong></span>
                <span>الرقبة/الإبط: <strong className="text-blue-700">{formatDim(seam.neckArmhole)}</strong></span>
                <span>الذيل/السفلية: <strong className="text-blue-700">{formatDim(seam.hem)}</strong></span>
              </div>
            </div>

            {/* Pattern Values Table (37 Dimensions) */}
            <div className="space-y-3">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Ruler className="w-4 h-4 text-blue-600" />
                  <span>1. حسابات الباترون الأساسية (Calculated Pattern Values)</span>
                </h3>
                <span className="text-xs text-slate-500">إجمالي 37 قياساً هندسياً</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {patternNames.slice(0, 30).map((name, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2 bg-slate-50 rounded border border-slate-100">
                    <span className="text-slate-700 font-medium truncate">{idx + 1}. {name}:</span>
                    <span className="font-mono font-bold text-blue-700 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      {formatDim(patternValues[idx])}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Detailed Body Measurements Table */}
            <div className="space-y-3 pt-4 border-t border-slate-200">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  <span>2. جدول مقاسات الجسم التفصيلية (Body Measurements)</span>
                </h3>
                <span className="text-xs text-slate-500">24 قياساً مرجعياً</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {detailedNames.slice(0, 24).map((name, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2 bg-emerald-50/50 rounded border border-emerald-100">
                    <span className="text-slate-700 truncate">{name}:</span>
                    <span className="font-mono font-bold text-emerald-800 bg-white px-1.5 py-0.5 rounded border border-emerald-200">
                      {formatDim(detailedValues[idx])}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Construction Instructions Summary */}
            <div className="space-y-2 pt-4 border-t border-slate-200 text-xs">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>3. تعليمات إرشادية للقص والرسم</span>
              </h3>
              <div className="bg-amber-50/60 border border-amber-200 p-3 rounded-xl text-slate-800 space-y-1.5">
                <p>• ابدأ برسم المستطيل الأساسي بربع محيط الصدر <strong>({formatDim(patternValues[11])})</strong> وطول الظهر <strong>({formatDim(patternValues[0])})</strong>.</p>
                <p>• انزل بخط الإبط بمقدار <strong>({formatDim(patternValues[10])})</strong> وعين حرة الرقبة بعرض <strong>({formatDim(patternValues[5])})</strong>.</p>
                <p>• اضف زيادات الخياطة المذكورة أعلاه قبل قص القماش بشكل مستقيم على اتجاه نسيج القماش (Grainline).</p>
              </div>
            </div>

            {/* Signature & Workshop Sign-Off Footer */}
            <div className="pt-8 border-t-2 border-slate-200 grid grid-cols-2 text-xs text-slate-600">
              <div className="space-y-8">
                <div>توقيع مصمم الباترون: .......................................</div>
                <div>ملاحظات الفصال والورشة: .......................................</div>
              </div>
              <div className="space-y-8 text-left">
                <div>اعتماد الجودة والمقاس: .......................................</div>
                <div className="text-slate-400 font-mono text-[10px]">موسوعة الأجيال – جميع الحقوق محفوظة © {new Date().getFullYear()}</div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
