import { normalizeScore } from './scoreFormat';

// ── Normalize movement names ──────────────────────────────────────────────────
// Les lignes de WOD sont saisies librement : « Pull-ups », « Pull Up »,
// « 12 Toes-to-bar », « Cal Row »… On canonicalise au singulier, sans trait
// d'union, avant de consulter la table — sinon chaque variante d'écriture
// crée sa propre clé et son propre compteur de reps.
const MOVEMENT_MAP: Record<string, string> = {
  deadlift: 'deadlift', 'soulevé de terre': 'deadlift',
  'sumo deadlift high pull': 'sdlhp', sdlhp: 'sdlhp',
  'pull up': 'pull_up', traction: 'pull_up',
  'chest to bar': 'chest_to_bar', 'chest to bar pull up': 'chest_to_bar', ctb: 'chest_to_bar',
  'pull over': 'pull_over',
  'push up': 'push_up', pompe: 'push_up',
  thruster: 'thruster', 'db thruster': 'db_thruster', 'dumbbell thruster': 'db_thruster',
  'kb thruster': 'kb_thruster',
  burpee: 'burpee', 'burpee over the bar': 'burpee', 'bar facing burpee': 'burpee',
  'burpee box jump': 'burpee_box_jump', 'burpee box jump over': 'burpee_box_jump',
  'box jump': 'box_jump', 'box jump over': 'box_jump', 'box step up': 'box_jump',
  'saut sur boite': 'box_jump',
  'kettlebell swing': 'kb_swing', 'kb swing': 'kb_swing',
  'air squat': 'air_squat', squat: 'air_squat',
  'front squat': 'squat', 'back squat': 'squat',
  'overhead squat': 'overhead_squat', ohs: 'overhead_squat',
  'goblet squat': 'goblet_squat',
  'pistol squat': 'pistol_squat', pistol: 'pistol_squat',
  'double under': 'double_under', 'single under': 'single_under',
  'toe to bar': 'toes_to_bar', 'toes to bar': 'toes_to_bar', t2b: 'toes_to_bar',
  'knee to elbow': 'knees_to_elbow', k2e: 'knees_to_elbow',
  'handstand push up': 'hspu', hspu: 'hspu', 'hspu strict': 'hspu',
  'strict handstand push up': 'hspu', 'wall facing hspu': 'hspu',
  'muscle up': 'muscle_up',
  'bar muscle up': 'bar_muscle_up', 'ring muscle up': 'ring_muscle_up',
  'ring dip': 'ring_dip', 'ring row': 'ring_row',
  clean: 'clean', épaulé: 'clean',
  'power clean': 'clean', 'squat clean': 'clean', 'hang clean': 'clean',
  'hang power clean': 'clean', 'hang squat clean': 'clean',
  'clean and jerk': 'clean_and_jerk', 'hang clean and jerk': 'clean_and_jerk',
  'db clean and jerk': 'db_cj', 'kb clean and jerk': 'kb_cj',
  snatch: 'snatch', arraché: 'snatch',
  'power snatch': 'snatch', 'squat snatch': 'snatch', 'hang snatch': 'snatch',
  'db snatch': 'db_snatch', 'db snatch alt': 'db_snatch', 'dumbbell snatch': 'db_snatch',
  'kb snatch': 'kb_snatch',
  'push press': 'press', 'push jerk': 'press',
  'shoulder to overhead': 'press', 'shoulder to oh': 'press',
  'strict press': 'strict_press', 'shoulder press': 'strict_press', 'military press': 'strict_press',
  'power jerk': 'press', 'split jerk': 'press', 'back rack split jerk': 'press',
  jerk: 'press',
  'db push press': 'db_push_press',
  'db strict press': 'db_strict_press', 'db shoulder press': 'db_strict_press',
  'dumbbell strict press': 'db_strict_press',
  'bench press': 'bench_press', bench: 'bench_press',
  'snatch balance': 'snatch_balance',
  'snatch high pull': 'snatch_high_pull', 'snatch pull': 'snatch_high_pull',
  'clean pull': 'clean_pull',
  'zercher squat': 'squat',
  'devil press': 'devil_press',
  lunge: 'lunge', 'db lunge': 'lunge', 'walking lunge': 'lunge', fente: 'lunge',
  'turkish get up': 'turkish_get_up',
  'wall ball': 'wall_ball', 'wall ball shot': 'wall_ball',
  'wall walk': 'wall_walk', ww: 'wall_walk',
  'sit up': 'sit_up', 'v up': 'v_up', 'hollow rock': 'hollow_rock',
  'mountain climber': 'mountain_climber',
  'mb slam': 'mb_slam', 'medicine ball slam': 'mb_slam', 'slam ball': 'mb_slam',
  row: 'row', 'cal row': 'row', aviron: 'row', rameur: 'row', 'cal rameur': 'row',
  'assault bike': 'bike', 'echo bike': 'bike', 'cal assault bike': 'bike',
  'cal bike': 'bike', 'bike erg': 'bike',
  'ski erg': 'ski_erg', 'cal ski erg': 'ski_erg', ski: 'ski_erg', skierg: 'ski_erg',
  run: 'run', course: 'run',
  // Formes accolées héritées de l'ancien normaliseur du site (pullup, wallball…) :
  // elles existent dans les données et dans les saisies libres.
  'kipping pull up': 'pull_up', 'strict pull up': 'pull_up',
  'alternating lunge': 'lunge', 'alternating db lunge': 'lunge',
  'alternating db snatch': 'db_snatch',
  'strict hspu': 'hspu', 'tall clean': 'clean', 'tall snatch': 'snatch',
  pullup: 'pull_up', pushup: 'push_up', situp: 'sit_up', boxjump: 'box_jump',
  wallball: 'wall_ball', wallwalk: 'wall_walk', doubleunder: 'double_under',
  singleunder: 'single_under', kbswing: 'kb_swing', toes2bar: 'toes_to_bar',
  // Décision A de Nab (#453, PR 3c-0) : comptent pour les badges deadlift et squat,
  // partout ; le pont serveur movement_stats_keys suit (migration 20270166).
  'kb deadlift': 'deadlift', 'kb front squat': 'squat',
  // Texte libre (#453, PR 3c) : écritures et abréviations courantes.
  'kettlebell deadlift': 'deadlift',
  'kb lunge': 'lunge', 'db overhead lunge': 'lunge', 'kb overhead lunge': 'lunge', 'overhead lunge': 'lunge',
  stoh: 'press', s2oh: 'press',
  c2b: 'chest_to_bar', du: 'double_under', bmu: 'bar_muscle_up', rmu: 'ring_muscle_up',
};

