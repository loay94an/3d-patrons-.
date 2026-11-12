import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download, ImagePlus, RotateCcw, MousePointer2, CheckCircle2,
  AlertCircle, Trash2, Crosshair
} from 'lucide-react';
import {
  GARMENT_LANDMARK_NAMES,
  GARMENT_VISION_SCHEMA_VERSION,
  validateGarmentVisionResult,
  type GarmentCategory,
  type GarmentLandmark,
  type GarmentVisionResult,
  type Point2D
} from '../lib/garment-vision';

const CATEGORY_LABELS: Record<GarmentCategory, string> = {
  blouse: 'بلوزة',
  dress: 'فستان',
  outwear: 'معطف / جاكيت',
  skirt: 'تنورة',
  trousers: 'بنطال',
  unknown: 'غير محدد'
};

const LANDMARK_LABELS: Record<string, string> = {
  neck_left: 'الرقبة يسار',
  neck_right: 'الرقبة يمين',
  shoulder_left: 'الكتف يسار',
  shoulder_right: 'الكتف يمين',
  armpit_left: 'الإبط يسار',
  armpit_right: 'الإبط يمين',
  waist_left: 'الخصر يسار',
  waist_right: 'الخصر يمين',
  hem_left: 'الحافة يسار',
  hem_right: 'الحافة يمين',
  sleeve_left: 'بداية الكم يسار',
  sleeve_right: 'بداية الكم يمين',
  cuff_left: 'نهاية الكم يسار',
  cuff_right: 'نهاية الكم يمين',
  crotch: 'نقطة الحجر',
  knee_left: 'الركبة يسار',
  knee_right: 'الركبة يمين'
};

