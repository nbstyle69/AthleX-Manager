import { z } from 'zod';
import { serializeStrength, type StrengthEntry } from '@/lib/strengthBlock';
import type { ImportEntry, ParsedMovement, ParsedStrength } from './types';
import { timecapToSeconds } from './text';

/**
 * Passage d'une entrée de preview à une ligne `box_wods`. Les mouvements sont
 * sérialisés « reps d'abord » (forme lue par le crédit de badges de l'app),
 * la musculation « nom d'abord » via `serializeStrength` — jamais modifié ici.
 *
 * Règles arrêtées (réponse reco, décision C) :
 * - fourchette `85-90%` → charge structurée = borne haute, fourchette en notes ;
 * - RPE / RM du jour / charge relative → pas de ligne structurée, ligne
 *   complète en notes sous `Musculation (non structurée) :`, carte orange.
 */

const TIMECAP_RE = /^\d{2}:\d{2}$/;

export const importEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format AAAA-MM-JJ'),
  title: z.string().trim().min(1, 'Titre requis'),
  block: z.enum(['skill-gym', 'skill-haltero', 'wod', 'pre-wod', 'post-wod']).nullable(),
  type: z.enum(['for-time', 'amrap', 'emom', 'tabata', 'strength', 'custom']).nullable(),
  timecap: z.string().regex(TIMECAP_RE, 'Time cap attendu en MM:SS').nullable(),
  rounds: z.number().int().positive().nullable(),
  emom_interval_minutes: z.number().int().positive().nullable(),
  tabata_work_seconds: z.number().int().positive().nullable(),
  tabata_rest_seconds: z.number().int().nonnegative().nullable(),
  notes_coach: z.string(),
  rank: z.boolean(),
  source_profile: z.string().min(1),
  source_page: z.number().int().positive(),
  movements: z.array(z.object({ name: z.string().trim().min(1, 'Nom de mouvement requis') })).default([]),
  musculation: z.array(z.object({ exercise: z.string().trim().min(1, 'Nom d\'exercice requis') })).default([]),
});

export function validateEntry(entry: ImportEntry): string[] {
  const r = importEntrySchema.safeParse(entry);
  if (r.success) return [];
  return r.error.issues.map(i => `${i.path.join('.') || 'entrée'} : ${i.message}`);
}

