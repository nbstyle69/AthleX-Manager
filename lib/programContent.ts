import { createClient } from '@/lib/supabase/client';
import {
  EMPTY_WOD_FORM, SharedWodColumns, WodFormState, formatCap, sharedWodColumns,
} from '@/lib/wodFields';

/**
 * Le contenu d'un programme athlète n'a pas de table à lui : c'est une ligne
 * de `box_wods` rattachée au programme par `wod_program_access`. Même chemin
 * canonique que l'app mobile (`src/services/programContent.ts`) : c'est le
 * rattachement qui décide qui voit quoi, côté serveur.
 *
 * Ce qui distingue une séance de programme d'un WOD du Whiteboard, c'est son
 * ancrage : le Whiteboard est daté (`scheduled_date`), la séance de programme
 * est relative (`program_week` × `program_day`, `scheduled_date = NULL`) —
 * l'athlète la reçoit à partir de SA date de début. La contrainte
 * `box_wods_ancrage_check` (migration `20261207`, athlex-app) rend les deux
 * ancrages exclusifs : une séance relative ne peut pas tomber dans une lecture
 * par date, donc jamais dans le Whiteboard d'une box.
 *
 * `description` garde exactement la grammaire du Whiteboard (`sharedWodColumns`) :
 * les parseurs de l'app la lisent sans code spécifique.
 */

export type ProgramWod = SharedWodColumns & {
  id: string;
  scheduled_date: string | null;
  program_week: number | null;
  program_day: number | null;
  sort_order: number;
  is_published: boolean | null;
};

/** Ancrage relatif d'une séance : semaine 1..X, jour ISO 1 (lundi) .. 7 (dimanche). */
export interface CaseProgramme { week: number; day: number }

export type ProgramWodPayload = SharedWodColumns & {
  scheduled_date: null;
  program_week: number;
  program_day: number;
  is_published: boolean;
  sort_order?: number;
};

const COLONNES = [
  'id', 'title', 'description', 'wod_type', 'block_name', 'time_cap_seconds', 'rounds',
  'notes', 'video_url', 'leaderboard_enabled', 'emom_interval_minutes',
  'tabata_work_seconds', 'tabata_rest_seconds',
  'scheduled_date', 'program_week', 'program_day', 'sort_order', 'is_published',
].join(', ');

export const JOUR_LABELS_LONGS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

// ── Helpers purs (testés) ─────────────────────────────────────────────────────

/** Une séance relative : pas de date, une semaine et un jour. */
export function estSeanceRelative(w: Pick<ProgramWod, 'scheduled_date' | 'program_week' | 'program_day'>): boolean {
  return w.scheduled_date == null && w.program_week != null && w.program_day != null;
}

/** Les séances d'une case de la grille (semaine × jour), dans l'ordre d'affichage. */
export function seancesDeCase<T extends Pick<ProgramWod, 'scheduled_date' | 'program_week' | 'program_day' | 'sort_order'>>(
  wods: T[], week: number, day: number,
): T[] {
  return wods
    .filter(w => estSeanceRelative(w) && w.program_week === week && w.program_day === day)
    .sort((a, b) => a.sort_order - b.sort_order);
}

/** Les séances d'une semaine entière (7 jours). */
export function seancesDeSemaine<T extends Pick<ProgramWod, 'scheduled_date' | 'program_week' | 'program_day' | 'sort_order'>>(
  wods: T[], week: number,
): T[] {
  return wods.filter(w => estSeanceRelative(w) && w.program_week === week);
}

/**
 * Séances encore datées (posées avant le modèle relatif, ex. le WOD ELITE du
 * 13/04/2026). Elles restent lues par l'app à leur date : on les montre à
 * part, on ne les convertit jamais en silence.
 */
export function seancesDatees<T extends Pick<ProgramWod, 'scheduled_date'>>(wods: T[]): T[] {
  return wods
    .filter(w => w.scheduled_date != null)
    .sort((a, b) => (a.scheduled_date ?? '').localeCompare(b.scheduled_date ?? ''));
}

/** Jour ISO (1 = lundi … 7 = dimanche) d'une date `YYYY-MM-DD`. */
export function jourIsoDe(iso: string): number {
  const d = new Date(iso + 'T00:00:00');
  return d.getDay() === 0 ? 7 : d.getDay();
}

