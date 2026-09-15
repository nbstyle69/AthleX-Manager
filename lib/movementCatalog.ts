// ── Catalogue de mouvements : Supabase `movement_catalog` + snapshot embarqué ──
// Le Manager lit la même table que le générateur de l'app. Le store est
// synchrone (les helpers de `lib/movements.ts` restent synchrones) et démarre
// sur le snapshot ; `setMovementCatalog` le remplace quand Supabase a répondu
// (client : `useMovementCatalog`, serveur : `loadMovementCatalog` par requête).
// Les mouvements `active = false` restent proposés aux coachs — seul le
// générateur de l'app les ignore.
import snapshot from './movementCatalog.snapshot.json';

/** Unité d'une quantité : répétitions, mètres, calories, secondes (Plank Hold). */
export type MovementUnit = 'reps' | 'm' | 'cal' | 's';

/** Colonnes de `movement_catalog` embarquées dans le snapshot. */
export interface MovementCatalogRow {
  id: string;
  name: string;
  family: string;
  pattern: string[] | null;
  modality: string | null;
  unit_default: string | null;
  units_allowed: string[] | null;
  load_unit: string | null;
  weight_functional: number | null;
  weight_hybrid: number | null;
  badge_key: string | null;
  active: boolean;
  version: number | null;
}

export interface CatalogMovement {
  name: string;
  /** Prend une charge externe (`load_unit = 'kg'`). */
  weighted: boolean;
  /** Quantité mesurée en mètres ou calories (`units_allowed` ∋ m | cal). */
  cardio?: boolean;
  /** Unité par défaut d'une ligne ; `reps` hors m/cal. */
  unit?: MovementUnit;
  /** `movement_catalog.id` ; `null` pour une entrée hors catalogue. */
  id: string | null;
  family: string | null;
  active: boolean;
}

export type MovementCatalogSource = 'supabase' | 'snapshot';

function toUnit(u: string | null | undefined): MovementUnit {
  return u === 'm' || u === 'cal' || u === 's' ? u : 'reps';
}

export function catalogMovementFromRow(row: MovementCatalogRow): CatalogMovement {
  const cardio = (row.units_allowed ?? []).some(u => u === 'm' || u === 'cal');
  return {
    id: row.id,
    name: row.name,
    family: row.family,
    weighted: row.load_unit === 'kg',
    cardio: cardio || undefined,
    unit: toUnit(row.unit_default),
    active: row.active,
  };
}

export const MOVEMENT_CATALOG_SNAPSHOT: readonly MovementCatalogRow[] = snapshot as MovementCatalogRow[];

function keyOf(name: string): string {
  return name.toLowerCase().trim();
}

let list: CatalogMovement[] = MOVEMENT_CATALOG_SNAPSHOT.map(catalogMovementFromRow);
let byKey = new Map(list.map(m => [keyOf(m.name), m]));
let source: MovementCatalogSource = 'snapshot';

/** Liste courante (snapshot puis Supabase), inactifs compris, triée par nom. */
export function getMovementCatalog(): CatalogMovement[] {
  return list;
}

export function getMovementCatalogSource(): MovementCatalogSource {
  return source;
}

export function findCatalogMovement(name: string): CatalogMovement | undefined {
  return byKey.get(keyOf(name));
}

/** Remplace le store ; ignoré si la liste est vide (on garde le repli). */
export function setMovementCatalog(rows: MovementCatalogRow[], from: MovementCatalogSource): boolean {
  if (rows.length === 0) return false;
  list = rows.map(catalogMovementFromRow).sort((a, b) => a.name.localeCompare(b.name));
  byKey = new Map(list.map(m => [keyOf(m.name), m]));
  source = from;
  return true;
}

/** Remet le snapshot embarqué (tests). */
export function resetMovementCatalog(): void {
  setMovementCatalog([...MOVEMENT_CATALOG_SNAPSHOT], 'snapshot');
}

export const MOVEMENT_CATALOG_COLUMNS =
  'id, name, family, pattern, modality, unit_default, units_allowed, load_unit, weight_functional, weight_hybrid, badge_key, active, version';

type CatalogReader = {
  from: (table: string) => {
    select: (cols: string) => {
      order: (col: string, opts: { ascending: boolean }) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
    };
  };
};

/**
 * Charge `movement_catalog` (client anon/authentifié ou service) et alimente le
 * store. Toute erreur ou liste vide laisse le snapshot en place.
 */
export async function loadMovementCatalog(supabase: CatalogReader): Promise<MovementCatalogSource> {
  try {
    const { data, error } = await supabase
      .from('movement_catalog')
      .select(MOVEMENT_CATALOG_COLUMNS)
      .order('name', { ascending: true });
    if (error || !Array.isArray(data)) return source;
    return setMovementCatalog(data as MovementCatalogRow[], 'supabase') ? 'supabase' : source;
  } catch {
    return source;
  }
}
