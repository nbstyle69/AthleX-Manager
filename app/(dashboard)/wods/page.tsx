'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Plus, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ArrowLeft, ArrowRight, Pencil, Trash2,
  Eye, EyeOff, X, Loader2, Dumbbell, Upload, Download, FileText, Calendar, LayoutGrid, List, Video,
  CalendarPlus, BookmarkPlus, CheckSquare, Square,
} from 'lucide-react';
import { getMyBox } from '@/lib/getMyBox';
import WodEditor from '@/components/wods/WodEditor';
import ApplyProgramWeekModal from '@/components/wods/ApplyProgramWeekModal';
import { RestrictionBadges, programColor } from '@/components/wods/RestrictionBadges';
import AssignRestrictionsModal from '@/components/wods/AssignRestrictionsModal';
import { assignRestrictions, libelleAssignation } from '@/lib/wodAssignment';
import SaveWeekAsTemplateModal from '@/components/wods/SaveWeekAsTemplateModal';
import { applyWeekNotes } from '@/lib/programWeek';
import {
  BLOCK_COLOR, BLOCK_LABEL, DAY_LABELS, EMPTY_WOD_FORM, TYPE_COLOR,
  WodFormState, WodType, formatCap, movementLines, parseCap, sharedWodColumns,
} from '@/lib/wodFields';
import { downloadWodCsvTemplate, parseWodImportFile, VALID_WOD_TYPES } from '@/lib/wodImport';

interface BoxWOD {
  id: string; box_id: string; created_by: string;
  title: string; description: string | null;
  wod_type: WodType | null; scheduled_date: string;
  time_cap_seconds: number | null; rounds: number | null;
  block_name: string | null;
  video_url: string | null;
  notes: string | null; is_published: boolean;
  publish_at: string | null;
  sort_order: number;
  emom_interval_minutes: number | null;
  tabata_work_seconds: number | null;
  tabata_rest_seconds: number | null;
}