/**
 * Nombre de semaines navigables. Un programme fixe est borné par sa durée ;
 * un programme « ongoing » n'a pas de fin : on laisse toujours une semaine
 * vide après la dernière écrite.
 */
export function nombreSemaines(
  programme: { type: 'fixed' | 'ongoing'; duration_weeks: number | null },
  wods: Pick<ProgramWod, 'scheduled_date' | 'program_week' | 'program_day'>[],
): number {
  if (programme.type === 'fixed') return Math.max(1, programme.duration_weeks ?? 1);
  const max = wods.reduce((m, w) => (estSeanceRelative(w) ? Math.max(m, w.program_week ?? 0) : m), 0);
  return Math.max(1, max + 1);
}

/** Un jour au-delà de `days_per_week` est un jour de repos : pas de séance. */
export function estJourRepos(day: number, daysPerWeek: number): boolean {
  return day > Math.min(7, Math.max(0, daysPerWeek));
}

/** Cible d'une séance déplacée d'un jour (bornée à la semaine ; `null` si impossible). */
export function caseVoisine(c: CaseProgramme, sens: 'prev' | 'next'): CaseProgramme | null {
  const day = c.day + (sens === 'prev' ? -1 : 1);
  if (day < 1 || day > 7) return null;
  return { week: c.week, day };
}

/** La même séance une semaine plus loin : le geste de « Dupliquer sem. N → N+1 ». */
export function semaineSuivante(c: CaseProgramme): CaseProgramme {
  return { week: c.week + 1, day: c.day };
}

/**
 * Séance → état du formulaire partagé. Une séance encore datée est proposée
 * dans la case (semaine affichée, jour de sa date) : l'enregistrer la rend
 * relative — le titre de la modale le dit.
 */
export function formulaireDepuisSeance(w: ProgramWod, semaineAffichee: number): WodFormState {
  const relative = estSeanceRelative(w);
  return {
    ...EMPTY_WOD_FORM,
    title: w.title,
    description: w.description ?? '',
    wod_type: w.wod_type ?? '',
    block: w.block_name ?? '',
    timeCap: formatCap(w.time_cap_seconds),
    rounds: w.rounds ? String(w.rounds) : '',
    notes: w.notes ?? '',
    videoUrl: w.video_url ?? '',
    leaderboard: w.leaderboard_enabled ?? true,
    published: w.is_published ?? true,
    emomInterval: w.emom_interval_minutes ? String(w.emom_interval_minutes) : '1',
    tabataWork: w.tabata_work_seconds ? String(w.tabata_work_seconds) : '20',
    tabataRest: w.tabata_rest_seconds != null ? String(w.tabata_rest_seconds) : '10',
    week: relative ? (w.program_week as number) : semaineAffichee,
    dayOfWeek: relative ? (w.program_day as number) : jourIsoDe(w.scheduled_date as string),
    // Verrou : une séance de programme ne porte ni date ni groupe ; le
    // programme est celui de la page, jamais celui du formulaire.
    date: '',
    groupIds: [],
    programIds: [],
  };
}

/**
 * Formulaire partagé → colonnes `box_wods` d'une séance de programme. La
 * sérialisation de `description` est celle du Whiteboard (`sharedWodColumns`) ;
 * l'ancrage est relatif et la date est forcée à `null`, quoi que porte le
 * formulaire.
 */
export function colonnesSeance(form: WodFormState, movements: string[]): ProgramWodPayload {
  const week = Math.max(1, Math.floor(form.week));
  const day = Math.min(7, Math.max(1, Math.floor(form.dayOfWeek)));
  return {
    ...sharedWodColumns(form, movements),
    scheduled_date: null,
    program_week: week,
    program_day: day,
    is_published: form.published,
  };
}

/** Export CSV de la semaine affichée (même grammaire que le template « programming »). */
export function csvSeances(wods: ProgramWod[]): string {
  const q = (s: string | null | undefined) => `"${(s ?? '').replace(/"/g, '""')}"`;
  const headers = ['week', 'day', 'title', 'type', 'description', 'timecap', 'rounds', 'notes', 'block', 'published'];
  const rows = wods
    .filter(estSeanceRelative)
    .sort((a, b) => (a.program_week! - b.program_week!) || (a.program_day! - b.program_day!) || (a.sort_order - b.sort_order))
    .map(w => [
      w.program_week, w.program_day, q(w.title), w.wod_type ?? '', q(w.description),
      formatCap(w.time_cap_seconds), w.rounds ?? '', q(w.notes), w.block_name ?? '',
      w.is_published === false ? 'false' : 'true',
    ].join(','));
  return [headers.join(','), ...rows].join('\n');
}

