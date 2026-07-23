export const MOVEMENT_BADGE_LEVELS = [
  { level: 1, reps: 100,   label: 'Bronze',   emoji: '🥉', color: '#A0714F' },
  { level: 2, reps: 500,   label: 'Argent',   emoji: '🥈', color: '#9E9E9E' },
  { level: 3, reps: 1000,  label: 'Or',       emoji: '🥇', color: '#FFFFFF' },
  { level: 4, reps: 5000,  label: 'Platine',  emoji: '💎', color: '#67E8F9' },
  { level: 5, reps: 10000, label: 'Légend',   emoji: '👑', color: '#A855F7' },
];

const MOVEMENT_ALIASES: Record<string, { key: string; label: string }> = {
  'thruster': { key: 'thruster', label: 'Thruster' },
  'thrusters': { key: 'thruster', label: 'Thruster' },
  'pull-up': { key: 'pullup', label: 'Pull-up' },
  'pull up': { key: 'pullup', label: 'Pull-up' },
  'pullup': { key: 'pullup', label: 'Pull-up' },
  'pullups': { key: 'pullup', label: 'Pull-up' },
  'burpee': { key: 'burpee', label: 'Burpee' },
  'burpees': { key: 'burpee', label: 'Burpee' },
  'clean': { key: 'clean', label: 'Clean' },
  'cleans': { key: 'clean', label: 'Clean' },
  'snatch': { key: 'snatch', label: 'Snatch' },
  'deadlift': { key: 'deadlift', label: 'Deadlift' },
  'deadlifts': { key: 'deadlift', label: 'Deadlift' },
  'box jump': { key: 'boxjump', label: 'Box Jump' },
  'box jumps': { key: 'boxjump', label: 'Box Jump' },
  'double under': { key: 'doubleunder', label: 'Double Under' },
  'double unders': { key: 'doubleunder', label: 'Double Under' },
  'push up': { key: 'pushup', label: 'Push-up' },
  'push ups': { key: 'pushup', label: 'Push-up' },
  'push-up': { key: 'pushup', label: 'Push-up' },
  'push-ups': { key: 'pushup', label: 'Push-up' },
  'squat': { key: 'squat', label: 'Squat' },
  'squats': { key: 'squat', label: 'Squat' },
  'kettlebell swing': { key: 'kbswing', label: 'KB Swing' },
  'kb swing': { key: 'kbswing', label: 'KB Swing' },
  'toes to bar': { key: 'toes2bar', label: 'Toes to Bar' },
  'toes-to-bar': { key: 'toes2bar', label: 'Toes to Bar' },
  'handstand push-up': { key: 'hspu', label: 'HSPU' },
  'hspu': { key: 'hspu', label: 'HSPU' },
  'wall ball': { key: 'wallball', label: 'Wall Ball' },
  'wall balls': { key: 'wallball', label: 'Wall Ball' },
  'row': { key: 'row', label: 'Rowing' },
  'rowing': { key: 'row', label: 'Rowing' },
};

export function normalizeMovement(raw: string): { key: string; label: string } {
  const lower = raw.toLowerCase().trim();
  return MOVEMENT_ALIASES[lower] ?? { key: lower.replace(/\s+/g, '_'), label: raw };
}

// ── Canonical movement catalog (mirrors the WOD generator) ───────────
// `weighted` = the movement takes an external load (barbell / DB / KB / med ball).
export interface CatalogMovement { name: string; weighted: boolean; cardio?: boolean; }

export const MOVEMENT_CATALOG: CatalogMovement[] = [
  { name: 'Thruster', weighted: true },
  { name: 'Power Clean', weighted: true },
  { name: 'Power Snatch', weighted: true },
  { name: 'Clean & Jerk', weighted: true },
  { name: 'Deadlift', weighted: true },
  { name: 'Front Squat', weighted: true },
  { name: 'Back Squat', weighted: true },
  { name: 'Overhead Squat', weighted: true },
  { name: 'Push Press', weighted: true },
  { name: 'Push Jerk', weighted: true },
  { name: 'Sumo Deadlift High Pull', weighted: true },
  { name: 'Squat Snatch', weighted: true },
  { name: 'Squat Clean', weighted: true },
  { name: 'Squat Clean & Jerk', weighted: true },
  { name: 'Cluster', weighted: true },
  { name: 'Alt DB Snatch', weighted: true },
  { name: 'DB Thruster', weighted: true },
  { name: 'Devils Press', weighted: true },
  { name: 'DB Deadlift', weighted: true },
  { name: 'DB Clean & Jerk', weighted: true },
  { name: 'DB Push Press', weighted: true },
  { name: 'KB Swing', weighted: true },
  { name: 'Goblet Squat', weighted: true },
  { name: 'KB Clean', weighted: true },
  { name: 'Wall Balls', weighted: true },
  { name: 'Pull-ups', weighted: false },
  { name: 'Toes-to-Bar', weighted: false },
  { name: 'Chest-to-Bar', weighted: false },
  { name: 'Bar Muscle-ups', weighted: false },
  { name: 'Handstand Push-ups', weighted: false },
  { name: 'Ring Dips', weighted: false },
  { name: 'Ring Muscle-ups', weighted: false },
  { name: 'Rope Climbs', weighted: false },
  { name: 'Pistols', weighted: false },
  { name: 'Handstand Walk', weighted: false },
  { name: 'Box Jump-overs', weighted: false },
  { name: 'Box Jumps', weighted: false },
  { name: 'Box Step-ups', weighted: false },
  { name: 'Burpees Over the Bar', weighted: false },
  { name: 'Burpees', weighted: false },
  { name: 'Push-ups', weighted: false },
  { name: 'Sit-ups', weighted: false },
  { name: 'Air Squats', weighted: false },
  { name: 'Row', weighted: false, cardio: true },
  { name: 'Bike Erg', weighted: false, cardio: true },
  { name: 'Echo Bike', weighted: false, cardio: true },
  { name: 'SkiErg', weighted: false, cardio: true },
  { name: 'Run', weighted: false, cardio: true },
  { name: 'Double-unders', weighted: false },
  { name: 'Lunges', weighted: false },
  { name: 'V-ups', weighted: false },
  { name: 'Hollow Rocks', weighted: false },
];