function getWeekDates(offset = 0): Date[] {
  const today = new Date();
  const monday = new Date(today);
  const day = today.getDay();
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function WODsPage() {
  const supabase = createClient();

  const [wods,       setWods]      = useState<BoxWOD[]>([]);
  const [loading,    setLoading]   = useState(true);
  const [weekOffset, setWeek]      = useState(0);
  const [boxId,      setBoxId]     = useState<string | null>(null);
  const [userId,     setUserId]    = useState<string | null>(null);

  const [modal,       setModal]       = useState(false);
  const [editWOD,     setEditWOD]     = useState<BoxWOD | null>(null);
  const [form,        setForm]        = useState<WodFormState>(EMPTY_WOD_FORM);
  const [movements,   setMovements]   = useState<string[]>([]);
  const [saving,      setSaving]      = useState(false);
  const [formError,   setFormError]   = useState<string | null>(null);
  const [importing,   setImporting]   = useState(false);
  const [importResult, setImportResult] = useState<{ ok: number; errors: string[]; notes?: string[] } | null>(null);

  // PDF AI import
  interface ParsedPdfWOD {
    scheduled_date: string;
    title: string;
    wod_type: WodType;
    description: string | null;
    time_cap_seconds: number | null;
    rounds: number | null;
    notes: string | null;
    block_name: string | null;
  }
  const [pdfAnalyzing, setPdfAnalyzing] = useState(false);
  const [pdfPreview, setPdfPreview] = useState<{
    wods: ParsedPdfWOD[];
    selected: boolean[];
    inserting: boolean;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [layout, setLayoutRaw] = useState<'rows' | 'columns'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('bo_wods_layout') as 'rows' | 'columns') || 'rows';
    }
    return 'rows';
  });
  const setLayout = (v: 'rows' | 'columns' | ((prev: 'rows' | 'columns') => 'rows' | 'columns')) => {
    setLayoutRaw(prev => {
      const next = typeof v === 'function' ? v(prev) : v;
      localStorage.setItem('bo_wods_layout', next);
      return next;
    });
  };
  const [showDateNav, setShowDateNav] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
    onConfirm: () => void | Promise<void>;
  } | null>(null);
  const [groups, setGroups] = useState<{ id: string; name: string; color: string }[]>([]);
  const [wodGroupMap, setWodGroupMap] = useState<Record<string, string[]>>({});
  const [applyModal, setApplyModal] = useState(false);
  const [templateModal, setTemplateModal] = useState(false);
  const [boxPrograms, setBoxPrograms] = useState<{ id: string; title: string; type: string }[]>([]);
  const [wodProgramMap, setWodProgramMap] = useState<Record<string, string[]>>({});
  const [pdfDestGroups, setPdfDestGroups] = useState<string[]>([]);
  const [pdfDestPrograms, setPdfDestPrograms] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const importRef = useRef<(f: File) => Promise<void>>(async () => {});
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [assignModal, setAssignModal] = useState(false);

  const weekDates = getWeekDates(weekOffset);
  const todayISO  = toISO(new Date());

  const refGroups = useMemo(
    () => groups.map(g => ({ id: g.id, name: g.name, color: g.color })),
    [groups],
  );
  const refPrograms = useMemo(
    () => boxPrograms.map(p => ({ id: p.id, name: p.title, color: programColor(p.type) })),
    [boxPrograms],
  );

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const box = await getMyBox(supabase);
      if (box) {
        setBoxId(box.id);
        const { data: g } = await supabase.from('message_groups').select('id, name, color').eq('box_id', box.id).order('name');
        setGroups(g ?? []);
        const { data: progs } = await supabase.from('programs').select('id, title, type').eq('box_id', box.id).eq('is_active', true).order('title');
        setBoxPrograms((progs ?? []) as any[]);
      }
    })();
  }, []);

  const load = useCallback(async () => {
    if (!boxId) return;
    setLoading(true);
    const { data } = await supabase
      .from('box_wods').select('*')
      .eq('box_id', boxId)
      .gte('scheduled_date', toISO(weekDates[0]))
      .lte('scheduled_date', toISO(weekDates[6]))
      .order('scheduled_date')
      .order('sort_order');
    const wodsArr = (data ?? []) as BoxWOD[];
    setWods(wodsArr);
    // Load group access for all WODs
    const ids = wodsArr.map(w => w.id);
    if (ids.length > 0) {
      const { data: accessRows } = await supabase
        .from('wod_group_access')
        .select('wod_id, group_id')
        .in('wod_id', ids);
      const map: Record<string, string[]> = {};
      (accessRows ?? []).forEach((r: any) => {
        if (!map[r.wod_id]) map[r.wod_id] = [];
        map[r.wod_id].push(r.group_id);
      });
      setWodGroupMap(map);
      // Load program access
      const { data: progAccessRows } = await supabase.from('wod_program_access').select('wod_id, program_id').in('wod_id', ids);
      const pMap: Record<string, string[]> = {};
      (progAccessRows ?? []).forEach((r: any) => {
        if (!pMap[r.wod_id]) pMap[r.wod_id] = [];
        pMap[r.wod_id].push(r.program_id);
      });
      setWodProgramMap(pMap);
    } else {
      setWodGroupMap({});
      setWodProgramMap({});
    }
    setLoading(false);
  }, [boxId, weekOffset]);

  useEffect(() => { load(); }, [load]);

  function toggleSelected(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function openCreate(date: string) {
    setEditWOD(null);
    setForm({ ...EMPTY_WOD_FORM, date });
    setMovements([]);
    setFormError(null);
    setModal(true);
  }

  async function loadWodGroups(wodId: string): Promise<string[]> {
    const { data } = await supabase.from('wod_group_access').select('group_id').eq('wod_id', wodId);
    return (data ?? []).map((r: any) => r.group_id);
  }

  async function openEdit(wod: BoxWOD) {
    setEditWOD(wod);
    const gIds = await loadWodGroups(wod.id);
    const { data: pRows } = await supabase.from('wod_program_access').select('program_id').eq('wod_id', wod.id);
    const pIds = (pRows ?? []).map((r: any) => r.program_id);
    setForm({
      ...EMPTY_WOD_FORM,
      title: wod.title, description: wod.description ?? '',
      wod_type: wod.wod_type ?? '', block: wod.block_name ?? '',
      date: wod.scheduled_date,
      timeCap: formatCap(wod.time_cap_seconds),
      rounds: wod.rounds ? String(wod.rounds) : '',
      notes: wod.notes ?? '', videoUrl: wod.video_url ?? '', published: wod.is_published,
      leaderboard: (wod as any).leaderboard_enabled ?? true,
      groupIds: gIds,
      programIds: pIds,
      publishMode: wod.publish_at ? 'scheduled' : 'now',
      publishHour: wod.publish_at ? new Date(wod.publish_at).getHours().toString().padStart(2, '0') : '06',
      publishMin: wod.publish_at ? new Date(wod.publish_at).getMinutes().toString().padStart(2, '0') : '00',
      emomInterval: wod.emom_interval_minutes ? String(wod.emom_interval_minutes) : '1',
      tabataWork: wod.tabata_work_seconds ? String(wod.tabata_work_seconds) : '20',
      tabataRest: wod.tabata_rest_seconds != null ? String(wod.tabata_rest_seconds) : '10',
    });
    setMovements(movementLines(wod.description));
    setFormError(null);
    setModal(true);
  }

  async function saveWOD() {
    if (!form.title.trim() || !form.date || !boxId || !userId) return;
    setSaving(true); setFormError(null);
    const payload = {
      ...sharedWodColumns(form, movements),
      box_id: boxId, created_by: userId,
      scheduled_date: form.date,
      is_published: form.published,
      publish_at: form.published && form.publishMode === 'scheduled'
        ? `${form.date}T${form.publishHour.padStart(2,'0')}:${form.publishMin.padStart(2,'0')}:00`
        : null,
    };
    let wodId = editWOD?.id;
    if (editWOD) {
      const { error } = await supabase.from('box_wods').update(payload).eq('id', editWOD.id);
      if (error) { setSaving(false); setFormError(error.message); return; }
    } else {
      // Assign sort_order = next position for that date
      const dayCount = wods.filter(w => w.scheduled_date === form.date).length;
      const { data: newWod, error } = await supabase.from('box_wods').insert({ ...payload, sort_order: dayCount }).select('id').single();
      if (error || !newWod) { setSaving(false); setFormError(error?.message ?? 'Erreur'); return; }
      wodId = newWod.id;
    }

    // Les restrictions de l'éditeur sont l'état complet du WOD : on repose
    // exactement ce qui est coché. Un refus d'écriture se dit — sinon la
    // fenêtre se ferme sur un enregistrement qui n'a pas eu lieu.
    if (wodId) {
      const echecs: string[] = [];
      const gDel = await supabase.from('wod_group_access').delete().eq('wod_id', wodId);
      if (gDel.error) echecs.push(`groupes (retrait) : ${gDel.error.message}`);
      if (form.groupIds.length > 0) {
        const gIns = await supabase.from('wod_group_access').insert(
          form.groupIds.map(gid => ({ wod_id: wodId, group_id: gid }))
        );
        if (gIns.error) echecs.push(`groupes : ${gIns.error.message}`);
      }
      const pDel = await supabase.from('wod_program_access').delete().eq('wod_id', wodId);
      if (pDel.error) echecs.push(`programmes (retrait) : ${pDel.error.message}`);
      if (form.programIds.length > 0) {
        const pIns = await supabase.from('wod_program_access').insert(
          form.programIds.map(pid => ({ wod_id: wodId, program_id: pid }))
        );
        if (pIns.error) echecs.push(`programmes : ${pIns.error.message}`);
      }
      if (echecs.length > 0) {
        setSaving(false);
        setFormError(`WOD enregistré, mais les restrictions n'ont pas été posées — ${echecs.join(' ; ')}`);
        load();
        return;
      }
    }

    setSaving(false);
    setModal(false);
    load();
  }

  async function togglePublish(wod: BoxWOD) {
    await supabase.from('box_wods').update({ is_published: !wod.is_published }).eq('id', wod.id);
    load();
  }

  function deleteWOD(wod: BoxWOD) {
    setConfirmDialog({
      title: 'Supprimer ce WOD ?',
      message: `"${wod.title}" sera définitivement supprimé.`,
      confirmLabel: 'Supprimer',
      danger: true,
      onConfirm: async () => {
        await supabase.from('box_wods').delete().eq('id', wod.id);
        load();
      },
    });
  }

  function deleteAllWodsThisWeek() {
    if (!boxId || wods.length === 0) return;
    const startISO = toISO(weekDates[0]);
    const endISO   = toISO(weekDates[6]);
    const count    = wods.length;
    setConfirmDialog({
      title: `Supprimer ${count} WODs ?`,
      message: `Tous les WODs de la semaine du ${weekDates[0].toLocaleDateString('fr-FR')} au ${weekDates[6].toLocaleDateString('fr-FR')} seront supprimés. Cette action est irréversible.`,
      confirmLabel: 'Tout supprimer',
      danger: true,
      onConfirm: async () => {
        await supabase
          .from('box_wods')
          .delete()
          .eq('box_id', boxId)
          .gte('scheduled_date', startISO)
          .lte('scheduled_date', endISO);
        load();
      },
    });
  }

  async function moveWod(dayISO: string, index: number, direction: 'up' | 'down') {
    const dayWODs = wods.filter(w => w.scheduled_date === dayISO);
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= dayWODs.length) return;
    [dayWODs[index], dayWODs[target]] = [dayWODs[target], dayWODs[index]];
    // Optimistic update
    setWods(prev => {
      const others = prev.filter(w => w.scheduled_date !== dayISO);
      return [...others, ...dayWODs.map((w, i) => ({ ...w, sort_order: i }))];
    });
    // Persist
    await Promise.all(dayWODs.map((w, i) =>
      supabase.from('box_wods').update({ sort_order: i }).eq('id', w.id)
    ));
  }

  async function moveWodToDay(wod: BoxWOD, direction: 'prev' | 'next') {
    const d = new Date(wod.scheduled_date + 'T00:00:00');
    d.setDate(d.getDate() + (direction === 'prev' ? -1 : 1));
    const targetDate = toISO(d);
    const targetDayCount = wods.filter(w => w.scheduled_date === targetDate).length;
    // Optimistic update
    setWods(prev => prev.map(w =>
      w.id === wod.id ? { ...w, scheduled_date: targetDate, sort_order: targetDayCount } : w
    ));
    await supabase.from('box_wods').update({ scheduled_date: targetDate, sort_order: targetDayCount }).eq('id', wod.id);
  }

  // ── CSV Export ────────────────────────────────────────────────────────────
  function exportCSV() {
    if (!wods.length) return;
    const headers = ['date','title','type','description','timecap','rounds','notes','published'];
    const rows = wods.map(w => [
      w.scheduled_date,
      `"${(w.title ?? '').replace(/"/g, '""')}"`,
      w.wod_type,
      `"${(w.description ?? '').replace(/"/g, '""')}"`,
      formatCap(w.time_cap_seconds),
      w.rounds ?? '',
      `"${(w.notes ?? '').replace(/"/g, '""')}"`,
      w.is_published ? 'true' : 'false',
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `wods_semaine_${toISO(weekDates[0])}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  // ── CSV Template ─────────────────────────────────────────────────────────
  // Colonnes : date,title,type,description,timecap,rounds,notes,block,published,rank,groups
  //   type      = for-time | amrap | emom | tabata | strength | custom
  //   timecap   = minutes (20) ou mm:ss (12:30)
  //   block     = skill-gym | skill-haltero | wod | pre-wod | post-wod  (optionnel)
  //   published = true/false  (défaut true)
  //   rank      = true/false  (défaut true) → leaderboard_enabled
  //   groups    = noms séparés par | (ex: Compétiteurs|Niveau Avancé) — vide = visible par tous
  function downloadTemplate() {
    downloadWodCsvTemplate('whiteboard');
  }

  // ── PDF AI Import (Claude) ──────────────────────────────────────────────────────────────────
  async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // strip 'data:application/pdf;base64,'
        const base64 = result.split(',')[1] ?? '';
        resolve(base64);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async function importPdfWods(file: File) {
    if (!boxId) return;
    try {
      setPdfAnalyzing(true);
      const pdfBase64 = await fileToBase64(file);
      const defaultStart = toISO(weekDates[0]);
      // Direct fetch to Edge Function so we can read non-2xx error body
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const res = await fetch(`${supabaseUrl}/functions/v1/parse-wod-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? anonKey}`,
          'apikey': anonKey,
        },
        body: JSON.stringify({ box_id: boxId, pdf_base64: pdfBase64, default_start_date: defaultStart }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error ?? `HTTP ${res.status}`);
      }
      const parsed = json?.wods as ParsedPdfWOD[] | undefined;
      if (!parsed || parsed.length === 0) {
        setImportResult({ ok: 0, errors: ['Aucun WOD détecté dans le PDF.'] });
        return;
      }
      setPdfPreview({ wods: parsed, selected: parsed.map(() => true), inserting: false });
      setPdfDestGroups([]);
      setPdfDestPrograms([]);
    } catch (e: any) {
      setImportResult({ ok: 0, errors: [`Erreur IA : ${e?.message ?? 'analyse PDF impossible'}`] });
    } finally {
      setPdfAnalyzing(false);
    }
  }

  async function confirmPdfImport() {
    if (!pdfPreview || !boxId || !userId) return;
    const selected = pdfPreview.wods.filter((_, i) => pdfPreview.selected[i]);
    if (selected.length === 0) return;
    setPdfPreview(p => p ? { ...p, inserting: true } : p);
    const payloads = selected.map((w, i) => ({
      box_id: boxId,
      created_by: userId,
      title: w.title,
      description: w.description,
      wod_type: w.wod_type,
      scheduled_date: w.scheduled_date,
      time_cap_seconds: w.time_cap_seconds,
      rounds: w.rounds,
      notes: w.notes,
      block_name: w.block_name,
      is_published: true,
      leaderboard_enabled: true,
      sort_order: i,
    }));
    const { data: inserted, error } = await supabase.from('box_wods').insert(payloads).select('id');
    if (error) {
      setImportResult({ ok: 0, errors: [error.message] });
      setPdfPreview(null);
      return;
    }

    const ids = (inserted ?? []).map(r => r.id);
    const notes: string[] = [];
    const errors: string[] = [];
    if (ids.length > 0 && (pdfDestGroups.length > 0 || pdfDestPrograms.length > 0)) {
      try {
        await assignRestrictions(ids, pdfDestGroups, pdfDestPrograms, 'ajouter');
        notes.push(libelleAssignation(ids.length, {
          groupes: pdfDestGroups.map(id => refGroups.find(g => g.id === id)?.name ?? id),
          programmes: pdfDestPrograms.map(id => refPrograms.find(p => p.id === id)?.name ?? id),
        }, 'ajouter'));
      } catch (e) {
        errors.push(`WOD importés, mais l'assignation a échoué : ${e instanceof Error ? e.message : String(e)}`);
      }
    } else if (ids.length > 0) {
      notes.push('Aucune restriction choisie : ces WOD sont visibles par toute la box. Sélectionne-les et utilise « Assigner à… » pour les restreindre.');
    }

    setImportResult({ ok: selected.length, errors, notes });
    setPdfPreview(null);
    void load();
  }

  // ── CSV / JSON / PDF Import ──────────────────────────────────────────────────────────────
  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (file) await importFile(file);
  }

  /**
   * Un seul chemin d'import, deux portes : le bouton « Importer » et le
   * glisser-déposer. Même parseur, mêmes refus nommés, même preview PDF.
   */
  async function importFile(file: File) {
    if (!boxId || !userId) return;
    const nom = file.name.toLowerCase();

    if (file.type === 'application/pdf' || nom.endsWith('.pdf')) {
      await importPdfWods(file);
      return;
    }
    if (!nom.endsWith('.csv') && !nom.endsWith('.json')) {
      setImportResult({
        ok: 0,
        errors: [`Type de fichier non supporté : « ${file.name} ». L'import accepte PDF, CSV et JSON.`],
      });
      return;
    }

    setImporting(true);
    setImportResult(null);
    const text = await file.text();

    const { rows, errors: parseErrors } = parseWodImportFile(text, file.name, 'whiteboard');

    if (rows.length === 0) {
      setImportResult({ ok: 0, errors: parseErrors.length ? parseErrors : ['Aucun WOD trouvé dans le fichier'] });
      setImporting(false);
      return;
    }

    // --- Resolve group names → IDs ---
    const allGroupNames = [...new Set(rows.flatMap(r => r.groupNames))];
    const groupMap: Record<string, string> = {};
    if (allGroupNames.length > 0) {
      const { data: grps } = await supabase
        .from('message_groups').select('id, name')
        .eq('box_id', boxId).in('name', allGroupNames);
      if (grps) grps.forEach((g: any) => { groupMap[g.name] = g.id; });
      const missing = allGroupNames.filter(n => !groupMap[n]);
      if (missing.length > 0) parseErrors.push(`Groupes inconnus (ignorés) : ${missing.join(', ')}`);
    }

    // --- Insert WODs ---
    let ok = 0;
    const errors = [...parseErrors];
    const importedIds: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const wodType = (VALID_WOD_TYPES as string[]).includes(r.type) ? r.type : 'custom';
      const { data: inserted, error } = await supabase.from('box_wods').insert({
        box_id: boxId, created_by: userId,
        title: r.title, description: r.description || null,
        wod_type: wodType, scheduled_date: r.date,
        time_cap_seconds: parseCap(r.timeCap),
        rounds: r.rounds ? parseInt(r.rounds) : null,
        notes: r.notes || null, block_name: r.block || null,
        is_published: r.published, leaderboard_enabled: r.rank,
      }).select('id').single();
      if (error) { errors.push(`Ligne ${i + 2} : ${error.message}`); continue; }
      ok++;
      if (inserted) importedIds.push(inserted.id);
      // Insert group access
      if (inserted && r.groupNames.length > 0) {
        const accessRows = r.groupNames
          .filter(gn => groupMap[gn])
          .map(gn => ({ wod_id: inserted.id, group_id: groupMap[gn] }));
        if (accessRows.length > 0) {
          const { error: gErr } = await supabase.from('wod_group_access').insert(accessRows);
          if (gErr) errors.push(`WOD "${r.title}" : erreur groupes — ${gErr.message}`);
        }
      }
    }

    const notes: string[] = [];
    if (importedIds.length > 0) {
      notes.push(
        'Choisis qui voit ces WOD : ils sont déjà sélectionnés, clique « Assigner à… ». '
        + 'Le CSV ne pose que les groupes de sa colonne groups ; les programmes se posent ici.',
      );
      setSelectMode(true);
      setSelectedIds(importedIds);
    }
    setImportResult({ ok, errors, notes });
    setImporting(false);
    if (ok > 0) load();
  }

  importRef.current = importFile;

  /* Le dépôt s'écoute sur la fenêtre : sans un preventDefault au niveau du
     document, Chrome traite le lâcher comme une navigation et télécharge le
     fichier au lieu de le donner à la page. Le compteur et le dragleave hors
     fenêtre évitent qu'un survol annulé laisse l'overlay collé. */
  useEffect(() => {
    let profondeur = 0;
    const porteUnFichier = (e: DragEvent) =>
      Array.from(e.dataTransfer?.types ?? []).includes('Files');

    const onEnter = (e: DragEvent) => {
      if (!porteUnFichier(e)) return;
      profondeur += 1;
      setDragOver(true);
    };
    const onOver = (e: DragEvent) => {
      if (!porteUnFichier(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };
    const onLeave = (e: DragEvent) => {
      profondeur = Math.max(0, profondeur - 1);
      if (profondeur === 0 || e.relatedTarget === null) setDragOver(false);
    };
    const relacher = () => { profondeur = 0; setDragOver(false); };
    const onDrop = (e: DragEvent) => {
      if (!porteUnFichier(e)) return;
      e.preventDefault();
      relacher();
      const file = e.dataTransfer?.files?.[0];
      if (file) void importRef.current(file);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') relacher(); };

    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragover', onOver);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('dragend', relacher);
    window.addEventListener('drop', onDrop);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('dragend', relacher);
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('keydown', onEsc);
    };
  }, []);

  function jumpToDate(dateStr: string) {
    const target = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDay = today.getDay();
    const currentMonday = new Date(today);
    currentMonday.setDate(today.getDate() - (todayDay === 0 ? 6 : todayDay - 1));
    const targetDay = target.getDay();
    const targetMonday = new Date(target);
    targetMonday.setDate(target.getDate() - (targetDay === 0 ? 6 : targetDay - 1));
    const diffMs = targetMonday.getTime() - currentMonday.getTime();
    const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
    setWeek(diffWeeks);
    setShowDateNav(false);
  }

  return (
    <div className="space-y-6 relative">
      {dragOver && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="border-2 border-dashed border-white/40 rounded-2xl px-10 py-8 text-center bg-[#111111]/80">
            <Upload size={28} className="text-white mx-auto mb-2" />
            <p className="text-base font-bold text-white">Lâche ton fichier pour l&apos;importer</p>
            <p className="text-xs text-gray-400 mt-1">PDF, CSV ou JSON — même parseur que le bouton « Importer ».</p>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-white">Whiteboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Calendrier des WODs de la semaine</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={downloadTemplate}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-colors">
            <FileText size={13} /> Template CSV
          </button>
          <button onClick={exportCSV} disabled={!wods.length}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-white/10 text-gray-400 hover:text-white hover:border-white/20 disabled:opacity-40 transition-colors">
            <Download size={13} /> Exporter
          </button>
          <label className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-colors cursor-pointer ${importing ? 'opacity-60 pointer-events-none' : ''}`}>
            {importing ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            {importing ? 'Import…' : 'Importer'}
            <input ref={fileInputRef} type="file" accept=".csv,.json,.pdf" className="hidden" onChange={handleImport} />
          </label>
          <button
            onClick={() => { setSelectMode(m => !m); setSelectedIds([]); }}
            title="Sélectionner plusieurs WOD pour les assigner à un groupe ou un programme"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
              selectMode ? 'border-white/40 text-white bg-white/10' : 'border-white/10 text-gray-400 hover:text-white hover:border-white/20'
            }`}
          >
            <CheckSquare size={13} /> {selectMode ? 'Quitter la sélection' : 'Sélectionner'}
          </button>
          <button
            onClick={() => setLayout(l => l === 'rows' ? 'columns' : 'rows')}
            title={layout === 'rows' ? 'Vue colonnes' : 'Vue lignes'}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-colors"
          >
            {layout === 'rows' ? <LayoutGrid size={13} /> : <List size={13} />}
            {layout === 'rows' ? 'Colonnes' : 'Lignes'}
          </button>
          <button
            onClick={deleteAllWodsThisWeek}
            disabled={!wods.length}
            title="Supprimer tous les WODs de la semaine affichée"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-red-500/20 text-red-400 hover:text-red-300 hover:border-red-500/40 hover:bg-red-500/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Trash2 size={13} /> Tout supprimer
          </button>
          <button
            onClick={() => setApplyModal(true)}
            title="Poser une semaine type ou une programmation souscrite sur le calendrier"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-colors"
          >
            <CalendarPlus size={13} /> Appliquer une semaine
          </button>
          <button
            onClick={() => setTemplateModal(true)}
            disabled={!wods.length}
            title="Recopier la semaine affichée dans une semaine type réutilisable"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-white/10 text-gray-400 hover:text-white hover:border-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <BookmarkPlus size={13} /> Enregistrer comme semaine type
          </button>
          <button
            onClick={() => openCreate(todayISO)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-white/90 text-[#0A0A0A] text-sm font-bold rounded-xl transition-colors"
          >
            <Plus size={15} /> Nouveau WOD
          </button>
        </div>
      </div>

      {/* Sélection multiple : le geste d'assignation et son compte-rendu */}
      {selectMode && (
        <div className="flex flex-wrap items-center gap-2 bg-[#111111] border border-white/15 rounded-xl px-4 py-3">
          <p className="text-sm font-bold text-white">
            {selectedIds.length} WOD{selectedIds.length > 1 ? 's' : ''} sélectionné{selectedIds.length > 1 ? 's' : ''}
          </p>
          <button
            onClick={() => setSelectedIds(selectedIds.length === wods.length ? [] : wods.map(w => w.id))}
            className="px-3 py-1.5 rounded-xl text-xs font-bold border border-white/10 text-gray-300 hover:text-white hover:border-white/20 transition-colors"
          >
            {selectedIds.length === wods.length && wods.length > 0 ? 'Tout désélectionner' : 'Toute la semaine'}
          </button>
          <button
            onClick={() => setAssignModal(true)}
            disabled={selectedIds.length === 0}
            className="px-4 py-1.5 rounded-xl text-xs font-bold bg-white text-black disabled:opacity-40 transition-colors"
          >
            Assigner à…
          </button>
        </div>
      )}

      {assignModal && (
        <AssignRestrictionsModal
          wodIds={selectedIds}
          groups={refGroups}
          programs={refPrograms}
          onClose={() => setAssignModal(false)}
          onDone={(message) => {
            setAssignModal(false);
            setImportResult({ ok: 0, errors: [], notes: [message] });
            setSelectedIds([]);
            void load();
          }}
        />
      )}

      {/* Appliquer une programmation souscrite sur la semaine affichée */}
      {applyModal && boxId && (
        <ApplyProgramWeekModal
          boxId={boxId}
          defaultMonday={toISO(weekDates[0])}
          groups={groups}
          onClose={() => setApplyModal(false)}
          onApplied={(summary) => {
            setApplyModal(false);
            setImportResult({ ok: summary.inserted, errors: [], notes: applyWeekNotes(summary) });
            void load();
          }}
        />
      )}

      {/* Recopier la semaine affichée dans une semaine type réutilisable */}
      {templateModal && boxId && (
        <SaveWeekAsTemplateModal
          boxId={boxId}
          monday={toISO(weekDates[0])}
          onClose={() => setTemplateModal(false)}
          onSaved={({ title, wods: n, days, updated }) => {
            setTemplateModal(false);
            setImportResult({
              ok: 0,
              errors: [],
              notes: [`Semaine type « ${title} » ${updated ? 'mise à jour' : 'enregistrée'} : ${n} WOD sur ${days} jour(s). Applique-la depuis « Appliquer une semaine ».`],
            });
          }}
        />
      )}

      {/* PDF AI loading overlay */}
      {pdfAnalyzing && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-[#111111] border border-white/10 rounded-2xl p-8 max-w-sm text-center">
            <Loader2 size={40} className="animate-spin text-white mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white mb-1">Analyse IA en cours…</h3>
            <p className="text-sm text-gray-400">Claude lit ton PDF et extrait les WODs.</p>
            <p className="text-xs text-gray-500 mt-3">Cela peut prendre 10 à 30 secondes.</p>
          </div>
        </div>
      )}

      {/* Confirm dialog (custom — replaces native confirm() which can be blocked by browser) */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-md p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${confirmDialog.danger ? 'bg-red-500/15' : 'bg-white/15'}`}>
                <Trash2 size={18} className={confirmDialog.danger ? 'text-red-400' : 'text-white'} />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-white mb-1">{confirmDialog.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{confirmDialog.message}</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 rounded-xl text-sm font-bold border border-white/10 text-gray-300 hover:bg-white/5 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={async () => {
                  const cb = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  await cb();
                }}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${confirmDialog.danger ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-white hover:bg-white/90 text-black'}`}
              >
                {confirmDialog.confirmLabel ?? 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF AI preview modal */}
      {pdfPreview && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
              <div>
                <h3 className="text-lg font-bold text-white">WODs détectés</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {pdfPreview.wods.length} WOD(s) — coche ceux à importer
                </p>
              </div>
              <button
                onClick={() => !pdfPreview.inserting && setPdfPreview(null)}
                disabled={pdfPreview.inserting}
                className="text-gray-500 hover:text-white disabled:opacity-40"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
              {pdfPreview.wods.map((wod, i) => {
                const tc = TYPE_COLOR[wod.wod_type] ?? '#6B7280';
                const checked = pdfPreview.selected[i];
                return (
                  <button
                    key={i}
                    onClick={() => {
                      setPdfPreview(p => p ? {
                        ...p,
                        selected: p.selected.map((s, idx) => idx === i ? !s : s),
                      } : p);
                    }}
                    className={`w-full text-left flex items-stretch bg-[#111111] border rounded-xl overflow-hidden transition-all ${
                      checked ? 'border-white/15' : 'border-white/5 opacity-50'
                    }`}
                  >
                    <div className="w-1.5" style={{ backgroundColor: tc }} />
                    <div className="flex-1 px-4 py-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-extrabold tracking-wider" style={{ color: tc }}>
                          {wod.wod_type.toUpperCase()}
                        </span>
                        <span className="text-[11px] text-gray-400 font-bold">{wod.scheduled_date}</span>
                        {wod.block_name && (
                          <span className="text-[9px] font-bold text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">
                            {wod.block_name}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-bold text-white truncate">{wod.title}</p>
                      {wod.description && (
                        <p className="text-xs text-gray-400 line-clamp-3 mt-1 whitespace-pre-line">{wod.description}</p>
                      )}
                      <div className="flex gap-3 mt-2">
                        {wod.time_cap_seconds != null && (
                          <span className="text-[11px] text-gray-500 font-bold">⏱ {formatCap(wod.time_cap_seconds)}</span>
                        )}
                        {wod.rounds != null && (
                          <span className="text-[11px] text-gray-500 font-bold">🔁 {wod.rounds} rounds</span>
                        )}
                      </div>
                    </div>
                    <div className="px-4 flex items-center">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        checked ? 'bg-white border-white' : 'border-gray-600'
                      }`}>
                        {checked && <span className="text-black text-xs font-black">✓</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="px-6 py-3 border-t border-white/8 space-y-2">
              <p className="text-xs font-black uppercase tracking-wider text-gray-500">Qui verra ces WOD</p>
              <div className="flex flex-wrap gap-2">
                {refGroups.map(g => (
                  <button
                    key={g.id}
                    onClick={() => setPdfDestGroups(prev => prev.includes(g.id) ? prev.filter(x => x !== g.id) : [...prev, g.id])}
                    className={`text-xs font-semibold px-2.5 py-1.5 rounded-full border transition-colors ${
                      pdfDestGroups.includes(g.id) ? 'border-white/40 text-white' : 'border-white/10 text-gray-400'
                    }`}
                    style={pdfDestGroups.includes(g.id) ? { backgroundColor: `${g.color}25` } : undefined}
                  >
                    Groupe : {g.name}
                  </button>
                ))}
                {refPrograms.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setPdfDestPrograms(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])}
                    className={`text-xs font-semibold px-2.5 py-1.5 rounded-full border transition-colors ${
                      pdfDestPrograms.includes(p.id) ? 'border-white/40 text-white' : 'border-white/10 text-gray-400'
                    }`}
                    style={pdfDestPrograms.includes(p.id) ? { backgroundColor: `${p.color}25` } : undefined}
                  >
                    Programme : {p.name}
                  </button>
                ))}
                {refGroups.length === 0 && refPrograms.length === 0 && (
                  <p className="text-xs text-gray-600">Aucun groupe ni programme dans cette box.</p>
                )}
              </div>
              <p className="text-[11px] text-gray-500">
                Rien de coché : les WOD importés seront visibles par toute la box. Tu pourras les restreindre après coup avec « Assigner à… ».
              </p>
            </div>

            <div className="flex items-center gap-3 px-6 py-4 border-t border-white/8">
              <button
                onClick={() => {
                  if (!pdfPreview) return;
                  const allSelected = pdfPreview.selected.every(Boolean);
                  setPdfPreview({ ...pdfPreview, selected: pdfPreview.selected.map(() => !allSelected) });
                }}
                className="px-4 py-2.5 rounded-xl text-xs font-bold border border-white/10 text-gray-300 hover:text-white hover:border-white/20 transition-colors"
              >
                {pdfPreview.selected.every(Boolean) ? 'Tout décocher' : 'Tout cocher'}
              </button>
              <button
                onClick={confirmPdfImport}
                disabled={pdfPreview.inserting || pdfPreview.selected.filter(Boolean).length === 0}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold bg-white text-black hover:bg-[#b89222] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {pdfPreview.inserting
                  ? <><Loader2 size={14} className="animate-spin" /> Import…</>
                  : <>Importer {pdfPreview.selected.filter(Boolean).length} WOD(s)</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import result */}
      {importResult && (
        <div className={`border rounded-xl px-4 py-3 text-sm ${importResult.errors.length > 0 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
          <div className="flex items-center justify-between">
            <p className={`font-bold ${importResult.errors.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {/* Zéro WOD posé n'est pas un enregistrement : un refus annoncé
                  par « ✅ Enregistré » se lit comme un import réussi. */}
              {importResult.ok > 0
                ? `✅ ${importResult.ok} WOD${importResult.ok > 1 ? 's' : ''} posé${importResult.ok > 1 ? 's' : ''}`
                : importResult.errors.length > 0 ? '⚠️ Rien n\u2019a été posé' : '✅ Fait'}
              {importResult.errors.length > 0 && ` — ⚠️ ${importResult.errors.length} erreur(s)`}
            </p>
            <button onClick={() => setImportResult(null)} className="text-gray-500 hover:text-white"><X size={13} /></button>
          </div>
          {importResult.errors.map((e, i) => (
            <p key={i} className="text-xs text-amber-400/80 mt-1">{e}</p>
          ))}
          {(importResult.notes ?? []).map((n, i) => (
            <p key={`n${i}`} className="text-xs text-emerald-400/80 mt-1">{n}</p>
          ))}
        </div>
      )}

      {/* Week nav */}
      <div className="relative">
        <div className="flex items-center justify-between bg-[#111111] border border-white/8 rounded-2xl px-5 py-3">
          <button onClick={() => setWeek(w => w - 1)} className="p-2 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
            <ChevronLeft size={18} />
          </button>
          <button onClick={() => setShowDateNav(v => !v)} className="text-center hover:opacity-80 transition-opacity group">
            <div className="flex items-center gap-2 justify-center">
              <Calendar size={14} className="text-gray-500 group-hover:text-white transition-colors" />
              <p className="text-sm font-bold text-white">
                {weekDates[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                {' — '}
                {weekDates[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            {weekOffset === 0 && <p className="text-xs text-white font-semibold mt-0.5">Semaine actuelle</p>}
          </button>
          <button onClick={() => setWeek(w => w + 1)} className="p-2 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
            <ChevronRight size={18} />
          </button>
        </div>
        {showDateNav && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-[#1a1a1a] border border-white/10 rounded-2xl p-4 shadow-2xl z-30 min-w-[280px]">
            <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Aller à une date</p>
            <input
              type="date"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-white transition-colors"
              onChange={(e) => { if (e.target.value) jumpToDate(e.target.value); }}
            />
            <div className="flex gap-2 mt-3">
              <button onClick={() => { setWeek(0); setShowDateNav(false); }} className="flex-1 py-2 text-xs font-semibold text-white rounded-xl hover:bg-white/10 transition-colors">
                Aujourd&#39;hui
              </button>
              <button onClick={() => setShowDateNav(false)} className="flex-1 py-2 text-xs font-semibold text-gray-400 rounded-xl hover:bg-white/5 transition-colors">
                Fermer
              </button>
            </div>
          </div>
        )}
        {weekOffset !== 0 && !showDateNav && (
          <div className="text-center mt-1">
            <button onClick={() => setWeek(0)} className="text-xs text-gray-500 hover:text-white font-semibold transition-colors">
              ← Revenir à la semaine actuelle
            </button>
          </div>
        )}
      </div>

      {/* Calendar */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-white" size={28} /></div>
      ) : layout === 'columns' ? (
        <div className="grid grid-cols-7 gap-2 min-h-[400px]">
          {weekDates.map((d, i) => {
            const iso     = toISO(d);
            const isToday = iso === todayISO;
            const dayWODs = wods.filter(w => w.scheduled_date === iso);
            return (
              <div key={iso} className={`bg-[#111111] border rounded-2xl overflow-hidden flex flex-col ${isToday ? 'border-white/50' : 'border-white/8'}`}>
                <div className={`text-center px-2 py-3 ${isToday ? 'bg-white/20' : ''}`}>
                  <p className={`text-xs font-black ${isToday ? 'text-white' : 'text-gray-400'}`}>{DAY_LABELS[i]}</p>
                  <p className={`text-sm font-bold mt-0.5 ${isToday ? 'text-white' : 'text-gray-300'}`}>
                    {d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </p>
                  {isToday && <span className="text-[9px] font-black text-white mt-0.5 block">Aujourd&#39;hui</span>}
                </div>
                <div className="flex-1 border-t border-white/5 p-2 space-y-2 min-h-[120px]">
                  {dayWODs.length === 0 ? (
                    <button onClick={() => openCreate(iso)} className="w-full h-full min-h-[100px] flex flex-col items-center justify-center text-xs text-gray-600 hover:text-gray-400 transition-colors rounded-xl hover:bg-white/5">
                      <Dumbbell size={16} className="mb-1.5 opacity-40" />
                      Ajouter
                    </button>
                  ) : (
                    <>
                      {dayWODs.map((wod, wi) => {
                        const wt = wod.wod_type ?? '';
                        const color = TYPE_COLOR[wt] ?? '#6B7280';
                        return (
                          <div key={wod.id} className={`rounded-xl p-2.5 border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors ${!wod.is_published ? 'opacity-50' : ''}`}>
                            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                              {wod.block_name && <span className="text-[8px] font-black tracking-wider px-1 py-0.5 rounded" style={{ backgroundColor: `${BLOCK_COLOR[wod.block_name]}20`, color: BLOCK_COLOR[wod.block_name] }}>{BLOCK_LABEL[wod.block_name]}</span>}
                              {wt && <><div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} /><span className="text-[9px] font-black tracking-wider truncate" style={{ color }}>{wt.toUpperCase()}</span></>}
                              {wod.video_url && <Video size={9} className="text-red-400 shrink-0" />}
                              {!wod.is_published && <EyeOff size={9} className="text-amber-500 shrink-0" />}
                              {wod.publish_at && new Date(wod.publish_at) > new Date() && <span className="text-[8px] font-bold text-blue-400">⏰ {new Date(wod.publish_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>}
                            </div>
                            <div className="flex items-start gap-1.5">
                              {selectMode && (
                                <button onClick={() => toggleSelected(wod.id)} className="mt-0.5 shrink-0" title="Sélectionner ce WOD">
                                  {selectedIds.includes(wod.id)
                                    ? <CheckSquare size={13} className="text-white" />
                                    : <Square size={13} className="text-gray-600" />}
                                </button>
                              )}
                              <p className="text-xs font-bold text-white truncate">{wod.title}</p>
                            </div>
                            {wod.description && <p className="text-[10px] text-gray-500 truncate mt-0.5">{wod.description}</p>}
                            <div className="mt-1">
                              <RestrictionBadges
                                compact
                                groupIds={wodGroupMap[wod.id] ?? []}
                                programIds={wodProgramMap[wod.id] ?? []}
                                groups={refGroups}
                                programs={refPrograms}
                              />
                            </div>
                            <div className="flex items-center gap-0.5 mt-2 pt-1.5 border-t border-white/5">
                              <button onClick={() => moveWodToDay(wod, 'prev')} className="p-1 rounded-lg hover:bg-white/10 transition-colors" title="Jour précédent">
                                <ArrowLeft size={11} className="text-gray-400" />
                              </button>
                              <button onClick={() => moveWodToDay(wod, 'next')} className="p-1 rounded-lg hover:bg-white/10 transition-colors" title="Jour suivant">
                                <ArrowRight size={11} className="text-gray-400" />
                              </button>
                              {dayWODs.length > 1 && (
                                <>
                                  <button onClick={() => moveWod(iso, wi, 'up')} disabled={wi === 0} className="p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-25" title="Monter">
                                    <ChevronUp size={11} className="text-gray-400" />
                                  </button>
                                  <button onClick={() => moveWod(iso, wi, 'down')} disabled={wi === dayWODs.length - 1} className="p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-25" title="Descendre">
                                    <ChevronDown size={11} className="text-gray-400" />
                                  </button>
                                </>
                              )}
                              <button onClick={() => togglePublish(wod)} className="p-1 rounded-lg hover:bg-white/10 transition-colors" title={wod.is_published ? 'Dépublier' : 'Publier'}>
                                {wod.is_published ? <Eye size={11} className="text-emerald-400" /> : <EyeOff size={11} className="text-gray-500" />}
                              </button>
                              <button onClick={() => openEdit(wod)} className="p-1 rounded-lg hover:bg-white/10 transition-colors">
                                <Pencil size={11} className="text-white" />
                              </button>
                              <button onClick={() => deleteWOD(wod)} className="p-1 rounded-lg hover:bg-red-500/10 transition-colors">
                                <Trash2 size={11} className="text-red-400" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      <button onClick={() => openCreate(iso)} className="w-full py-1.5 text-center text-[10px] text-white font-semibold rounded-lg hover:bg-white/5 transition-colors">
                        <Plus size={10} className="inline mr-0.5 -mt-px" /> Ajouter
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {weekDates.map((d, i) => {
            const iso     = toISO(d);
            const isToday = iso === todayISO;
            const dayWODs = wods.filter(w => w.scheduled_date === iso);
            return (
              <div key={iso} className={`bg-[#111111] border rounded-2xl overflow-hidden ${isToday ? 'border-white/50' : 'border-white/8'}`}>
                {/* Day header */}
                <div className={`flex items-center justify-between px-5 py-3 ${isToday ? 'bg-white/20' : ''}`}>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-black ${isToday ? 'text-white' : 'text-gray-400'}`}>
                      {DAY_LABELS[i]}
                    </span>
                    <span className={`text-sm font-bold ${isToday ? 'text-white' : 'text-gray-300'}`}>
                      {d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </span>
                    {isToday && (
                      <span className="text-[10px] font-black text-white bg-white/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Aujourd'hui
                      </span>
                    )}
                    <span className="text-xs text-gray-600">{dayWODs.length > 0 ? `${dayWODs.length} WOD${dayWODs.length > 1 ? 's' : ''}` : ''}</span>
                  </div>
                  <button
                    onClick={() => openCreate(iso)}
                    className="flex items-center gap-1.5 text-xs text-white hover:text-white font-semibold transition-colors"
                  >
                    <Plus size={14} /> Ajouter
                  </button>
                </div>

                {/* WODs list */}
                {dayWODs.length === 0 ? (
                  <button
                    onClick={() => openCreate(iso)}
                    className="w-full flex items-center justify-center gap-2 py-5 text-sm text-gray-600 hover:text-gray-400 border-t border-white/5 transition-colors"
                  >
                    <Dumbbell size={14} /> Aucun WOD — cliquez pour en ajouter
                  </button>
                ) : (
                  <div className="border-t border-white/5 divide-y divide-white/5">
                    {dayWODs.map((wod, wi) => {
                      const wt = wod.wod_type ?? '';
                      const color = TYPE_COLOR[wt] ?? '#6B7280';
                      return (
                        <div key={wod.id} className={`flex items-center gap-4 px-5 py-3.5 ${!wod.is_published ? 'opacity-60' : ''}`}>
                          <div className="flex flex-col gap-0.5 shrink-0">
                            <button onClick={() => moveWod(iso, wi, 'up')} disabled={wi === 0 || dayWODs.length < 2} className="p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-25" title="Monter">
                              <ChevronUp size={14} className="text-gray-400" />
                            </button>
                            <button onClick={() => moveWod(iso, wi, 'down')} disabled={wi === dayWODs.length - 1 || dayWODs.length < 2} className="p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-25" title="Descendre">
                              <ChevronDown size={14} className="text-gray-400" />
                            </button>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => moveWodToDay(wod, 'prev')} className="p-1 rounded-lg hover:bg-white/10 transition-colors" title="Jour précédent">
                              <ArrowLeft size={14} className="text-gray-400" />
                            </button>
                            <button onClick={() => moveWodToDay(wod, 'next')} className="p-1 rounded-lg hover:bg-white/10 transition-colors" title="Jour suivant">
                              <ArrowRight size={14} className="text-gray-400" />
                            </button>
                          </div>
                          <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: wod.block_name ? (BLOCK_COLOR[wod.block_name] ?? color) : color }} />
                          {selectMode && (
                            <button onClick={() => toggleSelected(wod.id)} className="shrink-0 mr-1" title="Sélectionner ce WOD">
                              {selectedIds.includes(wod.id)
                                ? <CheckSquare size={16} className="text-white" />
                                : <Square size={16} className="text-gray-600" />}
                            </button>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              {wod.block_name && (
                                <span className="text-[10px] font-black tracking-wider px-1.5 py-0.5 rounded" style={{ backgroundColor: `${BLOCK_COLOR[wod.block_name]}20`, color: BLOCK_COLOR[wod.block_name] }}>
                                  {BLOCK_LABEL[wod.block_name]}
                                </span>
                              )}
                              {wt && (
                                <span className="text-[10px] font-black tracking-wider" style={{ color }}>
                                  {wt.toUpperCase()}
                                </span>
                              )}
                              {wod.video_url && (
                                <span className="text-[9px] font-black text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-0.5">
                                  <Video size={9} /> Vidéo
                                </span>
                              )}
                              {!wod.is_published && (
                                <span className="text-[9px] font-black text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                  Brouillon
                                </span>
                              )}
                              <RestrictionBadges
                                groupIds={wodGroupMap[wod.id] ?? []}
                                programIds={wodProgramMap[wod.id] ?? []}
                                groups={refGroups}
                                programs={refPrograms}
                              />
                            </div>
                            <p className="text-sm font-bold text-white truncate">{wod.title}</p>
                            {wod.description && (
                              <p className="text-xs text-gray-500 truncate mt-0.5">{wod.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {wod.time_cap_seconds && (
                              <span className="text-xs text-gray-600 mr-2">{formatCap(wod.time_cap_seconds)}</span>
                            )}
                            <button
                              onClick={() => togglePublish(wod)}
                              title={wod.is_published ? 'Dépublier' : 'Publier'}
                              className="p-2 rounded-xl hover:bg-white/5 transition-colors"
                            >
                              {wod.is_published
                                ? <Eye size={15} className="text-emerald-400" />
                                : <EyeOff size={15} className="text-gray-500" />}
                            </button>
                            <button onClick={() => openEdit(wod)} className="p-2 rounded-xl hover:bg-white/5 transition-colors">
                              <Pencil size={14} className="text-white" />
                            </button>
                            <button onClick={() => deleteWOD(wod)} className="p-2 rounded-xl hover:bg-red-500/10 transition-colors">
                              <Trash2 size={14} className="text-red-400" />
                            </button>
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

      {modal && (
        <WodEditor
          mode="whiteboard"
          heading={editWOD ? 'Modifier le WOD' : 'Créer un WOD'}
          submitLabel={editWOD ? 'Enregistrer' : 'Créer le WOD'}
          form={form}
          setForm={setForm}
          movements={movements}
          setMovements={setMovements}
          saving={saving}
          error={formError}
          onClose={() => setModal(false)}
          onSubmit={saveWOD}
          groups={groups}
          programs={boxPrograms}
        />
      )}
    </div>
  );
}
