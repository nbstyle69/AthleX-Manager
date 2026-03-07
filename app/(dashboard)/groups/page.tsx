import { createClient, getOwnerBox } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Plus, Users2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default async function GroupsPage() {
  const supabase = await createClient();
  const box = await getOwnerBox(supabase);
  if (!box) redirect('/login');

  const { data: groups } = await supabase
    .from('message_groups')
    .select('id, name, description, created_at, message_group_members(count)')
    .eq('box_id', box.id)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Groupes</h1>
          <p className="text-sm text-gray-400 mt-1">{groups?.length ?? 0} groupe(s)</p>
        </div>
        <Link href="/groups/new"
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors">
          <Plus size={15} /> Nouveau groupe
        </Link>
      </div>

      {!groups?.length ? (
        <div className="bg-[#16162A] border border-white/8 rounded-2xl p-12 text-center">
          <Users2 size={40} className="text-gray-600 mx-auto mb-4" />
          <p className="text-white font-bold mb-1">Aucun groupe</p>
          <p className="text-sm text-gray-500">Créez des groupes pour organiser vos membres et envoyer des messages ciblés.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((g: any) => (
            <Link key={g.id} href={`/groups/${g.id}`}
              className="bg-[#16162A] border border-white/8 hover:border-white/20 rounded-2xl p-5 transition-all group">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center">
                  <Users2 size={18} className="text-indigo-400" />
                </div>
                <span className="text-xs text-gray-500 bg-white/5 px-2.5 py-1 rounded-lg">
                  {g.message_group_members?.[0]?.count ?? 0} membres
                </span>
              </div>
              <p className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">{g.name}</p>
              {g.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{g.description}</p>}
              <p className="text-xs text-gray-600 mt-3">{formatDate(g.created_at)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
