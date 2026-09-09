'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, CheckSquare, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Copy,
  Download, Dumbbell, Eye, EyeOff, FileText, LayoutGrid, List, Loader2, Pencil, Plus, Square, Trash2, Upload, Video, X,
  Moon,
} from 'lucide-react';
import WodEditor from '@/components/wods/WodEditor';
import PdfImportModal from '@/components/wods/PdfImportModal';
import { downloadWodCsvTemplate, parseWodImportFile } from '@/lib/wodImport';
import {
  BLOCK_COLOR, BLOCK_LABEL, DAY_LABELS, EMPTY_WOD_FORM, TYPE_COLOR, WodFormState, formatCap, movementLines,
} from '@/lib/wodFields';
import {
  CaseProgramme, ProgramWod,
  caseVoisine, colonnesSeance, createProgramWod, csvSeances, deleteProgramWod, deleteProgramWods,
  duplicateProgramWeek, estJourRepos, estSeanceRelative, formulaireDepuisSeance, listProgramWods,
  listProgramRestDays, reposDeSemaine, setProgramRestDay, RestDay,
  moveProgramWod, nombreSemaines, seanceDepuisLigneCsv, seancesDatees, seancesDeCase, seancesDeSemaine,
  setProgramWodPublished, updateProgramWod,
} from '@/lib/programContent';

/**
 * Page « Séances » d'un programme athlète : le rendu et l'outillage du
 * Whiteboard (7 colonnes Lun→Dim, cartes, ← → ↑ ↓ 👁 ✏️ 🗑, « Lignes »,
 * export CSV, sélection, tout supprimer, dupliquer la semaine) sur une
 * grille RELATIVE — « Semaine N / X », pas de date. Ce n'est pas le
 * Whiteboard : la box y programme ses WOD datés ; ici un athlète achète un
 * programme qu'il reçoit EN PLUS, à partir de sa propre date de démarrage.
 */

export interface ProgramForEditor {
  id: string;
  box_id: string;
  title: string;
  type: 'fixed' | 'ongoing';
  duration_weeks: number | null;
  days_per_week: number;
}

interface Props {
  program: ProgramForEditor;
  userId: string | null;
  onClose: () => void;
  /** Le compteur de séances de la liste des programmes se relit après chaque écriture. */
  onChanged?: () => void;
}