export function isWeightedMovement(name: string): boolean {
  const found = MOVEMENT_CATALOG.find(m => m.name.toLowerCase() === name.toLowerCase().trim());
  if (found) return found.weighted;
  return false;
}

// Serialize a structured movement row into a parseable line.
// reps + name (+ optional men/women loads). Cardio distance movements keep the number as-is.
//   { reps: 21, name: 'Thruster', weightKg: 43 }                  -> "21 Thruster (43 kg)"
//   { reps: 21, name: 'Thruster', weightKg: 43, weightKgW: 30 }   -> "21 Thruster (43/30 kg)"
//   { reps: 12, name: 'Pull-ups' }                                -> "12 Pull-ups"
export function serializeMovement(
  reps: number,
  name: string,
  weightKg?: number | null,
  weightKgWomen?: number | null,
): string {
  const base = `${reps} ${name.trim()}`.trim();
  const men = weightKg != null && weightKg > 0 ? weightKg : null;
  const women = weightKgWomen != null && weightKgWomen > 0 ? weightKgWomen : null;
  if (men != null && women != null) return `${base} (${men}/${women} kg)`;
  if (men != null) return `${base} (${men} kg)`;
  if (women != null) return `${base} (${women} kg)`;
  return base;
}

// Parse a stored movement line back into structured parts (best-effort, tolerant
// of legacy free-text like "7 reps — Sumo Deadlift High Pull @ 42.5/30 kg").
// A "men/women" pair ("43/30 kg") splits into weightKg (men) + weightKgWomen (women).
export function parseMovementRow(line: string): {
  reps: number | null;
  name: string;
  weightKg: number | null;
  weightKgWomen: number | null;
} {
  let s = (line ?? '').trim();
  // weight: "(43 kg)" / "(43/30 kg)" or "@ 43kg" / "@ 42.5/30 kg"
  let weightKg: number | null = null;
  let weightKgWomen: number | null = null;
  const num = String.raw`\d+(?:\.\d+)?`;
  const wParen = s.match(new RegExp(String.raw`\((${num})(?:\s*\/\s*(${num}))?\s*kg\)`, 'i'));
  const wAt = s.match(new RegExp(String.raw`@\s*(${num})(?:\s*\/\s*(${num}))?`, 'i'));
  const w = wParen ?? wAt;
  if (w) {
    weightKg = parseFloat(w[1]);
    if (w[2] != null) weightKgWomen = parseFloat(w[2]);
  }
  s = s.replace(/\((?:[^)]*)\)/g, '').replace(/@.*$/, '').trim();
  // leading reps, tolerating a "reps"/"rep"/"x" word and a "—"/"-" separator
  const m = s.match(/^(\d+)\s*(?:reps?|x)?\s*[—\-:]?\s*(.+)$/i);
  if (m) {
    return { reps: parseInt(m[1], 10), name: m[2].trim(), weightKg, weightKgWomen };
  }
  return { reps: null, name: s, weightKg, weightKgWomen };
}

// ── AMRAP / Max Reps score helpers ────────────────────────────────────────
// Score for these WODs is normalized to a TOTAL rep count so ranking + auto-
// decide stay coherent whether the athlete entered "rounds + reps" or a raw
// total. reps_per_round converts between the two representations.

// Sum of leading rep counts across the movement lines (one full round).
// Returns 0 when no rep-based movement is found.
export function repsPerRoundFromMovements(movements: string[] | null | undefined): number {
  if (!Array.isArray(movements)) return 0;
  return movements.reduce((acc, line) => {
    const { reps } = parseMovementRow(line);
    return acc + (reps ?? 0);
  }, 0);
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

// "123 reps (3 tours + 12)" — or just "123 reps" when reps_per_round is unknown.
export function formatAmrapScore(
  total: number,
  repsPerRound: number | null | undefined,
): string {
  const repsLabel = `${total} reps`;
  if (!repsPerRound || repsPerRound <= 0) return repsLabel;
  const { rounds, reps } = amrapTotalToRoundsReps(total, repsPerRound);
  return `${repsLabel} (${rounds} tour${rounds > 1 ? 's' : ''}${reps > 0 ? ` + ${reps}` : ''})`;
}

// WOD types whose score is a total rep count.
export function isRepsScoredType(type: string | null | undefined): boolean {
  const t = (type ?? '').toLowerCase();
  return t === 'amrap' || t === 'max reps';
}
