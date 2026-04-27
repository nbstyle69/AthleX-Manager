'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Plus, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ArrowLeft, ArrowRight, Pencil, Trash2,
  Eye, EyeOff, X, Loader2, Dumbbell, Upload, Download, FileText, Calendar, LayoutGrid, List, Video,
} from 'lucide-react';
import { getMyBox } from '@/lib/getMyBox';
import { useRef } from 'react';

type WodType = 'for-time' | 'amrap' | 'emom' | 'tabata' | 'strength' | 'custom';

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

const WOD_TYPES: { value: WodType; label: string; color: string }[] = [
  { value: 'for-time', label: 'For Time',  color: '#EF4444' },
  { value: 'amrap',    label: 'AMRAP',     color: '#3B82F6' },
  { value: 'emom',     label: 'EMOM',      color: '#8B5CF6' },
  { value: 'tabata',   label: 'Tabata',    color: '#F59E0B' },
  { value: 'strength', label: 'Force',     color: '#16A34A' },
  { value: 'custom',   label: 'Custom',    color: '#6B7280' },
];

const TYPE_COLOR: Record<string, string> = Object.fromEntries(WOD_TYPES.map(t => [t.value, t.color]));

type BlockType = 'skill-gym' | 'skill-haltero' | 'wod' | 'pre-wod' | 'post-wod' | '';
const BLOCKS: { value: string; label: string; color: string }[] = [
  { value: 'skill-gym',     label: 'Skill GYM',     color: '#06B6D4' },
  { value: 'skill-haltero', label: 'Skill Halt\u00e9ro',  color: '#F97316' },
  { value: 'wod',           label: 'WOD',            color: '#EF4444' },
  { value: 'pre-wod',       label: 'Pr\u00e9-WOD',       color: '#22C55E' },
  { value: 'post-wod',      label: 'Post-WOD',      color: '#A855F7' },
];
const BLOCK_COLOR: Record<string, string> = Object.fromEntries(BLOCKS.map(b => [b.value, b.color]));
const BLOCK_LABEL: Record<string, string> = Object.fromEntries(BLOCKS.map(b => [b.value, b.label]));

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

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

const EMPTY = { title: '', description: '', wod_type: '' as string, block: '' as string, date: '', timeCap: '', rounds: '', notes: '', videoUrl: '', published: true, leaderboard: true, groupIds: [] as string[], programIds: [] as string[], publishMode: 'now' as 'now' | 'scheduled', publishHour: '06', publishMin: '00', emomInterval: '1', tabataWork: '20', tabataRest: '10' };

