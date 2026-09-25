// Archivage d'une box, PR 3 (affichage) : bandeau du dashboard, pages publiques
// fermées, refus dans une boîte d'information, badge et alerte du super-admin.
import { readFileSync } from 'fs';
import { join } from 'path';
import { fakeSupabase } from '../__fixtures__/fakeSupabase';
import { archiveBannerDate, archiveBannerText, loadArchiveBanner } from '@/lib/boxArchiveBanner';
import { closedPublicBox } from '@/lib/publicClosedBox';
import { entryRefusalFrom, entryRefusalInfo } from '@/lib/entryRefusalView';
import { overdueAlertText } from '@/lib/boxArchiveOverdue';
import { fullDate } from '@/lib/confirmDialog';
import { translations } from '@/lib/translations';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const BOX = 'box-1';

function paying(extra: Record<string, any[]> = {}): Record<string, any[]> {
  return {
    boxes: [{ id: BOX, name: 'TEST archivage A', slug: 'test-a', is_active: true, archived_at: null, archive_scheduled_at: '2026-09-20T10:00:00Z' }],
    box_members: [
      { box_id: BOX, stripe_subscription_id: 'sub_m1', subscription_status: 'active', subscription_current_period_end: '2026-10-05T00:00:00Z' },
      // Ne paie plus, ou pas par Stripe : ignorés même plus lointains.
      { box_id: BOX, stripe_subscription_id: 'sub_m2', subscription_status: 'canceled', subscription_current_period_end: '2027-01-01T00:00:00Z' },
      { box_id: BOX, stripe_subscription_id: null, subscription_status: 'active', subscription_current_period_end: '2027-01-01T00:00:00Z' },
      { box_id: 'autre', stripe_subscription_id: 'sub_x', subscription_status: 'active', subscription_current_period_end: '2027-06-01T00:00:00Z' },
    ],
    box_subscriptions: [
      { box_id: BOX, billing_source: 'stripe', status: 'past_due', current_period_end: '2026-10-12T00:00:00Z' },
      { box_id: BOX, billing_source: 'manual', status: 'active', current_period_end: '2027-02-01T00:00:00Z' },
    ],
    box_programming: [{ id: 'prog-1', publisher_box_id: BOX }],
    box_programming_subscriptions: [
      { programming_id: 'prog-1', subscriber_box_id: 'cliente', stripe_subscription_id: 'sub_p1', status: 'active', current_period_end: '2026-10-20T00:00:00Z' },
      { programming_id: 'prog-9', subscriber_box_id: BOX, stripe_subscription_id: 'sub_p2', status: 'trialing', current_period_end: '2027-03-01T00:00:00Z' },
    ],
    ...extra,
  };
}

describe('Bandeau « archivage programmé » (point 1)', () => {
  it('la date est la fin la plus lointaine des abonnements qui paient encore (offres vendues comprises)', async () => {
    expect(await archiveBannerDate(fakeSupabase(paying()).client, BOX)).toBe('2026-10-20T00:00:00Z');
  });

  it('une offre achetée par la box compte aussi', async () => {
    const t = paying();
    t.box_programming_subscriptions[1].status = 'active';
    expect(await archiveBannerDate(fakeSupabase(t).client, BOX)).toBe('2027-03-01T00:00:00Z');
  });

  it('texte du relevé, avec la date au plus tard', () => {
    const { lead, rest } = archiveBannerText('TEST archivage A', '2026-10-20T00:00:00Z');
    expect(lead).toBe('Archivage programmé :');
    expect(rest).toBe(`TEST archivage A sera archivée au plus tard le ${fullDate('2026-10-20T00:00:00Z')}, à la fin du dernier abonnement. Les nouvelles adhésions, invitations et ventes sont fermées.`);
    expect(archiveBannerText('B', null).rest).toBe('B sera archivée à la fin du dernier abonnement. Les nouvelles adhésions, invitations et ventes sont fermées.');
  });

  it('seulement pour une box programmée et pas encore archivée', async () => {
    const name = 'TEST archivage A';
    expect(await loadArchiveBanner(fakeSupabase(paying()).client, { id: BOX, name })).not.toBeNull();
    const t1 = paying(); t1.boxes[0].archive_scheduled_at = null;
    expect(await loadArchiveBanner(fakeSupabase(t1).client, { id: BOX, name })).toBeNull();
    const t2 = paying(); (t2.boxes[0] as any).archived_at = '2026-09-25T00:00:00Z';
    expect(await loadArchiveBanner(fakeSupabase(t2).client, { id: BOX, name })).toBeNull();
  });

  it('le layout le montre au gérant et au staff, et le bandeau n’a aucune action', () => {
    const layout = read('app/(dashboard)/layout.tsx');
    expect(layout).toContain('loadArchiveBanner(createServiceClient(), { id: box.id, name: box.name })');
    expect(layout.match(/\{archiveBanner && <ArchiveScheduledBanner \{\.\.\.archiveBanner\} \/>\}/g)).toHaveLength(2);
    const banner = read('components/dashboard/ArchiveScheduledBanner.tsx');
    expect(banner).not.toMatch(/<button|<Link|href=|onClick/);
  });
});

