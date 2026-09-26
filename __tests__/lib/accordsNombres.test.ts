// Accords des nombres connus dans les textes affichés (règle S4) : jamais de
// « (s) », élision « d’1 » après « de ». Garde sur tout le Manager.
import fs from 'fs';
import path from 'path';
import { countOf, deCount } from '@/lib/plural';

const ROOTS = ['app', 'components', 'lib'];
// Contenu généré des tutoriels : régénéré par son script, hors de cette garde.
const EXCLUS = [path.join('lib', 'tutorials')];

function files(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (EXCLUS.some(x => p.startsWith(x))) continue;
    if (e.isDirectory()) out.push(...files(p));
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

/** Lignes de code (pas de commentaire) : le texte affiché y vit. */
const codeLines = (src: string) =>
  src.split(/\r?\n/).map((l, i) => ({ l, n: i + 1 })).filter(({ l }) => !/^\s*(\/\/|\*|\/\*)/.test(l));

/**
 * Un mot en minuscules suivi de « (s) » / « (es) » puis d'une espace ou d'une
 * ponctuation : c'est du texte (« membre(s) »), pas un appel de fonction
 * (`msg(e)`, `String(s).padStart`, `re.test(s)`).
 */
export const PLURIEL_PARENTHESE = /(?<![A-Za-zÀ-ÿ._$])[a-zà-ÿ]{2,}\((?:s|es)\)(?=[\s,:!?’'"`<]|\.(?![A-Za-z]))/;
/** « de 1 membre » écrit en dur, ou « de ${countOf(…)} » (qui donnerait « de 1 … »). */
export const DE_UN = /\bde 1 [a-zà-ÿ]|\bde \$\{countOf\(/;

const all = ROOTS.flatMap(files);

describe('accords des nombres connus (garde sur tout le Manager)', () => {
  it('trouve les fichiers à contrôler', () => {
    expect(all.length).toBeGreaterThan(100);
  });

  it('aucun « (s) » affiché', () => {
    const hits = all.flatMap(f => codeLines(fs.readFileSync(f, 'utf8'))
      .filter(({ l }) => PLURIEL_PARENTHESE.test(l))
      .map(({ l, n }) => `${f}:${n}: ${l.trim().slice(0, 90)}`));
    expect(hits).toEqual([]);
  });

  it('aucun « de 1 » devant un mot (élision : « d’1 »)', () => {
    const hits = all.flatMap(f => codeLines(fs.readFileSync(f, 'utf8'))
      .filter(({ l }) => DE_UN.test(l))
      .map(({ l, n }) => `${f}:${n}: ${l.trim().slice(0, 90)}`));
    expect(hits).toEqual([]);
  });

  it('la garde reconnaît le défaut et laisse passer le code', () => {
    expect(PLURIEL_PARENTHESE.test('{n} membre(s)</p>')).toBe(true);
    expect(PLURIEL_PARENTHESE.test('`${n} ligne(s) lue(s) :`')).toBe(true);
    expect(PLURIEL_PARENTHESE.test('text: msg(e) })')).toBe(false);
    expect(PLURIEL_PARENTHESE.test('${String(s).padStart(2, "0")}')).toBe(false);
    expect(PLURIEL_PARENTHESE.test("role: 'Gérant(e) de box'")).toBe(false);
    expect(PLURIEL_PARENTHESE.test('return /x/.test(s) ? a : b;')).toBe(false);
    expect(DE_UN.test('l’arrêt de 1 abonnement')).toBe(true);
    expect(DE_UN.test('l’arrêt de ${countOf(n, "a", "b")}')).toBe(true);
    expect(DE_UN.test('l’arrêt ${deCount(n, "a", "b")}')).toBe(false);
  });
});

describe('countOf et deCount', () => {
  it('0 et 1 au singulier, pluriel au-delà', () => {
    expect(countOf(0, 'membre', 'membres')).toBe('0 membre');
    expect(countOf(1, 'membre', 'membres')).toBe('1 membre');
    expect(countOf(3, 'membre', 'membres')).toBe('3 membres');
  });
  it('après « de » : « d’1 abonnement » / « de 3 abonnements »', () => {
    expect(deCount(1, 'abonnement', 'abonnements')).toBe('d’1 abonnement');
    expect(deCount(3, 'abonnement', 'abonnements')).toBe('de 3 abonnements');
  });
});

describe('verbes et participes accordés au nombre', () => {
  const read = (f: string) => fs.readFileSync(f, 'utf8');
  it('« 1 match décidé » / « 3 matchs décidés » (nombre rendu par la base, PR 2 tournois)', () => {
    expect(read('lib/tournaments/bracketDecision.ts')).toContain("countOf(n, 'match décidé', 'matchs décidés')");
  });
  it('« 1 WOD pas encore fermé, ouvert ou en attente »', () => {
    expect(read('components/tournaments/FinishTournamentButton.tsx')).toContain("${openWodCount > 1 ? 'fermés, ouverts ou en attente' : 'fermé, ouvert ou en attente'}");
  });
  it('« 1 membre en fait partie » / « 3 membres en font partie »', () => {
    expect(read('app/(dashboard)/groups/[id]/page.tsx')).toContain("countOf(members.length, 'membre en fait partie', 'membres en font partie')");
  });
  it('« semaine 2 » / « semaines 2, 3 »', () => {
    expect(read('components/wods/PdfImportModal.tsx')).toContain("${couvertes.length > 1 ? 'semaines' : 'semaine'} ${couvertes.join(', ')}");
  });
});

describe('routes S4 de suppression : le message d’échec accorde le nombre', () => {
  it.each(['app/api/membership-plans/delete/route.ts', 'app/api/programs/delete/route.ts', 'app/api/marketplace/offers/delete/route.ts'])('%s', f => {
    expect(fs.readFileSync(f, 'utf8')).toContain("Stripe a refusé l’arrêt ${deCount(failed.length, 'abonnement', 'abonnements')} :");
  });
});
