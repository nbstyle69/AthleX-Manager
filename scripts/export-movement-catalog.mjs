#!/usr/bin/env node
// Régénère lib/movementCatalog.snapshot.json depuis Supabase (`movement_catalog`).
// Le snapshot est le repli hors ligne du Manager (lib/movementCatalog.ts) ; il
// embarque toutes les lignes, actives ou non (les coachs voient les inactives).
//
//   NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/export-movement-catalog.mjs
//
// La clé anon suffit (lecture `authenticated`/`anon` refusée → utiliser le service role).
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.');
  process.exit(1);
}

const COLUMNS = [
  'id', 'name', 'family', 'pattern', 'modality', 'unit_default', 'units_allowed',
  'load_unit', 'weight_functional', 'weight_hybrid', 'badge_key', 'active', 'version',
];

const res = await fetch(`${url}/rest/v1/movement_catalog?select=${COLUMNS.join(',')}&order=name.asc`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
});
if (!res.ok) {
  console.error(`Supabase ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const rows = await res.json();
if (!Array.isArray(rows) || rows.length === 0) {
  console.error('Aucune ligne : snapshot non réécrit.');
  process.exit(1);
}

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'movementCatalog.snapshot.json');
writeFileSync(out, JSON.stringify(rows, null, 2) + '\n');
console.log(`${rows.length} mouvements → ${path.relative(process.cwd(), out)}`);
