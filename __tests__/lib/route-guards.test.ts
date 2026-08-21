import fs from 'fs';
import path from 'path';
import { COACH_ROUTE_SEGMENTS } from '@/lib/authz/coach-perimeter';

/**
 * Contrôle mécanique du lot 5-B : une route du back-office est soit dans le
 * périmètre coach, soit refusée au coach par une garde serveur.
 *
 * Une prose ne tient pas cette frontière : `/programs`, qui fixe les prix, avait
 * échappé à la liste d'exclusions de la barre latérale. Ici, une route qui naît
 * sans garde fait échouer la suite — et le compte d'assertions est affirmé, pour
 * qu'un fichier vide ne se lise pas comme un succès (règle 16).
 */
const DASHBOARD_DIR = path.join(process.cwd(), 'app', '(dashboard)');
const GUARD_CALL = 'requireOwnerAdminRoute';

function routeSegments(): string[] {
  return fs
    .readdirSync(DASHBOARD_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('_'))
    .map((e) => e.name);
}

describe('gardes serveur des routes du back-office', () => {
  const segments = routeSegments();
  let checked = 0;

  it('trouve les routes du dashboard', () => {
    expect(segments.length).toBeGreaterThan(10);
  });

  it.each(segments)('la route /%s est gardée ou dans le périmètre coach', (segment) => {
    checked += 1;
    if ((COACH_ROUTE_SEGMENTS as readonly string[]).includes(segment)) {
      // Périmètre coach : pas de garde, et surtout pas de garde par erreur.
      const layout = path.join(DASHBOARD_DIR, segment, 'layout.tsx');
      const source = fs.existsSync(layout) ? fs.readFileSync(layout, 'utf8') : '';
      expect(source).not.toContain(GUARD_CALL);
      return;
    }
    const layout = path.join(DASHBOARD_DIR, segment, 'layout.tsx');
    expect(fs.existsSync(layout)).toBe(true);
    expect(fs.readFileSync(layout, 'utf8')).toContain(GUARD_CALL);
  });

  it('a bien examiné toutes les routes trouvées', () => {
    expect(checked).toBe(segments.length);
  });

  it('les routes argent nommées par l’exigence sont gardées', () => {
    for (const money of ['programs', 'invitations', 'subscribers', 'stats']) {
      expect(segments).toContain(money);
      expect(
        fs.readFileSync(path.join(DASHBOARD_DIR, money, 'layout.tsx'), 'utf8'),
      ).toContain(GUARD_CALL);
    }
  });
});
