// Dates en heure de Paris : une fin de période à 23 h 30 ou à 0 h 30 (heure de
// Paris) s'affiche le bon jour, en heure d'hiver et d'été, sur les écrans comme
// dans les e-mails, quel que soit le fuseau de la machine.
//
// Jest tourne en UTC (jest.config.js), comme Vercel : les cas de 0 h 30
// tombent la veille sans l'heure de Paris. Le cœur `parisDate` est aussi lancé
// dans un vrai processus Node sous d'autres fuseaux (Tokyo : 23 h 30 à Paris y
// est déjà le lendemain), car `process.env.TZ` n'agit pas dans le bac à sable de Jest.
import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import * as ts from 'typescript';
import { parisDate } from '@/lib/datetime';
import { fullDate } from '@/lib/confirmDialog';
import { fullDate as mailFullDate, stopEmailContent, reviewEmailContent } from '@/lib/members/stopMembership';
import { programStopEmail, offerStopEmail } from '@/lib/stopProductSubscriptions';
import { ownerArchiveEmail, counterMemberArchiveEmail, programArchiveEmail, publisherArchiveEmail } from '@/lib/boxArchiveSchedule';
import { formatExpiredSince } from '@/lib/boxPlanTier';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

// 23 h 30 et 0 h 30 à Paris, en hiver (UTC+1) et en été (UTC+2).
const CASES = [
  { nom: 'hiver, 23 h 30', iso: '2026-01-15T22:30:00Z', jour: 'jeudi 15 janvier 2026', court: '15 janv. 2026', num: '15/01/2026' },
  { nom: 'été, 23 h 30', iso: '2026-07-15T21:30:00Z', jour: 'mercredi 15 juillet 2026', court: '15 juil. 2026', num: '15/07/2026' },
  { nom: 'hiver, 0 h 30', iso: '2026-01-15T23:30:00Z', jour: 'vendredi 16 janvier 2026', court: '16 janv. 2026', num: '16/01/2026' },
  { nom: 'été, 0 h 30', iso: '2026-07-15T22:30:00Z', jour: 'jeudi 16 juillet 2026', court: '16 juil. 2026', num: '16/07/2026' },
];
const LONG: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };

it('Jest tourne en UTC, comme Vercel', () => {
  expect(new Date('2026-01-15T23:30:00Z').getDate()).toBe(15);
});

// En UTC, 23 h 30 à Paris est encore le même jour : ces cas-là sont prouvés
// sous Tokyo, plus bas ; ceux de 0 h 30 le sont ici.
it('écrans : date complète et formats courts, hiver et été, 23 h 30 et 0 h 30', () => {
  for (const { iso, jour, court, num } of CASES) {
    expect(fullDate(iso)).toBe(jour);
    expect(parisDate(iso, { day: '2-digit', month: 'short', year: 'numeric' })).toBe(court);
    expect(parisDate(iso, { day: '2-digit', month: '2-digit', year: 'numeric' })).toBe(num);
    expect(formatExpiredSince(iso)).toBe(`échue depuis le ${num.slice(0, 5)}`);
  }
  // Une date seule (colonne `date`) reste ce jour-là.
  expect(fullDate('2026-09-29')).toBe('mardi 29 septembre 2026');
});

it('e-mails : même formatage (S2, S4, archivage)', () => {
  expect(mailFullDate).toBe(fullDate);
  for (const { iso, jour } of CASES) {
    const base = { firstName: 'Inès', boxName: 'La Forge', title: 'Force', periodEnd: iso };
    const texts = [
      stopEmailContent({ mode: 'period_end', planName: 'Illimité', ...base }).subject,
      reviewEmailContent({ action: 'approve', planName: 'Illimité', note: null, ...base }).subject,
      programStopEmail({ mode: 'period_end', ...base }).bodyText,
      offerStopEmail({ mode: 'period_end', firstName: 'Inès', publisherName: 'La Forge', title: 'Force', subscriberBoxName: 'Hangar 21', periodEnd: iso }).bodyText,
      ownerArchiveEmail({ firstName: 'Inès', boxName: 'La Forge', date: iso, boxPaysAthlex: false, boughtOffers: false }).subject,
      counterMemberArchiveEmail({ firstName: 'Inès', boxName: 'La Forge', date: iso }).subject,
      programArchiveEmail({ mode: 'period_end', ...base }).bodyText,
      publisherArchiveEmail({ mode: 'period_end', ...base }).bodyText,
    ];
    for (const t of texts) expect(t).toContain(jour);
  }
});

