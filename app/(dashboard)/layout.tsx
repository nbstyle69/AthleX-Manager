import { redirect } from 'next/navigation';
import { createClient, getOwnerBox } from '@/lib/supabase/server';
import Sidebar from '@/components/layout/Sidebar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const box = await getOwnerBox(supabase);
  if (!box) {
    return (
      <div className="min-h-screen bg-[#0F0F1A] flex items-center justify-center">
        <div className="bg-[#16162A] border border-white/8 rounded-2xl p-10 text-center max-w-sm">
          <p className="text-4xl mb-4">⚠️</p>
          <h2 className="text-lg font-bold text-white mb-2">Box non configurée</h2>
          <p className="text-sm text-gray-400">Votre box n&apos;est pas encore liée à ce compte. Contactez l&apos;équipe BattleWOD.</p>
        </div>
      </div>
    );
  }

  const { data: unreadData } = await supabase
    .from('box_messages')
    .select('id', { count: 'exact', head: true })
    .eq('box_id', box.id)
    .eq('is_read', false)
    .neq('sender_id', user.id);

  return (
    <div className="min-h-screen bg-[#0F0F1A] flex">
      <Sidebar
        box={{ name: box.name, plan: box.plan }}
        email={user.email ?? ''}
        unreadCount={(unreadData as any)?.count ?? 0}
      />
      <main className="flex-1 ml-60 min-h-screen p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