describe('Pages publiques fermées (point 2)', () => {
  it('une box archivée ou programmée est reconnue, les autres non', async () => {
    expect(await closedPublicBox(fakeSupabase(paying()).client, 'test-a')).toEqual({ name: 'TEST archivage A' });
    const t = paying(); t.boxes[0].archive_scheduled_at = null;
    expect(await closedPublicBox(fakeSupabase(t).client, 'test-a')).toBeNull();
    const t2 = paying(); t2.boxes[0].archive_scheduled_at = null; (t2.boxes[0] as any).archived_at = '2026-09-25T00:00:00Z';
    expect(await closedPublicBox(fakeSupabase(t2).client, 'test-a')).toEqual({ name: 'TEST archivage A' });
    const t3 = paying(); t3.boxes[0].is_active = false;
    expect(await closedPublicBox(fakeSupabase(t3).client, 'test-a')).toBeNull();
    expect(await closedPublicBox(fakeSupabase(paying()).client, 'inconnue')).toBeNull();
  });

  it('la fiche publique montre l’état fermé au lieu d’un 404, sans formulaire ni achat', () => {
    const page = read('app/box/[slug]/page.tsx');
    expect(page).toMatch(/const closed = await closedPublicBox\(createServiceClient\(\), slug\);\s*if \(closed\) return <ClosedBoxNotice name=\{closed\.name\} \/>;\s*notFound\(\);/);
    const notice = read('app/box/[slug]/ClosedBoxNotice.tsx');
    expect(notice).toContain('j.refused.box_archivage_programme');
    expect(notice).not.toMatch(/<form|<button|<input|Button/);
  });

  it('« Rejoindre » dit la même phrase pour les deux raisons', () => {
    const fr = translations.fr.funnel.join.refused as Record<string, string>;
    expect(fr.box_archivee).toBe("Cette box n'accepte plus de nouveaux membres.");
    expect(fr.box_archivage_programme).toBe("Cette box n'accepte plus de nouveaux membres.");
    const en = translations.en.funnel.join.refused as Record<string, string>;
    expect(en.box_archivee).toBe('This gym no longer accepts new members.');
    expect(en.box_archivage_programme).toBe('This gym no longer accepts new members.');
  });
});