function singularize(word: string): string {
  if (/(ches|shes|xes|sses)$/.test(word)) return word.slice(0, -2);
  if (/[^s]s$/.test(word)) return word.slice(0, -1);
  return word;
}

/**
 * Espace de clés canonique : les valeurs de `MOVEMENT_MAP`, seules clés qu'un
 * compteur de reps ou un badge sait lire. Une ligne de WOD qui ne s'y résout
 * pas n'est pas un mouvement (« Rest », « 3 rounds », « WOD du jour »…) : la
 * compter inventerait une clé que personne ne relit jamais.
 */
export const MOVEMENT_KEYS: ReadonlySet<string> = new Set(Object.values(MOVEMENT_MAP));

export function isKnownMovementKey(key: string): boolean {
  return MOVEMENT_KEYS.has(key);
}

/** Écriture nettoyée : casse, tirets, nombres, charges et pluriels ignorés. */
export function cleanMovementName(raw: string): string {
  return cleanWithoutPlural(raw).split(' ').map(singularize).join(' ');
}

function cleanWithoutPlural(raw: string): string {
  return raw.toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\bfor time\b/g, '')
    .replace(/\d+[-x]\d+[-x]?\d*/g, '')
    .replace(/\d+\s*(kg|lb|rm|%)/g, '')
    // Un chiffre entre deux lettres fait partie du nom (« t2b », « c2b », « s2oh ») ;
    // ailleurs c'est une quantité.
    .replace(/\d+/g, (d, i: number, str: string) => (/[a-z]/.test(str[i - 1] ?? '') && /[a-z]/.test(str[i + d.length] ?? '') ? d : ''))
    .replace(/[^\w\s-]/g, '')
    .replace(/-/g, ' ')
    .trim()
    .split(/\s+/)
    .join(' ');
}

