// ── `box_wods.wod_json` : le WOD structuré écrit à côté de `description` ─────
// `description` reste la source de vérité côté athlète (l'app la lit et la
// parse) ; `wod_json` en est la lecture structurée, dérivée des mêmes lignes,
// pour que l'app puisse s'en servir dans un lot ultérieur sans re-parser.
//
// Tant que la colonne n'est pas en prod, l'écriture est gardée : une erreur
// « colonne inconnue » (PostgreSQL 42703, PostgREST PGRST204) rejoue la même
// opération sans `wod_json`. Le garde disparaîtra une fois la migration
// `20261213000000_box_wods_wod_json` appliquée partout.
import { findCatalogMovement, type MovementUnit } from '@/lib/movementCatalog';
import { parseMovementRow } from '@/lib/movements';
import { parseStrengthLine, type StrengthEntry } from '@/lib/strengthBlock';
import { parseCardioLine, type CardioEntry } from '@/lib/cardioBlock';

export const WOD_JSON_VERSION = 1;

export interface WodJsonMovement {
  reps: number | null;
  repsWomen: number | null;
  unit: MovementUnit;
  name: string;
  /** `movement_catalog.id` quand le nom est au catalogue, sinon `null`. */
  catalogId: string | null;
  weightKg: number | null;
  weightKgWomen: number | null;
}

export interface WodJson {
  version: typeof WOD_JSON_VERSION;
  source: 'manager';
  format: string | null;
  time_cap_s: number | null;
  rounds: number | null;
  emom_interval_s: number | null;
  tabata: { work_s: number; rest_s: number } | null;
  strength: StrengthEntry[];
  cardio: CardioEntry[];
  movements: WodJsonMovement[];
  /** Lignes de `description` qui ne sont ni force, ni cardio, ni mouvement lisible. */
  free_text: string[];
}

/** Colonnes de `box_wods` dont `wod_json` est dérivé. */
export interface WodJsonSource {
  description: string | null;
  wod_type: string | null;
  time_cap_seconds: number | null;
  rounds: number | null;
  emom_interval_minutes?: number | null;
  tabata_work_seconds?: number | null;
  tabata_rest_seconds?: number | null;
}

/** « 5 rounds : … », « 3 tours … » : en-tête de rounds en prose, pas un mouvement. */
const ROUNDS_HEADER = /^(\d+)\s*(rounds?|rds?|tours?|sets?|s[ée]ries?)\b/i;
/** Un « nom » qui enchaîne plusieurs mouvements ou une explication n'est pas un mouvement. */
const PROSE_NAME = /\s[\/:;|]\s|\s(puis|then|et|and)\s/i;

export function buildWodJson(src: WodJsonSource): WodJson {
  const strength: StrengthEntry[] = [];
  const cardio: CardioEntry[] = [];
  const movements: WodJsonMovement[] = [];
  const free_text: string[] = [];
  let roundsFromText: number | null = null;

  for (const raw of (src.description ?? '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const s = parseStrengthLine(line);
    if (s) { strength.push(s); continue; }
    const c = parseCardioLine(line);
    if (c) { cardio.push(c); continue; }
    const header = line.match(ROUNDS_HEADER);
    if (header) {
      if (roundsFromText == null) roundsFromText = parseInt(header[1], 10);
      free_text.push(line);
      continue;
    }
    const row = parseMovementRow(line);
    if (!row.name || row.reps == null || PROSE_NAME.test(row.name)) { free_text.push(line); continue; }
    movements.push({
      reps: row.reps,
      repsWomen: row.repsWomen,
      unit: row.unit,
      name: row.name,
      catalogId: findCatalogMovement(row.name)?.id ?? null,
      weightKg: row.weightKg,
      weightKgWomen: row.weightKgWomen,
    });
  }

  const tabataWork = src.tabata_work_seconds ?? null;
  const tabataRest = src.tabata_rest_seconds ?? null;
  return {
    version: WOD_JSON_VERSION,
    source: 'manager',
    format: src.wod_type ?? null,
    time_cap_s: src.time_cap_seconds ?? null,
    rounds: src.rounds ?? roundsFromText,
    emom_interval_s: src.emom_interval_minutes != null ? src.emom_interval_minutes * 60 : null,
    tabata: src.wod_type === 'tabata' && tabataWork != null
      ? { work_s: tabataWork, rest_s: tabataRest ?? 0 }
      : null,
    strength,
    cardio,
    movements,
    free_text,
  };
}

/** Ajoute `wod_json` dérivé à un payload `box_wods` (insert ou update). */
export function withWodJson<T extends WodJsonSource>(payload: T): T & { wod_json: WodJson } {
  return { ...payload, wod_json: buildWodJson(payload) };
}

type PgError = { code?: string | null; message: string } | null;

/** La colonne n'existe pas encore sur cette base (migration non appliquée). */
export function isMissingWodJsonColumn(error: PgError): boolean {
  return !!error && (error.code === '42703' || error.code === 'PGRST204');
}

/**
 * Exécute l'écriture avec `wod_json`, puis sans si la base ne connaît pas la
 * colonne. `run(true)` et `run(false)` doivent produire la même opération, la
 * colonne en plus ou en moins.
 */
export async function writeWithWodJsonFallback<R extends { error: PgError }>(
  run: (includeWodJson: boolean) => PromiseLike<R>,
): Promise<R> {
  const first = await run(true);
  if (!isMissingWodJsonColumn(first.error)) return first;
  return run(false);
}

/** Retire `wod_json` d'une ligne ou d'un lot de lignes (repli du garde). */
export function stripWodJson<T extends { wod_json?: unknown }>(rows: T[]): Omit<T, 'wod_json'>[];
export function stripWodJson<T extends { wod_json?: unknown }>(row: T): Omit<T, 'wod_json'>;
export function stripWodJson<T extends { wod_json?: unknown }>(input: T | T[]) {
  const strip = (r: T) => { const { wod_json: _omit, ...rest } = r; void _omit; return rest; };
  return Array.isArray(input) ? input.map(strip) : strip(input);
}
