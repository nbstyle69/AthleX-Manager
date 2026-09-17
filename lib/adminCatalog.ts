// ── Admin : édition de `movement_catalog` et `wod_volume_caps` ──────────────
// Types et validation partagés entre les routes `/api/admin/movement-catalog`,
// `/api/admin/volume-caps` et leurs pages. Les contraintes reprennent les CHECK
// de la migration `20261211000000_movement_catalog.sql` (athlex-app) pour
// refuser côté Manager ce que la base refuserait.

// Même liste, même ordre que le CHECK `movement_catalog_family_check`
// (migration `20261214000000_movement_catalog_musculation` d'athlex-app, qui a
// ajouté `machine` et `cable`). Sans elles ici, la validation de la route
// refusait « famille inconnue » sur toute ligne de musculation : les exercices
// machine et poulie étaient au catalogue mais inéditables (écart E12).
export const CATALOG_FAMILIES = [
  'barbell', 'dumbbell', 'kettlebell', 'gym', 'bodyweight', 'erg', 'run',
  'sled', 'carry', 'sandbag', 'wallball', 'jump_rope', 'box', 'machine', 'cable', 'other',
] as const;
export type CatalogFamily = typeof CATALOG_FAMILIES[number];

export const CATALOG_PATTERNS = [
  'squat', 'hinge', 'push_v', 'push_h', 'pull_v', 'pull_h', 'carry', 'lunge', 'core', 'mono',
] as const;
export type CatalogPattern = typeof CATALOG_PATTERNS[number];

export const CATALOG_MODALITIES = ['W', 'G', 'M'] as const;
export type CatalogModality = typeof CATALOG_MODALITIES[number];
export const MODALITY_LABEL: Record<CatalogModality, string> = {
  W: 'W · haltéro', G: 'G · gymnastique', M: 'M · monostructural',
};

export const CATALOG_UNITS = ['reps', 'cal', 'm', 's'] as const;
export type CatalogUnit = typeof CATALOG_UNITS[number];

export const LOAD_UNITS = ['kg', 'cm'] as const;
export type LoadUnit = typeof LOAD_UNITS[number];

/** Les six catégories de charge, dans l'ordre d'affichage. */
export const LOAD_CATEGORIES = ['scaled', 'inter', 'rx', 'rxplus', 'elite', 'pro'] as const;
export type LoadCategory = typeof LOAD_CATEGORIES[number];
export const LOAD_CATEGORY_LABEL: Record<LoadCategory, string> = {
  scaled: 'Scaled', inter: 'Inter', rx: 'RX', rxplus: 'RX+', elite: 'Elite', pro: 'Pro',
};

export const LOAD_BANDS = ['light', 'medium', 'heavy'] as const;
export type LoadBand = typeof LOAD_BANDS[number];
export const LOAD_BAND_LABEL: Record<LoadBand, string> = { light: 'Light', medium: 'Medium', heavy: 'Heavy' };

/** `[H, F]` par bande, par catégorie — la forme de `movement_catalog.loads`. */
export type LoadTable = Record<LoadCategory, Record<LoadBand, [number, number]>>;

export interface MovementCatalogAdminRow {
  id: string;
  name: string;
  family: CatalogFamily;
  pattern: CatalogPattern[];
  modality: CatalogModality;
  grip: string;
  shoulder_load: string;
  unit_default: CatalogUnit;
  units_allowed: CatalogUnit[];
  load_unit: LoadUnit | null;
  weight_functional: number;
  weight_hybrid: number;
  equipment: string[];
  cadence: unknown;
  loads: LoadTable | null;
  rep_ranges: unknown;
  substitutions: unknown;
  variant_up: string | null;
  badge_key: string | null;
  active: boolean;
  version: number;
  notes: string | null;
  updated_at: string;
  // ── Musculation (lecture seule dans l'admin) ────────────────────────────
  // Renseignées seulement sur les lignes `discipline_muscu`. Leur édition
  // viendra dans un lot ultérieur : les afficher évite qu'un admin croie
  // qu'un exercice muscu n'a pas de métadonnées parce qu'il ne les voit pas.
  discipline_muscu?: boolean;
  muscle_primary?: string | null;
  muscle_secondary?: string[] | null;
  compound?: boolean;
  unilateral?: boolean;
  level_min?: string | null;
  load_mode?: string | null;
  priority?: number | null;
  movement_group?: string | null;
}

/** Champs modifiables depuis l'onglet Catalogue. */
export interface MovementCatalogPatch {
  name?: string;
  family?: CatalogFamily;
  pattern?: CatalogPattern[];
  modality?: CatalogModality;
  unit_default?: CatalogUnit;
  units_allowed?: CatalogUnit[];
  load_unit?: LoadUnit | null;
  weight_functional?: number;
  weight_hybrid?: number;
  loads?: LoadTable | null;
  active?: boolean;
  notes?: string | null;
}

/** Création : champs minimum (id, nom, famille, unités, modalité, pattern, poids, actif). */
export interface MovementCatalogCreate extends Required<Omit<MovementCatalogPatch, 'loads' | 'notes' | 'load_unit'>> {
  id: string;
  load_unit: LoadUnit | null;
  loads?: LoadTable | null;
}

export const ID_RE = /^[a-z0-9_]+$/;

function isIn<T extends string>(list: readonly T[], v: unknown): v is T {
  return typeof v === 'string' && (list as readonly string[]).includes(v);
}

function isIntIn(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
}

export function emptyLoadTable(): LoadTable {
  const out = {} as LoadTable;
  for (const c of LOAD_CATEGORIES) {
    out[c] = { light: [0, 0], medium: [0, 0], heavy: [0, 0] };
  }
  return out;
}

