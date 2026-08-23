import fs from 'fs';
import path from 'path';
import { COACH_HREFS } from '@/lib/authz/coach-perimeter';
import { postLoginPath, OWNER_HOME, COACH_HOME, ATHLETE_HOME } from '@/lib/authz/post-login';

/**
 * La poignée de porte du lot 5-B : la garde serveur ouvre le back-office au
 * coach, mais la connexion l'envoyait dans l'espace athlète — il devait taper
 * `/wods` à la main. Les assertions portent donc sur deux choses distinctes : la
 * destination calculée, et le fait que la connexion ne recalcule plus « qui est
 * staff » de son côté (c'était la cause, pas le symptôme).
 */
describe('destination après connexion', () => {
  it('le gérant arrive sur le tableau de bord', () => {
    expect(postLoginPath([{ my_role: 'owner' }])).toBe(OWNER_HOME);
  });

  it('le coach arrive dans son back-office, pas dans l’espace athlète', () => {
    expect(postLoginPath([{ my_role: 'coach' }])).toBe(COACH_HOME);
    expect(COACH_HOME).not.toBe(ATHLETE_HOME);
  });

  it('la destination du coach est dans le périmètre que la garde serveur autorise', () => {
    expect(COACH_HREFS).toContain(COACH_HOME);
  });

  it('un membre sans titre arrive dans l’espace athlète', () => {
    expect(postLoginPath([])).toBe(ATHLETE_HOME);
  });

  it('cas mixte : coach ici, gérant ailleurs → le titre le plus large gagne', () => {
    expect(postLoginPath([{ my_role: 'coach' }, { my_role: 'owner' }])).toBe(OWNER_HOME);
    expect(postLoginPath([{ my_role: 'owner' }, { my_role: 'coach' }])).toBe(OWNER_HOME);
  });
});

describe('la connexion et le back-office lisent une seule source', () => {
  const login = fs.readFileSync(
    path.join(process.cwd(), 'app', '(auth)', 'login', 'LoginForm.tsx'),
    'utf8',
  );

  it('le formulaire de connexion demande son titre au serveur', () => {
    expect(login).toContain("supabase.rpc('get_my_admin_boxes')");
    expect(login).toContain('postLoginPath');
  });

  it('il ne redéduit plus le titre depuis les tables', () => {
    expect(login).not.toContain("from('boxes')");
    expect(login).not.toContain("from('box_members')");
  });

  it('la barre latérale offre un chemin explicite vers l’espace athlète', () => {
    const sidebar = fs.readFileSync(
      path.join(process.cwd(), 'components', 'layout', 'Sidebar.tsx'),
      'utf8',
    );
    expect(sidebar).toContain('ATHLETE_HOME');
    expect(sidebar).toContain('Mon espace athlète');
  });
});
