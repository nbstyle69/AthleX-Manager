import { createClient, getOwnerBox } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Trophy } from 'lucide-react';
import { cfPoints, rankWODScores } from '@/lib/cf-games-points';

interface Props { params: Promise<{ id: string }> }

export default async function LeaderboardPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const box = await getOwnerBox(supabase);
  if (!box) redirect('/login');

  const { data: wods } = await supabase
    .from('tournament_wods')
    .select('id, title, type')
    .eq('tournament_id', id)
    .order('order_index');

  const { data: scores } = await supabase
    .from('tournament_scores')
    .select('id, score_value, tiebreak_value, athlete_id, tournament_wod_id, profile:profiles(username, level, elo)')
    .eq('tournament_id', id)
    .eq('status', 'validated');

  // Build leaderboard: total CF points per athlete
  const athleteMap: Record<string, { username: string; level: string; elo: number; points: number; wods: Record<string, number> }> = {};

  for (const wod of (wods ?? [])) {
    const wodScores = (scores ?? []).filter((s: any) => s.tournament_wod_id === wod.id);
    const ranked = rankWODScores(wodScores, wod.type);
    for (const s of ranked) {
      const profile = Array.isArray(s.profile) ? s.profile[0] : s.profile;
      if (!profile) continue;
      if (!athleteMap[s.athlete_id]) {
        athleteMap[s.athlete_id] = { username: profile.username, level: profile.level, elo: profile.elo ?? 1000, points: 0, wods: {} };
      }
      athleteMap[s.athlete_id].points += s.cfPoints;
      athleteMap[s.athlete_id].wods[wod.id] = s.cfPoints;
    }
  }

  const leaderboard = Object.values(athleteMap)
    .sort((a, b) => b.points - a.points)
    .map((a, i) => ({ ...a, rank: i + 1 }));

  const MEDAL = ['🥇', '🥈', '🥉'];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/tournaments/${id}`} className="text-gray-400 hover:text-white transition-colors"><ArrowLeft size={18} /></Link>
        <h1 className="text-xl font-black text-white flex-1">Classement général</h1>
        <span className="text-xs text-gray-500 bg-white/5 px-3 py-1.5 rounded-lg">{leaderboard.length} athlètes</span>
      </div>

      {!leaderboard.length ? (
        <div className="bg-[#16162A] border border-white/8 rounded-2xl p-12 text-center">
          <Trophy size={36} className="text-gray-600 mx-auto mb-4" />
          <p className="text-white font-bold mb-1">Aucun score validé</p>
          <p className="text-sm text-gray-500">Le classement s&apos;affiche dès qu&apos;il y a des scores validés.</p>
        </div>
      ) : (
        <div className="bg-[#16162A] border border-white/8 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/8">
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider w-12">#</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Athlète</th>
                {(wods ?? []).map((w: any) => (
                  <th key={w.id} className="text-center px-3 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">{w.title}</th>
                ))}
                <th className="text-right px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Total pts</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((a) => (
                <tr key={a.username} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-4">
                    <span className="text-lg">{MEDAL[a.rank - 1] ?? `#${a.rank}`}</span>
                  </td>
                  <td className="px-5 py-4">
                    <div>
                      <p className="text-sm font-bold text-white">{a.username}</p>
                      <p className="text-xs text-gray-500">{a.level?.toUpperCase()} · ELO {a.elo}</p>
                    </div>
                  </td>
                  {(wods ?? []).map((w: any) => (
                    <td key={w.id} className="px-3 py-4 text-center">
                      {a.wods[w.id] !== undefined
                        ? <span className="text-sm font-bold text-indigo-300">{a.wods[w.id]}</span>
                        : <span className="text-gray-600 text-xs">—</span>
                      }
                    </td>
                  ))}
                  <td className="px-5 py-4 text-right">
                    <span className="text-base font-black text-white">{a.points}</span>
                    <span className="text-xs text-gray-500 ml-1">pts</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-600 text-center">
        Système de points CF Games · 1er = 100pts, 2e = 97pts, 3e = 95pts…
      </p>
    </div>
  );
}
