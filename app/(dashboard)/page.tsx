import { createClient, getOwnerBox } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { Trophy, Users, Clock, MessageSquare, ChevronRight, CheckCircle, XCircle } from 'lucide-react';
import { formatDateTime, statusBadge } from '@/lib/utils';
import LogoUploadWidget from '@/components/dashboard/LogoUploadWidget';
import InviteCodeWidget from '@/components/dashboard/InviteCodeWidget';

export default async function DashboardPage() {
  const supabase = await createClient();
  const box = await getOwnerBox(supabase);
  if (!box) redirect('/login');

  const [{ data: boxTournaments }, { data: boxGroups }, { data: { user: authUser } }] = await Promise.all([
    supabase.from('tournaments').select('id').eq('box_id', box.id),
    supabase.from('message_groups').select('id').eq('box_id', box.id),
    supabase.auth.getUser(),
  ]);
  const tournamentIds = (boxTournaments ?? []).map((t: any) => t.id);
  const groupIds = (boxGroups ?? []).map((g: any) => g.id);
  const ownerId = authUser?.id ?? '';

  // "Messages non lus" = messages posted by others in the box's group chats
  // since the owner last opened /messages (timestamp stored in a cookie, set
  // client-side by the messages page — same last-seen approach as the app).
  const cookieStore = await cookies();
  const messagesSeenAt = cookieStore.get(`msg_seen_${box.id}`)?.value;

  const [
    { count: activeTournaments },
    { count: membersCount },
    { count: pendingScores },
    { count: unreadMessages },
    { data: recentTournaments },
    { data: pendingScoresList },
  ] = await Promise.all([
    supabase.from('tournaments').select('*', { count: 'exact', head: true })
      .eq('box_id', box.id).in('status', ['open', 'active']),
    supabase.from('box_members').select('*', { count: 'exact', head: true }).eq('box_id', box.id).eq('status', 'active'),
    tournamentIds.length
      ? supabase.from('tournament_scores').select('id', { count: 'exact', head: true })
          .eq('status', 'pending').in('tournament_id', tournamentIds)
      : Promise.resolve({ count: 0, data: null, error: null }),
    groupIds.length && ownerId
      ? (() => {
          let q = supabase.from('group_messages').select('id', { count: 'exact', head: true })
            .in('group_id', groupIds).neq('sender_id', ownerId);
          if (messagesSeenAt) q = q.gt('created_at', messagesSeenAt);
          return q;
        })()
      : Promise.resolve({ count: 0, data: null, error: null }),
    supabase.from('tournaments').select('id, name, status, created_at, max_participants, tournament_participants(count)')
      .eq('box_id', box.id).order('created_at', { ascending: false }).limit(3),
    tournamentIds.length
      ? supabase.from('tournament_scores')
          .select('id, score_value, submitted_at, status, athlete_id, tournament_wod_id, tournament_id, profile:profiles!athlete_id(username, level), tw:tournament_wods(title)')
          .eq('status', 'pending').in('tournament_id', tournamentIds)
          .order('submitted_at', { ascending: false }).limit(5)
      : Promise.resolve({ count: 0, data: [], error: null }),
  ]);

  const normalizedScores = (pendingScoresList ?? []).map((s: any) => ({
    ...s,
    profile: Array.isArray(s.profile) ? s.profile[0] : s.profile,
    tw:      Array.isArray(s.tw)      ? s.tw[0]      : s.tw,
  }));

  const kpis = [
    { label: 'Tournois actifs',    value: activeTournaments ?? 0, icon: Trophy,        color: '#FFFFFF', href: '/tournaments' },
    { label: 'Membres',            value: membersCount ?? 0,      icon: Users,         color: '#22C55E', href: '/members' },
    { label: 'Scores en attente',  value: pendingScores ?? 0,     icon: Clock,         color: '#D97706', href: '/tournaments' },
    { label: 'Messages non lus',   value: unreadMessages ?? 0,    icon: MessageSquare, color: '#8B5CF6', href: '/messages' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black text-white">Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">Bienvenue dans votre back office — {box.name}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, color, href }) => (
          <Link key={label} href={href}
            className="bg-[#111111] border border-white/8 rounded-2xl p-5 hover:border-white/15 transition-colors group">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
                <Icon size={20} style={{ color }} />
              </div>
              <ChevronRight size={14} className="text-gray-600 group-hover:text-gray-400 transition-colors" />
            </div>
            <p className="text-3xl font-black text-white">{value}</p>
            <p className="text-xs text-gray-400 font-medium mt-1">{label}</p>
          </Link>
        ))}
      </div>

      {/* Invite code */}
      {(box as any).invite_code && (
        <InviteCodeWidget initialCode={(box as any).invite_code} boxName={box.name} />
      )}

      {/* Logo upload */}
      <LogoUploadWidget />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tournois récents */}
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-bold text-white">Tournois récents</h2>
            <Link href="/tournaments" className="text-xs text-white hover:text-white font-semibold">Voir tout →</Link>
          </div>
          {!recentTournaments?.length ? (
            <p className="text-sm text-gray-500 text-center py-6">Aucun tournoi créé.</p>
          ) : (
            <div className="space-y-3">
              {recentTournaments.map((t: any) => {
                const sb = statusBadge(t.status);
                return (
                  <Link key={t.id} href={`/tournaments/${t.id}`}
                    className="flex items-center justify-between py-3 border-b border-white/5 last:border-0 hover:bg-white/3 rounded-lg px-2 -mx-2 transition-colors">
                    <div>
                      <p className="text-sm font-semibold text-white">{t.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{(t.tournament_participants as any)?.[0]?.count ?? 0} / {t.max_participants} participants</p>
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md" style={{ backgroundColor: `${sb.color}20`, color: sb.color }}>
                      {sb.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Scores à valider */}
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-bold text-white">Scores à valider</h2>
            <Link href="/tournaments" className="text-xs text-white hover:text-white font-semibold">Voir tout →</Link>
          </div>
          {!normalizedScores.length ? (
            <p className="text-sm text-gray-500 text-center py-6">Aucun score en attente. ✅</p>
          ) : (
            <div className="space-y-2">
              {normalizedScores.map((score: any) => (
                <Link key={score.id} href={`/tournaments/${score.tournament_id}/scores`}
                  className="flex items-center gap-3 py-3 border-b border-white/5 last:border-0 hover:bg-white/3 rounded-lg px-2 -mx-2 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-black shrink-0">
                    {(score.profile?.username ?? '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{score.profile?.username ?? '?'}</p>
                    <p className="text-xs text-gray-500 truncate">{score.tw?.title ?? ''} · {score.score_value}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center">
                      <CheckCircle size={12} className="text-green-500" />
                    </div>
                    <div className="w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center">
                      <XCircle size={12} className="text-red-500" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
