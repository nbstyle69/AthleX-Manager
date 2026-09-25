'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Loader2, AlertTriangle, Plus, Trash2, RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { messageErreur } from '@/lib/erreurs';
import { BLOCKS, DAY_LABELS, WOD_TYPES, TYPE_COLOR } from '@/lib/wodFields';
import { PROFILES } from '@/lib/pdfImport/profiles';
import { stripWodJson, withWodJson, writeWithWodJsonFallback } from '@/lib/wodJson';
import { entryToBoxWod, validateEntry, hasUnstructuredStrength } from '@/lib/pdfImport/serialize';
import {
  ANCRE_IMPORT_PROGRAMME, caseDepuisDate, dateFictive, entryToProgramWod, rangsParCase, recalerSurSemaine, semainesCouvertes,
} from '@/lib/pdfImport/programme';
import type { ImportEntry, ImportResult, ImportWarning, ParsedMovement, ParsedStrength } from '@/lib/pdfImport/types';
import { assignRestrictions, libelleAssignation } from '@/lib/wodAssignment';
import { RestDay, estJourRepos, rattacherAuProgramme } from '@/lib/programContent';
import { softVar } from '@/lib/colorVars';
import { programColor } from '@/components/wods/RestrictionBadges';
import { countOf } from '@/lib/plural';

/**
 * Import PDF de programmation hebdo (spec v2) : le PDF est analysé côté
 * serveur (`/api/wods/import-pdf`), la preview structurée est éditable carte
 * par carte, puis tout est inséré en un seul lot dans `box_wods`.
 *
 * Deux destinations, une seule preview :
 * - `whiteboard` : daté à partir du lundi choisi, groupes / programmes au choix ;
 * - `program` : semaine × jour relatifs du programme courant, qui est le seul
 *   destinataire possible (pas de groupe, pas d'autre programme).
 */

interface Ref { id: string; name: string; color: string }

export type PdfImportTarget =
  | { kind: 'whiteboard'; defaultWeekStart: string; groups: Ref[]; programs: Ref[] }
  | {
      kind: 'program';
      program: { id: string; title: string; type: 'fixed' | 'ongoing' };
      /** Semaine affichée sur la page Séances : semaine cible par défaut. */
      defaultWeek: number;
      weeksCount: number;
      /** Jours marqués « Repos » par le coach : signalés dans la preview. */
      restDays: readonly RestDay[];
    };

interface Props {
  file: File;
  boxId: string;
  userId: string;
  target: PdfImportTarget;
  onClose: () => void;
  onDone: (r: { ok: number; errors: string[]; notes?: string[] }) => void;
}

type ApiResult = ImportResult & { source_pdf_url: string | null; llm_used: boolean };

const WARNING_LABEL: Record<ImportWarning, string> = {
  'movement-unresolved': 'Mouvement hors catalogue',
  'timecap-unparsed': 'Time cap non lu',
  'level-scale-missing': 'Barème manquant',
  'enum-fallback': 'Format → Custom',
  'charge-order-ambiguous': 'Ordre H/F ambigu',
  'strength-unstructured': 'Muscu non structurée',
  'generic-profile': 'Source générique',
};

const INPUT = 'px-2 py-1.5 rounded-ax-control bg-ax-overlay border border-ax-border text-xs text-ax-text focus:outline-none focus:border-ax-focus';
const ORANGE = 'border-ax-warning bg-ax-warning-soft text-ax-warning';
const NOTES_MIN_ROWS = 3;
const NOTES_MAX_ROWS = 10;

/** Textarea qui suit son contenu entre NOTES_MIN_ROWS et NOTES_MAX_ROWS lignes (scroll interne au-delà). */
function NotesTextarea({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 16;
    const padding = el.offsetHeight - el.clientHeight + (parseFloat(getComputedStyle(el).paddingTop) || 0) + (parseFloat(getComputedStyle(el).paddingBottom) || 0);
    const max = lineHeight * NOTES_MAX_ROWS + padding;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
    el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden';
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={ev => onChange(ev.target.value)}
      rows={NOTES_MIN_ROWS}
      className={`${INPUT} w-full resize-y leading-5`}
      placeholder="Notes coach"
    />
  );
}

