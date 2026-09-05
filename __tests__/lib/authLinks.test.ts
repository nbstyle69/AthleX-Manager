/**
 * Liens e-mail Supabase Auth : chaque flux porte sa page, aucun routage par
 * `type` côté web.
 *
 * Partie 1 (toujours jouée) — garde de source : la page de mot de passe écoute
 * PASSWORD_RECOVERY et ne lit plus `type` ; la page confirmée n'écoute rien.
 *
 * Partie 2 (pile jetable d'athlex-app) — vraie forme du lien : GoTrue génère
 * le lien tel qu'il part dans l'e-mail (`verify?token=…&type=…&redirect_to=…`),
 * on suit le 303 sans le suivre jusqu'au bout et on lit le `Location`.
 *   (athlex-app) ./scripts/test-stack.sh up ; set -a; . /tmp/athlex-test-stack.env; set +a
 *   (AthleX-Manager) npx jest authLinks
 * Sans TEST_SUPABASE_URL / TEST_SUPABASE_SERVICE_ROLE_KEY : skip, jamais la prod.
 */
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { SITE_URL } from '@/lib/site-url';

const ROOT = path.join(__dirname, '..', '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

describe('pages de retour auth — aucun routage par type', () => {
  it('update-password écoute PASSWORD_RECOVERY et ne lit pas `type`', () => {
    const src = read('app/(auth)/update-password/page.tsx');
    expect(src).toMatch(/onAuthStateChange\([^)]*=>[\s\S]*?'PASSWORD_RECOVERY'/);
    expect(src).not.toMatch(/get\(['"]type['"]\)/);
    expect(src).not.toMatch(/authReturn/);
  });

  it("email-confirme n'écoute aucun événement auth et ne consomme aucun jeton", () => {
    const src = read('app/(auth)/email-confirme/page.tsx');
    expect(src).not.toMatch(/onAuthStateChange|setSession|exchangeCodeForSession|PASSWORD_RECOVERY/);
    expect(src).not.toMatch(/get\(['"]type['"]\)/);
  });

  it('lib/authReturn (routage par type) a disparu', () => {
    expect(fs.existsSync(path.join(ROOT, 'lib', 'authReturn.ts'))).toBe(false);
  });
});

const URL_ = process.env.TEST_SUPABASE_URL;
const KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
const live = !!(URL_ && KEY && !/supabase\.co/.test(URL_));
const d = live ? describe : describe.skip;

const UPDATE_PASSWORD_URL = `${SITE_URL}/update-password`;
const EMAIL_CONFIRMED_URL = `${SITE_URL}/email-confirme`;
const landing = (loc: string) => loc.split(/[#?]/)[0];

d('vraie forme du lien GoTrue → redirection réelle', () => {
  const admin = createClient(URL_!, KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const created: string[] = [];
  afterAll(async () => { for (const id of created) await admin.auth.admin.deleteUser(id); });

  async function follow(link: string) {
    const res = await fetch(link, { redirect: 'manual' });
    return { status: res.status, location: res.headers.get('location') ?? '' };
  }

  it('recovery + redirectTo /update-password → 303 vers /update-password#…&type=recovery', async () => {
    const email = `a4.mgr.recovery.${Date.now()}@athlex.test`;
    const { data: u, error: e0 } = await admin.auth.admin.createUser({ email, password: 'Passw0rd!a4', email_confirm: true });
    expect(e0).toBeNull();
    created.push(u.user!.id);
    const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo: UPDATE_PASSWORD_URL } });
    expect(error).toBeNull();
    const link = data.properties!.action_link;
    expect(link).toMatch(/\/auth\/v1\/verify\?token=.+&type=recovery&redirect_to=/);
    const { status, location } = await follow(link);
    expect(status).toBe(303);
    expect(landing(location)).toBe(UPDATE_PASSWORD_URL);
    expect(location).toMatch(/#access_token=.+&refresh_token=.+/);
    expect(location).toMatch(/[#&]type=recovery(&|$)/);
  });

  it('signup + emailRedirectTo /email-confirme → 303 vers /email-confirme#…&type=signup', async () => {
    const email = `a4.mgr.signup.${Date.now()}@athlex.test`;
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'signup', email, password: 'Passw0rd!a4', options: { redirectTo: EMAIL_CONFIRMED_URL },
    });
    expect(error).toBeNull();
    created.push(data.user!.id);
    const link = data.properties!.action_link;
    expect(link).toMatch(/\/auth\/v1\/verify\?token=.+&type=signup&redirect_to=/);
    const { status, location } = await follow(link);
    expect(status).toBe(303);
    expect(landing(location)).toBe(EMAIL_CONFIRMED_URL);
    expect(location).toMatch(/[#&]type=signup(&|$)/);
  });
});
