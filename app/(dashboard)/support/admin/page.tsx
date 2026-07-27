import { redirect } from 'next/navigation';
import { createClient, getServerUser } from '@/lib/supabase/server';
import AdminSupportInbox from '@/components/support/AdminSupportInbox';

export default async function SupportAdminPage() {
  const user = await getServerUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc('is_support_admin');

  if (!isAdmin) {
    return (
      <div className="max-w-3xl">
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-10 text-center">
          <p className="text-4xl mb-3">🔒</p>
          <p className="text-lg font-bold text-white mb-2">Accès réservé</p>
          <p className="text-sm text-gray-400">Cette boîte de réception est réservée au support AthleX.</p>
        </div>
      </div>
    );
  }

  return <AdminSupportInbox userId={user.id} accent="white" />;
}
