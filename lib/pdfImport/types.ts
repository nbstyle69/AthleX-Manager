import type { WodType } from '@/lib/wodFields';

/**
 * Importateur PDF de programmation — types partagés entre le cœur générique
 * (`core.ts`, `formats.ts`, `movements.ts`, `strength.ts`) et les profils de
 * source (`profiles/*`). Le cœur ne sait rien d'un coach en particulier : il
 * reçoit des pages déjà découpées en jours puis en sections, et rend des
 * entrées prêtes à passer en preview puis dans `box_wods`.
 */

/** Une page du PDF, texte brut, `index` 1-based. */
export interface PdfPage { index: number; text: string }

/** Une page rattachée à un jour de la semaine (0 = lundi … 6 = dimanche). */
export interface DayPage { day: number; pageIndex: number; lines: string[] }

/** Une section = une entrée WOD candidate (un titre, ses lignes). */
export interface RawSection {
  title: string;
  lines: string[];
  day: number;
  pageIndex: number;
  /** Lignes marquées « niveau » par le profil (barème) ; vide si non marquées. */
  levelLines?: string[];
  /** Suggestion de block du profil quand le titre ne suffit pas (`generic`). */
  blockHint?: BlockName | null;
}

/** Valeurs réelles du select « Block » du formulaire (cf. `lib/wodFields.ts`). */
export type BlockName = 'skill-gym' | 'skill-haltero' | 'wod' | 'pre-wod' | 'post-wod';

export type ChargeOrder = 'FH' | 'HF' | 'unknown';

export interface LevelMarkers { open: string; pro: string; elite: string }

export interface SourceProfile {
  slug: string;
  label: string;
  defaultGroups: string[];
  /** Score 0–1 : « ce PDF vient-il de cette source ? » */
  detect: (pages: PdfPage[]) => number;
  splitDays: (pages: PdfPage[]) => DayPage[];
  splitSections: (day: DayPage) => RawSection[];
  /** Titre de section normalisé (majuscules, sans emoji) → block. */
  sectionToBlock: Record<string, BlockName>;
  chargeOrder: ChargeOrder;
  levelMarkers?: LevelMarkers;
  synonyms: Record<string, string>;
  typoFixes: Record<string, string>;
  artefacts: RegExp[];
  warmupMarkers: string[];
  /** Texte de la page 1 (intro / citation) : affiché en preview, non importé. */
  weekNotes?: (pages: PdfPage[]) => string | null;
}

export interface ParsedMovement {
  name: string;
  resolved: boolean;
  reps: string | null;
  charge_h: string | null;
  charge_f: string | null;
  reps_h?: string | null;
  reps_f?: string | null;
  note: string | null;
  level?: 'open' | 'pro' | 'elite' | null;
}

export interface ParsedStrength {
  exercise: string;
  resolved: boolean;
  sets: number | null;
  reps: number | null;
  percent: number | null;
  rpe: string | null;
  charge_note: string | null;
  tempo: string | null;
  rest: string | null;
}

export type ImportWarning =
  | 'movement-unresolved'
  | 'timecap-unparsed'
  | 'level-scale-missing'
  | 'enum-fallback'
  | 'charge-order-ambiguous'
  | 'strength-unstructured'
  | 'generic-profile';

export interface ImportEntry {
  /** Identifiant local de preview (stable pendant l'édition). */
  key: string;
  date: string;
  order: number;
  block: BlockName | null;
  type: WodType | null;
  title: string;
  movements: ParsedMovement[];
  musculation: ParsedStrength[];
  /** `MM:SS` strict ou null. */
  timecap: string | null;
  rounds: number | null;
  emom_interval_minutes: number | null;
  tabata_work_seconds: number | null;
  tabata_rest_seconds: number | null;
  notes_coach: string;
  video_url: null;
  groups: string[];
  programs: string[];
  published: true;
  rank: boolean;
  source_profile: string;
  source_page: number;
  warnings: ImportWarning[];
}

export interface ImportResult {
  week_start: string;
  source_profile: string;
  detected_scores: Record<string, number>;
  week_notes: string | null;
  programs: string[];
  entries: ImportEntry[];
  /** Noms de mouvements non résolus rencontrés (dédupliqués), pour décision catalogue. */
  unresolved_movements: string[];
}