export default function WODsPage() {
  const supabase = createClient();

  const [wods,       setWods]      = useState<BoxWOD[]>([]);
  const [loading,    setLoading]   = useState(true);
  const [weekOffset, setWeek]      = useState(0);
  const [boxId,      setBoxId]     = useState<string | null>(null);
  const [userId,     setUserId]    = useState<string | null>(null);

  const [modal,       setModal]       = useState(false);
  const [editWOD,     setEditWOD]     = useState<BoxWOD | null>(null);
  const [form,        setForm]        = useState(EMPTY);
  const [saving,      setSaving]      = useState(false);
  const [formError,   setFormError]   = useState<string | null>(null);
  const [importing,   setImporting]   = useState(false);
  const [importResult, setImportResult] = useState<{ ok: number; errors: string[] } | null>(null);

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
  const [groups, setGroups] = useState<{ id: string; name: string; color: string }[]>([]);
  const [wodGroupMap, setWodGroupMap] = useState<Record<string, string[]>>({});
  const [boxPrograms, setBoxPrograms] = useState<{ id: string; title: string; type: string }[]>([]);
  const [wodProgramMap, setWodProgramMap] = useState<Record<string, string[]>>({});

  const weekDates = getWeekDates(weekOffset);
  const todayISO  = toISO(new Date());

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const box = await getMyBox(supabase, user.id);
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

  function openCreate(date: string) {
    setEditWOD(null);
    setForm({ ...EMPTY, date });
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
      title: wod.title, description: wod.description ?? '',
      wod_type: wod.wod_type ?? '', block: wod.block_name ?? '',
      date: wod.scheduled_date,
      timeCap: wod.time_cap_seconds ? String(Math.floor(wod.time_cap_seconds / 60)) : '',
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
    setFormError(null);
    setModal(true);
  }

  async function saveWOD() {
    if (!form.title.trim() || !form.date || !boxId || !userId) return;
    setSaving(true); setFormError(null);
    const payload = {
      box_id: boxId, created_by: userId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      wod_type: form.wod_type || null,
      block_name: form.block || null,
      scheduled_date: form.date,
      time_cap_seconds: form.timeCap ? parseInt(form.timeCap) * 60 : null,
      rounds: form.rounds ? parseInt(form.rounds) : null,
      notes: form.notes.trim() || null,
      video_url: form.videoUrl.trim() || null,
      is_published: form.published,
      leaderboard_enabled: form.leaderboard,
      publish_at: form.published && form.publishMode === 'scheduled'
        ? `${form.date}T${form.publishHour.padStart(2,'0')}:${form.publishMin.padStart(2,'0')}:00`
        : null,
      emom_interval_minutes: form.wod_type === 'emom'
        ? Math.min(5, Math.max(1, parseInt(form.emomInterval) || 1))
        : null,
      tabata_work_seconds: form.wod_type === 'tabata'
        ? Math.max(5, parseInt(form.tabataWork) || 20)
        : null,
      tabata_rest_seconds: form.wod_type === 'tabata'
        ? Math.max(0, parseInt(form.tabataRest) || 10)
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

    // Save group access
    if (wodId) {
      await supabase.from('wod_group_access').delete().eq('wod_id', wodId);
      if (form.groupIds.length > 0) {
        await supabase.from('wod_group_access').insert(
          form.groupIds.map(gid => ({ wod_id: wodId, group_id: gid }))
        );
      }
      // Save program access
      await supabase.from('wod_program_access').delete().eq('wod_id', wodId);
      if (form.programIds.length > 0) {
        await supabase.from('wod_program_access').insert(
          form.programIds.map(pid => ({ wod_id: wodId, program_id: pid }))
        );
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

  async function deleteWOD(wod: BoxWOD) {
    if (!confirm(`Supprimer "${wod.title}" ?`)) return;
    await supabase.from('box_wods').delete().eq('id', wod.id);
    load();
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
    const headers = ['date','title','type','description','time_cap_min','rounds','notes','published'];
    const rows = wods.map(w => [
      w.scheduled_date,
      `"${(w.title ?? '').replace(/"/g, '""')}"`,
      w.wod_type,
      `"${(w.description ?? '').replace(/"/g, '""')}"`,
      w.time_cap_seconds ? String(Math.floor(w.time_cap_seconds / 60)) : '',
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
  //   block     = skill-gym | skill-haltero | wod | pre-wod | post-wod  (optionnel)
  //   published = true/false  (défaut true)
  //   rank      = true/false  (défaut true) → leaderboard_enabled
  //   groups    = noms séparés par | (ex: Compétiteurs|CrossFit Avancé) — vide = visible par tous
  function downloadTemplate() {
    const headers = 'date,title,type,description,timecap,rounds,notes,block,published,rank,groups';
    const examples = [
      `2026-03-10,Fran,for-time,"21-15-9 Thrusters (43kg) + Pull-ups",20,,"Objectif sub 5min",wod,true,true,Compétiteurs|CrossFit Avancé`,
      `2026-03-10,Front Squat,strength,"5x3 Front Squat @80-85%",,5,"Repos 3min entre séries",skill-haltero,true,false,`,
      `2026-03-11,Cindy,amrap,"5 Pull-ups / 10 Push-ups / 15 Air Squats",20,,"Comptez vos rounds complets",wod,true,true,`,
      `2026-03-12,Karen,for-time,"150 Wall Balls (9kg / cible 3m)",20,,,wod,false,true,Groupe du Matin`,
      `2026-03-13,EMOM 12,emom,"Min 1: 12 Box Jumps | Min 2: 8 Dips | Min 3: 200m Row",12,4,,wod,true,true,`,
    ].join('\n');
    const csv = `${headers}\n${examples}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'template_wods.csv';
    a.click(); URL.revokeObjectURL(url);
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
      const { data, error } = await supabase.functions.invoke('parse-wod-pdf', {
        body: { box_id: boxId, pdf_base64: pdfBase64, default_start_date: defaultStart },
      });
      if (error) throw error;
      const parsed = (data as any)?.wods as ParsedPdfWOD[] | undefined;
      if (!parsed || parsed.length === 0) {
        setImportResult({ ok: 0, errors: ['Aucun WOD détecté dans le PDF.'] });
        return;
      }
      setPdfPreview({ wods: parsed, selected: parsed.map(() => true), inserting: false });
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
    const { error } = await supabase.from('box_wods').insert(payloads);
    if (error) {
      setImportResult({ ok: 0, errors: [error.message] });
    } else {
      setImportResult({ ok: selected.length, errors: [] });
      load();
    }
    setPdfPreview(null);
  }

  // ── CSV / JSON / PDF Import ──────────────────────────────────────────────────────────────
  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !boxId || !userId) return;

    // PDF → IA Claude
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      // reset input so user can re-pick same file
      if (fileInputRef.current) fileInputRef.current.value = '';
      await importPdfWods(file);
      return;
    }

    setImporting(true);
    setImportResult(null);
    const text = await file.text();

    const parseBool = (v: string | undefined | null, fb = true): boolean => {
      if (!v || !v.trim()) return fb;
      const s = v.trim().toLowerCase();
      return !(s === 'false' || s === '0' || s === 'non');
    };

    // --- Parse rows ---
    interface ImportRow {
      date: string; title: string; type: string; description: string;
      timeCap: string; rounds: string; notes: string; block: string;
      published: boolean; rank: boolean; groupNames: string[];
    }
    const rows: ImportRow[] = [];
    const parseErrors: string[] = [];

    if (file.name.endsWith('.json')) {
      try {
        const parsed = JSON.parse(text);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        arr.forEach((r: any, i: number) => {
          if (!r.date || !r.title) { parseErrors.push(`Entrée ${i + 1} ignorée : date ou titre manquant`); return; }
          rows.push({
            date: r.date, title: r.title, type: r.type || 'custom',
            description: r.description || '', timeCap: r.timecap != null ? String(r.timecap) : '',
            rounds: r.rounds != null ? String(r.rounds) : '', notes: r.notes || '',
            block: r.block || '', published: r.published !== false,
            rank: r.rank !== false, groupNames: Array.isArray(r.groups) ? r.groups : [],
          });
        });
      } catch { parseErrors.push('Fichier JSON invalide'); }
    } else {
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) { setImporting(false); return; }
      const dataLines = lines.slice(1);
      for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i];
        const fields: string[] = [];
        let current = ''; let inQuote = false;
        for (let c = 0; c < line.length; c++) {
          const ch = line[c];
          if (ch === '"') { if (inQuote && line[c+1] === '"') { current += '"'; c++; } else { inQuote = !inQuote; } }
          else if ((ch === ',' || ch === ';') && !inQuote) { fields.push(current); current = ''; }
          else { current += ch; }
        }
        fields.push(current);
        const [date, title, type, description, timeCap, rounds, notes, block, published, rank, groups] = fields;
        if (!date?.match(/^\d{4}-\d{2}-\d{2}$/) || !title?.trim()) {
          parseErrors.push(`Ligne ${i + 2} ignorée : date ou titre invalide`);
          continue;
        }
        rows.push({
          date: date.trim(), title: title.trim(), type: type?.trim() || 'custom',
          description: description?.trim() || '', timeCap: timeCap?.trim() || '',
          rounds: rounds?.trim() || '', notes: notes?.trim() || '',
          block: block?.trim() || '', published: parseBool(published),
          rank: parseBool(rank), groupNames: groups ? groups.split('|').map(g => g.trim()).filter(Boolean) : [],
        });
      }
    }

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
    const validTypes = ['for-time','amrap','emom','tabata','strength','custom'];
    let ok = 0;
    const errors = [...parseErrors];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const wodType = validTypes.includes(r.type) ? r.type : 'custom';
      const { data: inserted, error } = await supabase.from('box_wods').insert({
        box_id: boxId, created_by: userId,
        title: r.title, description: r.description || null,
        wod_type: wodType, scheduled_date: r.date,
        time_cap_seconds: r.timeCap ? parseInt(r.timeCap) * 60 : null,
        rounds: r.rounds ? parseInt(r.rounds) : null,
        notes: r.notes || null, block_name: r.block || null,
        is_published: r.published, leaderboard_enabled: r.rank,
      }).select('id').single();
      if (error) { errors.push(`Ligne ${i + 2} : ${error.message}`); continue; }
      ok++;
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

    setImportResult({ ok, errors });
    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (ok > 0) load();
  }

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

  const inp = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#C9A227] transition-colors';

  return (
    <div className="space-y-6">
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
            onClick={() => setLayout(l => l === 'rows' ? 'columns' : 'rows')}
            title={layout === 'rows' ? 'Vue colonnes' : 'Vue lignes'}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-colors"
          >
            {layout === 'rows' ? <LayoutGrid size={13} /> : <List size={13} />}
            {layout === 'rows' ? 'Colonnes' : 'Lignes'}
          </button>
          <button
            onClick={() => openCreate(todayISO)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#C9A227] hover:bg-[#C9A227]/90 text-white text-sm font-bold rounded-xl transition-colors"
          >
            <Plus size={15} /> Nouveau WOD
          </button>
        </div>
      </div>

      {/* PDF AI loading overlay */}
      {pdfAnalyzing && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-[#111111] border border-white/10 rounded-2xl p-8 max-w-sm text-center">
            <Loader2 size={40} className="animate-spin text-[#C9A227] mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white mb-1">Analyse IA en cours…</h3>
            <p className="text-sm text-gray-400">Claude lit ton PDF et extrait les WODs.</p>
            <p className="text-xs text-gray-500 mt-3">Cela peut prendre 10 à 30 secondes.</p>
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
                          <span className="text-[11px] text-gray-500 font-bold">⏱ {Math.floor(wod.time_cap_seconds / 60)} min</span>
                        )}
                        {wod.rounds != null && (
                          <span className="text-[11px] text-gray-500 font-bold">🔁 {wod.rounds} rounds</span>
                        )}
                      </div>
                    </div>
                    <div className="px-4 flex items-center">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        checked ? 'bg-[#C9A227] border-[#C9A227]' : 'border-gray-600'
                      }`}>
                        {checked && <span className="text-black text-xs font-black">✓</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
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
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold bg-[#C9A227] text-black hover:bg-[#b89222] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
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
              ✅ {importResult.ok} WOD{importResult.ok > 1 ? 's' : ''} importé{importResult.ok > 1 ? 's' : ''}
              {importResult.errors.length > 0 && ` — ⚠️ ${importResult.errors.length} erreur(s)`}
            </p>
            <button onClick={() => setImportResult(null)} className="text-gray-500 hover:text-white"><X size={13} /></button>
          </div>
          {importResult.errors.map((e, i) => (
            <p key={i} className="text-xs text-amber-400/80 mt-1">{e}</p>
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
              <Calendar size={14} className="text-gray-500 group-hover:text-[#C9A227] transition-colors" />
              <p className="text-sm font-bold text-white">
                {weekDates[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                {' — '}
                {weekDates[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            {weekOffset === 0 && <p className="text-xs text-[#C9A227] font-semibold mt-0.5">Semaine actuelle</p>}
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
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#C9A227] transition-colors"
              onChange={(e) => { if (e.target.value) jumpToDate(e.target.value); }}
            />
            <div className="flex gap-2 mt-3">
              <button onClick={() => { setWeek(0); setShowDateNav(false); }} className="flex-1 py-2 text-xs font-semibold text-[#C9A227] rounded-xl hover:bg-[#C9A227]/10 transition-colors">
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
            <button onClick={() => setWeek(0)} className="text-xs text-gray-500 hover:text-[#C9A227] font-semibold transition-colors">
              ← Revenir à la semaine actuelle
            </button>
          </div>
        )}
      </div>

      {/* Calendar */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#C9A227]" size={28} /></div>
      ) : layout === 'columns' ? (
        <div className="grid grid-cols-7 gap-2 min-h-[400px]">
          {weekDates.map((d, i) => {
            const iso     = toISO(d);
            const isToday = iso === todayISO;
            const dayWODs = wods.filter(w => w.scheduled_date === iso);
            return (
              <div key={iso} className={`bg-[#111111] border rounded-2xl overflow-hidden flex flex-col ${isToday ? 'border-[#C9A227]/50' : 'border-white/8'}`}>
                <div className={`text-center px-2 py-3 ${isToday ? 'bg-[#C9A227]/20' : ''}`}>
                  <p className={`text-xs font-black ${isToday ? 'text-[#C9A227]' : 'text-gray-400'}`}>{DAY_LABELS[i]}</p>
                  <p className={`text-sm font-bold mt-0.5 ${isToday ? 'text-white' : 'text-gray-300'}`}>
                    {d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </p>
                  {isToday && <span className="text-[9px] font-black text-[#C9A227] mt-0.5 block">Aujourd&#39;hui</span>}
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
                            <p className="text-xs font-bold text-white truncate">{wod.title}</p>
                            {wod.description && <p className="text-[10px] text-gray-500 truncate mt-0.5">{wod.description}</p>}
                            {((wodGroupMap[wod.id] ?? []).length > 0 || (wodProgramMap[wod.id] ?? []).length > 0) && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {(wodGroupMap[wod.id] ?? []).map(gid => {
                                  const g = groups.find(gr => gr.id === gid);
                                  if (!g) return null;
                                  return (
                                    <span key={gid} className="inline-flex items-center gap-0.5 text-[8px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${g.color}20`, color: g.color }}>
                                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: g.color }} />
                                      {g.name}
                                    </span>
                                  );
                                })}
                                {(wodProgramMap[wod.id] ?? []).map(pid => {
                                  const pr = boxPrograms.find(p => p.id === pid);
                                  if (!pr) return null;
                                  const pc = pr.type === 'fixed' ? '#3B82F6' : '#8B5CF6';
                                  return (
                                    <span key={pid} className="inline-flex items-center gap-0.5 text-[8px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${pc}20`, color: pc }}>
                                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: pc }} />
                                      {pr.title}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
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
                                <Pencil size={11} className="text-[#C9A227]" />
                              </button>
                              <button onClick={() => deleteWOD(wod)} className="p-1 rounded-lg hover:bg-red-500/10 transition-colors">
                                <Trash2 size={11} className="text-red-400" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      <button onClick={() => openCreate(iso)} className="w-full py-1.5 text-center text-[10px] text-[#C9A227] font-semibold rounded-lg hover:bg-white/5 transition-colors">
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
              <div key={iso} className={`bg-[#111111] border rounded-2xl overflow-hidden ${isToday ? 'border-[#C9A227]/50' : 'border-white/8'}`}>
                {/* Day header */}
                <div className={`flex items-center justify-between px-5 py-3 ${isToday ? 'bg-[#C9A227]/20' : ''}`}>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-black ${isToday ? 'text-[#C9A227]' : 'text-gray-400'}`}>
                      {DAY_LABELS[i]}
                    </span>
                    <span className={`text-sm font-bold ${isToday ? 'text-white' : 'text-gray-300'}`}>
                      {d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </span>
                    {isToday && (
                      <span className="text-[10px] font-black text-[#C9A227] bg-[#C9A227]/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Aujourd'hui
                      </span>
                    )}
                    <span className="text-xs text-gray-600">{dayWODs.length > 0 ? `${dayWODs.length} WOD${dayWODs.length > 1 ? 's' : ''}` : ''}</span>
                  </div>
                  <button
                    onClick={() => openCreate(iso)}
                    className="flex items-center gap-1.5 text-xs text-[#C9A227] hover:text-[#C9A227] font-semibold transition-colors"
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
                              {(wodGroupMap[wod.id] ?? []).map(gid => {
                                const g = groups.find(gr => gr.id === gid);
                                if (!g) return null;
                                return (
                                  <span key={gid} className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${g.color}20`, color: g.color }}>
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: g.color }} />
                                    {g.name}
                                  </span>
                                );
                              })}
                              {(wodProgramMap[wod.id] ?? []).map(pid => {
                                const pr = boxPrograms.find(p => p.id === pid);
                                if (!pr) return null;
                                const pc = pr.type === 'fixed' ? '#3B82F6' : '#8B5CF6';
                                return (
                                  <span key={pid} className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${pc}20`, color: pc }}>
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: pc }} />
                                    {pr.title}
                                  </span>
                                );
                              })}
                            </div>
                            <p className="text-sm font-bold text-white truncate">{wod.title}</p>
                            {wod.description && (
                              <p className="text-xs text-gray-500 truncate mt-0.5">{wod.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {wod.time_cap_seconds && (
                              <span className="text-xs text-gray-600 mr-2">{Math.floor(wod.time_cap_seconds / 60)} min</span>
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
                              <Pencil size={14} className="text-[#C9A227]" />
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

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#111111] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
              <h2 className="text-lg font-black text-white">{editWOD ? 'Modifier le WOD' : 'Créer un WOD'}</h2>
              <button onClick={() => setModal(false)} className="p-1.5 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {formError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">{formError}</div>
              )}

              {/* Group access */}
              {groups.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Groupes autorisés <span className="text-gray-600 normal-case tracking-normal">(vide = tous les membres)</span></label>
                  <div className="flex flex-wrap gap-2">
                    {groups.map(g => {
                      const selected = form.groupIds.includes(g.id);
                      return (
                        <button key={g.id} type="button"
                          onClick={() => setForm(f => ({
                            ...f,
                            groupIds: selected ? f.groupIds.filter(id => id !== g.id) : [...f.groupIds, g.id],
                          }))}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                            selected
                              ? 'border-transparent scale-105'
                              : 'border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                          }`}
                          style={selected ? { backgroundColor: `${g.color}25`, color: g.color, borderColor: `${g.color}50` } : {}}
                        >
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: g.color }} />
                          {g.name}
                        </button>
                      );
                    })}
                  </div>
                  {form.groupIds.length > 0 && (
                    <p className="text-[11px] text-gray-500 mt-1.5">Seuls les membres de ces groupes verront ce WOD.</p>
                  )}
                </div>
              )}

              {/* Program access */}
              {boxPrograms.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Programmes assignés <span className="text-gray-600 normal-case tracking-normal">(vide = aucun programme)</span></label>
                  <div className="flex flex-wrap gap-2">
                    {boxPrograms.map(p => {
                      const selected = form.programIds.includes(p.id);
                      const pColor = p.type === 'fixed' ? '#3B82F6' : '#8B5CF6';
                      return (
                        <button key={p.id} type="button"
                          onClick={() => setForm(f => ({
                            ...f,
                            programIds: selected ? f.programIds.filter(id => id !== p.id) : [...f.programIds, p.id],
                          }))}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                            selected
                              ? 'border-transparent scale-105'
                              : 'border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                          }`}
                          style={selected ? { backgroundColor: `${pColor}25`, color: pColor, borderColor: `${pColor}50` } : {}}
                        >
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: pColor }} />
                          {p.title}
                        </button>
                      );
                    })}
                  </div>
                  {form.programIds.length > 0 && (
                    <p className="text-[11px] text-gray-500 mt-1.5">Ce WOD apparaîtra dans le whiteboard des membres de ces programmes.</p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Date *</label>
                  <input type="date" className={inp} value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Block</label>
                  <select className={inp} value={form.block}
                    onChange={e => setForm(f => ({ ...f, block: e.target.value }))}>
                    <option value="" className="text-black">— Aucun —</option>
                    {BLOCKS.map(b => <option key={b.value} value={b.value} className="text-black">{b.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Type <span className="text-gray-600 normal-case tracking-normal">(optionnel)</span></label>
                  <select className={inp} value={form.wod_type}
                    onChange={e => setForm(f => ({ ...f, wod_type: e.target.value }))}>
                    <option value="" className="text-black">— Aucun —</option>
                    {WOD_TYPES.map(t => <option key={t.value} value={t.value} className="text-black">{t.label}</option>)}
                  </select>
                </div>
              </div>

              {form.wod_type === 'emom' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Intervalle EMOM</label>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map(v => {
                      const selected = parseInt(form.emomInterval) === v;
                      return (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, emomInterval: String(v) }))}
                          className={`py-2 rounded-lg text-xs font-bold border transition-colors ${
                            selected
                              ? 'bg-[#8B5CF6]/25 text-[#C4B5FD] border-[#8B5CF6]/60'
                              : 'bg-white/5 text-gray-400 border-white/10 hover:text-white hover:border-white/20'
                          }`}
                        >
                          {v === 1 ? 'EMOM' : `E${v}MOM`}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1.5">Un intervalle = {form.emomInterval} min entre chaque départ.</p>
                </div>
              )}

              {form.wod_type === 'tabata' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Travail (sec)</label>
                    <input type="number" min={5} max={300} className={inp} value={form.tabataWork}
                      onChange={e => setForm(f => ({ ...f, tabataWork: e.target.value }))}
                      placeholder="20" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Repos (sec)</label>
                    <input type="number" min={0} max={300} className={inp} value={form.tabataRest}
                      onChange={e => setForm(f => ({ ...f, tabataRest: e.target.value }))}
                      placeholder="10" />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Titre *</label>
                <input className={inp} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Fran, Cindy, Helen…" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Description</label>
                <textarea rows={3} className={`${inp} resize-none`} value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="21-15-9 Thrusters + Pull-ups…" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Time Cap (min)</label>
                  <input type="number" className={inp} value={form.timeCap}
                    onChange={e => setForm(f => ({ ...f, timeCap: e.target.value }))} placeholder="20" min="0" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Rounds <span className="text-gray-600 normal-case tracking-normal">(optionnel)</span></label>
                  <input type="number" className={inp} value={form.rounds}
                    onChange={e => setForm(f => ({ ...f, rounds: e.target.value }))} placeholder="—" min="0" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Notes Coach</label>
                <textarea rows={2} className={`${inp} resize-none`} value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Conseils, scaling options…" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider flex items-center gap-1.5"><Video size={13} className="text-red-400" /> Vidéo YouTube <span className="text-gray-600 normal-case tracking-normal">(optionnel)</span></label>
                <input className={inp} value={form.videoUrl}
                  onChange={e => setForm(f => ({ ...f, videoUrl: e.target.value }))}
                  placeholder="https://www.youtube.com/watch?v=..." />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-white">Publier</p>
                    <p className="text-xs text-gray-500">Visible par les athlètes de la box</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, published: !f.published }))}
                    className={`relative w-11 h-6 rounded-full transition-colors ${form.published ? 'bg-emerald-500' : 'bg-white/10'}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.published ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                {form.published && (
                  <div className="bg-white/5 rounded-xl px-4 py-3 space-y-3">
                    <div className="flex gap-2">
                      {(['now', 'scheduled'] as const).map(mode => (
                        <button key={mode} type="button"
                          onClick={() => setForm(f => ({ ...f, publishMode: mode }))}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${form.publishMode === mode ? 'bg-[#C9A227]/20 text-[#C9A227] border border-[#C9A227]/40' : 'bg-white/5 text-gray-400 border border-white/10 hover:text-white'}`}>
                          {mode === 'now' ? 'Maintenant' : 'Programmer'}
                        </button>
                      ))}
                    </div>
                    {form.publishMode === 'scheduled' && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Heure :</span>
                        <input type="number" min={0} max={23} value={form.publishHour}
                          onChange={e => setForm(f => ({ ...f, publishHour: e.target.value }))}
                          className="w-14 bg-[#0A0A0A] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white text-center focus:outline-none focus:border-[#C9A227]/50" />
                        <span className="text-gray-500 font-bold">:</span>
                        <input type="number" min={0} max={59} value={form.publishMin}
                          onChange={e => setForm(f => ({ ...f, publishMin: e.target.value }))}
                          className="w-14 bg-[#0A0A0A] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white text-center focus:outline-none focus:border-[#C9A227]/50" />
                        <span className="text-[10px] text-gray-600 ml-1">Le WOD sera visible à cette heure le jour programmé</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-white">Classement</p>
                  <p className="text-xs text-gray-500">{form.leaderboard ? 'Les scores sont classés entre membres' : 'Scores enregistrés en historique uniquement'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, leaderboard: !f.leaderboard }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${form.leaderboard ? 'bg-[#C9A227]' : 'bg-white/10'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.leaderboard ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setModal(false)}
                  className="flex-1 py-3 rounded-xl border border-white/10 text-sm text-gray-400 hover:text-white transition-colors">
                  Annuler
                </button>
                <button
                  onClick={saveWOD}
                  disabled={!form.title.trim() || !form.date || saving}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#C9A227] hover:bg-[#C9A227] disabled:opacity-50 text-white text-sm font-bold transition-colors"
                >
                  {saving && <Loader2 size={15} className="animate-spin" />}
                  {editWOD ? 'Enregistrer' : 'Créer le WOD'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
