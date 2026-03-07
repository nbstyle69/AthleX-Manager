import { redirect } from 'next/navigation';
import { createClient, getOwnerBox, getServerUser } from '@/lib/supabase/server';
import Sidebar from '@/components/layout/Sidebar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
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

  return (
    <div className="min-h-screen bg-[#0F0F1A] flex">
      <Sidebar
        box={{ name: box.name, plan: (box as any).plan ?? 'free' }}
        email={user.email ?? ''}
        unreadCount={0}
      />
      <main className="flex-1 ml-60 min-h-screen p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
