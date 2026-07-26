import { redirect } from 'next/navigation';
import { createClient, getServerProfile, getServerUser } from '@/lib/supabase/server';
import AdminSidebar from '@/components/layout/AdminSidebar';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const profile = await getServerProfile(supabase);

  if (!profile || (profile.role !== 'super_admin' && profile.role !== 'admin')) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-10 text-center max-w-sm">
          <p className="text-4xl mb-4">🔒</p>
          <h2 className="text-lg font-bold text-white mb-2">Accès refusé</h2>
          <p className="text-sm text-gray-400">Cette section est réservée aux super administrateurs.</p>
        </div>
      </div>
    );
  }

  const { count: supportUnread } = await supabase
    .from('support_tickets')
    .select('id', { count: 'exact', head: true })
    .eq('admin_unread', true);

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex">
      <AdminSidebar
        username={profile.username ?? 'Admin'}
        email={user.email ?? ''}
        supportUnread={supportUnread ?? 0}
      />
      <main className="flex-1 ml-60 min-h-screen p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
