import { redirect } from 'next/navigation';
import { createClient, getServerUser } from '@/lib/supabase/server';
import OwnerSupport from '@/components/support/OwnerSupport';

export default async function SupportPage() {
  const user = await getServerUser();
  if (!user) redirect('/login');

  const supabase = await createClient();

  // Resolve the box this user is staff of (owner or coach).
  const { data: owned } = await supabase.from('boxes').select('id').eq('owner_id', user.id).maybeSingle();
  let boxId = owned?.id ?? null;
  if (!boxId) {
    const { data: membership } = await supabase
      .from('box_members').select('box_id')
      .eq('member_id', user.id).in('role', ['owner', 'coach']).eq('status', 'active')
      .maybeSingle();
    boxId = membership?.box_id ?? null;
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
