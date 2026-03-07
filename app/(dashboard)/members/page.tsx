import { createClient, getOwnerBox } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Users } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default async function MembersPage() {
  const supabase = await createClient();
  const box = await getOwnerBox(supabase);
  if (!box) redirect('/login');

  const { data: members } = await supabase
    .from('profiles')
    .select('id, username, level, elo, email, created_at, is_banned')
    .eq('box_id', box.id)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Membres</h1>
          <p className="text-sm text-gray-400 mt-1">{members?.length ?? 0} membre(s)</p>
        </div>
      </div>

      {!members?.length ? (
        <div className="bg-[#16162A] border border-white/8 rounded-2xl p-12 text-center">
          <Users size={40} className="text-gray-600 mx-auto mb-4" />
          <p className="text-white font-bold mb-1">Aucun membre</p>
          <p className="text-sm text-gray-500">Les membres rejoignent votre box via le code invitation.</p>
        </div>
      ) : (
        <div className="bg-[#16162A] border border-white/8 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/8">
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Membre</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Niveau</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">ELO</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Inscrit le</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Statut</th>
                <th className="text-right px-5 py-3.5"></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m: any) => (
                <tr key={m.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-600/20 flex items-center justify-center text-indigo-300 text-xs font-black shrink-0">
                        {(m.username ?? '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className={`text-sm font-semibold ${m.is_banned ? 'line-through text-gray-500' : 'text-white'}`}>{m.username}</p>
                        <p className="text-xs text-gray-500">{m.email ?? ''}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs font-bold uppercase text-gray-400">{m.level ?? 'scaled'}</span>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-300">{m.elo ?? 1000}</td>
                  <td className="px-5 py-4 text-sm text-gray-400">{formatDate(m.created_at)}</td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${m.is_banned ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                      {m.is_banned ? 'Banni' : 'Actif'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <form action={async () => {
                      'use server';
                      const srv = await (await import('@/lib/supabase/server')).createClient();
                      await srv.from('profiles').update({ is_banned: !m.is_banned }).eq('id', m.id);
                    }}>
                      <button type="submit" className={`text-xs font-semibold transition-colors ${m.is_banned ? 'text-green-400 hover:text-green-300' : 'text-red-400 hover:text-red-300'}`}>
                        {m.is_banned ? 'Débannir' : 'Bannir'}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