function isMonday(iso: string): boolean {
  const d = new Date(`${iso}T00:00:00`);
  return !Number.isNaN(d.getTime()) && d.getDay() === 1;
}

function emptyMovement(): ParsedMovement {
  return { name: '', resolved: false, reps: null, charge_h: null, charge_f: null, note: null };
}

function emptyStrength(): ParsedStrength {
  return { exercise: '', resolved: false, sets: null, reps: null, percent: null, rpe: null, charge_note: null, tempo: null, rest: null };
}

export default function PdfImportModal({ file, boxId, userId, target, onClose, onDone }: Props) {
  const supabase = createClient();
  const isProgram = target.kind === 'program';
  const groups = target.kind === 'whiteboard' ? target.groups : [];
  const programs = target.kind === 'whiteboard' ? target.programs : [];
  // Programme : le lundi envoyé au cœur est un ancrage fictif, relu en semaine × jour.
  const [weekStart, setWeekStart] = useState(target.kind === 'whiteboard' ? target.defaultWeekStart : ANCRE_IMPORT_PROGRAMME);
  const [semaineCible, setSemaineCible] = useState(target.kind === 'program' ? target.defaultWeek : 1);
  const [forcedProfile, setForcedProfile] = useState<string>('');
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [entries, setEntries] = useState<ImportEntry[]>([]);
  const [keep, setKeep] = useState<Record<string, boolean>>({});
  const [destGroups, setDestGroups] = useState<string[]>([]);
  const [destPrograms, setDestPrograms] = useState<string[]>([]);
  const [inserting, setInserting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const profileLabel = useMemo(() => Object.fromEntries(PROFILES.map(p => [p.slug, p.label])), []);

  async function analyze(profileSlug: string) {
    if (!isMonday(weekStart)) { setError('La date de début doit être un lundi.'); return; }
    setAnalyzing(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set('box_id', boxId);
      fd.set('week_start', weekStart);
      fd.set('pdf', file);
      if (profileSlug) fd.set('profile', profileSlug);
      const res = await fetch('/api/wods/import-pdf', { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      const r = json as ApiResult;
      setResult(r);
      setEntries(isProgram ? recalerSurSemaine(r.entries, semaineCible) : r.entries);
      setKeep(Object.fromEntries(r.entries.map(e => [e.key, true])));
      setForcedProfile(r.source_profile);
      setFieldErrors({});
      // Groupes par défaut du profil (par nom) ; programmes vides par défaut (spec §11).
      const wanted = new Set(r.entries.flatMap(e => e.groups));
      setDestGroups(groups.filter(g => wanted.has(g.name)).map(g => g.id));
      setDestPrograms([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analyse impossible');
    } finally {
      setAnalyzing(false);
    }
  }

  useEffect(() => { void analyze(''); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function patch(key: string, p: Partial<ImportEntry>) {
    setEntries(prev => prev.map(e => (e.key === key ? { ...e, ...p } : e)));
  }
  function patchMovement(key: string, i: number, p: Partial<ParsedMovement> | null) {
    setEntries(prev => prev.map(e => {
      if (e.key !== key) return e;
      const movements = p === null ? e.movements.filter((_, j) => j !== i) : e.movements.map((m, j) => (j === i ? { ...m, ...p } : m));
      return { ...e, movements };
    }));
  }
  function patchStrength(key: string, i: number, p: Partial<ParsedStrength> | null) {
    setEntries(prev => prev.map(e => {
      if (e.key !== key) return e;
      const musculation = p === null ? e.musculation.filter((_, j) => j !== i) : e.musculation.map((m, j) => (j === i ? { ...m, ...p } : m));
      return { ...e, musculation };
    }));
  }

  /** Programme : changer la semaine cible décale toutes les cartes d'un bloc. */
  function changerSemaineCible(next: number) {
    const cible = Math.max(1, next);
    const delta = cible - semaineCible;
    setSemaineCible(cible);
    if (delta !== 0) {
      setEntries(prev => prev.map(e => {
        const c = caseDepuisDate(e.date);
        return { ...e, date: dateFictive(Math.max(1, c.week + delta), c.day) };
      }));
    }
  }

  const selected = entries.filter(e => keep[e.key]);
  const isGeneric = result?.source_profile === 'generic';
  const semaines = isProgram ? semainesCouvertes(entries) : [];
  const semainesProposees = target.kind === 'program'
    ? Array.from({ length: Math.max(target.weeksCount, ...semaines, semaineCible) + (target.program.type === 'ongoing' ? 12 : 0) }, (_, i) => i + 1)
    : [];

  async function insertAll() {
    if (target.kind === 'program') { await insertProgramme(target); return; }
    if (!result || selected.length === 0) return;
    const errs: Record<string, string[]> = {};
    for (const e of selected) {
      const v = validateEntry(e);
      if (v.length) errs[e.key] = v;
    }
    setFieldErrors(errs);
    if (Object.keys(errs).length) { setError(`${countOf(Object.keys(errs).length, 'carte', 'cartes')} à corriger avant insertion.`); return; }

    setInserting(true);
    setError(null);
    const perDay: Record<string, number> = {};
    const rows = selected.map(e => {
      const n = perDay[e.date] ?? 0;
      perDay[e.date] = n + 1;
      return withWodJson(entryToBoxWod(e, { boxId, userId, sourcePdfUrl: result.source_pdf_url, sortOrder: n }));
    });
    const { data: inserted, error: insErr } = await writeWithWodJsonFallback(inc =>
      supabase.from('box_wods').insert(inc ? rows : stripWodJson(rows)).select('id'));
    if (insErr) {
      setInserting(false);
      setError(`Insertion refusée (aucun WOD créé) : ${insErr.message}`);
      return;
    }
    const ids = (inserted ?? []).map(r => r.id as string);
    const notes: string[] = [];
    const errors: string[] = [];
    if (ids.length && (destGroups.length || destPrograms.length)) {
      try {
        await assignRestrictions(ids, destGroups, destPrograms, 'ajouter');
        notes.push(libelleAssignation(ids.length, {
          groupes: destGroups.map(id => groups.find(g => g.id === id)?.name ?? id),
          programmes: destPrograms.map(id => programs.find(p => p.id === id)?.name ?? id),
        }, 'ajouter'));
      } catch (e) {
        errors.push(`WOD importés, mais l'assignation a échoué : ${messageErreur(e)}`);
      }
    } else if (ids.length) {
      notes.push('Aucune restriction choisie : ces WOD sont visibles par toute la box.');
    }
    if (result.unresolved_movements.length) {
      notes.push(`Mouvements hors catalogue conservés tels quels : ${result.unresolved_movements.join(', ')}.`);
    }
    onDone({ ok: ids.length, errors, notes });
  }

  async function insertProgramme(t: Extract<PdfImportTarget, { kind: 'program' }>) {
    if (!result || selected.length === 0) return;
    const errs: Record<string, string[]> = {};
    for (const e of selected) {
      const v = validateEntry(e);
      if (v.length) errs[e.key] = v;
    }
    setFieldErrors(errs);
    if (Object.keys(errs).length) { setError(`${countOf(Object.keys(errs).length, 'carte', 'cartes')} à corriger avant insertion.`); return; }
    if (t.program.type === 'fixed' && selected.some(e => caseDepuisDate(e.date).week > t.weeksCount)) {
      setError(`Le programme dure ${countOf(t.weeksCount, 'semaine', 'semaines')} : une carte vise une semaine au-delà.`);
      return;
    }

    setInserting(true);
    setError(null);
    const rangs = rangsParCase(selected);
    const rows = selected.map((e, i) => withWodJson(entryToProgramWod(e, { boxId, userId, sourcePdfUrl: result.source_pdf_url, sortOrder: rangs[i] })));
    const { data: inserted, error: insErr } = await writeWithWodJsonFallback(inc =>
      supabase.from('box_wods').insert(inc ? rows : stripWodJson(rows)).select('id'));
    if (insErr) {
      setInserting(false);
      setError(`Insertion refusée (aucune séance créée) : ${insErr.message}`);
      return;
    }
    const ids = (inserted ?? []).map(r => r.id as string);
    try {
      await rattacherAuProgramme(ids, t.program.id);
    } catch (e) {
      setInserting(false);
      setError(`Rattachement au programme refusé (séances retirées) : ${messageErreur(e)}`);
      return;
    }
    const couvertes = semainesCouvertes(selected);
    const notes = [`${countOf(ids.length, 'séance rattachée', 'séances rattachées')} à « ${t.program.title} », ${couvertes.length > 1 ? 'semaines' : 'semaine'} ${couvertes.join(', ')}.`];
    if (result.unresolved_movements.length) {
      notes.push(`Mouvements hors catalogue conservés tels quels : ${result.unresolved_movements.join(', ')}.`);
    }
    onDone({ ok: ids.length, errors: [], notes });
  }

  return (
    <div className="fixed inset-0 z-50 bg-ax-overlay backdrop-blur-ax-glass flex items-center justify-center p-4">
      <div className="bg-ax-surface border border-ax-border rounded-ax-card w-full max-w-5xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-ax-border">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-ax-text [overflow-wrap:anywhere]">Import PDF — {file.name}</h3>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              {target.kind === 'whiteboard' ? (
                <label className="text-xs text-ax-text-secondary flex items-center gap-2">
                  Lundi de la semaine
                  <input type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)} className={INPUT} disabled={analyzing || inserting} />
                </label>
              ) : (
                <label className="text-xs text-ax-text-secondary flex items-center gap-2">
                  Semaine cible
                  <select value={semaineCible} onChange={e => changerSemaineCible(parseInt(e.target.value, 10))} className={INPUT} disabled={analyzing || inserting} data-testid="semaine-cible">
                    {semainesProposees.map(w => <option key={w} value={w}>Semaine {w}{target.program.type === 'fixed' ? ` / ${target.weeksCount}` : ''}</option>)}
                  </select>
                </label>
              )}
              <label className="text-xs text-ax-text-secondary flex items-center gap-2">
                Source
                <select value={forcedProfile} onChange={e => setForcedProfile(e.target.value)} className={INPUT} disabled={analyzing || inserting}>
                  {PROFILES.map(p => <option key={p.slug} value={p.slug}>{p.label}</option>)}
                </select>
              </label>
              <button
                onClick={() => void analyze(forcedProfile)}
                disabled={analyzing || inserting}
                className="text-xs font-bold px-3 py-1.5 rounded-ax-control border border-ax-border text-ax-text hover:text-ax-text hover:border-ax-input-border disabled:opacity-40 flex items-center gap-1.5"
              >
                {analyzing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Ré-analyser
              </button>
              {result && (
                <span className="text-[11px] text-ax-text-muted">
                  Détecté : <span className="text-ax-text-secondary font-bold">{profileLabel[result.source_profile] ?? result.source_profile}</span>
                  {Object.entries(result.detected_scores).map(([k, v]) => ` · ${k} ${Math.round(v * 100)}%`).join('')}
                  {result.llm_used && ' · découpage IA (Haiku)'}
                </span>
              )}
            </div>
          </div>
          <button onClick={() => !inserting && onClose()} disabled={inserting} className="text-ax-text-muted hover:text-ax-text disabled:opacity-40"><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {error && (
            <div className="flex items-start gap-2 text-xs text-ax-danger bg-ax-danger-soft border border-ax-danger rounded-ax-control px-3 py-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {error}
            </div>
          )}
          {isGeneric && result && (
            <div className={`flex items-start gap-2 text-xs rounded-ax-control px-3 py-2 border ${ORANGE}`}>
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              Source non reconnue : découpage générique, ordre des charges H/F incertain — vérifie chaque carte avant d&apos;insérer.
            </div>
          )}
          {isProgram && result && semaines.length > 1 && (
            <div className="text-xs text-ax-text-secondary bg-ax-surface-secondary border border-ax-border rounded-ax-control px-3 py-2">
              Le document couvre {semaines.length} semaines : elles sont posées en semaines {semaines.join(', ')} du programme
              (semaine cible = première semaine du document). Ajuste la semaine et le jour carte par carte si besoin.
            </div>
          )}
          {result?.week_notes && (
            <div className="text-xs text-ax-text-secondary bg-ax-surface-secondary border border-ax-border rounded-ax-control px-3 py-2 whitespace-pre-line">
              <span className="text-[10px] font-black uppercase tracking-wider text-ax-text-muted block mb-1">Notes de la semaine</span>
              {result.week_notes}
            </div>
          )}
          {analyzing && !result && (
            <div className="py-16 text-center text-sm text-ax-text-secondary flex flex-col items-center gap-3">
              <Loader2 size={32} className="animate-spin text-ax-text" /> Analyse du PDF…
            </div>
          )}
          {result && entries.length === 0 && <p className="text-sm text-ax-text-secondary py-8 text-center">Aucun WOD détecté dans ce PDF.</p>}

          {entries.map(e => {
            const warnings = [...e.warnings];
            if (hasUnstructuredStrength(e) && !warnings.includes('strength-unstructured')) warnings.push('strength-unstructured');
            const orange = warnings.length > 0;
            const checked = keep[e.key];
            const errs = fieldErrors[e.key] ?? [];
            return (
              <div key={e.key} className={`rounded-ax-control border ${errs.length ? 'border-ax-danger' : orange ? 'border-ax-warning' : 'border-ax-border'} ${checked ? '' : 'opacity-50'} bg-ax-surface`}>
                <div className="flex items-center gap-2 px-3 py-2 border-b border-ax-border">
                  <input type="checkbox" checked={checked} onChange={ev => setKeep(k => ({ ...k, [e.key]: ev.target.checked }))} className="accent-ax-accent-text" />
                  {target.kind === 'whiteboard' ? (
                    <input type="date" value={e.date} onChange={ev => patch(e.key, { date: ev.target.value })} className={INPUT} />
                  ) : (() => {
                    const c = caseDepuisDate(e.date);
                    const repos = estJourRepos(target.restDays, c.week, c.day);
                    return (
                      <>
                        <select value={c.week} onChange={ev => patch(e.key, { date: dateFictive(parseInt(ev.target.value, 10), c.day) })} className={INPUT} title="Semaine du programme">
                          {semainesProposees.map(w => <option key={w} value={w}>S{w}</option>)}
                        </select>
                        <select value={c.day} onChange={ev => patch(e.key, { date: dateFictive(c.week, parseInt(ev.target.value, 10)) })} className={`${INPUT} ${repos ? ORANGE : ''}`} title={repos ? 'Jour de repos du programme' : 'Jour du programme'}>
                          {DAY_LABELS.map((d, i) => <option key={d} value={i + 1}>{d}{estJourRepos(target.restDays, c.week, i + 1) ? ' (repos)' : ''}</option>)}
                        </select>
                      </>
                    );
                  })()}
                  <input value={e.title} onChange={ev => patch(e.key, { title: ev.target.value })} className={`${INPUT} flex-1 font-bold`} placeholder="Titre" />
                  <select value={e.block ?? ''} onChange={ev => patch(e.key, { block: (ev.target.value || null) as ImportEntry['block'] })} className={INPUT}>
                    <option value="">Block…</option>
                    {BLOCKS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                  </select>
                  <select value={e.type ?? ''} onChange={ev => patch(e.key, { type: (ev.target.value || null) as ImportEntry['type'] })} className={INPUT} style={{ color: TYPE_COLOR[e.type ?? ''] }}>
                    <option value="">Type…</option>
                    {WOD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <span className="text-[10px] text-ax-text-muted shrink-0">p.{e.source_page}</span>
                </div>

                <div className="px-3 py-2 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="text-[11px] text-ax-text-secondary flex items-center gap-1">TC
                      <input value={e.timecap ?? ''} onChange={ev => patch(e.key, { timecap: ev.target.value || null })} className={`${INPUT} w-20 ${warnings.includes('timecap-unparsed') ? ORANGE : ''}`} placeholder="MM:SS" />
                    </label>
                    <label className="text-[11px] text-ax-text-secondary flex items-center gap-1">Rounds
                      <input value={e.rounds ?? ''} onChange={ev => patch(e.key, { rounds: ev.target.value ? parseInt(ev.target.value, 10) : null })} className={`${INPUT} w-14`} />
                    </label>
                    {e.type === 'emom' && (
                      <label className="text-[11px] text-ax-text-secondary flex items-center gap-1">Toutes les (min)
                        <input value={e.emom_interval_minutes ?? ''} onChange={ev => patch(e.key, { emom_interval_minutes: ev.target.value ? parseInt(ev.target.value, 10) : null })} className={`${INPUT} w-12`} />
                      </label>
                    )}
                    {e.type === 'tabata' && (
                      <label className="text-[11px] text-ax-text-secondary flex items-center gap-1">Work/Rest (s)
                        <input value={e.tabata_work_seconds ?? ''} onChange={ev => patch(e.key, { tabata_work_seconds: ev.target.value ? parseInt(ev.target.value, 10) : null })} className={`${INPUT} w-12`} />
                        <input value={e.tabata_rest_seconds ?? ''} onChange={ev => patch(e.key, { tabata_rest_seconds: ev.target.value ? parseInt(ev.target.value, 10) : null })} className={`${INPUT} w-12`} />
                      </label>
                    )}
                    <label className="text-[11px] text-ax-text-secondary flex items-center gap-1">
                      <input type="checkbox" checked={e.rank} onChange={ev => patch(e.key, { rank: ev.target.checked })} className="accent-ax-accent-text" /> Classement
                    </label>
                  </div>

                  <div className="space-y-1.5">
                    {e.musculation.length > 0 && <p className="text-[10px] font-black uppercase tracking-wider text-ax-text-muted">Musculation</p>}
                    {e.musculation.map((s, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <input value={s.exercise} onChange={ev => patchStrength(e.key, i, { exercise: ev.target.value, resolved: false })} className={`${INPUT} flex-1 ${s.resolved ? '' : ORANGE}`} placeholder="Exercice" title={s.resolved ? '' : 'Hors catalogue — conservé tel quel'} />
                        <input value={s.sets ?? ''} onChange={ev => patchStrength(e.key, i, { sets: ev.target.value ? parseInt(ev.target.value, 10) : null })} className={`${INPUT} w-12`} placeholder="Sér." />
                        <span className="text-ax-text-muted text-xs">×</span>
                        <input value={s.reps ?? ''} onChange={ev => patchStrength(e.key, i, { reps: ev.target.value ? parseInt(ev.target.value, 10) : null })} className={`${INPUT} w-12`} placeholder="Reps" />
                        <input value={s.percent ?? ''} onChange={ev => patchStrength(e.key, i, { percent: ev.target.value ? parseFloat(ev.target.value) : null })} className={`${INPUT} w-14`} placeholder="%1RM" />
                        <input value={s.rpe ?? s.charge_note ?? ''} onChange={ev => patchStrength(e.key, i, { charge_note: ev.target.value || null, rpe: null })} className={`${INPUT} w-24`} placeholder="RPE / note" />
                        <button onClick={() => patchStrength(e.key, i, null)} className="text-ax-text-muted hover:text-ax-danger"><Trash2 size={12} /></button>
                      </div>
                    ))}
                    {e.movements.length > 0 && <p className="text-[10px] font-black uppercase tracking-wider text-ax-text-muted pt-1">Mouvements</p>}
                    {e.movements.map((m, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <input value={m.reps ?? ''} onChange={ev => patchMovement(e.key, i, { reps: ev.target.value || null })} className={`${INPUT} w-32 shrink-0`} placeholder="Reps" title={m.reps ?? ''} />
                        <input value={m.name} onChange={ev => patchMovement(e.key, i, { name: ev.target.value, resolved: false })} className={`${INPUT} flex-[2] min-w-0 ${m.resolved ? '' : ORANGE}`} placeholder="Mouvement" title={m.resolved ? '' : 'Hors catalogue — conservé tel quel'} />
                        <input value={m.charge_h ?? ''} onChange={ev => patchMovement(e.key, i, { charge_h: ev.target.value || null })} className={`${INPUT} w-16`} placeholder="♂" />
                        <input value={m.charge_f ?? ''} onChange={ev => patchMovement(e.key, i, { charge_f: ev.target.value || null })} className={`${INPUT} w-16`} placeholder="♀" />
                        <input value={m.note ?? ''} onChange={ev => patchMovement(e.key, i, { note: ev.target.value || null })} className={`${INPUT} flex-1 min-w-0`} placeholder="Note" title={m.note ?? ''} />
                        <button onClick={() => patchMovement(e.key, i, null)} className="text-ax-text-muted hover:text-ax-danger"><Trash2 size={12} /></button>
                      </div>
                    ))}
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => patch(e.key, { movements: [...e.movements, emptyMovement()] })} className="text-[11px] text-ax-text-secondary hover:text-ax-text flex items-center gap-1"><Plus size={11} /> mouvement</button>
                      <button onClick={() => patch(e.key, { musculation: [...e.musculation, emptyStrength()] })} className="text-[11px] text-ax-text-secondary hover:text-ax-text flex items-center gap-1"><Plus size={11} /> muscu</button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-wider text-ax-text-muted">Notes coach</p>
                    <NotesTextarea value={e.notes_coach} onChange={v => patch(e.key, { notes_coach: v })} />
                    {(warnings.length > 0 || errs.length > 0) && (
                      <div className="flex flex-wrap gap-1">
                        {warnings.map(w => <span key={w} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-ax-badge border ${ORANGE}`}>{WARNING_LABEL[w]}</span>)}
                        {errs.map(er => <span key={er} className="text-[10px] font-bold px-1.5 py-0.5 rounded-ax-badge border border-ax-danger bg-ax-danger-soft text-ax-danger">{er}</span>)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Destinataires — Programme : verrouillé sur le programme courant. */}
        {result && target.kind === 'program' && (
          <div className="px-6 py-3 border-t border-ax-border space-y-2" data-testid="destinataire-verrouille">
            <p className="text-xs font-black uppercase tracking-wider text-ax-text-muted">Qui verra ces séances</p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-1.5 rounded-full border border-ax-input-border text-ax-text cursor-default"
                style={{ backgroundColor: softVar(programColor(target.program.type), 0.145) }}>
                Programme : {target.program.title}
              </span>
              <span className="text-[11px] text-ax-text-muted">Les acheteurs du programme, à la semaine × jour indiqués depuis leur démarrage — pas de groupe, pas d&apos;autre programme.</span>
            </div>
          </div>
        )}
        {result && target.kind === 'whiteboard' && (
          <div className="px-6 py-3 border-t border-ax-border space-y-2">
            <p className="text-xs font-black uppercase tracking-wider text-ax-text-muted">Qui verra ces WOD</p>
            <div className="flex flex-wrap gap-2">
              {groups.map(g => (
                <button key={g.id} onClick={() => setDestGroups(prev => prev.includes(g.id) ? prev.filter(x => x !== g.id) : [...prev, g.id])}
                  className={`text-xs font-semibold px-2.5 py-1.5 rounded-full border transition-colors ${destGroups.includes(g.id) ? 'border-ax-input-border text-ax-text' : 'border-ax-border text-ax-text-secondary'}`}
                  style={destGroups.includes(g.id) ? { backgroundColor: softVar(g.color, 0.145) } : undefined}>
                  Groupe : {g.name}
                </button>
              ))}
              {programs.map(p => (
                <button key={p.id} onClick={() => setDestPrograms(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])}
                  className={`text-xs font-semibold px-2.5 py-1.5 rounded-full border transition-colors ${destPrograms.includes(p.id) ? 'border-ax-input-border text-ax-text' : 'border-ax-border text-ax-text-secondary'}`}
                  style={destPrograms.includes(p.id) ? { backgroundColor: softVar(p.color, 0.145) } : undefined}>
                  Programme : {p.name}
                </button>
              ))}
              {groups.length === 0 && programs.length === 0 && <p className="text-xs text-ax-text-muted">Aucun groupe ni programme dans cette box.</p>}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-ax-border">
          <button
            onClick={() => { const all = entries.every(e => keep[e.key]); setKeep(Object.fromEntries(entries.map(e => [e.key, !all]))); }}
            disabled={entries.length === 0}
            className="px-4 py-2.5 rounded-ax-control text-xs font-bold border border-ax-border text-ax-text-secondary hover:text-ax-text hover:border-ax-input-border disabled:opacity-40"
          >
            {entries.length > 0 && entries.every(e => keep[e.key]) ? 'Tout décocher' : 'Tout cocher'}
          </button>
          <button
            onClick={() => void insertAll()}
            disabled={inserting || analyzing || selected.length === 0}
            className="flex-1 px-4 py-2.5 rounded-ax-control text-sm font-bold bg-ax-text text-ax-background hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {inserting ? <><Loader2 size={14} className="animate-spin" /> Insertion…</> : <>Insérer {isProgram ? countOf(selected.length, 'séance', 'séances') : `${selected.length} WOD`}</>}
          </button>
        </div>
      </div>
    </div>
  );
}