export function GarmentImageWorkbench() {
  const [category, setCategory] = useState<GarmentCategory>('blouse');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState('');
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [landmarks, setLandmarks] = useState<GarmentLandmark[]>([]);
  const [activeLandmark, setActiveLandmark] = useState('');
  const [selectedLandmark, setSelectedLandmark] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
  }, []);

  const availableLandmarks = useMemo(
    () => [...(GARMENT_LANDMARK_NAMES[category as keyof typeof GARMENT_LANDMARK_NAMES] ?? [])],
    [category]
  );

  const result = useMemo<GarmentVisionResult | null>(() => {
    if (!imageUrl || !imageSize.width || !imageSize.height) return null;
    const points = landmarks.filter(item => item.point !== null);
    if (points.length < 2) return null;
    const xs = points.map(item => item.point!.x);
    const ys = points.map(item => item.point!.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    const pad = 0.015;
    const x = Math.max(0, minX - pad);
    const y = Math.max(0, minY - pad);
    const right = Math.min(1, maxX + pad);
    const bottom = Math.min(1, maxY + pad);
    return {
      schemaVersion: GARMENT_VISION_SCHEMA_VERSION,
      category,
      boundingBox: { x, y, width: Math.max(0.001, right - x), height: Math.max(0.001, bottom - y) },
      mask: null,
      landmarks,
      confidence: 1,
      image: {
        originalWidth: imageSize.width,
        originalHeight: imageSize.height,
        processedWidth: imageSize.width,
        processedHeight: imageSize.height,
        model: 'manual-annotation',
        modelVersion: '1',
        landmarkSchema: '3d-patrons-canonical-v1'
      }
    };
  }, [category, imageSize, imageUrl, landmarks]);

  const validationIssues = result ? validateGarmentVisionResult(result) : [];
  const placedCount = landmarks.filter(item => item.point !== null).length;

  const handleImage = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setNotice('يرجى اختيار ملف صورة صالح.');
      return;
    }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setImageUrl(null);
    setImageName('');
    setImageSize({ width: 0, height: 0 });
    setLandmarks([]);
    setSelectedLandmark(null);
    setActiveLandmark('');
    setDragging(null);
    const image = new Image();
    image.onload = () => {
      if (objectUrlRef.current !== url) return;
      setImageUrl(url);
      setImageName(file.name);
      setImageSize({ width: image.naturalWidth, height: image.naturalHeight });
      setNotice('تم تحميل الصورة. اختر معلماً ثم اضغط على موضعه في الصورة.');
    };
    image.onerror = () => {
      if (objectUrlRef.current !== url) return;
      URL.revokeObjectURL(url);
      objectUrlRef.current = null;
      setImageUrl(null);
      setImageName('');
      setImageSize({ width: 0, height: 0 });
      setNotice('تعذر قراءة الصورة؛ اختر ملف صورة آخر.');
    };
    image.src = url;
  };

  const pointFromClient = (clientX: number, clientY: number): Point2D | null => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return null;
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
    };
  };

  const placePoint = (event: React.PointerEvent<SVGSVGElement>) => {
    if (dragging) return;
    const point = pointFromClient(event.clientX, event.clientY);
    if (!point) return;
    const target = activeLandmark || availableLandmarks.find(name => !landmarks.some(item => item.name === name && item.point));
    if (!target) {
      setNotice('تم وضع جميع المعالم المتاحة. اختر معلماً لتحريكه أو احذفه لإعادة وضعه.');
      return;
    }
    setLandmarks(previous => {
      const existing = previous.find(item => item.name === target);
      const next: GarmentLandmark = {
        name: target,
        point,
        visibility: 'visible',
        confidence: null,
        sourceKey: 'manual'
      };
      return existing
        ? previous.map(item => item.name === target ? next : item)
        : [...previous, next];
    });
    setSelectedLandmark(target);
    setActiveLandmark('');
    setNotice('تم تحديد ' + (LANDMARK_LABELS[target] ?? target) + '. يمكنك سحب النقطة لتعديل موضعها.');
  };

  const updatePoint = (name: string, point: Point2D) => {
    setLandmarks(previous => previous.map(item =>
      item.name === name ? { ...item, point, visibility: 'visible' } : item
    ));
  };

  const removeSelected = () => {
    if (!selectedLandmark) return;
    setLandmarks(previous => previous.filter(item => item.name !== selectedLandmark));
    setSelectedLandmark(null);
  };

  const reset = () => {
    setLandmarks([]);
    setSelectedLandmark(null);
    setActiveLandmark('');
    setDragging(null);
    setNotice('تم مسح جميع المعالم.');
  };

  const exportJson = () => {
    if (!result) return;
    const issues = validateGarmentVisionResult(result);
    if (issues.length) {
      setNotice('لا يمكن التصدير قبل إصلاح أخطاء البيانات.');
      return;
    }
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'garment-vision-annotation.json';
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice('تم تصدير ملف المعالم بصيغة JSON.');
  };

  return (
    <section className="h-full w-full overflow-y-auto bg-slate-950 p-3 text-slate-100 sm:p-5" dir="rtl">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-black sm:text-2xl">تحليل صورة الملابس</h1>
            <p className="mt-1 text-xs leading-6 text-slate-400">ارفع صورة واضحة، وحدد نقاط القطعة يدوياً. هذه المرحلة لا تستخدم نموذج ذكاء اصطناعي بعد.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-bold hover:bg-indigo-500">
              <ImagePlus className="h-4 w-4" /> رفع صورة
            </button>
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={event => handleImage(event.target.files?.[0])} />
            <button onClick={reset} disabled={!landmarks.length} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-sm font-bold text-slate-300 disabled:opacity-40">
              <RotateCcw className="h-4 w-4" /> مسح النقاط
            </button>
            <button onClick={exportJson} disabled={!result || validationIssues.length > 0} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold hover:bg-emerald-500 disabled:opacity-40">
              <Download className="h-4 w-4" /> تصدير JSON
            </button>
          </div>
        </header>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900 p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-slate-400">{imageName || 'لم يتم اختيار صورة'}</div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Crosshair className="h-4 w-4" /> {placedCount} نقطة محددة
              </div>
            </div>
            {imageUrl ? (
              <div className="relative mx-auto overflow-hidden rounded-xl border border-slate-700 bg-slate-950" style={{ aspectRatio: imageSize.width + ' / ' + imageSize.height, maxHeight: '68vh', maxWidth: '100%' }}>
                <img src={imageUrl} alt="صورة قطعة الملابس المراد تحليلها" className="pointer-events-none absolute inset-0 h-full w-full object-fill" />
                <svg
                  ref={svgRef}
                  viewBox="0 0 1000 1000"
                  preserveAspectRatio="none"
                  className={`absolute inset-0 h-full w-full ${activeLandmark ? 'cursor-crosshair' : 'cursor-default'}`}
                  onPointerDown={placePoint}
                  onPointerMove={event => {
                    if (!dragging) return;
                    const next = pointFromClient(event.clientX, event.clientY);
                    if (next) updatePoint(dragging, next);
                  }}
                  onPointerUp={() => setDragging(null)}
                  onPointerCancel={() => setDragging(null)}
                >
                  {landmarks.filter(item => item.point).map(item => {
                    const point = item.point!;
                    const selected = selectedLandmark === item.name;
                    return (
                      <g key={item.name}>
                        <circle cx={point.x * 1000} cy={point.y * 1000} r={selected ? 11 : 8} fill={selected ? '#fbbf24' : '#22d3ee'} stroke="#082f49" strokeWidth="3" />
                        <text x={point.x * 1000 + 14} y={point.y * 1000 - 12} fill="white" stroke="#0f172a" strokeWidth="4" paintOrder="stroke" fontSize="24" fontWeight="700">{LANDMARK_LABELS[item.name] ?? item.name}</text>
                        <circle
                          cx={point.x * 1000} cy={point.y * 1000} r="18"
                          fill="transparent" className="cursor-grab"
                          onPointerDown={event => {
                            event.stopPropagation();
                            setSelectedLandmark(item.name);
                            setDragging(item.name);
                            event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
                          }}
                        />
                      </g>
                    );
                  })}
                </svg>
              </div>
            ) : (
              <button onClick={() => inputRef.current?.click()} className="flex min-h-72 w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-700 bg-slate-950/60 text-slate-400 transition hover:border-indigo-500 hover:text-indigo-300">
                <ImagePlus className="h-10 w-10" />
                <span className="font-bold">اختر صورة ملابس للبدء</span>
                <span className="text-xs">PNG أو JPG أو WebP</span>
              </button>
            )}
            {notice && <p className="mt-3 rounded-lg bg-slate-800 px-3 py-2 text-xs leading-6 text-slate-300" role="status">{notice}</p>}
          </div>

          <aside className="space-y-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <label className="mb-2 block text-sm font-bold">نوع قطعة الملابس</label>
              <select value={category} onChange={event => { setCategory(event.target.value as GarmentCategory); setLandmarks([]); setSelectedLandmark(null); setActiveLandmark(''); setDragging(null); }} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <div className="mt-4 flex items-center gap-2 text-sm font-bold"><MousePointer2 className="h-4 w-4 text-cyan-300" /> اختر المعلم ثم انقر الصورة</div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {availableLandmarks.map(name => {
                  const placed = landmarks.some(item => item.name === name && item.point);
                  return (
                    <button key={name} onClick={() => { setActiveLandmark(name); setSelectedLandmark(name); }} className={`rounded-lg border px-2 py-2 text-right text-xs font-semibold transition ${activeLandmark === name ? 'border-amber-400 bg-amber-400/10 text-amber-200' : placed ? 'border-cyan-800 bg-cyan-950/40 text-cyan-200' : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500'}`}>
                      <span className="flex items-center justify-between gap-1"><span>{LANDMARK_LABELS[name] ?? name}</span>{placed && <CheckCircle2 className="h-3.5 w-3.5" />}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-[11px] leading-5 text-slate-500">يمكنك اختيار النقطة ثم النقر على الصورة. اسحب أي نقطة لتصحيح موقعها.</p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold">المعالم المسجلة</h2>
                <button onClick={removeSelected} disabled={!selectedLandmark} className="rounded-lg p-1.5 text-rose-300 hover:bg-rose-950 disabled:opacity-30" title="حذف النقطة المحددة"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="space-y-2">
                {landmarks.length ? landmarks.map(item => (
                  <button key={item.name} onClick={() => setSelectedLandmark(item.name)} className={`flex w-full items-center justify-between rounded-lg px-2 py-2 text-xs ${selectedLandmark === item.name ? 'bg-slate-700 text-white' : 'bg-slate-950 text-slate-400'}`}>
                    <span>{LANDMARK_LABELS[item.name] ?? item.name}</span>
                    <span dir="ltr">{item.point ? (item.point.x * 100).toFixed(1) + '%, ' + (item.point.y * 100).toFixed(1) + '%' : 'غير محدد'}</span>
                  </button>
                )) : <p className="text-xs text-slate-500">لم تتم إضافة نقاط بعد.</p>}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center gap-2 text-sm font-bold">
                {validationIssues.length ? <AlertCircle className="h-4 w-4 text-amber-400" /> : <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                حالة البيانات
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-400">{result ? (validationIssues.length ? 'توجد ملاحظات تحتاج مراجعة.' : 'البيانات سليمة بنيوياً وجاهزة للتصدير.') : 'أضف صورتك وحدد نقطتين على الأقل لتكوين ملف أولي.'}</p>
              <p className="mt-2 text-[10px] text-slate-500">الإحداثيات نسبية للصورة. المحيطات والأطوال الحقيقية غير مستنتجة من هذه النقاط.</p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
