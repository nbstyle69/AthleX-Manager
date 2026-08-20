// Lecture des données de force d'un athlète, côté staff. Ces helpers sont purs :
// les deux lectures elles-mêmes passent par des RPC `SECURITY DEFINER`
// (`get_athlete_private_profile`, `list_athlete_strength_sets`), jamais par une
// lecture directe des colonnes privées ni de `strength_set_logs`.

export interface StrengthSet {
  id: string;
  source_type: string;
  source_id: string;
  source_title: string | null;
  movement: string;
  movement_label: string | null;
  set_index: number;
  reps: number;
  load_kg: number | null;
  prescribed_reps: number | null;
  prescribed_load_kg: number | null;
  performed_at: string;
}

export interface Record1RM {
  movement: string;
  value: string;
  date: string | null;
  /** `strength_set_logs.id` de la série qui a établi ce record, si connue. */
  sourceId: string | null;
}

export interface StrengthSession {
  key: string;
  title: string;
  sourceType: string;
  performedAt: string;
  sets: StrengthSet[];
}

const PR_PREFIXES = ['weightlifting_', 'Haltérophilie_'];

/**
 * Records d'haltérophilie lisibles depuis `personal_records`.
 *
 * Les clés `_date` et `_src` accompagnent une valeur, elles n'en sont pas une :
 * les traiter comme des charges afficherait un uuid en kilos.
 */
export function readWeightliftingRecords(
  records: Record<string, unknown> | null,
): Record1RM[] {
  if (!records) return [];
  const out: Record1RM[] = [];
  for (const [key, raw] of Object.entries(records)) {
    if (key.endsWith('_date') || key.endsWith('_src')) continue;
    const prefix = PR_PREFIXES.find(p => key.startsWith(p));
    if (!prefix) continue;
    if (typeof raw !== 'string' && typeof raw !== 'number') continue;
    const movement = key.slice(prefix.length);
    const date = records[`${key}_date`];
    const src = records[`${key}_src`];
    out.push({
      movement,
      value: String(raw),
      date: typeof date === 'string' ? date : null,
      sourceId: typeof src === 'string' ? src : null,
    });
  }
  return out.sort((a, b) => a.movement.localeCompare(b.movement));
}

/** Regroupe les séries par séance/bloc (jour + source), la plus récente d'abord. */
export function groupStrengthSessions(sets: StrengthSet[]): StrengthSession[] {
  const map = new Map<string, StrengthSession>();
  for (const s of sets) {
    const day = s.performed_at.slice(0, 10);
    const key = `${day}|${s.source_type}|${s.source_id}`;
    const existing = map.get(key);
    if (existing) {
      existing.sets.push(s);
      if (s.performed_at > existing.performedAt) existing.performedAt = s.performed_at;
      continue;
    }
    map.set(key, {
      key,
      title: s.source_title ?? 'Séance sans titre',
      sourceType: s.source_type,
      performedAt: s.performed_at,
      sets: [s],
    });
  }
  return [...map.values()].sort((a, b) => b.performedAt.localeCompare(a.performedAt));
}