/** MOVEMENT_MAP sur l'écriture au singulier, puis telle qu'écrite (« ohs » n'est pas un pluriel). */
function mapLookup(raw: string): string | undefined {
  return MOVEMENT_MAP[cleanMovementName(raw)] ?? MOVEMENT_MAP[cleanWithoutPlural(raw)];
}

/** Clé de badge d'une écriture que MOVEMENT_MAP connaît, sinon null (pas de repli). */
export function mappedMovementKey(raw: string): string | null {
  return mapLookup(raw) ?? null;
}

export function normalizeMovement(raw: string): { key: string; label: string } {
  const cleaned = cleanMovementName(raw);
  const key = mapLookup(raw) ?? cleaned.replace(/\s+/g, '_');
  const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return { key, label };
}

// ── ELO calculation (delegated to shared utility) ────────────────────────────
// Kept as re-export for backward compatibility
export { calcAvgOpponentDelta as calcTournamentElo } from './elo';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface TournamentWOD {
  id: string;
  tournament_id: string;
  order_index: number;
  title: string;
  description: string | null;
  type: string;
  duration_minutes: number;
  movements: string[];
  scoring: string;
  deadline_hours: number;
  opens_at: string | null;
  closes_at: string | null;
  status: 'pending' | 'active' | 'closed';
  // Timer config (set from back office)
  timer_type: 'countdown' | 'stopwatch' | 'emom' | 'tabata' | 'none' | null;
  time_cap_seconds: number | null;
  rounds: number | null;
  work_seconds: number | null;
  rest_seconds: number | null;
  reps_per_round: number | null;
}

// ── AMRAP / Max Reps score helpers ────────────────────────────────────────
// Score for these WODs is normalized to a TOTAL rep count so ranking stays
// coherent whether the athlete entered "rounds + reps" or a raw total.
// reps_per_round converts between the two representations; derived from the
// movements by `repsPerRoundFromMovements` (movementParser.ts).

export function isRepsScoredType(type: string | null | undefined): boolean {
  const t = (type ?? '').toLowerCase();
  return t === 'amrap' || t === 'max reps';
}

export function amrapTotalToRoundsReps(
  total: number,
  repsPerRound: number,
): { rounds: number; reps: number } {
  if (!repsPerRound || repsPerRound <= 0) return { rounds: 0, reps: total };
  return { rounds: Math.floor(total / repsPerRound), reps: total % repsPerRound };
}

export function roundsRepsToTotal(
  rounds: number,
  reps: number,
  repsPerRound: number,
): number {
  return Math.max(0, Math.round(rounds)) * Math.max(0, repsPerRound) + Math.max(0, Math.round(reps));
}

/**
 * Libellé des tours d'un score AMRAP, fourni par l'écran (`n => t('score.amrapRounds', { count: n })`) :
 * ce fichier n'importe pas l'i18n (il est aussi empaqueté par un script Node).
 */
export type RoundsLabel = (rounds: number) => string;

// "123 reps (3 tours + 12)" — or just "123 reps" when reps_per_round is unknown.
export function formatAmrapScore(
  total: number,
  repsPerRound: number | null | undefined,
  roundsLabel: RoundsLabel,
): string {
  const repsLabel = `${total} reps`;
  if (!repsPerRound || repsPerRound <= 0) return repsLabel;
  const { rounds, reps } = amrapTotalToRoundsReps(total, repsPerRound);
  return `${repsLabel} (${roundsLabel(rounds)}${reps > 0 ? ` + ${reps}` : ''})`;
}

// ── Time (For Time) helpers ───────────────────────────────────────────────────
// Scores for "For Time" WODs are stored canonically as a TOTAL SECONDS number
// (as a string in text columns) so ranking (smallest time wins) stays correct
// regardless of how the athlete typed it. The UI always shows/edits "mm:ss".

