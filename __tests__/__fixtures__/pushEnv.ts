/**
 * Push « membership_stopped » dans les tests de routes : active l'envoi (clés
 * factices) pour le bloc courant, et lit les appels simulés à send-push.
 * Hors de ces blocs, l'envoi reste coupé (configuration absente) : les tests
 * existants gardent leurs appels `fetch` à l'identique.
 */
export function withPushEnv() {
  let err: jest.SpyInstance;
  let log: jest.SpyInstance;
  beforeEach(() => {
    process.env.CRON_SECRET = 'cron_test';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://projet.supabase.co';
    err = jest.spyOn(console, 'error').mockImplementation(() => {});
    log = jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    delete process.env.CRON_SECRET;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    err.mockRestore();
    log.mockRestore();
  });
}

export interface SentPush {
  secret: string; user_id: string; title: string; body: string;
  en: { title: string; body: string }; data: { type: string; box_id: string };
}

export const pushesOf = (fetchSpy: jest.SpyInstance): SentPush[] => fetchSpy.mock.calls
  .filter(c => String(c[0]).endsWith('/functions/v1/send-push'))
  .map(c => ({ secret: c[1].headers['x-cron-secret'], ...JSON.parse(c[1].body).recipients[0] }));

/** send-push en panne (réseau), Resend et le reste inchangés. */
export function failPush(fetchSpy: jest.SpyInstance) {
  const base = fetchSpy.getMockImplementation();
  fetchSpy.mockImplementation((url: string, init: any) => (String(url).endsWith('/functions/v1/send-push')
    ? Promise.reject(new TypeError('fetch failed'))
    : base ? base(url, init) : Promise.resolve({ ok: true, text: async () => '' })));
}
