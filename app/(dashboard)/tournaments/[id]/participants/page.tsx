import { createClient, getOwnerBox } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, UserX } from 'lucide-react';

interface Props { params: Promise<{ id: string }> }

export default async function ParticipantsPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const box = await getOwnerBox(supabase);
  if (!box) redirect('/login');

  const { data: participants } = await supabase
    .from('tournament_participants')
    .select('id, status, joined_at, disqualified_at, athlete_id, profile:profiles(username, level, elo, avatar_url)')
    .eq('tournament_id', id)
    .order('joined_at');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/tournaments/${id}`} className="text-gray-400 hover:text-white transition-colors"><ArrowLeft size={18} /></Link>
        <h1 className="text-xl font-black text-white flex-1">Participants</h1>
        <span className="text-xs text-gray-500 bg-white/5 px-3 py-1.5 rounded-lg">{participants?.length ?? 0} inscrit(s)</span>
      </div>

      {!participants?.length ? (
        <div className="bg-[#16162A] border border-white/8 rounded-2xl p-12 text-center">
          <p className="text-gray-500">Aucun participant inscrit.</p>
        </div>
      ) : (
        <div className="bg-[#16162A] border border-white/8 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/8">
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">#</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Athlète</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Niveau</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">ELO</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Statut</th>
                <th className="text-right px-5 py-3.5"></th>
              </tr>
            </thead>
            <tbody>
              {participants.map((p: any, idx: number) => {
                const profile = Array.isArray(p.profile) ? p.profile[0] : p.profile;
                const isDisq = p.status === 'disqualified';
                return (
                  <tr key={p.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-4 text-sm text-gray-500">{idx + 1}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-indigo-600/20 flex items-center justify-center text-indigo-300 text-xs font-black shrink-0">
                          {(profile?.username ?? '?')[0].toUpperCase()}
                        </div>
                        <p className={`text-sm font-semibold ${isDisq ? 'line-through text-gray-500' : 'text-white'}`}>{profile?.username ?? '?'}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs font-bold uppercase text-gray-400">{profile?.level ?? '—'}</span>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-300">{profile?.elo ?? 1000}</td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${isDisq ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                        {isDisq ? 'Disqualifié' : 'Inscrit'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {!isDisq && (
                        <form action={async () => {
                          'use server';
                          const srv = await (await import('@/lib/supabase/server')).createClient();
                          await srv.from('tournament_participants').update({ status: 'disqualified', disqualified_at: new Date().toISOString() }).eq('id', p.id);
                        }}>
                          <button type="submit" className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 font-semibold transition-colors ml-auto">
                            <UserX size={13} /> Disq.
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
