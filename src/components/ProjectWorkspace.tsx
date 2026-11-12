import React, { useEffect, useMemo, useState } from 'react';
import { Archive, Download, FilePlus2, FolderOpen, History, Save, Trash2, Upload } from 'lucide-react';
import {
  createProject, DEFAULT_PROJECT_EASE, DEFAULT_PROJECT_MEASUREMENTS, exportProjects, importProjects,
  loadProjects, persistProjects, saveProject, type ProjectSnapshot, type ProjectGarment, type ProjectFamily
} from '../lib/project-store';
import { deleteCadProjectDocument, loadCadProjectDocument, saveCadProjectDocument, type CadProjectDocument } from '../lib/cad-project-document';
import { deleteProjectFabric, loadProjectFabric, saveProjectFabric } from '../lib/project-fabric-store';
import type { FabricCustomState } from '../lib/fabric-engine';

type PortableProject = ProjectSnapshot & { cadDocument?: CadProjectDocument | null; fabricState?: FabricCustomState | null };

const garmentOptions: { value: ProjectGarment; label: string }[] = [
  { value: 'blouse', label: 'بلوزة' }, { value: 'dress', label: 'فستان' }, { value: 'shirt', label: 'قميص' },
  { value: 'skirt', label: 'تنورة' }, { value: 'pants', label: 'بنطال' }, { value: 'tshirt', label: 'تيشيرت' },
  { value: 'abaya', label: 'عباءة' }, { value: 'coat', label: 'معطف' }, { value: 'hoodie', label: 'هودي' }, { value: 'blazer', label: 'بليزر' }
];
const familyOptions: { value: ProjectFamily; label: string }[] = [
  { value: 'bodice', label: 'الجذع' }, { value: 'skirt', label: 'التنورة' }, { value: 'trousers', label: 'البنطال' }, { value: 'jacket', label: 'الجاكيت' }
];
const measurementFields = [
  { key: 'bust', label: 'الصدر' }, { key: 'waist', label: 'الخصر' }, { key: 'hip', label: 'الورك' },
  { key: 'backLength', label: 'طول الظهر' }, { key: 'sleeveLength', label: 'طول الكم' }, { key: 'upperArm', label: 'أعلى الذراع' }
] as const;
const easeFields = [{ key: 'bust', label: 'الصدر' }, { key: 'waist', label: 'الخصر' }, { key: 'hip', label: 'الورك' }, { key: 'upperArm', label: 'أعلى الذراع' }] as const;

