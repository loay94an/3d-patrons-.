import React, { useState } from 'react';
import { Download, Share2, X, Smartphone, CheckCircle } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already installed, don't show the install prompt
  if (isInstalled) {
    return (
      <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 text-white/90 text-xs font-medium border border-white/20">
        <CheckCircle className="w-3.5 h-3.5 text-emerald-300" />
        <span>مثبّت كتطبيق</span>
      </div>
    );
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-2 rounded-full bg-white text-blue-700 hover:bg-blue-50 px-4 py-2 text-xs md:text-sm font-bold shadow-md hover:shadow-lg transition-all transform hover:scale-105 active:scale-95"
        title="تثبيت التطبيق على جهازك للعمل دون إنترنت"
      >
        <Download className="w-4 h-4 animate-bounce" />
        <span>تثبيت التطبيق (PWA)</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-2 rounded-full bg-white/20 hover:bg-white/30 text-white px-3.5 py-1.5 text-xs md:text-sm font-medium border border-white/30 transition-all"
        >
          <Smartphone className="w-4 h-4" />
          <span>تثبيت على الآيفون</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 relative">
              <button
                onClick={() => setShowIOSGuide(false)}
                className="absolute top-4 left-4 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold">تثبيت التطبيق على iPhone / iPad</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">لاستخدام التطبيق كبرنامج كامل وسريع</p>
                </div>
              </div>

              <ol className="space-y-3 text-sm text-slate-600 dark:text-slate-300 pr-4 list-decimal list-inside">
                <li>
                  اضغط على زر <strong className="text-blue-600 dark:text-blue-400 inline-flex items-center gap-1">المشاركة <Share2 className="w-3.5 h-3.5 inline" /></strong> في أسفل شاشة Safari.
                </li>
                <li>
                  مرر للأسفل واضغط على <strong className="text-slate-900 dark:text-white">"إضافة إلى الشاشة الرئيسية" (Add to Home Screen)</strong>.
                </li>
                <li>
                  اضغط على <strong className="text-blue-600 dark:text-blue-400">"إضافة" (Add)</strong> في أعلى الزاوية.
                </li>
              </ol>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-blue-600 hover:bg-blue-700 py-2.5 text-sm font-bold text-white transition"
              >
                فهمت ذلك
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Fallback for browsers before prompt fires or desktop without direct prompt
  return (
    <button
      onClick={() => {
        // Provide user feedback
        alert('لتثبيت التطبيق: افتح قائمة المتصفح (⋮ أو ⋯) واختر "تثبيت التطبيق" أو "Install App"');
      }}
      className="hidden sm:flex items-center gap-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white px-3.5 py-1.5 text-xs md:text-sm font-medium border border-white/25 transition-all"
    >
      <Download className="w-3.5 h-3.5" />
      <span>تثبيت التطبيق</span>
    </button>
  );
};