// ── Accès base ────────────────────────────────────────────────────────────────

/** Toutes les séances d'un programme (relatives d'abord, datées ensuite). */
export async function listProgramWods(programId: string): Promise<ProgramWod[]> {
  const supabase = createClient();
  const { data: liens, error: erreurLiens } = await supabase
    .from('wod_program_access')
    .select('wod_id')
    .eq('program_id', programId);
  if (erreurLiens) throw erreurLiens;

  const ids = (liens ?? []).map(l => l.wod_id);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('box_wods')
    .select(COLONNES)
    .in('id', ids)
    .order('program_week', { ascending: true, nullsFirst: false })
    .order('program_day', { ascending: true, nullsFirst: false })
    .order('scheduled_date', { ascending: true })
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as ProgramWod[];
}

/**
 * Crée la séance ET son rattachement au programme courant — et à lui seul.
 * Si le rattachement échoue, la séance est retirée : une ligne `box_wods`
 * sans lien de programme serait du contenu payant offert par accident.
 */
export async function createProgramWod(
  programId: string,
  boxId: string,
  userId: string | null,
  payload: ProgramWodPayload,
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('box_wods')
    .insert({
      box_id: boxId,
      ...(userId ? { created_by: userId } : {}),
      ...payload,
      sort_order: payload.sort_order ?? 0,
    })
    .select('id')
    .single();
  if (error) throw error;

  const wodId = data.id;
  const { error: erreurLien } = await supabase
    .from('wod_program_access')
    .insert({ wod_id: wodId, program_id: programId });
  if (erreurLien) {
    await supabase.from('box_wods').delete().eq('id', wodId);
    throw erreurLien;
  }
  return wodId;
}

export async function updateProgramWod(wodId: string, payload: ProgramWodPayload): Promise<void> {
  const supabase = createClient();
  const { sort_order, ...reste } = payload;
  const { error } = await supabase
    .from('box_wods')
    .update({ ...reste, ...(sort_order != null ? { sort_order } : {}) })
    .eq('id', wodId);
  if (error) throw error;
}

/** Déplacement dans la grille (case et/ou rang). */
export async function moveProgramWod(wodId: string, cible: CaseProgramme, sortOrder: number): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('box_wods')
    .update({ scheduled_date: null, program_week: cible.week, program_day: cible.day, sort_order: sortOrder })
    .eq('id', wodId);
  if (error) throw error;
}

export async function setProgramWodPublished(wodId: string, published: boolean): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('box_wods').update({ is_published: published }).eq('id', wodId);
  if (error) throw error;
}

/** Le rattachement part avec la séance (FK ON DELETE CASCADE). */
export async function deleteProgramWod(wodId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('box_wods').delete().eq('id', wodId);
  if (error) throw error;
}

/** Suppression par identifiants : jamais par plage, la page ne voit que ses séances. */
export async function deleteProgramWods(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const supabase = createClient();
  const { error } = await supabase.from('box_wods').delete().in('id', ids);
  if (error) throw error;
}

/** Recopie une semaine de séances relatives sur la semaine suivante. */
export async function duplicateProgramWeek(
  programId: string,
  boxId: string,
  userId: string | null,
  wods: ProgramWod[],
): Promise<number> {
  let copies = 0;
  for (const w of wods) {
    if (!estSeanceRelative(w)) continue;
    const cible = semaineSuivante({ week: w.program_week as number, day: w.program_day as number });
    const { id: _id, scheduled_date: _d, program_week: _w, program_day: _j, is_published, ...contenu } = w;
    await createProgramWod(programId, boxId, userId, {
      ...contenu,
      scheduled_date: null,
      program_week: cible.week,
      program_day: cible.day,
      is_published: is_published ?? true,
      sort_order: w.sort_order,
    });
    copies += 1;
  }
  return copies;
}
