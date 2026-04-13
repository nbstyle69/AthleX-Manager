import { redirect } from 'next/navigation';
import { createClient, getOwnerBox, getServerProfile, getServerUser } from '@/lib/supabase/server';
import Sidebar from '@/components/layout/Sidebar';
import TrialBanner from '@/components/TrialBanner';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();
  if (!user) redirect('/login');

  const supabase = await createClient();

  // Super admin → redirect to /admin section
  const profile = await getServerProfile(supabase);
  if (profile?.role === 'super_admin' || profile?.role === 'admin') {
    redirect('/admin');
  }

  const box = await getOwnerBox(supabase);
  if (!box) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-10 text-center max-w-sm">
          <p className="text-4xl mb-4">⚠️</p>
          <h2 className="text-lg font-bold text-white mb-2">Box non configurée</h2>
          <p className="text-sm text-gray-400">Votre box n&apos;est pas encore liée à ce compte. Contactez l&apos;équipe Test.</p>
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
  const subStatus = (sub?.status as string) ?? 'trialing';

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex">
      <Sidebar
        box={{ name: box.name, plan: (sub?.plan_tier as string) ?? 'starter' }}
        email={user.email ?? ''}
        unreadCount={0}
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
    </div>
  );
}
