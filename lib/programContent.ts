import { createClient } from '@/lib/supabase/client';

/**
 * Le contenu d'un programme n'a plus de table à lui : c'est un WOD de box
 * (`box_wods`) rattaché au programme par `wod_program_access`. Même chemin
 * canonique que l'app mobile (`src/services/programContent.ts`) et que le
 * Whiteboard : c'est le rattachement qui décide qui voit quoi, côté serveur.
 *
 * Conséquence de forme assumée : le contenu est daté au calendrier
 * (`scheduled_date`) et non numéroté en « jour 1..N ». L'éditeur garde sa
 * grille semaine/jour, mais elle est ancrée sur un lundi réel — sinon deux
 * schémas coexisteraient pour la même donnée, ce qu'on vient de supprimer.
 */

export type ProgramWod = {
  id: string;
  title: string;
  description: string | null;
  wod_type: string | null;
  time_cap_seconds: number | null;
  notes: string | null;
  scheduled_date: string;
  sort_order: number;
  is_published: boolean | null;
};

export type ProgramWodInput = {
  title: string;
  description: string;
  wod_type: string;
  time_cap_seconds: number | null;
  notes: string | null;
  scheduled_date: string;
  sort_order?: number;
};

const COLONNES =
  'id, title, description, wod_type, time_cap_seconds, notes, scheduled_date, sort_order, is_published';

/** Les WOD d'un programme, du plus ancien au plus récent. */
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
    .order('scheduled_date', { ascending: true })
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ProgramWod[];
}

/**
 * Crée le WOD ET son rattachement. Si le rattachement échoue, le WOD est
 * retiré : un WOD de box publié sans lien de programme serait visible de toute
 * la box, donc du contenu payant offert par accident.
 */
export async function createProgramWod(
  programId: string,
  boxId: string,
  input: ProgramWodInput,
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('box_wods')
    .insert({
      box_id: boxId,
      title: input.title,
      description: input.description,
      wod_type: input.wod_type,
      time_cap_seconds: input.time_cap_seconds,
      notes: input.notes,
      scheduled_date: input.scheduled_date,
      sort_order: input.sort_order ?? 0,
      is_published: true,
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

export async function updateProgramWod(
  wodId: string,
  input: ProgramWodInput,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('box_wods')
    .update({
      title: input.title,
      description: input.description,
      wod_type: input.wod_type,
      time_cap_seconds: input.time_cap_seconds,
      notes: input.notes,
      scheduled_date: input.scheduled_date,
      ...(input.sort_order != null ? { sort_order: input.sort_order } : {}),
    })
    .eq('id', wodId);
  if (error) throw error;
}

/** Le rattachement part avec le WOD (FK ON DELETE CASCADE). */
export async function deleteProgramWod(wodId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('box_wods').delete().eq('id', wodId);
  if (error) throw error;
}

/** Recopie une semaine de contenu sur la semaine suivante. */
export async function duplicateProgramWeek(
  programId: string,
  boxId: string,
  wods: ProgramWod[],
): Promise<number> {
  let copies = 0;
  for (const w of wods) {
    await createProgramWod(programId, boxId, {
      title: w.title,
      description: w.description ?? '',
      wod_type: w.wod_type ?? 'custom',
      time_cap_seconds: w.time_cap_seconds,
      notes: w.notes,
      scheduled_date: addDays(w.scheduled_date, 7),
      sort_order: w.sort_order,
    });
    copies += 1;
  }
  return copies;
}

/** Décalage de jours sur une date ISO (`YYYY-MM-DD`), sans dérive de fuseau. */
export function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Lundi de la semaine d'une date ISO : l'ancre de la grille de l'éditeur. */
export function mondayOf(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const decalage = (d.getDay() + 6) % 7;
  return addDays(iso, -decalage);
}

/**
 * Ancre de la grille : le lundi de la première séance existante, ou celui de
 * la semaine courante pour un programme encore vide.
 */
export function ancreProgramme(wods: ProgramWod[]): string {
  const premiere = wods.map(w => w.scheduled_date).sort()[0];
  return mondayOf(premiere ?? new Date().toISOString().slice(0, 10));
}
