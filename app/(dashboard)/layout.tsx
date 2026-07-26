import { redirect } from 'next/navigation';
import { createClient, getOwnerBox, getServerProfile, getServerUser } from '@/lib/supabase/server';
import Sidebar from '@/components/layout/Sidebar';
import TrialBanner from '@/components/TrialBanner';
import PaywallOverlay from '@/components/PaywallOverlay';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();
  if (!user) redirect('/login');

  const supabase = await createClient();

  // Super admin → redirect to /admin section
  const profile = await getServerProfile(supabase, user.id);
  if (profile?.role === 'super_admin' || profile?.role === 'admin') {
    redirect('/admin');
  }

  const box = await getOwnerBox(supabase, user.id);
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
  const locked =
    subStatus !== 'active' &&
    subStatus !== 'past_due' &&
    !(subStatus === 'trialing' && daysLeft > 0);

  // Support: unread replies for this box, and admin inbox visibility/unread.
  const { count: supportUnread } = await supabase
    .from('support_tickets')
    .select('id', { count: 'exact', head: true })
    .eq('box_id', box.id)
    .eq('requester_unread', true);

  const { data: isSupportAdmin } = await supabase.rpc('is_support_admin');
  let supportAdminUnread = 0;
  if (isSupportAdmin) {
    const { count } = await supabase
      .from('support_tickets')
      .select('id', { count: 'exact', head: true })
      .eq('admin_unread', true);
    supportAdminUnread = count ?? 0;
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex">
      <Sidebar
        box={{ name: box.name, plan: (sub?.plan_tier as string) ?? 'starter' }}
        email={user.email ?? ''}
        unreadCount={0}
        supportUnread={supportUnread ?? 0}
        isSupportAdmin={!!isSupportAdmin}
        supportAdminUnread={supportAdminUnread}
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
    </div>
  );
}
