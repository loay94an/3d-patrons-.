import React, { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [showReconnected, setShowReconnected] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
    } else if (wasOffline) {
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
        setWasOffline(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  if (!isOnline) {
    return (
      <div className="fixed bottom-4 left-4 right-4 sm:right-auto sm:max-w-md z-50 flex items-center gap-3 rounded-xl bg-amber-600 text-white px-4 py-3 text-xs md:text-sm font-medium shadow-2xl border border-amber-500 animate-in slide-in-from-bottom-4 duration-300">
        <WifiOff className="w-5 h-5 shrink-0 animate-pulse text-amber-200" />
        <div>
          <p className="font-bold">أنت تعمل الآن في وضع عدم الاتصال (Offline)</p>
          <p className="text-amber-100 text-xs">جميع أدوات وحسابات الباترون تعمل بكفاءة كاملة دون إنترنت.</p>
        </div>
      </div>
    );
  }

  if (showReconnected) {
    return (
      <div className="fixed bottom-4 left-4 right-4 sm:right-auto sm:max-w-md z-50 flex items-center gap-2.5 rounded-xl bg-emerald-600 text-white px-4 py-2.5 text-xs md:text-sm font-medium shadow-xl border border-emerald-500 animate-in slide-in-from-bottom-4 duration-300">
        <Wifi className="w-4 h-4 shrink-0 text-emerald-200" />
        <span>تم استعادة الاتصال بالإنترنت</span>
      </div>
    );
  }

  return null;
};
