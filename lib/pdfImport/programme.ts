import type { ImportEntry } from './types';
import { BoxWodInsert, entryToBoxWod } from './serialize';

/**
 * Import PDF vers un programme athlète : le cœur (`core.ts`) date chaque
 * séance à partir d'un lundi (`week_start` + jour détecté). Pour un programme,
 * ce lundi est un ancrage FICTIF : on le relit ensuite en semaine × jour
 * relatifs. Le PDF n'a pas à changer, ni le parseur — seule la destination
 * change : `scheduled_date = NULL`, `program_week`, `program_day`.
 */

/** Un lundi quelconque, hors de tout calendrier réel de box. */
export const ANCRE_IMPORT_PROGRAMME = '2001-01-01';

const MS_JOUR = 86_400_000;

function utc(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getTime();
}

export function dateFictive(week: number, day: number, ancre = ANCRE_IMPORT_PROGRAMME): string {
  const d = new Date(utc(ancre) + ((week - 1) * 7 + (day - 1)) * MS_JOUR);
  return d.toISOString().slice(0, 10);
}

/** Date fictive → case du programme. Semaine 1 = la semaine de l'ancrage. */
export function caseDepuisDate(iso: string, ancre = ANCRE_IMPORT_PROGRAMME): { week: number; day: number } {
  const jours = Math.round((utc(iso) - utc(ancre)) / MS_JOUR);
  const borne = Math.max(0, jours);
  return { week: Math.floor(borne / 7) + 1, day: (borne % 7) + 1 };
}

/**
 * Le cœur rend des dates à partir de l'ancrage (semaine 1) ; la preview veut
 * les voir à partir de la semaine affichée : on décale tout d'un bloc.
 */
export function recalerSurSemaine<T extends { date: string }>(entries: T[], semaineCible: number): T[] {
  const delta = Math.max(1, semaineCible) - 1;
  if (delta === 0) return entries;
  return entries.map(e => {
    const c = caseDepuisDate(e.date);
    return { ...e, date: dateFictive(c.week + delta, c.day) };
  });
}

/** Nombre de semaines distinctes couvertes par le document (pour le mapping en preview). */
export function semainesCouvertes(entries: { date: string }[]): number[] {
  return [...new Set(entries.map(e => caseDepuisDate(e.date).week))].sort((a, b) => a - b);
}

export type ProgramWodInsert = Omit<BoxWodInsert, 'scheduled_date'> & {
  scheduled_date: null;
  program_week: number;
  program_day: number;
};

/**
 * Même sérialisation que le Whiteboard (`entryToBoxWod` : description,
 * notes, source_pdf_url / source_page / source_profile), ancrage relatif.
 */
export function entryToProgramWod(
  entry: ImportEntry,
  ctx: { boxId: string; userId: string; sourcePdfUrl: string | null; sortOrder: number },
): ProgramWodInsert {
  const base = entryToBoxWod(entry, ctx);
  const c = caseDepuisDate(entry.date);
  return { ...base, scheduled_date: null, program_week: c.week, program_day: c.day };
}

/** Rangs par case pour un lot d'entrées retenues (ordre de preview). */
export function rangsParCase(entries: ImportEntry[]): number[] {
  const parCase: Record<string, number> = {};
  return entries.map(e => {
    const n = parCase[e.date] ?? 0;
    parCase[e.date] = n + 1;
    return n;
  });
}
