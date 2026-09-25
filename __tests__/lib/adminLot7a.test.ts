// Lot 7a — super-admin (pilotage et support) : jetons `--ax-*` seulement, et
// les corrections de débordement à 390 px restent en place.
import { readFileSync } from 'fs';
import { join } from 'path';
import { planTierClasses } from '@/lib/boxPlanTier';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

const FILES = [
  'app/admin/page.tsx',
  'app/admin/users/page.tsx',
  'app/admin/boxes/page.tsx',
  'app/admin/boxes/[id]/page.tsx',
  'app/admin/analytics/page.tsx',
  'app/admin/reports/page.tsx',
  'components/support/AdminSupportInbox.tsx',
  'components/admin/BoxArchiveBlock.tsx',
  'components/admin/AutoProgrammingBlock.tsx',
];

// Couleurs Tailwind codées en dur, fonds noirs ou blancs fixes, hexadécimaux.
const LEGACY = /(?<![\w-])(?:[a-z-]+:)*(?:bg|text|border|from|to|divide|accent|placeholder)-(?:white|black|gray|zinc|slate|neutral|red|green|emerald|amber|yellow|orange|blue|sky|cyan|purple|violet|pink|rose)(?:-\d{2,3})?(?:\/[\w.[\]]+)?(?![\w-])|bg-\[#|text-\[#|#[0-9A-Fa-f]{6}\b/;

describe('lot 7a : apparence en jetons', () => {
  it.each(FILES)('%s n’utilise plus de couleur codée en dur', f => {
    const src = read(f).split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*'));
    const hits = src.filter(l => LEGACY.test(l));
    expect(hits).toEqual([]);
  });

  it('pastilles de formule : même sens, en jetons', () => {
    expect(planTierClasses('multi')).toContain('text-ax-warning');
    expect(planTierClasses('complete')).toContain('text-ax-purple');
    expect(planTierClasses('impayé')).toContain('text-ax-danger');
    expect(planTierClasses('free')).toContain('text-ax-text-secondary');
    expect(planTierClasses('essai')).toContain('--ax-sub-sky-text');
  });
});

describe('lot 7a : rien ne sort de l’écran à 390 px', () => {
  it('les trois tableaux défilent dans leur zone (Table du lot 1)', () => {
    for (const f of ['app/admin/users/page.tsx', 'app/admin/boxes/[id]/page.tsx', 'app/admin/reports/page.tsx']) {
      expect(read(f)).toMatch(/<Table aria-label=/);
      expect(read(f)).not.toMatch(/<table/);
    }
  });
  it('en-têtes et filtres passent à la ligne', () => {
    expect(read('app/admin/users/page.tsx')).toContain('relative w-full sm:w-64');
    expect(read('app/admin/boxes/page.tsx')).toContain('flex flex-wrap items-center gap-3 w-full sm:w-auto');
    expect(read('app/admin/reports/page.tsx')).toMatch(/<div className="flex flex-wrap gap-2">\s*\{FILTER_OPTS/);
    expect(read('components/support/AdminSupportInbox.tsx')).toMatch(/<div className="flex flex-wrap gap-2">\s*\{FILTERS/);
  });
  it('signalements : plus de double marge dans la zone principale', () => {
    expect(read('app/admin/reports/page.tsx')).not.toContain('p-8 space-y-6');
  });
  it('statistiques : la valeur d’une barre s’affiche aussi au focus', () => {
    const src = read('app/admin/analytics/page.tsx');
    expect(src).toMatch(/tabIndex=\{0\} aria-label=\{`\$\{d\.date\.slice\(5\)\} : \$\{d\.count\}`\}/);
    expect(src).toContain('group-hover:opacity-100 group-focus:opacity-100');
  });
});

describe('AdminSupportInbox : deux accents, chacun son sens', () => {
  const src = read('components/support/AdminSupportInbox.tsx');
  it('menthe sur /admin/support, blanc plein sur /support/admin', () => {
    expect(src).toMatch(/accent === 'emerald'\s*\? 'border border-ax-accent-text bg-ax-accent-soft text-ax-accent-text/);
    expect(src).toContain("'border border-ax-text bg-ax-text text-ax-background hover:brightness-110'");
    expect(read('app/admin/support/page.tsx')).toContain('accent="emerald"');
    expect(read('app/(dashboard)/support/admin/page.tsx')).toContain('accent="white"');
  });
  it('objet et message saisis lisibles en entier', () => {
    expect(src).not.toMatch(/\btruncate\b/);
    expect(src).toContain('text-sm whitespace-pre-wrap break-words');
  });
});
