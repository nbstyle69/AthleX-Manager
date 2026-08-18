// Champs communs à un WOD, quel que soit son contexte : posé sur le calendrier
// d'une box (`box_wods`) ou écrit dans une programmation vendue à d'autres boxs
// (`box_programming_wods`). Les deux tables portent les mêmes colonnes ; seul
// l'ancrage diffère — une date d'un côté, semaine × jour de l'autre.

export type WodType = 'for-time' | 'amrap' | 'emom' | 'tabata' | 'strength' | 'custom';

export const WOD_TYPES: { value: WodType; label: string; color: string }[] = [
  { value: 'for-time', label: 'For Time', color: '#EF4444' },
  { value: 'amrap',    label: 'AMRAP',    color: '#3B82F6' },
  { value: 'emom',     label: 'EMOM',     color: '#8B5CF6' },
  { value: 'tabata',   label: 'Tabata',   color: '#F59E0B' },
  { value: 'strength', label: 'Force',    color: '#16A34A' },
  { value: 'custom',   label: 'Custom',   color: '#6B7280' },
];

export const TYPE_COLOR: Record<string, string> = Object.fromEntries(WOD_TYPES.map(t => [t.value, t.color]));

export const BLOCKS: { value: string; label: string; color: string }[] = [
  { value: 'skill-gym',     label: 'Skill GYM',     color: '#06B6D4' },
  { value: 'skill-haltero', label: 'Skill Haltéro', color: '#F97316' },
  { value: 'wod',           label: 'WOD',           color: '#EF4444' },
  { value: 'pre-wod',       label: 'Pré-WOD',       color: '#22C55E' },
  { value: 'post-wod',      label: 'Post-WOD',      color: '#A855F7' },
];

export const BLOCK_COLOR: Record<string, string> = Object.fromEntries(BLOCKS.map(b => [b.value, b.color]));
export const BLOCK_LABEL: Record<string, string> = Object.fromEntries(BLOCKS.map(b => [b.value, b.label]));

export const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

/**
 * Le time cap se saisit et s'affiche en `mm:ss` — le coach pense en
 * minutes:secondes, et la colonne est en secondes. `formatCap` puis `parseCap`
 * doivent redonner la valeur d'origine à la seconde, sinon un simple
 * « Enregistrer » réécrit la donnée.
 */
export function formatCap(seconds: number | null | undefined): string {
  if (seconds == null) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** `mm:ss` → secondes. Un nombre nu est lu comme des minutes (`12` → 720). */
export function parseCap(text: string): number | null {
  const raw = text.trim();
  if (!raw) return null;
  const [minPart, secPart] = raw.split(':');
  const minutes = parseInt(minPart, 10);
  if (Number.isNaN(minutes)) return null;
  if (secPart === undefined) return minutes * 60;
  const seconds = parseInt(secPart, 10);
  return minutes * 60 + (Number.isNaN(seconds) ? 0 : seconds);
}

export interface WodFormState {
  title: string;
  description: string;
  wod_type: string;
  block: string;
  timeCap: string;
  rounds: string;
  notes: string;
  videoUrl: string;
  leaderboard: boolean;
  emomInterval: string;
  tabataWork: string;
  tabataRest: string;
  // Contexte Whiteboard uniquement : date, accès et publication.
  date: string;
  published: boolean;
  publishMode: 'now' | 'scheduled';
  publishHour: string;
  publishMin: string;
  groupIds: string[];
  programIds: string[];
  // Contexte Programmation uniquement : semaine × jour.
  week: number;
  dayOfWeek: number;
}

export const EMPTY_WOD_FORM: WodFormState = {
  title: '', description: '', wod_type: '', block: '',
  timeCap: '', rounds: '', notes: '', videoUrl: '',
  leaderboard: true,
  emomInterval: '1', tabataWork: '20', tabataRest: '10',
  date: '', published: true, publishMode: 'now', publishHour: '06', publishMin: '00',
  groupIds: [], programIds: [],
  week: 1, dayOfWeek: 1,
};

export interface SharedWodColumns {
  title: string;
  description: string | null;
  wod_type: string | null;
  block_name: string | null;
  time_cap_seconds: number | null;
  rounds: number | null;
  notes: string | null;
  video_url: string | null;
  leaderboard_enabled: boolean;
  emom_interval_minutes: number | null;
  tabata_work_seconds: number | null;
  tabata_rest_seconds: number | null;
}

/**
 * Colonnes que `box_wods` et `box_programming_wods` ont en commun. Les
 * mouvements structurés ne sont pas un modèle à part : ils sont sérialisés
 * une ligne par mouvement dans `description`.
 */
export function sharedWodColumns(form: WodFormState, movements: string[]): SharedWodColumns {
  return {
    title: form.title.trim(),
    description: movements.map(l => l.trim()).filter(Boolean).join('\n') || null,
    wod_type: form.wod_type || null,
    block_name: form.block || null,
    time_cap_seconds: parseCap(form.timeCap),
    rounds: form.rounds ? parseInt(form.rounds) : null,
    notes: form.notes.trim() || null,
    video_url: form.videoUrl.trim() || null,
    leaderboard_enabled: form.leaderboard,
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
}

/** `description` → lignes de l'éditeur de mouvements. */
export function movementLines(description: string | null): string[] {
  return description ? description.split('\n').map(l => l.trim()).filter(Boolean) : [];
}