describe('parisDate dans un vrai processus, sous d’autres fuseaux', () => {
  let mod: string;
  beforeAll(() => {
    const js = ts.transpileModule(read('lib/datetime.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    mod = join(mkdtempSync(join(tmpdir(), 'paris-')), 'datetime.js');
    writeFileSync(mod, js);
  });
  const run = (zone: string, inputs: string[]) => JSON.parse(execFileSync(process.execPath, ['-e',
    `const { parisDate } = require(${JSON.stringify(mod)});
     console.log(JSON.stringify(${JSON.stringify(inputs)}.map(i => parisDate(i, ${JSON.stringify(LONG)}))));`,
  ], { env: { ...process.env, TZ: zone }, encoding: 'utf8' }));

  it.each(['UTC', 'Asia/Tokyo', 'America/New_York', 'Europe/Paris'])('%s', (zone) => {
    expect(run(zone, [...CASES.map(c => c.iso), '2026-09-29'])).toEqual([...CASES.map(c => c.jour), 'mardi 29 septembre 2026']);
  });
});

describe('les affichages d’abonnement, de période, d’arrêt, d’archivage et d’engagement passent par parisDate', () => {
  it.each([
    ['app/(dashboard)/subscribers/page.tsx', /function fmtDate\(iso: string \| null\) \{\s*if \(!iso\) return '—';\s*return parisDate\(iso, /],
    ['components/UnpaidPanel.tsx', /function fmtDate\(iso: string \| null\) \{\s*if \(!iso\) return '—';\s*return parisDate\(iso, /],
    ['app/compte/page.tsx', /function fmtDate\(iso: string \| null \| undefined\): string \{\s*if \(!iso\) return '—';\s*return parisDate\(iso, /],
    ['app/compte/ManageSubscription.tsx', /function fmtDate\(iso: string \| null\) \{\s*if \(!iso\) return '';\s*return parisDate\(iso, /],
    ['components/PaywallOverlay.tsx', /parisDate\(trialEndsAt, /],
    ['components/TrialBanner.tsx', /parisDate\(trialEndsAt, /],
    ['components/admin/BoxArchiveBlock.tsx', /archivée depuis le \{parisDate\(archivedAt, /],
    ['components/marketplace/MarketplaceWorkspace.tsx', /effective le \$\{parisDate\(end, /],
    ['app/admin/boxes/[id]/page.tsx', /période jusqu'au \$\{parisDate\(json\.current_period_end, [\s\S]*Box archivée le \{parisDate\(box\.archived_at, /],
    ['app/admin/boxes/page.tsx', /Archivée le \$\{parisDate\(box\.archived_at, [\s\S]*<Archive size=\{10\} \/> \{parisDate\(box\.archived_at, [\s\S]*Archivage programmé le \$\{parisDate\(box\.archive_scheduled_at, /],
  ])('%s', (p, re) => {
    expect(read(p)).toMatch(re);
  });

  it('aucun formatage de date sans fuseau dans les modules d’e-mails', () => {
    for (const p of ['lib/members/stopMembership.ts', 'lib/stopProductSubscriptions.ts', 'lib/boxArchiveSchedule.ts', 'lib/confirmDialog.ts', 'lib/boxPlanTier.ts']) {
      expect(read(p)).not.toMatch(/toLocaleDateString|toLocaleString|getDate\(\)|getMonth\(\)/);
    }
  });
});
