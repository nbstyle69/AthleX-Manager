import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '../..', p), 'utf8');

const SIDEBAR = read('components/layout/Sidebar.tsx');
const ADMIN = read('components/layout/AdminSidebar.tsx');
const BAR = read('components/layout/MobileNavBar.tsx');
const SHEET = read('components/ui/sheet.tsx');
const OWNER_LAYOUT = read('app/(dashboard)/layout.tsx');
const ADMIN_LAYOUT = read('app/admin/layout.tsx');

// Pas d'environnement de test de composants React (Jest en `node`, sans
// Testing Library) : on vérifie ici la structure, le comportement est couvert
// par les captures de la PR.
describe('Cadre du back-office sur mobile : une seule source pour le menu', () => {
  it('la barre latérale owner rend le même panneau sur bureau et dans le Sheet', () => {
    expect(SIDEBAR).toMatch(/const panel = \(/);
    expect((SIDEBAR.match(/\{panel\}/g) ?? []).length).toBe(2);
    expect(SIDEBAR).toMatch(/<aside className="hidden lg:flex fixed top-0 left-0 h-full w-60/);
    expect(SIDEBAR).toMatch(/<MobileNavBar/);
    // entrées inchangées : une seule déclaration de GROUPS / PINNED / HELP / DASHBOARD
    for (const name of ['GROUPS', 'PINNED', 'HELP', 'DASHBOARD']) {
      expect((SIDEBAR.match(new RegExp(`^const ${name}\\b`, 'gm')) ?? []).length).toBe(1);
    }
  });

  it('la barre latérale admin rend le même panneau NAV sur bureau et dans le Sheet', () => {
    expect(ADMIN).toMatch(/const panel = \(/);
    expect((ADMIN.match(/\{panel\}/g) ?? []).length).toBe(2);
    expect((ADMIN.match(/^const NAV\b/gm) ?? []).length).toBe(1);
    expect(ADMIN).toMatch(/<aside className="hidden lg:flex fixed top-0 left-0 h-full w-60/);
  });

  it('les liens de navigation ferment le menu, le changement de route aussi, et le focus va sur <main>', () => {
    for (const src of [SIDEBAR, ADMIN]) {
      expect(src).toMatch(/useMobileMenu\(pathname\)/);
      expect(src).toMatch(/onClick=\{onNavigate\}/);
      expect(src).toMatch(/onCloseAutoFocus=\{onCloseAutoFocus\}/);
    }
    expect(BAR).toMatch(/useEffect\(\(\) => \{\s*setOpen\(false\);/);
    expect(BAR).toMatch(/getElementById\(MAIN_CONTENT_ID\)\?\.focus\(\{ preventScroll: true \}\)/);
    for (const src of [OWNER_LAYOUT, ADMIN_LAYOUT]) {
      expect(src).toMatch(/<main id=\{MAIN_CONTENT_ID\} tabIndex=\{-1\}/);
    }
  });

  it('aucune chaîne visible mal encodée dans le périmètre', () => {
    for (const src of [SIDEBAR, ADMIN, BAR, SHEET, OWNER_LAYOUT, ADMIN_LAYOUT]) {
      expect(src).not.toMatch(/Ã|â€/);
    }
    expect(ADMIN).toMatch(/Déconnexion/);
  });

  it('le bouton menu est accessible et le panneau est un Sheet Radix (Échap, fond, focus, scroll)', () => {
    expect(BAR).toMatch(/open: 'Ouvrir le menu'/);
    expect(BAR).toMatch(/open: 'Open menu'/);
    expect(BAR).toMatch(/<Menu size=/);
    expect(BAR).toMatch(/<SheetTrigger[\s\S]*aria-label=\{t\.open\}/);
    expect(BAR).toMatch(/<SheetContent[\s\S]*side="left"/);
    expect(BAR).toMatch(/<SheetCloseButton/);
    expect(BAR).toMatch(/lg:hidden sticky top-0/);
    expect(SHEET).toMatch(/DialogPrimitive\.Root/);
    expect(SHEET).toMatch(/DialogPrimitive\.Trigger/);
  });

  it('les layouts ne décalent le contenu qu\u2019à partir de 1024 px', () => {
    for (const src of [OWNER_LAYOUT, ADMIN_LAYOUT]) {
      expect(src).not.toMatch(/"flex-1 ml-60/);
      expect(src).toMatch(/flex-1 lg:ml-60/);
      expect(src).toMatch(/flex flex-col lg:flex-row/);
    }
  });
});
