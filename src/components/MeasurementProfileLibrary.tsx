import React, { useEffect, useState } from 'react';
import { Check, FolderOpen, Save, Trash2 } from 'lucide-react';
import type { StudioMeasurements } from '../lib/ktr-bridge';
import { createMeasurementProfile } from '../lib/measurement-profile';
import { deleteSavedMeasurementProfile, loadSavedMeasurementProfiles, saveMeasurementProfile, type SavedMeasurementProfile } from '../lib/measurement-profile-store';

type Props = {
  values: StudioMeasurements;
  onLoad: (values: StudioMeasurements) => void;
};

export function MeasurementProfileLibrary({ values, onLoad }: Props) {
  const [name, setName] = useState('');
  const [profiles, setProfiles] = useState<SavedMeasurementProfile[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setProfiles(loadSavedMeasurementProfiles(window.localStorage));
  }, []);

  const saveCurrent = () => {
    const next = saveMeasurementProfile(window.localStorage, name, createMeasurementProfile(values));
    if (!next) {
      setMessage('تعذر الحفظ. اكتب اسماً للملف وتأكد من إتاحة التخزين في المتصفح.');
      return;
    }
    setProfiles(next);
    setName('');
    setMessage('تم حفظ ملف القياسات على هذا الجهاز.');
  };

  const remove = (id: string) => {
    const next = deleteSavedMeasurementProfile(window.localStorage, id);
    if (!next) {
      setMessage('تعذر حذف ملف القياسات.');
      return;
    }
    setProfiles(next);
    setMessage('تم حذف الملف المحدد.');
  };

  return (
    <section className="mt-4 rounded-xl border border-slate-700 bg-slate-950/70 p-3" aria-label="مكتبة ملفات القياسات">
      <div className="flex items-center gap-2 text-sm font-bold"><FolderOpen className="h-4 w-4 text-sky-300" /> ملفات القياسات المحفوظة</div>
      <p className="mt-1 text-[11px] leading-5 text-slate-400">احفظ قياسات أشخاص أو مقاسات عمل مختلفة، ثم أعد تحميلها في أي مشروع على هذا الجهاز.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input aria-label="اسم ملف القياسات" value={name} onChange={event => setName(event.target.value)} maxLength={60} placeholder="اسم ملف القياسات" className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-sky-400" />
        <button type="button" onClick={saveCurrent} disabled={!name.trim()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"><Save className="h-4 w-4" /> حفظ القياسات الحالية</button>
      </div>
      {profiles.length > 0 ? <ul className="mt-3 space-y-2">{profiles.map(profile => <li key={profile.id} className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900/70 p-2 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="truncate text-xs font-bold">{profile.name}</div><div className="mt-1 text-[10px] text-slate-500">الصدر {profile.profile.values.bust} · الخصر {profile.profile.values.waist} · الورك {profile.profile.values.hip} سم</div></div><div className="flex shrink-0 gap-2"><button type="button" onClick={() => { onLoad({ ...profile.profile.values }); setMessage(`تم تحميل: ${profile.name}`); }} className="inline-flex items-center gap-1 rounded-md bg-emerald-600/20 px-2.5 py-1.5 text-[11px] font-bold text-emerald-200 hover:bg-emerald-600/30"><Check className="h-3.5 w-3.5" /> تحميل</button><button type="button" onClick={() => remove(profile.id)} aria-label={`حذف ${profile.name}`} className="rounded-md px-2 py-1.5 text-rose-300 hover:bg-rose-500/10"><Trash2 className="h-3.5 w-3.5" /></button></div></li>)}</ul> : <p className="mt-3 text-[11px] text-slate-500">لا توجد ملفات محفوظة بعد.</p>}
      {message && <p role="status" className="mt-2 text-[11px] text-sky-200">{message}</p>}
    </section>
  );
}