export function ProjectWorkspace({ onOpenCad }: { onOpenCad: (project: ProjectSnapshot) => void }) {
  const [projects, setProjects] = useState<ProjectSnapshot[]>(() => loadProjects(typeof window === 'undefined' ? null : window.localStorage));
  const [activeId, setActiveId] = useState<string | null>(() => loadProjects(typeof window === 'undefined' ? null : window.localStorage)[0]?.id ?? null);
  const [status, setStatus] = useState('تُحفظ التغييرات تلقائياً على هذا الجهاز');
  const [showHistory, setShowHistory] = useState(false);
  const active = projects.find(project => project.id === activeId) ?? null;

  useEffect(() => {
    const ok = persistProjects(typeof window === 'undefined' ? null : window.localStorage, projects);
    setStatus(ok ? 'تم الحفظ محلياً' : 'تعذر الحفظ؛ صدّر نسخة احتياطية من المشروع');
  }, [projects]);

  const update = (patch: Parameters<typeof saveProject>[1]) => {
    if (!active) return;
    setProjects(current => current.map(project => project.id === active.id ? saveProject(project, patch) : project));
  };
  const create = () => {
    const project = createProject(`مشروع ${projects.length + 1}`);
    setProjects(current => [project, ...current]);
    setActiveId(project.id);
    setShowHistory(false);
  };
  const remove = () => {
    if (!active || !window.confirm(`هل تريد حذف «${active.name}» من هذا الجهاز؟`)) return;
    deleteCadProjectDocument(window.localStorage, active.id);
    deleteProjectFabric(window.localStorage, active.id);
    const next = projects.filter(project => project.id !== active.id);
    setProjects(next); setActiveId(next[0]?.id ?? null);
  };
  const getPortableProjects = (items: ProjectSnapshot[]): PortableProject[] => items.map(project => ({
    ...project,
    cadDocument: loadCadProjectDocument(typeof window === 'undefined' ? null : window.localStorage, project.id),
    fabricState: loadProjectFabric(typeof window === 'undefined' ? null : window.localStorage, project.id)
  }));
  const download = () => {
    if (!active) return;
    const blob = new Blob([exportProjects(getPortableProjects([active]))], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `${active.name.replace(/[^\p{L}\p{N}-]+/gu, '-')}.patron-project.json`;
    anchor.click(); URL.revokeObjectURL(url);
  };
  const backupAll = () => {
    const blob = new Blob([exportProjects(getPortableProjects(projects))], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'patron-studio-projects-backup.json'; anchor.click(); URL.revokeObjectURL(url);
  };
  const restore = async (file?: File) => {
    if (!file) return;
    try {
      const portable = importProjects(await file.text()) as PortableProject[];
      portable.forEach(project => {
        if (project.fabricState) {
          saveProjectFabric(typeof window === 'undefined' ? null : window.localStorage, project.id, project.fabricState);
        }
        if (project.cadDocument) {
          saveCadProjectDocument(
            typeof window === 'undefined' ? null : window.localStorage,
            project.id, project.cadDocument.pieces, project.cadDocument.summaries, project.cadDocument.updatedAt
          );
        }
      });
      const imported = portable.map(({ cadDocument: _cadDocument, ...project }) => project);
      setProjects(current => {
        const byId = new Map(current.map(project => [project.id, project]));
        imported.forEach(project => byId.set(project.id, project));
        return [...byId.values()].sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
      });
      setActiveId(imported[0]?.id ?? activeId);
      setStatus(`تم استيراد ${imported.length} مشروع`);
    } catch (error) { setStatus(error instanceof Error ? error.message : 'تعذر قراءة الملف'); }
  };
  const restoreVersion = (version: ProjectSnapshot['history'][number]) => {
    if (!active) return;
    const restored = saveProject(active, {
      measurements: { ...version.measurements },
      ease: { ...version.ease },
      notes: version.notes
    });
    setProjects(current => current.map(project => project.id === active.id ? restored : project));
    setStatus(`تم استعادة بيانات الإصدار ${version.version} وحفظها كإصدار جديد`);
  };
  const versionLabel = useMemo(() => active ? `الإصدار ${active.version}` : '', [active]);

  return <div dir="rtl" className="h-full w-full overflow-y-auto bg-slate-950 p-4 text-slate-100 sm:p-6">
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><div className="flex items-center gap-2 text-indigo-300"><FolderOpen className="h-5 w-5" /><span className="text-xs font-bold">مساحة العمل</span></div>
          <h1 className="mt-1 text-2xl font-black">المشاريع وملفات القياسات</h1>
          <p className="mt-1 text-xs text-slate-400">مشاريع مستقلة، حفظ تلقائي، سجل نسخ، ونسخ احتياطي قابل للنقل.</p></div>
        <div className="flex flex-wrap gap-2">
          <button onClick={create} className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-3 py-2 text-sm font-bold"><FilePlus2 className="h-4 w-4" /> مشروع جديد</button>
          <button onClick={backupAll} disabled={!projects.length} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-sm disabled:opacity-40"><Archive className="h-4 w-4" /> نسخة احتياطية</button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-sm"><Upload className="h-4 w-4" /> استعادة<input type="file" accept=".json,application/json" className="hidden" onChange={event => { void restore(event.target.files?.[0]); event.currentTarget.value = ''; }} /></label>
        </div>
      </header>
      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
          <div className="flex items-center justify-between px-1"><h2 className="font-bold">قائمة المشاريع</h2><span className="text-xs text-slate-500">{projects.length}</span></div>
          {projects.length === 0 && <p className="rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-400">لا توجد مشاريع بعد. أنشئ مشروعاً جديداً لبدء حفظ القياسات والملاحظات.</p>}
          {projects.map(project => <button key={project.id} onClick={() => { setActiveId(project.id); setShowHistory(false); }} className={`w-full rounded-xl border p-3 text-right ${activeId === project.id ? 'border-indigo-400 bg-indigo-500/10' : 'border-slate-800 bg-slate-950 hover:border-slate-600'}`}>
            <span className="block truncate text-sm font-bold">{project.name}</span><span className="mt-1 block text-[11px] text-slate-400">{garmentOptions.find(item => item.value === project.garment)?.label} · v{project.version}</span><span className="mt-1 block text-[10px] text-slate-500">{new Date(project.updatedAt).toLocaleString('ar')}</span>
          </button>)}
        </aside>
        {active ? <section className="min-w-0 space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <input aria-label="اسم المشروع" value={active.name} onChange={event => update({ name: event.target.value })} className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-lg font-black" />
            <div className="flex flex-wrap gap-2">
              <button onClick={download} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs"><Download className="h-4 w-4" /> تصدير المشروع</button>
              <button onClick={() => onOpenCad(active)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold"><Save className="h-4 w-4" /> فتح في محرر 2D</button>
              <button onClick={() => setShowHistory(value => !value)} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs"><History className="h-4 w-4" /> سجل النسخ ({active.history.length})</button>
              <button onClick={remove} className="inline-flex items-center gap-2 rounded-lg border border-rose-900/70 px-3 py-2 text-xs text-rose-300"><Trash2 className="h-4 w-4" /> حذف</button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs text-slate-400">نوع الملابس<select value={active.garment} onChange={event => update({ garment: event.target.value as ProjectGarment })} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white">{garmentOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <label className="space-y-1 text-xs text-slate-400">عائلة الباترون<select value={active.family} onChange={event => update({ family: event.target.value as ProjectFamily })} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white">{familyOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          </div>
          <div><h3 className="mb-3 flex items-center gap-2 font-bold"><span className="text-sky-300">01</span> القياسات الأساسية <span className="text-[10px] font-normal text-slate-500">(سم)</span></h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{measurementFields.map(field => <label key={field.key} className="space-y-1 text-xs text-slate-400">{field.label}<input type="number" min="0" step="0.5" value={active.measurements[field.key]} onChange={event => update({ measurements: { ...active.measurements, [field.key]: Number(event.target.value) } })} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-bold text-white" /></label>)}</div>
          </div>
          <div><h3 className="mb-3 font-bold"><span className="text-indigo-300">02</span> راحة التصميم <span className="text-[10px] font-normal text-slate-500">(سم)</span></h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{easeFields.map(field => <label key={field.key} className="space-y-1 text-xs text-slate-400">{field.label}<input type="number" step="0.5" value={active.ease[field.key]} onChange={event => update({ ease: { ...active.ease, [field.key]: Number(event.target.value) } })} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-bold text-white" /></label>)}</div>
          </div>
          <label className="block space-y-1 text-xs text-slate-400">ملاحظات المشروع<textarea rows={4} value={active.notes} onChange={event => update({ notes: event.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-white" placeholder="ملاحظات الملاءمة، القماش، التعديلات المطلوبة..." /></label>
          {showHistory && <div className="rounded-xl border border-slate-700 bg-slate-950 p-3"><h3 className="mb-2 flex items-center gap-2 font-bold"><History className="h-4 w-4" /> سجل الإصدارات السابقة</h3>{active.history.length ? [...active.history].reverse().map(item => <div key={item.version} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 py-2 text-xs"><div className="flex flex-col gap-1"><span>الإصدار {item.version}</span><span className="text-slate-500">{new Date(item.savedAt).toLocaleString('ar')}</span></div><button type="button" onClick={() => restoreVersion(item)} className="rounded-lg border border-indigo-500/50 bg-indigo-500/10 px-3 py-1.5 font-bold text-indigo-200 hover:bg-indigo-500/20">استعادة هذه النسخة</button></div>) : <p className="text-xs text-slate-400">لا توجد نسخ سابقة بعد. ستظهر هنا عند تعديل البيانات.</p>}</div>}
          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-3 text-xs text-slate-500"><span className="flex items-center gap-2"><Save className="h-4 w-4 text-emerald-400" /> {status}</span><span>{versionLabel} · آخر تعديل {new Date(active.updatedAt).toLocaleString('ar')}</span></footer>
        </section> : <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 text-center"><FolderOpen className="h-10 w-10 text-slate-600" /><p className="mt-3 font-bold">ابدأ بمشروعك الأول</p><p className="mt-1 text-xs text-slate-500">أنشئ مشروعاً لحفظ قياسات شخص وبيانات التصميم.</p><button onClick={create} className="mt-4 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-bold">إنشاء مشروع</button></div>}
      </div>
      <p className="text-[11px] leading-6 text-amber-200/80">ملاحظة: الحفظ الحالي محلي على المتصفح والجهاز، وليس مزامنة سحابية. استخدم النسخة الاحتياطية لنقل المشاريع أو استعادتها بعد حذف بيانات المتصفح.</p>
    </div>
  </div>;
}
