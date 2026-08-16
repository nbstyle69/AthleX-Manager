/**
 * Rejeu au VRAI JWT de la route d'export « mes données » (/api/box-export)
 * et de l'import en masse d'invitations, contre le serveur Next réellement
 * lancé — pas contre des mocks.
 *
 * Ce que le protocole cherche : une donnée d'une box B dans le pack d'un
 * gérant A, un jeton d'invitation dans un CSV, un identifiant Stripe qui
 * traîne, et un CSV piégé qui passerait en bloc au lieu d'être refusé ligne
 * par ligne.
 *
 *   set -a && . /tmp/athlex-test-stack.env && set +a
 *   node scripts/_export_isolation_proto.mjs           (serveur sur :3210)
 */
import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';

const URL_SUPA = process.env.TEST_SUPABASE_URL;
const ANON = process.env.TEST_SUPABASE_ANON_KEY;
const SERVICE = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
const APP = process.env.APP_URL ?? 'http://127.0.0.1:3210';

const svc = createClient(URL_SUPA, SERVICE, { auth: { persistSession: false } });

let ok = 0, ko = 0;
const check = (label, cond, detail = '') => {
  if (cond) { ok++; console.log(`  ✅ ${label}`); }
  else { ko++; console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`); }
};

const rnd = () => Math.random().toString(36).slice(2, 10);

async function mkUser(prefix, role = 'box_owner') {
  const email = `${prefix}-${rnd()}@exemple.test`;
  const password = `Pw-${rnd()}!A1`;
  const { data, error } = await svc.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { username: `${prefix}${rnd()}` },
  });
  if (error) throw new Error(`createUser ${prefix}: ${error.message}`);
  await svc.from('profiles').upsert({ id: data.user.id, email, username: `${prefix}${rnd()}`, role });
  const anon = createClient(URL_SUPA, ANON, { auth: { persistSession: false } });
  const { data: session, error: signInError } = await anon.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`signIn ${prefix}: ${signInError.message}`);
  return { id: data.user.id, email, token: session.session.access_token };
}

async function mkBox(owner, name) {
  const { data, error } = await svc.from('boxes')
    .insert({ name, slug: `${name.toLowerCase().replace(/\W+/g, '-')}-${rnd()}`, owner_id: owner.id, city: 'Lyon', invite_code: rnd().slice(0, 6).toUpperCase() })
    .select('id, slug').single();
  if (error) throw new Error(`box ${name}: ${error.message}`);
  await svc.from('box_members').insert({ box_id: data.id, member_id: owner.id, role: 'owner', status: 'active' });
  return data;
}

/** L'export lit les cookies : le JWT y est posé tel quel, comme /api/auth/set-session le fait. */
const asOwner = (token, path) => fetch(`${APP}${path}`, { headers: { cookie: `sb-access-token=${token}` } });

async function main() {
  console.log('\n── Fixtures ───────────────────────────────────────────');
  const ownerA = await mkUser('ownerA');
  const ownerB = await mkUser('ownerB');
  const athlete = await mkUser('athlete', 'athlete');
  const boxA = await mkBox(ownerA, 'BoxA');
  const boxB = await mkBox(ownerB, 'BoxB');

  const { data: planA } = await svc.from('membership_plans')
    .insert({ box_id: boxA.id, name: 'Illimité', price_cents: 6900, plan_type: 'subscription', is_active: true })
    .select('id').single();
  const { data: planB } = await svc.from('membership_plans')
    .insert({ box_id: boxB.id, name: 'FormuleB', price_cents: 4900, plan_type: 'subscription', is_active: true })
    .select('id').single();

  const memberA = await mkUser('membreA', 'athlete');
  const memberB = await mkUser('membreB', 'athlete');
  const banni = await mkUser('banni', 'athlete');
  await svc.from('box_members').insert([
    { box_id: boxA.id, member_id: memberA.id, role: 'member', status: 'active', plan_id: planA.id,
      amount_cents: 6900, subscription_status: 'active', stripe_subscription_id: 'sub_SECRET_A' },
    { box_id: boxB.id, member_id: memberB.id, role: 'member', status: 'active', plan_id: planB.id,
      amount_cents: 4900, subscription_status: 'active', stripe_subscription_id: 'sub_SECRET_B' },
    { box_id: boxA.id, member_id: banni.id, role: 'member', status: 'banned' },
  ]);

  // Un cours et une réservation de chaque côté : le pack de A ne doit connaître que les siens.
  const { data: schedA } = await svc.from('class_schedules')
    .insert({ box_id: boxA.id, title: 'WOD 18h A', scheduled_date: '2026-02-03', start_time: '18:00', end_time: '19:00', max_capacity: 12 })
    .select('id').single();
  const { data: schedB } = await svc.from('class_schedules')
    .insert({ box_id: boxB.id, title: 'WOD 18h B', scheduled_date: '2026-02-03', start_time: '18:00', end_time: '19:00', max_capacity: 12 })
    .select('id').single();
  await svc.from('class_reservations').insert([
    { box_id: boxA.id, schedule_id: schedA.id, member_id: memberA.id, status: 'confirmed', attended: true },
    { box_id: boxB.id, schedule_id: schedB.id, member_id: memberB.id, status: 'confirmed', attended: false },
  ]);
  await svc.from('box_wods').insert([
    { box_id: boxA.id, title: 'Fran A', scheduled_date: '2026-02-03', is_published: true, created_by: ownerA.id },
    { box_id: boxB.id, title: 'Fran B', scheduled_date: '2026-02-03', is_published: true, created_by: ownerB.id },
  ]);
  await svc.from('box_cash_payments').insert([
    { box_id: boxA.id, member_id: memberA.id, plan_id: planA.id, plan_name: 'Illimité', amount_cents: 6900, source: 'invitation', collected_by: ownerA.id },
    { box_id: boxB.id, member_id: memberB.id, plan_id: planB.id, plan_name: 'FormuleB', amount_cents: 4900, source: 'invitation', collected_by: ownerB.id },
  ]);

  const anonA = createClient(URL_SUPA, ANON, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${ownerA.token}` } },
  });

  console.log('\n── Import en masse au JWT du gérant A ─────────────────');
  // CSV piégé : formule d'une autre box, membre exclu, membre déjà là,
  // doublon interne, e-mail invalide, ligne saine.
  const rows = [
    { line: 2, email: `neuf-${rnd()}@exemple.test`, first_name: 'Nora', last_name: 'B', plan_id: planA.id },
    { line: 3, email: memberA.email, first_name: 'Déjà', last_name: 'Là', plan_id: null },
    { line: 4, email: banni.email, first_name: 'Ex', last_name: 'Clu', plan_id: null },
    { line: 5, email: 'pas-un-email', first_name: 'Faux', last_name: 'Mail', plan_id: null },
    { line: 6, email: `piege-${rnd()}@exemple.test`, first_name: 'Formule', last_name: 'Etrangere', plan_id: planB.id },
  ];
  rows.push({ ...rows[0], line: 7 }); // doublon interne de la ligne 2

  const before = await svc.from('box_members').select('member_id').eq('box_id', boxA.id);
  const { data: report, error: bulkError } = await anonA.rpc('create_box_invitations_bulk', {
    p_box_id: boxA.id, p_rows: rows,
  });
  check('la RPC bulk répond au gérant de la box', !bulkError, bulkError?.message);
  const v = Object.fromEntries((report?.results ?? []).map(r => [r.line, `${r.verdict}${r.reason ? ':' + r.reason : ''}`]));
  check('ligne saine → créée', v[2] === 'creee', v[2]);
  check('membre déjà dans la box → ignorée (deja_membre)', v[3] === 'ignoree:deja_membre', v[3]);
  check('membre exclu → refusée (membre_exclu)', v[4] === 'refusee:membre_exclu', v[4]);
  check('e-mail invalide → refusée (email_invalide)', v[5] === 'refusee:email_invalide', v[5]);
  check('formule d’une autre box → refusée (formule_inconnue)', v[6] === 'refusee:formule_inconnue', v[6]);
  check('doublon interne → ignorée (doublon_fichier)', v[7] === 'ignoree:doublon_fichier', v[7]);
  check('un fichier piégé n’est jamais refusé en bloc', (report?.results ?? []).length === rows.length,
    `${(report?.results ?? []).length} verdicts pour ${rows.length} lignes`);
  const after = await svc.from('box_members').select('member_id').eq('box_id', boxA.id);
  check('aucun membre écrit par l’import', (after.data?.length ?? -1) === (before.data?.length ?? -2));
  check('aucun jeton d’invitation rendu par la RPC',
    !JSON.stringify(report ?? {}).match(/token/i), JSON.stringify(report ?? {}).slice(0, 120));

  const bulkB = await anonA.rpc('create_box_invitations_bulk', {
    p_box_id: boxB.id, p_rows: [{ line: 2, email: `x-${rnd()}@exemple.test` }],
  });
  check('le gérant A ne peut pas importer dans la box B', /FORBIDDEN/.test(bulkB.error?.message ?? ''),
    bulkB.error?.message ?? 'accepté (!)');

  console.log('\n── Export au VRAI JWT ─────────────────────────────────');
  const anonRes = await fetch(`${APP}/api/box-export?box_id=${boxA.id}`);
  check('visiteur anonyme → 401', anonRes.status === 401, String(anonRes.status));

  const athleteRes = await asOwner(athlete.token, `/api/box-export?box_id=${boxA.id}`);
  check('athlète → 403', athleteRes.status === 403, String(athleteRes.status));

  const crossRes = await asOwner(ownerB.token, `/api/box-export?box_id=${boxA.id}`);
  check('gérant de la box B sur la box A → 403', crossRes.status === 403, String(crossRes.status));

  const noBox = await asOwner(ownerA.token, '/api/box-export');
  check('box_id manquant → 400', noBox.status === 400, String(noBox.status));

  const res = await asOwner(ownerA.token, `/api/box-export?box_id=${boxA.id}`);
  check('gérant A sur sa box → 200 application/zip',
    res.status === 200 && res.headers.get('content-type') === 'application/zip',
    `${res.status} ${res.headers.get('content-type')}`);

  const zip = await JSZip.loadAsync(Buffer.from(await res.arrayBuffer()));
  const files = Object.keys(zip.files).sort();
  check('le pack contient les 7 CSV + le LISEZ-MOI', files.length === 8, files.join(', '));
  const dump = {};
  for (const name of files) dump[name] = await zip.file(name).async('string');
  const all = Object.values(dump).join('\n');

  check('membres.csv contient l’adhérent de la box A', dump['membres.csv'].includes(memberA.email));
  check('encaissements-comptoir.csv contient les 69,00 € de A', dump['encaissements-comptoir.csv'].includes('69.00'));
  check('reservations.csv contient le cours de A', dump['reservations.csv'].includes('WOD 18h A'));
  check('wods.csv contient le WOD de A', dump['wods.csv'].includes('Fran A'));

  check('AUCUNE donnée de la box B dans le pack de A',
    !all.includes(memberB.email) && !all.includes('WOD 18h B') && !all.includes('Fran B') && !all.includes('FormuleB'),
    'fuite inter-box');
  check('aucun identifiant Stripe dans le pack',
    !all.includes('sub_SECRET_A') && !/sub_|cus_|acct_/.test(all));

  const { data: invRows } = await svc.from('box_invitations').select('token_hash').eq('box_id', boxA.id).limit(1);
  const hash = invRows?.[0]?.token_hash ?? null;
  check('un token_hash existe bien en base (le test a du sens)', !!hash);
  check('aucun token_hash dans le pack', hash ? !all.includes(hash) : false);
  check('invitations.csv contient bien l’invitation créée à l’instant',
    dump['invitations.csv'].split('\r\n').length >= 2);

  console.log('\n── Nettoyage ──────────────────────────────────────────');
  await svc.from('boxes').delete().in('id', [boxA.id, boxB.id]);
  for (const u of [ownerA, ownerB, athlete, memberA, memberB, banni]) await svc.auth.admin.deleteUser(u.id);
  console.log('  fixtures supprimées');

  console.log(`\n${ok} ✅ · ${ko} ❌\n`);
  process.exit(ko === 0 ? 0 : 1);
}

main().catch(err => { console.error(err); process.exit(1); });
