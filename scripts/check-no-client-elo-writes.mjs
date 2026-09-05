#!/usr/bin/env node
/**
 * Garde : plus aucune écriture ELO côté client.
 *
 * La clôture d'un tournoi passe par la RPC serveur `finalize_tournament_elo`
 * (une transaction : classement, tournament_elo_history, profiles.elo, statut).
 * Le 10/08, un `profiles.update` filtré par la RLS (204, 0 ligne) suivi d'un
 * `tournament_elo_history.upsert` réussi a désynchronisé profils et historique.
 *
 * Échoue si, dans components/ ou app/, réapparaît :
 *   · un `.from('tournament_elo_history')` suivi de insert/upsert/update/delete ;
 *   · un `.from('profiles')` suivi de `.update(`/`.upsert(` hors allowlist
 *     (routes serveur `service_role`, formulaire du compte sur SA propre ligne).
 *
 * Usage : node scripts/check-no-client-elo-writes.mjs   (CI + npm run check:elo-writes)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SCAN = ['components', 'app'];

// Écritures profiles légitimes, nominatives. Tout nouveau point d'écriture doit
// être ajouté ici avec sa raison — ou, mieux, passer par une RPC serveur.
//   · `own`     : l'utilisateur modifie SA ligne (RLS own row), pas l'ELO ;
//   · `service` : route serveur app/api avec la clé service (jamais depuis le navigateur).
const PROFILES_WRITE_ALLOWLIST = new Map([
  ['app/compte/AccountProfileForm.tsx',         'own — profil du compte connecté'],
  ['app/api/create-box/route.ts',               'service — rôle box_owner à la création de box'],
  ['app/api/auth/signup/route.ts',              'service — filet idempotent du profil (elo par défaut 1000)'],
  ['app/api/invitations/accept/route.ts',       'service — filet idempotent du profil (elo par défaut 1000)'],
  ['app/api/admin/inter-competitions/route.ts', 'service — ELO inter-box, historique inter_elo_history côté serveur'],
  ['app/api/admin/daily-tournaments/route.ts',  'service — ELO tournoi quotidien, daily_tournament_elo_history côté serveur'],
]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === 'node_modules' || name.startsWith('.')) continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

const WRITE = String.raw`\s*\.\s*(insert|upsert|update|delete)\s*\(`;
const HISTORY_WRITE = new RegExp(String.raw`\.from\(\s*['"]tournament_elo_history['"]\s*\)` + WRITE, 'g');
const PROFILES_WRITE = new RegExp(String.raw`\.from\(\s*['"]profiles['"]\s*\)\s*\.\s*(update|upsert)\s*\(`, 'g');
const ELO_IN_PAYLOAD = /\belo\b/;

const errors = [];
for (const dir of SCAN) {
  for (const file of walk(join(ROOT, dir))) {
    const rel = relative(ROOT, file);
    const src = readFileSync(file, 'utf8');
    const lineOf = idx => src.slice(0, idx).split('\n').length;

    for (const m of src.matchAll(HISTORY_WRITE)) {
      errors.push(`${rel}:${lineOf(m.index)} — écriture tournament_elo_history depuis le client (${m[1]}) : passe par finalize_tournament_elo`);
    }
    for (const m of src.matchAll(PROFILES_WRITE)) {
      if (PROFILES_WRITE_ALLOWLIST.has(rel)) continue;
      const touchesElo = ELO_IN_PAYLOAD.test(src.slice(m.index, m.index + 400));
      errors.push(`${rel}:${lineOf(m.index)} — profiles.${m[1]}${touchesElo ? " touchant l'ELO" : ''} hors allowlist : passe par une RPC serveur (cf. scripts/check-no-client-elo-writes.mjs)`);
    }
  }
}

if (errors.length) {
  console.error('❌ Écriture(s) ELO côté client détectée(s) :\n  ' + errors.join('\n  '));
  process.exit(1);
}
console.log('✅ aucune écriture profiles(elo) / tournament_elo_history côté client dans components/ et app/');
