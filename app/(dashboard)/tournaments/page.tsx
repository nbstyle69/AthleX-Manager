import { createClient, getOwnerBox } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Plus, Trophy, Users, Clock, ChevronRight } from 'lucide-react';
import { formatDate, statusBadge } from '@/lib/utils';

export default async function TournamentsPage() {
  const supabase = await createClient();
  const box = await getOwnerBox(supabase);
  if (!box) redirect('/login');

  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('id, name, status, level, max_participants, created_at, start_date, format')
    .eq('box_id', box.id)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Tournois</h1>
          <p className="text-sm text-gray-400 mt-1">{tournaments?.length ?? 0} tournoi(s) créé(s)</p>
        </div>
        <Link href="/tournaments/new"
          className="flex items-center gap-2 bg-[#C9A227] hover:bg-[#C9A227] text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors">
          <Plus size={16} /> Créer un tournoi
        </Link>
      </div>

      {!tournaments?.length ? (
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-12 text-center">
          <Trophy size={40} className="text-gray-600 mx-auto mb-4" />
          <h3 className="text-white font-bold mb-2">Aucun tournoi</h3>
          <p className="text-sm text-gray-500 mb-6">Créez votre premier tournoi pour commencer.</p>
          <Link href="/tournaments/new"
            className="inline-flex items-center gap-2 bg-[#C9A227] hover:bg-[#C9A227] text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors">
            <Plus size={15} /> Créer un tournoi
          </Link>
        </div>
      ) : (
        <div className="bg-[#111111] border border-white/8 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/8">
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Tournoi</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Niveau</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Participants</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Statut</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-5 py-3.5"></th>
              </tr>
            </thead>
            <tbody>
              {tournaments.map((t: any, i: number) => {
                const sb = statusBadge(t.status);
                return (
                  <tr key={t.id} className={`border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors ${i % 2 === 0 ? '' : 'bg-white/[0.01]'}`}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-white">{t.name}</p>
                        {t.format && t.format !== 'simple' && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#C9A227]/15 text-[#C9A227]">
                            {t.format === 'bracket' ? 'Bracket' : t.format === 'swiss' ? 'Swiss' : t.format === 'league_div' ? 'Ligue' : t.format}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs font-bold uppercase text-gray-400">{t.level ?? 'RX'}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 text-sm text-gray-300">
                        <Users size={13} className="text-gray-500" />
                        0 / {t.max_participants}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-lg" style={{ backgroundColor: `${sb.color}20`, color: sb.color }}>
                        {sb.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-400">{formatDate(t.start_date ?? t.created_at)}</td>
                    <td className="px-5 py-4">
                      <Link href={`/tournaments/${t.id}`}
                        className="flex items-center gap-1 text-xs text-[#C9A227] hover:text-[#C9A227] font-semibold transition-colors">
                        Gérer <ChevronRight size={13} />
                      </Link>
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
