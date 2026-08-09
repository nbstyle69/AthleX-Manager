import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient, getServerUser, getActiveBox, ACTIVE_BOX_COOKIE } from '@/lib/supabase/server';
import OwnerSupport from '@/components/support/OwnerSupport';

export default async function SupportPage() {
  const user = await getServerUser();
  if (!user) redirect('/login');

  const supabase = await createClient();

  // Owner / co-owner : la box active du back-office. Coach : sa box de staff,
  // en respectant la box active quand il en encadre plusieurs.
  const active = await getActiveBox(supabase, user.id);
  let boxId = active?.id ?? null;
  if (!boxId) {
    const { data: memberships } = await supabase
      .from('box_members').select('box_id')
      .eq('member_id', user.id).in('role', ['owner', 'coach']).eq('status', 'active');
    const ids = (memberships ?? []).map((m) => (m as { box_id: string }).box_id);
    const wanted = (await cookies()).get(ACTIVE_BOX_COOKIE)?.value;
    boxId = (wanted && ids.includes(wanted) ? wanted : ids[0]) ?? null;
  }

  if (!boxId) {
    return (
      <div className="max-w-3xl">
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-10 text-center">
          <p className="text-lg font-bold text-white mb-2">Support indisponible</p>
          <p className="text-sm text-gray-400">Ce compte n&apos;est rattaché à aucune box.</p>
        </div>
      </div>
    );
  }

  return <OwnerSupport boxId={boxId} userId={user.id} />;
}