describe('Refus dans une boîte d’information (point 3)', () => {
  const MSG = 'Cette box est en archivage programmé : elle n’accepte plus de nouvel abonnement.';

  it('lit le code des routes gardées, avec le message de la base', () => {
    expect(entryRefusalFrom({ error: MSG, code: 'BOX_ARCHIVAGE_PROGRAMME' })).toEqual({ code: 'BOX_ARCHIVAGE_PROGRAMME', message: MSG });
    expect(entryRefusalFrom({ error: 'Archivée.', code: 'BOX_ARCHIVEE' })).toEqual({ code: 'BOX_ARCHIVEE', message: 'Archivée.' });
  });

  it('lit aussi la raison des routes d’essai et de l’invitation', () => {
    expect(entryRefusalFrom({ ok: false, reason: 'box_archivee', message: 'M' })).toEqual({ code: 'BOX_ARCHIVEE', message: 'M' });
    expect(entryRefusalFrom({ ok: false, reason: 'box_archivage_programme' })).toEqual({
      code: 'BOX_ARCHIVAGE_PROGRAMME', message: "Cette box n'accepte plus de nouvel abonnement ni d'achat.",
    });
  });

  it('les autres erreurs restent aux écrans', () => {
    for (const d of [null, undefined, {}, { error: 'Erreur' }, { code: 'AUTRE', error: 'x' }, { reason: 'complet' }, { url: 'https://x' }]) {
      expect(entryRefusalFrom(d)).toBeNull();
    }
  });

  it('la boîte est une information, avec un titre par code', () => {
    expect(entryRefusalInfo({ code: 'BOX_ARCHIVEE', message: 'M' })).toEqual({ kind: 'info', title: 'Box archivée', body: 'M' });
    expect(entryRefusalInfo({ code: 'BOX_ARCHIVAGE_PROGRAMME', message: 'M' })).toEqual({ kind: 'info', title: 'Archivage programmé', body: 'M' });
  });

  const SCREENS = [
    'app/(dashboard)/invitations/page.tsx',
    'app/(dashboard)/subscribers/page.tsx',
    'app/box/[slug]/MembershipManageButton.tsx',
    'app/box/[slug]/MembershipSubscribeButton.tsx',
    'app/box/[slug]/ProgramBuyButton.tsx',
    'app/box/[slug]/TrialBookingCta.tsx',
    'app/compte/ManageSubscription.tsx',
    'app/pricing/manage/page.tsx',
    'app/pricing/page.tsx',
    'app/rejoindre/[token]/JoinInvitationClient.tsx',
    'components/dashboard/InviteCodeWidget.tsx',
    'components/PaymentFailedBanner.tsx',
    'components/marketplace/MarketplaceWorkspace.tsx',
  ];
  const EXPECTED_CHECKS: Record<string, number> = {
    'app/box/[slug]/TrialBookingCta.tsx': 2,
    'app/rejoindre/[token]/JoinInvitationClient.tsx': 2,
  };

  it.each(SCREENS)('%s ouvre la boîte sur un refus et la rend', (p) => {
    const s = read(p);
    const checks = s.match(/entryRefusalFrom\(/g) ?? [];
    expect(checks).toHaveLength(EXPECTED_CHECKS[p] ?? 1);
    expect(s.match(/inform\(entryRefusalInfo\((refusal|closed)\)\)/g) ?? []).toHaveLength(EXPECTED_CHECKS[p] ?? 1);
    expect(s).toContain('{dialog}');
  });

  it('marketplace : la fenêtre « S’abonner » a sa propre boîte, et la rend', () => {
    const s = read('components/marketplace/MarketplaceWorkspace.tsx');
    const modal = s.slice(s.indexOf('function SubscribeModal('), s.indexOf('function MyOffers('));
    expect(modal).toContain('const { dialog, inform } = useConfirmDialog();');
    expect(modal).toContain('entryRefusalFrom(json)');
    expect(modal).toContain('{dialog}');
  });
});

describe('archive_notified_at (point 5)', () => {
  it('la cible d’archivage lit la date d’envoi', () => {
    expect(read('lib/boxArchiveSchedule.ts')).toContain(".select('id, name, stripe_account_id, contact_email, owner_id, archived_at, archive_scheduled_at, archive_notified_at')");
  });
});

describe('Super-admin : badge et alerte des 2 jours (point 4)', () => {
  it('badge « Archivage programmé » dans la liste, seulement si la box n’est pas déjà archivée', () => {
    const s = read('app/admin/boxes/page.tsx');
    expect(s).toContain('archive_scheduled_at: b.archive_scheduled_at ?? null,');
    expect(s).toMatch(/\{box\.archive_scheduled_at && !box\.archived_at && \(\s*<span\s+data-testid=\{`archivage-programme-\$\{box\.id\}`\}/);
    expect(s).toMatch(/<CalendarClock size=\{10\} \/> Archivage programmé\r?\n/);
  });

  it('texte de l’alerte accordé en nombre', () => {
    expect(overdueAlertText(1)).toEqual({
      title: '1 box en archivage programmé n’est toujours pas archivée',
      body: 'Son dernier abonnement a pris fin il y a plus de 2 jours. Ouvrez sa fiche pour vérifier ce qui la retient.',
    });
    expect(overdueAlertText(3)).toEqual({
      title: '3 boxs en archivage programmé ne sont toujours pas archivées',
      body: 'Leur dernier abonnement a pris fin il y a plus de 2 jours. Ouvrez chaque fiche pour vérifier ce qui les retient.',
    });
  });

  it('l’accueil /admin lit box_archive_overdue et n’affiche l’alerte que si elle liste une box, avec un lien par box', () => {
    const s = read('app/admin/page.tsx');
    expect(s).toContain("supabase.rpc('box_archive_overdue')");
    expect(s).toMatch(/\{overdue\.length > 0 && \(\s*<div role="alert" data-testid="alerte-archivage-retard"/);
    expect(s).toContain('{overdue.map(b => (');
    expect(s).toContain('href={`/admin/boxes/${b.box_id}`}');
  });
});
