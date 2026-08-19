import { createClient, getServerProfile } from '@/lib/supabase/server';
import { Shield, Swords, Users, Trophy } from 'lucide-react';
import Link from 'next/link';

export default async function AdminDashboard() {
  const supabase = await createClient();
  const profile = await getServerProfile(supabase);

  // Stats
  const { count: contestedCount } = await supabase
    .from('daily_tournament_scores')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'contested');

  const { count: activeDailies } = await supabase
    .from('daily_tournaments')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'open');

  // Colonne autorisée, pas `*` : `authenticated` n'a plus SELECT sur email.
  const { count: totalUsers } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true });

  const { count: totalDailies } = await supabase
    .from('daily_tournaments')
    .select('*', { count: 'exact', head: true });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <Shield size={22} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Panneau Super Admin</h1>
            <p className="text-sm text-gray-400">Bonjour, {profile?.username ?? 'Admin'}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/admin/daily-contests" className="group">
          <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-5 hover:border-red-500/30 transition-all">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-red-500/15 flex items-center justify-center">
                <Swords size={18} className="text-red-400" />
              </div>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Contestations</span>
            </div>
            <p className="text-3xl font-black text-white">{contestedCount ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">scores contestés à vérifier</p>
          </div>
        </Link>

        <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <Trophy size={18} className="text-emerald-400" />
            </div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Daily actifs</span>
          </div>
          <p className="text-3xl font-black text-white">{activeDailies ?? 0}</p>
          <p className="text-xs text-gray-500 mt-1">tournois en cours</p>
        </div>

        <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <Trophy size={18} className="text-blue-400" />
            </div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Daily</span>
          </div>
          <p className="text-3xl font-black text-white">{totalDailies ?? 0}</p>
          <p className="text-xs text-gray-500 mt-1">tournois créés</p>
        </div>

        <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-purple-500/15 flex items-center justify-center">
              <Users size={18} className="text-purple-400" />
            </div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Utilisateurs</span>
          </div>
          <p className="text-3xl font-black text-white">{totalUsers ?? 0}</p>
          <p className="text-xs text-gray-500 mt-1">athlètes inscrits</p>
        </div>
      </div>

      {/* Quick actions */}
      {(contestedCount ?? 0) > 0 && (
        <Link href="/admin/daily-contests">
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 flex items-center gap-4 hover:bg-red-500/15 transition-all cursor-pointer">
            <Swords size={24} className="text-red-400" />
            <div>
              <p className="text-sm font-bold text-white">{contestedCount} contestation{(contestedCount ?? 0) > 1 ? 's' : ''} en attente</p>
              <p className="text-xs text-gray-400">Cliquez pour vérifier et valider ou rejeter les scores contestés</p>
            </div>
          </div>
        </Link>
      )}
    </div>
  );
}
