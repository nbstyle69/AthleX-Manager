import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient, getActiveBox, getAdminBoxes, getBoxBillingState, getServerProfile, getServerUser } from '@/lib/supabase/server';
import Sidebar from '@/components/layout/Sidebar';
import TrialBanner from '@/components/TrialBanner';
import PaywallOverlay from '@/components/PaywallOverlay';
import MultiBoxUpgradeOverlay from '@/components/MultiBoxUpgradeOverlay';
import { getOwnerPricing } from '@/lib/owner-pricing';

/**
 * Messages non lus : mêmes règles que la tuile du dashboard (messages des
 * autres dans les groupes de la box depuis la dernière ouverture de /messages,
 * horodatée dans un cookie). Les groupes lus dépendent du titre : le coach ne
 * voit que ceux dont il est membre, la RLS s'en charge.
 */
async function countUnreadMessages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  boxId: string,
  userId: string,
): Promise<number> {
  const { data: messageGroups } = await supabase
    .from('message_groups')
    .select('id')
    .eq('box_id', boxId);
  const groupIds = (messageGroups ?? []).map((g) => g.id);
  if (groupIds.length === 0) return 0;

  const messagesSeenAt = (await cookies()).get(`msg_seen_${boxId}`)?.value;
  let q = supabase
    .from('group_messages')
    .select('id', { count: 'exact', head: true })
    .in('group_id', groupIds)
    .neq('sender_id', userId);
  if (messagesSeenAt) q = q.gt('created_at', messagesSeenAt);
  const { count } = await q;
  return count ?? 0;
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();
  if (!user) redirect('/login');

  const supabase = await createClient();

  // Super admin → redirect to /admin section
  const profile = await getServerProfile(supabase, user.id);
  if (profile?.role === 'super_admin' || profile?.role === 'admin') {
    redirect('/admin');
  }

  const boxes = await getAdminBoxes(supabase);
  const box = await getActiveBox(supabase);
  if (!box) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-10 text-center max-w-sm">
          <p className="text-4xl mb-4">⚠️</p>
          <h2 className="text-lg font-bold text-white mb-2">Box non configurée</h2>
          <p className="text-sm text-gray-400">Ce compte n&apos;est lié à aucune box. Si tu es un athlète, gère ton compte et tes abonnements ici :</p>
          <a href="/compte" className="inline-block mt-4 px-5 py-2.5 rounded-xl bg-white text-[#0A0A0A] text-sm font-bold hover:bg-gray-200 transition-colors">Mon espace athlète</a>
        </div>
      </div>
    );
  }

  // Coach : périmètre `CoachTabs` (Whiteboard, Horaires, Messages) et rien
  // d'autre. La facturation de la box lui est refusée en lecture (RLS
  // `is_box_owner_admin`), donc on ne l'interroge pas : la lire renverrait
  // « aucun abonnement » et l'enfermerait derrière le paywall du gérant.
  if (box.my_role === 'coach') {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex">
        <Sidebar
          box={{ name: box.name, plan: 'none' }}
          email={user.email ?? ''}
          unreadCount={await countUnreadMessages(supabase, box.id, user.id)}
          boxes={boxes.map((b) => ({ id: b.id, name: b.name }))}
          activeBoxId={box.id}
          isOwnerAdmin={false}
        />
        <main className="flex-1 ml-60 min-h-screen p-8 overflow-y-auto">{children}</main>
      </div>
    );
  }

  // Fetch subscription for this box
  const { data: sub } = await supabase
    .from('box_subscriptions')
    .select('status, trial_ends_at, is_early_adopter, current_period_end, plan_tier')
    .eq('box_id', box.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = new Date();
  const trialEndsAt = sub?.trial_ends_at ?? null;
  const daysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;
  const subStatus = sub ? (sub.status as string) : 'none';

  // Lock the back-office once the trial is over and there's no paying subscription.
  // `active` = paid, `past_due` = paid-but-dunning (kept accessible), `trialing` with
  // days left = still in trial. Everything else past the trial end is locked.
  // Owner-level Solo/Multi entitlement. Additional boxes are locked behind the
  // Multi plan; the Multi plan also supersedes the legacy per-box paywall.
  const billing = await getBoxBillingState({ id: box.id, owner_id: box.owner_id });

  const legacyLocked =
    subStatus !== 'active' &&
    subStatus !== 'past_due' &&
    !(subStatus === 'trialing' && daysLeft > 0);

  // Primary box: keep legacy gate unless Multi already covers it.
  // Additional box: gated purely by the Multi plan.
  const locked = billing.requiresMulti
    ? false // handled by the Multi upgrade overlay below
    : billing.coveredByMulti
      ? false
      : legacyLocked;

  // Support: unread replies for this box, and admin inbox visibility/unread.
  const { count: supportUnread } = await supabase
    .from('support_tickets')
    .select('id', { count: 'exact', head: true })
    .eq('box_id', box.id)
    .eq('requester_unread', true);

  const unreadMessages = await countUnreadMessages(supabase, box.id, user.id);

  // Invitations « à encaisser » : mode comptoir, paiement pas encore encaissé.
  const { count: invitationsToCollect } = await supabase
    .from('box_invitations')
    .select('id', { count: 'exact', head: true })
    .eq('box_id', box.id)
    .eq('status', 'pending')
    .eq('payment_mode', 'box')
    .eq('cash_collected', false);

  const { data: isSupportAdmin } = await supabase.rpc('is_support_admin');
  let supportAdminUnread = 0;
  if (isSupportAdmin) {
    const { count } = await supabase
      .from('support_tickets')
      .select('id', { count: 'exact', head: true })
      .eq('admin_unread', true);
    supportAdminUnread = count ?? 0;
  }

  // Resolve Multi-box amounts from Stripe only when the upgrade overlay is shown.
  const ownerPricing = billing.requiresMulti
    ? await getOwnerPricing()
    : { basePrice: 0, extraPerBox: 0 };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex">
      <Sidebar
        box={{ name: box.name, plan: (sub?.plan_tier as string) ?? 'none' }}
        email={user.email ?? ''}
        unreadCount={unreadMessages}
        supportUnread={supportUnread ?? 0}
        invitationsToCollect={invitationsToCollect ?? 0}
        isSupportAdmin={!!isSupportAdmin}
        supportAdminUnread={supportAdminUnread}
        boxes={boxes.map((b) => ({ id: b.id, name: b.name }))}
        activeBoxId={box.id}
        isOwnerAdmin
      />
      <main className="flex-1 ml-60 min-h-screen p-8 overflow-y-auto">
        <TrialBanner
          status={subStatus}
          daysLeft={daysLeft}
          trialEndsAt={trialEndsAt}
          isEarlyAdopter={sub?.is_early_adopter ?? false}
          boxId={box.id}
        />
        {children}
      </main>
      {locked && <PaywallOverlay boxId={box.id} trialEndsAt={trialEndsAt} />}
      {billing.requiresMulti && (
        <MultiBoxUpgradeOverlay
          boxName={box.name}
          boxCount={billing.boxCount}
          primaryBoxId={boxes[0]?.id ?? null}
          basePrice={ownerPricing.basePrice}
          extraPerBox={ownerPricing.extraPerBox}
        />
      )}
    </div>
  );
}
