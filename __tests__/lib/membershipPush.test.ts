// Push « membership_stopped » : textes validés FR / EN, date en heure de Paris
// (Jest tourne en UTC : 0 h 30 à Paris y est la veille), appel serveur de
// send-push (x-cron-secret), et aucun échec qui lève ou journalise du personnel.
import { membershipStopPush, sendMembershipStoppedPush } from '@/lib/members/membershipPush';

// 16 janvier 2026, 0 h 30 à Paris (23 h 30 UTC la veille).
const END = '2026-01-15T23:30:00Z';

describe('textes validés', () => {
  it('arrêt immédiat', () => {
    expect(membershipStopPush({ mode: 'now', boxName: 'La Forge', periodEnd: END })).toEqual({
      title: 'Abonnement arrêté',
      body: "La Forge a arrêté ton abonnement aujourd'hui.",
      en: { title: 'Membership stopped', body: 'La Forge stopped your membership today.' },
    });
  });

  it('fin programmée : date en heure de Paris, format anglais pour l’anglais', () => {
    expect(membershipStopPush({ mode: 'period_end', boxName: 'La Forge', periodEnd: END })).toEqual({
      title: "Fin d'abonnement programmée",
      body: 'La Forge a programmé la fin de ton abonnement le vendredi 16 janvier 2026.',
      en: { title: 'Membership ending', body: 'La Forge has scheduled your membership to end on Friday, 16 January 2026.' },
    });
  });

  it('fin programmée sans date connue', () => {
    const p = membershipStopPush({ mode: 'period_end', boxName: 'La Forge', periodEnd: null });
    expect(p.body).toBe('La Forge a programmé la fin de ton abonnement à la fin de la période payée.');
    expect(p.en.body).toBe('La Forge has scheduled your membership to end at the end of the paid period.');
  });
});

describe('envoi à send-push', () => {
  const USER = '11111111-1111-4111-8111-111111111111';
  const ARGS = { userId: USER, boxId: 'box-1', mode: 'now' as const, boxName: 'La Forge', periodEnd: null };
  let fetchSpy: jest.SpyInstance;
  let errSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env.CRON_SECRET = 'cron_test';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://projet.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon_test';
    fetchSpy = jest.spyOn(global, 'fetch' as any).mockResolvedValue({ ok: true, json: async () => ({ sent: 1 }) } as any);
    errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    fetchSpy.mockRestore(); errSpy.mockRestore(); logSpy.mockRestore();
    delete process.env.CRON_SECRET; delete process.env.NEXT_PUBLIC_SUPABASE_URL; delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });
  const logged = () => JSON.stringify([...errSpy.mock.calls, ...logSpy.mock.calls]);

  it('chemin serveur : x-cron-secret, type membership_stopped, destinataire et deux langues', async () => {
    expect(await sendMembershipStoppedPush(ARGS)).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://projet.supabase.co/functions/v1/send-push');
    expect(init.method).toBe('POST');
    expect(init.headers['x-cron-secret']).toBe('cron_test');
    expect(JSON.parse(init.body)).toEqual({
      category: 'membership_stopped',
      recipients: [{
        user_id: USER,
        title: 'Abonnement arrêté', body: "La Forge a arrêté ton abonnement aujourd'hui.",
        en: { title: 'Membership stopped', body: 'La Forge stopped your membership today.' },
        data: { type: 'membership_stopped', box_id: 'box-1' },
      }],
    });
  });

  it.each([
    ['réseau', () => fetchSpy.mockRejectedValue(new TypeError('fetch failed')), /membership push failed:","TypeError/],
    // Réponse d'erreur avec un corps qui dirait « envoyé » : le statut l'emporte.
    ['4xx', () => fetchSpy.mockResolvedValue({ ok: false, status: 403, json: async () => ({ sent: 1 }) }), /membership push failed: status",403/],
    ['5xx', () => fetchSpy.mockResolvedValue({ ok: false, status: 503, json: async () => ({ sent: 1 }) }), /membership push failed: status",503/],
    ['membre sans téléphone', () => fetchSpy.mockResolvedValue({ ok: true, json: async () => ({ sent: 0 }) }), /membership push done: sent",0/],
  ])('échec (%s) : ne lève pas, journalisé sans donnée personnelle', async (_n, arrange, trace) => {
    arrange();
    await expect(sendMembershipStoppedPush(ARGS)).resolves.toBe(false);
    expect(logged()).toMatch(trace);
    expect(logged()).not.toMatch(new RegExp(`${USER}|La Forge|box-1|cron_test`));
  });

  it('configuration absente : aucun appel, aucune erreur levée', async () => {
    delete process.env.CRON_SECRET;
    await expect(sendMembershipStoppedPush(ARGS)).resolves.toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