type Layout = 'columns' | 'rows';
const LAYOUT_KEY = 'bo_program_sessions_layout';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function ProgramSessionsEditor({ program, userId, onClose, onChanged }: Props) {
  const [wods, setWods] = useState<ProgramWod[]>([]);
  const [loading, setLoading] = useState(true);
  const [week, setWeek] = useState(1);
  const [layout, setLayoutRaw] = useState<Layout>(() => {
    if (typeof window !== 'undefined') {
      const v = localStorage.getItem(LAYOUT_KEY);
      if (v === 'rows' || v === 'columns') return v;
    }
    return 'columns';
  });
  const setLayout = (next: Layout) => { localStorage.setItem(LAYOUT_KEY, next); setLayoutRaw(next); };

  const [modal, setModal] = useState(false);
  const [editWod, setEditWod] = useState<ProgramWod | null>(null);
  const [form, setForm] = useState<WodFormState>(EMPTY_WOD_FORM);
  const [movements, setMovements] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string; message: string; confirmLabel: string; onConfirm: () => Promise<void>;
  } | null>(null);

  const [restDays, setRestDays] = useState<RestDay[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [w, r] = await Promise.all([listProgramWods(program.id), listProgramRestDays(program.id)]);
      setWods(w);
      setRestDays(r);
    } catch (e) {
      setNotice({ ok: false, text: `Impossible de charger les séances : ${msg(e)}` });
    }
    setLoading(false);
  }, [program.id]);

  useEffect(() => { void load(); }, [load]);

  const totalSemaines = useMemo(() => nombreSemaines(program, wods), [program, wods]);
  const semaine = useMemo(() => seancesDeSemaine(wods, week), [wods, week]);
  const datees = useMemo(() => seancesDatees(wods), [wods]);
  const relatives = useMemo(() => wods.filter(estSeanceRelative).length, [wods]);
  const isFixed = program.type === 'fixed';
  const peutAvancer = !isFixed || week < totalSemaines;

  const apresEcriture = async () => { await load(); onChanged?.(); };

  // ── Formulaire partagé ─────────────────────────────────────────────────────
  async function toggleRepos(day: number) {
    const repos = !estJourRepos(restDays, week, day);
    if (repos && seancesDeCase(wods, week, day).length > 0) {
      setNotice({ ok: false, text: 'Ce jour contient des séances : déplacez-les ou supprimez-les avant de le passer en repos.' });
      return;
    }
    setRestDays(prev => repos
      ? [...prev, { program_week: week, program_day: day }]
      : prev.filter(r => !(r.program_week === week && r.program_day === day)));
    try { await setProgramRestDay(program.id, { week, day }, repos); onChanged?.(); }
    catch (e) { setNotice({ ok: false, text: msg(e) }); await load(); }
  }

  function openCreate(day: number) {
    if (estJourRepos(restDays, week, day)) return;
    setEditWod(null);
    setForm({ ...EMPTY_WOD_FORM, week, dayOfWeek: day, published: true });
    setMovements([]);
    setFormError(null);
    setModal(true);
  }

  function openEdit(w: ProgramWod) {
    setEditWod(w);
    setForm(formulaireDepuisSeance(w, week));
    setMovements(movementLines(w.description));
    setFormError(null);
    setModal(true);
  }

  async function save() {
    if (!form.title.trim()) return;
    setSaving(true); setFormError(null);
    const payload = colonnesSeance(form, movements);
    if (estJourRepos(restDays, payload.program_week, payload.program_day)) {
      setFormError(`Le ${DAY_LABELS[payload.program_day - 1]} de la semaine ${payload.program_week} est un jour de repos.`);
      setSaving(false);
      return;
    }
    try {
      if (editWod) {
        await updateProgramWod(editWod.id, payload);
      } else {
        const rang = seancesDeCase(wods, payload.program_week, payload.program_day).length;
        await createProgramWod(program.id, program.box_id, userId, { ...payload, sort_order: rang });
      }
      setModal(false);
      setWeek(payload.program_week);
      await apresEcriture();
    } catch (e) {
      setFormError(msg(e));
    }
    setSaving(false);
  }

  // ── Actions de carte ───────────────────────────────────────────────────────
  async function togglePublish(w: ProgramWod) {
    try {
      await setProgramWodPublished(w.id, !(w.is_published ?? true));
      await load();
    } catch (e) { setNotice({ ok: false, text: msg(e) }); }
  }

  function remove(w: ProgramWod) {
    setConfirmDialog({
      title: 'Supprimer cette séance ?',
      message: `« ${w.title} » sera définitivement supprimée du programme.`,
      confirmLabel: 'Supprimer',
      onConfirm: async () => {
        try { await deleteProgramWod(w.id); await apresEcriture(); }
        catch (e) { setNotice({ ok: false, text: `Suppression impossible : ${msg(e)}` }); }
      },
    });
  }

  function removeWeek() {
    if (semaine.length === 0) return;
    setConfirmDialog({
      title: `Supprimer ${semaine.length} séance${semaine.length > 1 ? 's' : ''} ?`,
      message: `Toutes les séances de la semaine ${week} de « ${program.title} » seront supprimées. Les autres semaines et le Whiteboard ne sont pas touchés.`,
      confirmLabel: 'Tout supprimer',
      onConfirm: async () => {
        try { await deleteProgramWods(semaine.map(w => w.id)); await apresEcriture(); }
        catch (e) { setNotice({ ok: false, text: `Suppression impossible : ${msg(e)}` }); }
      },
    });
  }

  function removeSelected() {
    if (selectedIds.length === 0) return;
    setConfirmDialog({
      title: `Supprimer ${selectedIds.length} séance${selectedIds.length > 1 ? 's' : ''} ?`,
      message: 'Les séances sélectionnées seront définitivement supprimées.',
      confirmLabel: 'Supprimer la sélection',
      onConfirm: async () => {
        try { await deleteProgramWods(selectedIds); setSelectedIds([]); await apresEcriture(); }
        catch (e) { setNotice({ ok: false, text: `Suppression impossible : ${msg(e)}` }); }
      },
    });
  }

  async function moveInDay(c: CaseProgramme, index: number, sens: 'up' | 'down') {
    const jour = seancesDeCase(wods, c.week, c.day);
    const cible = sens === 'up' ? index - 1 : index + 1;
    if (cible < 0 || cible >= jour.length) return;
    [jour[index], jour[cible]] = [jour[cible], jour[index]];
    setWods(prev => prev.map(w => {
      const i = jour.findIndex(j => j.id === w.id);
      return i === -1 ? w : { ...w, sort_order: i };
    }));
    try {
      await Promise.all(jour.map((w, i) => moveProgramWod(w.id, c, i)));
    } catch (e) { setNotice({ ok: false, text: msg(e) }); await load(); }
  }

  async function moveToDay(w: ProgramWod, sens: 'prev' | 'next') {
    if (!estSeanceRelative(w)) return;
    const cible = caseVoisine({ week: w.program_week as number, day: w.program_day as number }, sens);
    if (!cible) return;
    if (estJourRepos(restDays, cible.week, cible.day)) {
      setNotice({ ok: false, text: `Le ${DAY_LABELS[cible.day - 1]} est un jour de repos cette semaine.` });
      return;
    }
    const rang = seancesDeCase(wods, cible.week, cible.day).length;
    setWods(prev => prev.map(x => (x.id === w.id ? { ...x, program_week: cible.week, program_day: cible.day, sort_order: rang } : x)));
    try { await moveProgramWod(w.id, cible, rang); }
    catch (e) { setNotice({ ok: false, text: msg(e) }); await load(); }
  }

  async function duplicateWeek() {
    const reposSemaine = reposDeSemaine(restDays, week);
    if (semaine.length === 0 && reposSemaine.length === 0) { setNotice({ ok: false, text: 'Aucune séance ni repos cette semaine.' }); return; }
    if (isFixed && week >= totalSemaines) {
      setNotice({ ok: false, text: `Le programme dure ${totalSemaines} semaine${totalSemaines > 1 ? 's' : ''} : il n'y a pas de semaine ${week + 1}.` });
      return;
    }
    try {
      const n = await duplicateProgramWeek(program.id, program.box_id, userId, semaine, reposSemaine);
      const r = reposSemaine.length;
      setNotice({ ok: true, text: `${n} séance${n > 1 ? 's' : ''}${r > 0 ? ` et ${r} jour${r > 1 ? 's' : ''} de repos` : ''} recopié${n + r > 1 ? 's' : ''} en semaine ${week + 1}.` });
      setWeek(week + 1);
      await apresEcriture();
    } catch (e) { setNotice({ ok: false, text: `Duplication impossible : ${msg(e)}` }); }
  }

  function exportCSV() {
    if (semaine.length === 0) return;
    const blob = new Blob([csvSeances(semaine)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${program.title.replace(/[^\w-]+/g, '_')}_semaine_${week}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  /**
   * Import : PDF (même cœur et même preview que le Whiteboard, destination
   * verrouillée sur ce programme) ou CSV/JSON au format « programming »
   * (`week,day,title,…`). Tout passe par la sérialisation du formulaire.
   */
  async function importFile(file: File) {
    const nom = file.name.toLowerCase();
    if (file.type === 'application/pdf' || nom.endsWith('.pdf')) { setPdfFile(file); return; }
    if (!nom.endsWith('.csv') && !nom.endsWith('.json')) {
      setNotice({ ok: false, text: `Type de fichier non supporté : « ${file.name} ». L'import accepte PDF, CSV et JSON.` });
      return;
    }
    setImporting(true);
    const { rows, errors } = parseWodImportFile(await file.text(), file.name, 'programming', isFixed ? totalSemaines : 52);
    if (rows.length === 0) {
      setNotice({ ok: false, text: errors[0] ?? 'Aucune séance trouvée dans le fichier.' });
      setImporting(false);
      return;
    }
    let ok = 0;
    const rangs: Record<string, number> = {};
    for (const row of rows) {
      const payload = seanceDepuisLigneCsv(row);
      const cle = `${payload.program_week}-${payload.program_day}`;
      const rang = seancesDeCase(wods, payload.program_week, payload.program_day).length + (rangs[cle] ?? 0);
      rangs[cle] = (rangs[cle] ?? 0) + 1;
      try {
        await createProgramWod(program.id, program.box_id, userId, { ...payload, sort_order: rang });
        ok += 1;
      } catch (e) {
        errors.push(`« ${row.title} » (S${row.week} J${row.day}) : ${msg(e)}`);
      }
    }
    setNotice({ ok: errors.length === 0, text: `${ok} séance${ok > 1 ? 's' : ''} importée${ok > 1 ? 's' : ''}${errors.length ? ` — ${errors.join(' · ')}` : ''}` });
    setImporting(false);
    await apresEcriture();
  }

  const toggleSelected = (id: string) =>
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  // ── Carte (identique au Whiteboard, sans groupe : le programme est implicite) ──
  function Badges({ w }: { w: ProgramWod }) {
    const wt = w.wod_type ?? '';
    const color = TYPE_COLOR[wt] ?? '#6B7280';
    return (
      <>
        {w.block_name && (
          <span className="text-[8px] font-black tracking-wider px-1 py-0.5 rounded" style={{ backgroundColor: `${BLOCK_COLOR[w.block_name]}20`, color: BLOCK_COLOR[w.block_name] }}>
            {BLOCK_LABEL[w.block_name] ?? w.block_name}
          </span>
        )}
        {wt && (
          <>
            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <span className="text-[9px] font-black tracking-wider truncate" style={{ color }}>{wt.toUpperCase()}</span>
          </>
        )}
        {w.video_url && <Video size={9} className="text-red-400 shrink-0" />}
        {w.is_published === false && <EyeOff size={9} className="text-amber-500 shrink-0" />}
      </>
    );
  }

  function Actions({ w, c, index, total, size = 11 }: { w: ProgramWod; c: CaseProgramme; index: number; total: number; size?: number }) {
    return (
      <>
        <button onClick={() => moveToDay(w, 'prev')} disabled={c.day === 1} className="p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-25" title="Jour précédent">
          <ArrowLeft size={size} className="text-gray-400" />
        </button>
        <button onClick={() => moveToDay(w, 'next')} disabled={c.day === 7} className="p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-25" title="Jour suivant">
          <ArrowRight size={size} className="text-gray-400" />
        </button>
        {total > 1 && (
          <>
            <button onClick={() => moveInDay(c, index, 'up')} disabled={index === 0} className="p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-25" title="Monter">
              <ChevronUp size={size} className="text-gray-400" />
            </button>
            <button onClick={() => moveInDay(c, index, 'down')} disabled={index === total - 1} className="p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-25" title="Descendre">
              <ChevronDown size={size} className="text-gray-400" />
            </button>
          </>
        )}
        <button onClick={() => togglePublish(w)} className="p-1 rounded-lg hover:bg-white/10 transition-colors" title={w.is_published === false ? 'Publier' : 'Dépublier'}>
          {w.is_published === false ? <EyeOff size={size} className="text-gray-500" /> : <Eye size={size} className="text-emerald-400" />}
        </button>
        <button onClick={() => openEdit(w)} className="p-1 rounded-lg hover:bg-white/10 transition-colors" title="Modifier">
          <Pencil size={size} className="text-white" />
        </button>
        <button onClick={() => remove(w)} className="p-1 rounded-lg hover:bg-red-500/10 transition-colors" title="Supprimer">
          <Trash2 size={size} className="text-red-400" />
        </button>
      </>
    );
  }

  const chipProgramme = (
    <span className="text-[8px] font-black tracking-wider px-1 py-0.5 rounded" style={{ backgroundColor: `${isFixed ? '#3B82F6' : '#8B5CF6'}20`, color: isFixed ? '#3B82F6' : '#8B5CF6' }}>
      {program.title}
    </span>
  );

  return (
    <div className="fixed inset-0 z-50 bg-[#0A0A0A] overflow-y-auto">
      {/* En-tête */}
      <div className="sticky top-0 z-10 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="px-6 py-4 flex items-center gap-4 flex-wrap">
          <button onClick={onClose} className="text-gray-400 hover:text-white" title="Retour aux programmes">
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1 min-w-[200px]">
            <h2 className="text-lg font-black text-white">{program.title}</h2>
            <p className="text-xs text-gray-500">
              {isFixed ? `${program.duration_weeks} semaines` : 'Ongoing'} · {program.days_per_week}j/sem · {relatives} séance{relatives > 1 ? 's' : ''}
              {datees.length > 0 && ` · ${datees.length} datée${datees.length > 1 ? 's' : ''}`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => downloadWodCsvTemplate('programming')} title="Modèle CSV (week,day,title,…)"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-colors">
              <FileText size={13} /> Modèle CSV
            </button>
            <button onClick={exportCSV} disabled={semaine.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-white/10 text-gray-400 hover:text-white hover:border-white/20 disabled:opacity-40 transition-colors">
              <Download size={13} /> Exporter
            </button>
            <button onClick={() => fileInputRef.current?.click()} disabled={importing} title="Importer un PDF de programmation ou un CSV/JSON"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-white/10 text-gray-400 hover:text-white hover:border-white/20 disabled:opacity-40 transition-colors">
              {importing ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Importer
            </button>
            <input
              ref={fileInputRef} type="file" accept=".csv,.json,.pdf" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void importFile(f); }}
            />
            <button
              onClick={() => { setSelectMode(m => !m); setSelectedIds([]); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${selectMode ? 'border-white/40 text-white bg-white/10' : 'border-white/10 text-gray-400 hover:text-white hover:border-white/20'}`}
            >
              <CheckSquare size={13} /> {selectMode ? 'Quitter la sélection' : 'Sélectionner'}
            </button>
            <button
              onClick={() => setLayout(layout === 'columns' ? 'rows' : 'columns')}
              title={layout === 'columns' ? 'Vue lignes' : 'Vue colonnes'}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-colors"
            >
              {layout === 'columns' ? <List size={13} /> : <LayoutGrid size={13} />}
              {layout === 'columns' ? 'Lignes' : 'Colonnes'}
            </button>
            <button
              onClick={removeWeek}
              disabled={semaine.length === 0}
              title="Supprimer toutes les séances de la semaine affichée"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-red-500/20 text-red-400 hover:text-red-300 hover:border-red-500/40 hover:bg-red-500/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Trash2 size={13} /> Tout supprimer
            </button>
            <button
              onClick={duplicateWeek}
              disabled={semaine.length === 0 || (isFixed && week >= totalSemaines)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-white/10 text-gray-300 hover:text-white hover:border-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Copy size={13} /> Dupliquer sem. {week} → {week + 1}
            </button>
            <button
              onClick={() => openCreate(1)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-white/90 text-[#0A0A0A] text-sm font-bold rounded-xl transition-colors"
            >
              <Plus size={15} /> Nouvelle séance
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">
        {selectMode && (
          <div className="flex flex-wrap items-center gap-2 bg-[#111111] border border-white/15 rounded-xl px-4 py-3">
            <p className="text-sm font-bold text-white">
              {selectedIds.length} séance{selectedIds.length > 1 ? 's' : ''} sélectionnée{selectedIds.length > 1 ? 's' : ''}
            </p>
            <button
              onClick={() => setSelectedIds(selectedIds.length === semaine.length ? [] : semaine.map(w => w.id))}
              className="px-3 py-1.5 rounded-xl text-xs font-bold border border-white/10 text-gray-300 hover:text-white hover:border-white/20 transition-colors"
            >
              {selectedIds.length === semaine.length && semaine.length > 0 ? 'Tout désélectionner' : 'Toute la semaine'}
            </button>
            <button
              onClick={removeSelected}
              disabled={selectedIds.length === 0}
              className="px-4 py-1.5 rounded-xl text-xs font-bold bg-red-500 hover:bg-red-600 text-white disabled:opacity-40 transition-colors"
            >
              Supprimer la sélection
            </button>
          </div>
        )}

        {notice && (
          <div className={`border rounded-xl px-4 py-3 text-sm flex items-start justify-between gap-3 ${notice.ok ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
            <p className="font-semibold">{notice.text}</p>
            <button onClick={() => setNotice(null)} className="text-gray-500 hover:text-white"><X size={13} /></button>
          </div>
        )}

        {/* Navigation : « Semaine N / X », pas de date — un programme est relatif. */}
        <div className="flex items-center justify-between bg-[#111111] border border-white/8 rounded-2xl px-5 py-3">
          <button onClick={() => setWeek(w => Math.max(1, w - 1))} disabled={week <= 1} className="p-2 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white disabled:opacity-30 transition-colors" title="Semaine précédente">
            <ChevronLeft size={18} />
          </button>
          <div className="text-center">
            <p className="text-sm font-bold text-white">
              Semaine {week}{isFixed ? ` / ${totalSemaines}` : ''}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {semaine.length} séance{semaine.length > 1 ? 's' : ''} · {reposDeSemaine(restDays, week).length} jour{reposDeSemaine(restDays, week).length > 1 ? 's' : ''} de repos · {program.days_per_week}j/sem annoncés
            </p>
          </div>
          <button onClick={() => setWeek(w => w + 1)} disabled={!peutAvancer} className="p-2 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white disabled:opacity-30 transition-colors" title="Semaine suivante">
            <ChevronRight size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-white" size={28} /></div>
        ) : layout === 'columns' ? (
          <div className="grid grid-cols-7 gap-2 min-h-[400px]">
            {DAY_LABELS.map((label, i) => {
              const day = i + 1;
              const repos = estJourRepos(restDays, week, day);
              const c = { week, day };
              const dayWods = seancesDeCase(wods, week, day);
              return (
                <div key={day} className={`border rounded-2xl overflow-hidden flex flex-col ${repos ? 'bg-white/[0.01] border-white/[0.03]' : 'bg-[#111111] border-white/8'}`}>
                  <div className="text-center px-2 py-3 relative">
                    <p className={`text-xs font-black ${repos ? 'text-gray-600' : 'text-gray-400'}`}>{label}</p>
                    {repos
                      ? <p className="text-[9px] font-black text-gray-600 mt-0.5 tracking-wider">REPOS</p>
                      : <p className="text-[10px] font-bold text-gray-500 mt-0.5">Jour {day}</p>}
                    <button
                      onClick={() => void toggleRepos(day)}
                      className={`absolute top-1.5 right-1.5 p-1 rounded-md transition-colors ${repos ? 'text-white bg-white/10' : 'text-gray-600 hover:text-gray-300 hover:bg-white/5'}`}
                      title={repos ? 'Retirer le repos' : 'Marquer ce jour en repos'}
                      aria-pressed={repos}
                      aria-label={`Repos ${label}`}
                    >
                      <Moon size={11} />
                    </button>
                  </div>
                  <div className="flex-1 border-t border-white/5 p-2 space-y-2 min-h-[120px]">
                    {dayWods.length === 0 ? (
                      repos ? null : (
                        <button onClick={() => openCreate(day)} className="w-full h-full min-h-[100px] flex flex-col items-center justify-center text-xs text-gray-600 hover:text-gray-400 transition-colors rounded-xl hover:bg-white/5">
                          <Dumbbell size={16} className="mb-1.5 opacity-40" />
                          Ajouter
                        </button>
                      )
                    ) : (
                      <>
                        {dayWods.map((w, wi) => (
                          <div key={w.id} className={`rounded-xl p-2.5 border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors ${w.is_published === false ? 'opacity-50' : ''}`}>
                            <div className="flex items-center gap-1.5 mb-1 flex-wrap"><Badges w={w} /></div>
                            <div className="flex items-start gap-1.5">
                              {selectMode && (
                                <button onClick={() => toggleSelected(w.id)} className="mt-0.5 shrink-0" title="Sélectionner cette séance">
                                  {selectedIds.includes(w.id) ? <CheckSquare size={13} className="text-white" /> : <Square size={13} className="text-gray-600" />}
                                </button>
                              )}
                              <p className="text-xs font-bold text-white truncate">{w.title}</p>
                            </div>
                            {w.description && <p className="text-[10px] text-gray-500 truncate mt-0.5">{w.description}</p>}
                            <div className="mt-1 flex items-center gap-1 flex-wrap">
                              {chipProgramme}
                              {w.time_cap_seconds != null && <span className="text-[9px] text-gray-600">{formatCap(w.time_cap_seconds)}</span>}
                            </div>
                            <div className="flex items-center gap-0.5 mt-2 pt-1.5 border-t border-white/5">
                              <Actions w={w} c={c} index={wi} total={dayWods.length} />
                            </div>
                          </div>
                        ))}
                        {!repos && (
                          <button onClick={() => openCreate(day)} className="w-full py-1.5 text-center text-[10px] text-white font-semibold rounded-lg hover:bg-white/5 transition-colors">
                            <Plus size={10} className="inline mr-0.5 -mt-px" /> Ajouter
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            {DAY_LABELS.map((label, i) => {
              const day = i + 1;
              const repos = estJourRepos(restDays, week, day);
              const c = { week, day };
              const dayWods = seancesDeCase(wods, week, day);
              return (
                <div key={day} className={`border rounded-2xl overflow-hidden ${repos ? 'bg-white/[0.01] border-white/[0.03]' : 'bg-[#111111] border-white/8'}`}>
                  <div className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-black ${repos ? 'text-gray-600' : 'text-gray-400'}`}>{label}</span>
                      {repos
                        ? <span className="text-[10px] font-black text-gray-600 bg-white/5 px-2 py-0.5 rounded-full uppercase tracking-wider">Repos</span>
                        : <span className="text-xs text-gray-500">Jour {day}</span>}
                      <span className="text-xs text-gray-600">{dayWods.length > 0 ? `${dayWods.length} séance${dayWods.length > 1 ? 's' : ''}` : ''}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => void toggleRepos(day)}
                        className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg transition-colors ${repos ? 'text-white bg-white/10' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                        aria-pressed={repos}
                        aria-label={`Repos ${label}`}
                      >
                        <Moon size={12} /> Repos
                      </button>
                      {!repos && (
                        <button onClick={() => openCreate(day)} className="flex items-center gap-1.5 text-xs text-white font-semibold transition-colors">
                          <Plus size={14} /> Ajouter
                        </button>
                      )}
                    </div>
                  </div>
                  {dayWods.length === 0 ? (
                    repos ? null : (
                      <button onClick={() => openCreate(day)} className="w-full flex items-center justify-center gap-2 py-5 text-sm text-gray-600 hover:text-gray-400 border-t border-white/5 transition-colors">
                        <Dumbbell size={14} /> Aucune séance — cliquez pour en ajouter
                      </button>
                    )
                  ) : (
                    <div className="border-t border-white/5 divide-y divide-white/5">
                      {dayWods.map((w, wi) => {
                        const wt = w.wod_type ?? '';
                        const color = TYPE_COLOR[wt] ?? '#6B7280';
                        return (
                          <div key={w.id} className={`flex items-center gap-4 px-5 py-3.5 ${w.is_published === false ? 'opacity-60' : ''}`}>
                            <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: w.block_name ? (BLOCK_COLOR[w.block_name] ?? color) : color }} />
                            {selectMode && (
                              <button onClick={() => toggleSelected(w.id)} className="shrink-0 mr-1" title="Sélectionner cette séance">
                                {selectedIds.includes(w.id) ? <CheckSquare size={16} className="text-white" /> : <Square size={16} className="text-gray-600" />}
                              </button>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5 flex-wrap"><Badges w={w} />{chipProgramme}</div>
                              <p className="text-sm font-bold text-white truncate">{w.title}</p>
                              {w.description && <p className="text-xs text-gray-500 truncate mt-0.5">{w.description}</p>}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {w.time_cap_seconds != null && <span className="text-xs text-gray-600 mr-2">{formatCap(w.time_cap_seconds)}</span>}
                              <Actions w={w} c={c} index={wi} total={dayWods.length} size={14} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Séances posées avant le modèle relatif : encore datées, toujours lues
            par l'app à leur date. Elles ne sont converties qu'à la main. */}
        {!loading && datees.length > 0 && (
          <div className="bg-[#111111] border border-amber-500/20 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-white/5">
              <p className="text-sm font-bold text-amber-400">Séances datées (ancien modèle)</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Ces séances sont ancrées sur une date, pas sur une semaine du programme. Les modifier les place en
                semaine × jour ; les laisser telles quelles ne change rien pour les athlètes.
              </p>
            </div>
            <div className="divide-y divide-white/5">
              {datees.map(w => (
                <div key={w.id} className="flex items-center gap-4 px-5 py-3">
                  <span className="text-xs font-bold text-gray-400 w-24 shrink-0">
                    {new Date(`${w.scheduled_date}T00:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap"><Badges w={w} /></div>
                    <p className="text-sm font-bold text-white truncate">{w.title}</p>
                  </div>
                  <button onClick={() => openEdit(w)} className="p-2 rounded-xl hover:bg-white/5 transition-colors" title="Placer en semaine × jour">
                    <Pencil size={14} className="text-white" />
                  </button>
                  <button onClick={() => remove(w)} className="p-2 rounded-xl hover:bg-red-500/10 transition-colors" title="Supprimer">
                    <Trash2 size={14} className="text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {confirmDialog && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-md p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-red-500/15">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-white mb-1">{confirmDialog.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{confirmDialog.message}</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDialog(null)} className="px-4 py-2 rounded-xl text-sm font-bold border border-white/10 text-gray-300 hover:bg-white/5 transition-colors">
                Annuler
              </button>
              <button
                onClick={async () => { const cb = confirmDialog.onConfirm; setConfirmDialog(null); await cb(); }}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-red-500 hover:bg-red-600 text-white transition-colors"
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {pdfFile && userId && (
        <PdfImportModal
          file={pdfFile}
          boxId={program.box_id}
          userId={userId}
          target={{
            kind: 'program',
            program: { id: program.id, title: program.title, type: program.type },
            defaultWeek: week,
            weeksCount: totalSemaines,
            restDays,
          }}
          onClose={() => setPdfFile(null)}
          onDone={r => {
            setPdfFile(null);
            setNotice({ ok: r.errors.length === 0, text: [`${r.ok} séance${r.ok > 1 ? 's' : ''} importée${r.ok > 1 ? 's' : ''}.`, ...(r.notes ?? []), ...r.errors].join(' ') });
            void apresEcriture();
          }}
        />
      )}

      {modal && (
        <WodEditor
          mode="program"
          heading={editWod
            ? (estSeanceRelative(editWod) ? 'Modifier la séance' : `Placer la séance du ${editWod.scheduled_date} en semaine × jour`)
            : `Nouvelle séance — semaine ${form.week}, ${DAY_LABELS[form.dayOfWeek - 1]}`}
          submitLabel={editWod ? 'Enregistrer' : 'Créer la séance'}
          form={form}
          setForm={setForm}
          movements={movements}
          setMovements={setMovements}
          saving={saving}
          error={formError}
          onClose={() => setModal(false)}
          onSubmit={save}
          weeksCount={isFixed ? totalSemaines : Math.max(totalSemaines, form.week) + 12}
          lockedProgram={{ id: program.id, title: program.title, type: program.type }}
          restDays={restDays}
        />
      )}
    </div>
  );
}
