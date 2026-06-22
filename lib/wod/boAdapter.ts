/**
 * BattleWOD — Adaptateur BO web
 * =============================
 * Convertit la sortie des moteurs déterministes vers la forme attendue par
 * le formulaire WOD du Back Office (movements: string[], timer_type, etc.).
 */

import { generateCFWod, CFParams, CFWod, Level, Intent, Method, Block as CFBlock, Movement as CFMovement } from './engineCrossFit';
import { generateHyroxWod, HyroxWod, HyroxParams, SessionType, Category, TrainingType, Block as HyBlock } from './engineHyrox';
import { applyTeamFormat } from './teamWod';
import { randomSeed } from './rng';

export interface BOGenResult {
  title: string;
  movements: string[];
  scoring: string;
  description: string;
  timer_type: string;
  time_cap_seconds: number | null;
  rounds: number | null;
  work_seconds: number | null;
  rest_seconds: number | null;
  duration_minutes: number;
}

const cap1 = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function cfMovementLine(m: CFMovement): string {
  let line = `${m.prescription} — ${m.name}`;
  if (m.load) line += ` @ ${m.load}`;
  if (m.scaling_note) line += `  (${m.scaling_note})`;
  return line;
}
function cfBlockLines(b: CFBlock): string[] {
  const header = b.label ? `${b.label} · ${b.scheme}` : b.scheme;
  const lines = [header, ...b.movements.map(cfMovementLine)];
  if (b.rest) lines.push(`→ Repos : ${b.rest}`);
  return lines;
}
function hyMovementLine(m: { name: string; prescription: string; load: string | null; substitution: string | null }): string {
  let line = `${m.prescription} — ${m.name}`;
  if (m.load) line += ` @ ${m.load}`;
  if (m.substitution) line += `  [sub: ${m.substitution}]`;
  return line;
}
function hyBlockLines(b: HyBlock): string[] {
  const header = b.label ? `${b.label} · ${b.scheme}` : b.scheme;
  const lines = [header, ...b.movements.map(hyMovementLine)];
  if (b.rest) lines.push(`→ Repos : ${b.rest}`);
  return lines;
}

// ============================ Functional Fitness ============================

const CF_LEVEL_MAP: Record<string, Level> = {
  scaled: 'Scaled', inter: 'Inter', rx: 'RX', 'rx+': 'RX+', gx: 'Elite', elite: 'Elite', pro: 'Pro',
};
const CF_EQ_MAP: Record<string, string> = {
  'Barbell': 'Barbell', 'Haltères': 'Haltères', 'Kettlebell': 'Kettlebell', 'Box': 'Box',
  'Corde à sauter': 'Corde', 'Barre de traction': 'Barre traction', 'Anneaux': 'Anneaux',
  'Erg': 'Erg', 'Med Ball': 'Med Ball', 'Worm': 'Worm', 'Sans matériel': 'Sans matériel',
};
const CF_METHODS: Method[] = ['For Time', 'AMRAP', 'EMOM', 'Tabata', 'Max Reps'];

const CF_TIMER: Record<string, string> = {
  'AMRAP': 'stopwatch', 'For Time': 'countdown', 'EMOM': 'emom',
  'Tabata': 'tabata', 'Max Reps': 'countdown', 'Strength': 'none',
};
const CF_SCORING: Record<string, (d: number) => string> = {
  'AMRAP': (d) => `Max rounds + reps en ${d} min`,
  'For Time': (d) => `Temps total (cap ${d} min)`,
  'EMOM': (d) => `EMOM ${d} min — score = rounds complétés`,
  'Tabata': () => 'Score = total de reps',
  'Max Reps': () => 'Score = total de reps',
  'Strength': () => 'Score = charge max',
};

export function boGenerateFunctional(type: string, level: string, duration: number, eqList: string[]): BOGenResult {
  const isStrength = type === 'Strength';
  const equipment = eqList.filter(e => e !== 'Benchmark' && e !== 'GHD').map(e => CF_EQ_MAP[e] ?? e);
  const params: CFParams = {
    level: CF_LEVEL_MAP[level] ?? 'RX',
    duration_min: duration,
    intent: isStrength ? 'Force' : 'Mixed',
    method: (CF_METHODS.includes(type as Method) ? type : 'For Time') as Method,
    format: 'Solo',
    equipment,
    benchmark: eqList.includes('Benchmark'),
  };
  const wod: CFWod = generateCFWod(params, randomSeed());

  const movements: string[] = [];
  if (wod.strength) movements.push(...cfBlockLines(wod.strength));
  if (!isStrength) wod.blocks.forEach(b => movements.push(...cfBlockLines(b)));

  return {
    title: wod.title,
    movements,
    scoring: (CF_SCORING[type] ?? CF_SCORING['For Time'])(duration),
    description: [wod.stimulus, wod.coach_notes[0]].filter(Boolean).join(' '),
    timer_type: CF_TIMER[type] ?? 'stopwatch',
    time_cap_seconds: isStrength || type === 'Tabata' ? null : duration * 60,
    rounds: type === 'EMOM' ? duration : type === 'Tabata' ? 8 : null,
    work_seconds: type === 'Tabata' ? 20 : null,
    rest_seconds: type === 'Tabata' ? 10 : null,
    duration_minutes: duration,
  };
}

// ============================ Hybrid / Hyrox ============================

const HY_CATEGORY_MAP: Record<string, Category> = {
  Open: 'Men', Pro: 'Men Pro', Elite: 'Men Pro',
};

export function boGenerateHybrid(type: string, level: string, format: string, duration: number, eqList: string[]): BOGenResult {
  const isRunInterval = type === 'Running Intervals';
  const session_type: SessionType = isRunInterval ? 'Run Split' : 'Engine';
  const training_type: TrainingType = (isRunInterval ? 'Cardio Force' : type) as TrainingType;
  const params: HyroxParams = {
    category: HY_CATEGORY_MAP[level] ?? 'Men',
    duration_min: (duration as HyroxParams['duration_min']),
    session_type,
    format: (format as HyroxParams['format']),
    training_type,
    equipment: eqList,
    vest: 'off',
  };
  const seed = randomSeed();
  let wod: HyroxWod = generateHyroxWod(params, seed);
  if (!/solo/i.test(format)) wod = applyTeamFormat(wod, { mode: 'hyrox', seed });

  const movements: string[] = [];
  wod.blocks.forEach(b => movements.push(...hyBlockLines(b)));
  if (wod.modifiers.length > 0) movements.push(`⚙️ ${wod.modifiers.join(' · ')}`);

  return {
    title: wod.title,
    movements,
    scoring: `${cap1(wod.score_type)} (cap ${wod.time_cap_min} min)`,
    description: `${type} — ${format} — ${level} — ${duration} min. ${wod.coach_notes[0] ?? wod.stimulus}`,
    timer_type: 'countdown',
    time_cap_seconds: duration * 60,
    rounds: null,
    work_seconds: null,
    rest_seconds: null,
    duration_minutes: duration,
  };
}