/** Une table 6 × 3 × [H, F] d'entiers ≥ 0 (les zéros sont acceptés : « à définir »). */
export function validateLoadTable(v: unknown): v is LoadTable {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  for (const c of LOAD_CATEGORIES) {
    const bands = o[c];
    if (!bands || typeof bands !== 'object') return false;
    for (const b of LOAD_BANDS) {
      const pair = (bands as Record<string, unknown>)[b];
      if (!Array.isArray(pair) || pair.length !== 2) return false;
      if (!pair.every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0)) return false;
    }
  }
  return true;
}

/**
 * Valide un patch (les clés absentes sont ignorées) et renvoie les erreurs en
 * français, ou une liste vide. `full` exige les champs de création.
 */
export function validateMovementPatch(body: unknown, full: boolean): { errors: string[]; patch: MovementCatalogPatch & { id?: string } } {
  const errors: string[] = [];
  const patch: MovementCatalogPatch & { id?: string } = {};
  if (!body || typeof body !== 'object') return { errors: ['corps JSON attendu'], patch };
  const b = body as Record<string, unknown>;

  if (full) {
    if (typeof b.id !== 'string' || !ID_RE.test(b.id)) errors.push('id : minuscules, chiffres et _ uniquement');
    else patch.id = b.id;
  }
  const need = (k: string) => full && !(k in b) && errors.push(`${k} requis`);

  if ('name' in b) {
    if (typeof b.name !== 'string' || !b.name.trim()) errors.push('nom requis');
    else patch.name = b.name.trim();
  } else need('name');

  if ('family' in b) {
    if (!isIn(CATALOG_FAMILIES, b.family)) errors.push('famille inconnue');
    else patch.family = b.family;
  } else need('family');

  if ('pattern' in b) {
    if (!Array.isArray(b.pattern) || !b.pattern.every(p => isIn(CATALOG_PATTERNS, p))) errors.push('pattern inconnu');
    else patch.pattern = b.pattern as CatalogPattern[];
  } else need('pattern');

  if ('modality' in b) {
    if (!isIn(CATALOG_MODALITIES, b.modality)) errors.push('modalité : W, G ou M');
    else patch.modality = b.modality;
  } else need('modality');

  if ('units_allowed' in b) {
    if (!Array.isArray(b.units_allowed) || b.units_allowed.length === 0 || !b.units_allowed.every(u => isIn(CATALOG_UNITS, u))) {
      errors.push('unités : au moins une parmi reps, cal, m, s');
    } else patch.units_allowed = b.units_allowed as CatalogUnit[];
  } else need('units_allowed');

  if ('unit_default' in b) {
    if (!isIn(CATALOG_UNITS, b.unit_default)) errors.push('unité par défaut inconnue');
    else patch.unit_default = b.unit_default;
  } else need('unit_default');

  if (patch.unit_default && patch.units_allowed && !patch.units_allowed.includes(patch.unit_default)) {
    errors.push("l'unité par défaut doit faire partie des unités autorisées");
  }

  if ('load_unit' in b) {
    if (b.load_unit === null || b.load_unit === '') patch.load_unit = null;
    else if (!isIn(LOAD_UNITS, b.load_unit)) errors.push('unité de charge : kg, cm ou aucune');
    else patch.load_unit = b.load_unit;
  } else need('load_unit');

  for (const k of ['weight_functional', 'weight_hybrid'] as const) {
    if (k in b) {
      if (!isIntIn(b[k], 0, 10)) errors.push(`${k} : entier de 0 à 10`);
      else patch[k] = b[k] as number;
    } else need(k);
  }

  if ('loads' in b) {
    if (b.loads === null) patch.loads = null;
    else if (!validateLoadTable(b.loads)) errors.push('bandes de charge : 6 catégories × 3 bandes × [H, F]');
    else patch.loads = b.loads;
  }

  if ('active' in b) {
    if (typeof b.active !== 'boolean') errors.push('active : booléen');
    else patch.active = b.active;
  } else need('active');

  if ('notes' in b) {
    if (b.notes !== null && typeof b.notes !== 'string') errors.push('notes : texte');
    else patch.notes = (b.notes as string | null) || null;
  }

  return { errors, patch };
}

// ── wod_volume_caps ────────────────────────────────────────────────────────

export interface VolumeCapRow {
  label: string;
  ids: string[] | null;
  family: CatalogFamily | null;
  band: LoadBand | null;
  unit: CatalogUnit;
  rx_total: number;
  active: boolean;
  version: number;
  updated_at: string;
}

export interface VolumeCapPatch {
  rx_total?: number;
  active?: boolean;
  unit?: CatalogUnit;
}

export function validateVolumeCapPatch(body: unknown): { errors: string[]; patch: VolumeCapPatch } {
  const errors: string[] = [];
  const patch: VolumeCapPatch = {};
  if (!body || typeof body !== 'object') return { errors: ['corps JSON attendu'], patch };
  const b = body as Record<string, unknown>;
  if ('rx_total' in b) {
    if (!isIntIn(b.rx_total, 1, 100000)) errors.push('rx_total : entier > 0');
    else patch.rx_total = b.rx_total as number;
  }
  if ('active' in b) {
    if (typeof b.active !== 'boolean') errors.push('active : booléen');
    else patch.active = b.active;
  }
  if ('unit' in b) {
    if (!isIn(CATALOG_UNITS, b.unit)) errors.push('unité inconnue');
    else patch.unit = b.unit;
  }
  if (Object.keys(patch).length === 0 && errors.length === 0) errors.push('rien à modifier');
  return { errors, patch };
}

export interface SkeletonRow {
  id: string;
  discipline: string;
  format: string;
  definition: unknown;
  active: boolean;
  version: number;
  updated_at: string;
}