export function isTimeScoredType(type: string | null | undefined): boolean {
  const t = (type ?? '').toLowerCase();
  return t === 'for time' || t === 'for-time';
}

// "12:30" -> 750 ; "90" -> 90 ; "1:05:30" -> 3930. Accepts already-numeric input.
export function timeStringToSeconds(v: string | number | null | undefined): number {
  if (typeof v === 'number') return Math.max(0, Math.round(v));
  const s = (v ?? '').toString().trim();
  if (!s) return 0;
  if (s.includes(':')) {
    const parts = s.split(':').map(p => parseInt(p.replace(/[^0-9]/g, ''), 10) || 0);
    return parts.reduce((acc, p) => acc * 60 + p, 0);
  }
  return parseInt(s.replace(/[^0-9]/g, ''), 10) || 0;
}

// 750 -> "12:30" ; 3930 -> "1:05:30".
export function secondsToTimeString(total: number): string {
  const sec = Math.max(0, Math.round(total || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// Live input mask: keeps only digits and formats them right-to-left as mm:ss
// (or h:mm:ss) while the user types. "1234" -> "12:34", "5" -> "0:05".
export function maskTimeInput(raw: string): string {
  const digits = (raw ?? '').replace(/[^0-9]/g, '').slice(0, 6);
  if (!digits) return '';
  const groups: string[] = [];
  let rest = digits;
  while (rest.length > 2) {
    groups.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  groups.unshift(rest);
  if (groups.length === 1) return `0:${groups[0].padStart(2, '0')}`;
  return groups.map((g, i) => (i === 0 ? g : g.padStart(2, '0'))).join(':');
}

// Parse any stored score into a comparable number for ranking/ELO.
// For Time -> total seconds; everything else -> leading numeric value.
export function parseScoreToNumber(
  value: string | number | null | undefined,
  wodType: string | null | undefined,
): number {
  if (isTimeScoredType(wodType)) return timeStringToSeconds(value ?? 0);
  if (typeof value === 'number') return value;
  return parseFloat((value ?? '').toString()) || 0;
}

// Human-readable display of a stored score.
// For Time -> "mm:ss", ou "CAP + X reps" si le temps limite a été atteint.
// AMRAP/Max Reps -> "123 reps (3 tours + 12)".
export function formatScoreDisplay(
  value: string | number | null | undefined,
  wodType: string | null | undefined,
  repsPerRound: number | null | undefined,
  capped: boolean | null | undefined,
  roundsLabel: RoundsLabel,
): string {
  const raw = (value ?? '').toString();
  if (isTimeScoredType(wodType)) {
    const n = normalizeScore(timeStringToSeconds(raw), capped, true);
    return n.capped ? `CAP + ${n.value} reps` : secondsToTimeString(n.value);
  }
  if (isRepsScoredType(wodType)) {
    const n = parseFloat(raw);
    if (!isNaN(n)) return formatAmrapScore(n, repsPerRound, roundsLabel);
  }
  return raw;
}

export interface TournamentScore {
  id: string;
  athlete_id: string;
  tournament_id: string;
  tournament_wod_id: string;
  score_value: string;
  tiebreak_value: number | null;
  video_url: string | null;
  notes: string | null;
  capped?: boolean | null;
  status: 'pending' | 'validated' | 'rejected';
  submitted_at: string;
  deadline_at: string | null;
  ai_analysis: string | null;
  elo_points: number;
  profile?: { username: string; level: string; elo: number };
  tw?: { title: string; type: string; movements?: string[] };
  t?: { name: string };
}

// `locale` : dateLocale() de src/i18n/locale (ce fichier reste sans dépendance à l'app,
// il est aussi empaqueté par scripts/generate-movement-stats-keys.mjs).
export function formatDate(iso: string, locale: string) {
  try {
    return new Date(iso).toLocaleDateString(locale, {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return iso; }
}

export function formatDateTime(iso: string, locale: string) {
  try {
    return new Date(iso).toLocaleDateString(locale, {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}
