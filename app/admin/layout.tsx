import { redirect } from 'next/navigation';
import { createClient, getServerProfile, getServerUser } from '@/lib/supabase/server';
import AdminSidebar from '@/components/layout/AdminSidebar';
import { Card } from '@/components/ui/card';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const profile = await getServerProfile(supabase);

  if (!profile || (profile.role !== 'super_admin' && profile.role !== 'admin')) {
    return (
      <div className="min-h-screen bg-ax-background flex items-center justify-center">
        <Card className="p-10 text-center max-w-sm">
          <p className="text-4xl mb-4">🔒</p>
          <h2 className="font-display text-lg font-medium uppercase tracking-wide text-ax-text mb-2">Accès refusé</h2>
          <p className="text-sm text-ax-text-secondary">Cette section est réservée aux super administrateurs.</p>
        </Card>
      </div>
    );
  }

  const { count: supportUnread } = await supabase
    .from('support_tickets')
    .select('id', { count: 'exact', head: true })
    .eq('admin_unread', true);

  return (
    <div className="min-h-screen bg-ax-background flex flex-col lg:flex-row">
      <AdminSidebar
        username={profile.username ?? 'Admin'}
        email={user.email ?? ''}
        supportUnread={supportUnread ?? 0}
      />
      <main className="flex-1 lg:ml-60 min-h-screen p-4 sm:p-6 lg:p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