/** `6×1` → 6 séries de 1 ; `21` → 21 ; `500 m` → 500 ; sinon null. */
function leadingNumber(reps: string | null): number | null {
  if (!reps) return null;
  const m = reps.match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

/** Charge H/F en `(43/30 kg)` si numérique en kg, sinon en parenthèse libre. */
function chargeSuffix(m: ParsedMovement): string {
  const h = m.charge_h?.trim() ?? '';
  const f = m.charge_f?.trim() ?? '';
  if (!h && !f) return '';
  const kg = (s: string) => s.match(/^(\d+(?:[.,]\d+)?)\s*kg$/i)?.[1]?.replace(',', '.') ?? null;
  const hk = kg(h), fk = kg(f);
  if (hk && fk) return hk === fk ? ` (${hk} kg)` : ` (${hk}/${fk} kg)`;
  if (h === f || !f) return ` (${h})`;
  if (!h) return ` (${f})`;
  return ` (♂ ${h} / ♀ ${f})`;
}

/** Une ligne de metcon : `21 Thruster (43/30 kg)` — jamais de `@` (crédit de badges). */
export function serializeImportMovement(m: ParsedMovement): string {
  const parts: string[] = [];
  const reps = m.reps?.trim() ?? '';
  const n = leadingNumber(reps);
  const setsReps = reps.match(/^(\d+)×(\d+)$/);
  let head: string;
  if (setsReps) head = `${setsReps[1]}×${setsReps[2]} ${m.name}`;
  else if (m.reps_h && m.reps_f) head = `${m.reps_h}/${m.reps_f} ${m.name}`;
  else if (n != null && /^\d+$/.test(reps)) head = `${reps} ${m.name}`;
  else if (n != null) head = `${reps.replace(/\s+/, '')} ${m.name}`;
  else head = reps ? `${m.name} (${reps})` : m.name;
  parts.push(head + chargeSuffix(m));
  const extras: string[] = [];
  if (m.reps_h && m.reps_f) extras.push('♂/♀');
  if (m.level) extras.push(`niveau ${m.level}`);
  if (m.note) extras.push(m.note);
  if (extras.length) parts.push(`(${extras.join(' · ')})`);
  return parts.join(' ');
}

export interface StrengthSerialization {
  /** Lignes structurées (`serializeStrength`). */
  lines: string[];
  /** Fourchettes de charge à rappeler dans les notes (`Charges : …`). */
  chargeNotes: string[];
  /** Lignes impossibles à structurer, conservées telles quelles. */
  unstructured: string[];
}

function describeStrength(s: ParsedStrength): string {
  const bits: string[] = [];
  if (s.sets != null && s.reps != null) bits.push(`${s.sets}×${s.reps}`);
  else if (s.reps != null) bits.push(`${s.reps}`);
  bits.push(s.exercise);
  if (s.percent != null) bits.push(`@ ${s.percent} %`);
  if (s.rpe) bits.push(`RPE ${s.rpe}`);
  if (s.charge_note) bits.push(`(${s.charge_note})`);
  if (s.tempo) bits.push(`tempo ${s.tempo}`);
  if (s.rest) bits.push(`repos ${s.rest}`);
  return bits.join(' ');
}

function restToSeconds(rest: string | null): number | null {
  if (!rest) return null;
  const m = rest.match(/^(\d+)(?:'(\d{2})?|(")|$)/);
  if (!m) return null;
  if (m[3]) return parseInt(m[1], 10);
  return parseInt(m[1], 10) * 60 + (m[2] ? parseInt(m[2], 10) : 0);
}

export function serializeImportStrength(items: ParsedStrength[]): StrengthSerialization {
  const out: StrengthSerialization = { lines: [], chargeNotes: [], unstructured: [] };
  for (const s of items) {
    const range = s.charge_note?.match(/(\d+)-(\d+)%/);
    const structurable = s.sets != null && s.reps != null && s.exercise
      && !s.rpe
      && (s.percent != null || range != null || !s.charge_note || /^\d+ à \d+ séries$/.test(s.charge_note));
    if (!structurable) { out.unstructured.push(describeStrength(s)); continue; }
    const load = s.percent ?? (range ? parseInt(range[2], 10) : null);
    const entry: StrengthEntry = {
      name: s.exercise,
      sets: s.sets as number,
      reps: s.reps as number,
      load,
      unit: '%1RM',
      restSec: restToSeconds(s.rest),
      tempo: s.tempo,
    };
    const line = serializeStrength(entry);
    if (!line) { out.unstructured.push(describeStrength(s)); continue; }
    out.lines.push(line);
    if (range) out.chargeNotes.push(`${s.exercise} ${s.sets}×${s.reps} : ${range[1]}-${range[2]} %`);
    else if (s.charge_note && !/^\d+ à \d+ séries$/.test(s.charge_note)) out.chargeNotes.push(`${s.exercise} : ${s.charge_note}`);
  }
  return out;
}

export interface BoxWodInsert {
  box_id: string;
  created_by: string;
  title: string;
  description: string | null;
  wod_type: string | null;
  block_name: string | null;
  scheduled_date: string;
  time_cap_seconds: number | null;
  rounds: number | null;
  notes: string | null;
  video_url: null;
  is_published: true;
  leaderboard_enabled: boolean;
  sort_order: number;
  emom_interval_minutes: number | null;
  tabata_work_seconds: number | null;
  tabata_rest_seconds: number | null;
  source_pdf_url: string | null;
  source_page: number;
  source_profile: string;
}

export function entryToBoxWod(
  entry: ImportEntry,
  ctx: { boxId: string; userId: string; sourcePdfUrl: string | null; sortOrder: number },
): BoxWodInsert {
  const strength = serializeImportStrength(entry.musculation);
  const description = [
    ...strength.lines,
    ...entry.movements.map(serializeImportMovement),
  ].map(l => l.trim()).filter(Boolean).join('\n') || null;

  const notes: string[] = [];
  if (entry.notes_coach.trim()) notes.push(entry.notes_coach.trim());
  if (strength.chargeNotes.length) notes.push(`Charges : ${strength.chargeNotes.join(' ; ')}`);
  if (strength.unstructured.length) notes.push(`Musculation (non structurée) :\n${strength.unstructured.map(l => `- ${l}`).join('\n')}`);

  return {
    box_id: ctx.boxId,
    created_by: ctx.userId,
    title: entry.title.trim(),
    description,
    wod_type: entry.type,
    block_name: entry.block,
    scheduled_date: entry.date,
    time_cap_seconds: timecapToSeconds(entry.timecap),
    rounds: entry.rounds,
    notes: notes.join('\n\n') || null,
    video_url: null,
    is_published: true,
    leaderboard_enabled: entry.rank,
    sort_order: ctx.sortOrder,
    emom_interval_minutes: entry.type === 'emom' ? entry.emom_interval_minutes : null,
    tabata_work_seconds: entry.type === 'tabata' ? entry.tabata_work_seconds : null,
    tabata_rest_seconds: entry.type === 'tabata' ? entry.tabata_rest_seconds : null,
    source_pdf_url: ctx.sourcePdfUrl,
    source_page: entry.source_page,
    source_profile: entry.source_profile,
  };
}

/** Une entrée dont la musculation ne peut pas être structurée passe orange (§5, décision C). */
export function hasUnstructuredStrength(entry: ImportEntry): boolean {
  return serializeImportStrength(entry.musculation).unstructured.length > 0;
}
