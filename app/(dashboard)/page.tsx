import { createClient, getActiveBox } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { Trophy, Users, Clock, MessageSquare, ChevronRight, CheckCircle, XCircle } from 'lucide-react';
import { formatDateTime, statusBadge } from '@/lib/utils';
import { softVar } from '@/lib/colorVars';
import HelpDock from '@/components/help/HelpDock';
import LogoUploadWidget from '@/components/dashboard/LogoUploadWidget';
import InviteCodeWidget from '@/components/dashboard/InviteCodeWidget';

export default async function DashboardPage() {
  const supabase = await createClient();
  const box = await getActiveBox(supabase);
  if (!box) redirect('/login');
  // Le tableau de bord agrège du chiffre et du code d'invitation : il reste au
  // gérant. Le coach entre par son périmètre, il n'y a pas de page vide à voir.
  if (box.my_role !== 'owner') redirect('/wods');

  const [{ data: boxTournaments }, { data: boxGroups }, { data: { user: authUser } }] = await Promise.all([
    // Archivage (#371) : un tournoi archivé sort du tableau de bord.
    supabase.from('tournaments').select('id').eq('box_id', box.id).is('archived_at', null),
    supabase.from('message_groups').select('id').eq('box_id', box.id),
    supabase.auth.getUser(),
  ]);
  // Le code d'invitation n'est plus lu sur `boxes` (Phase 3 le révoque à
  // `authenticated`) : la RPC ne le rend qu'aux admins de la box.
  const { data: inviteCode } = await supabase.rpc('get_my_box_invite_code', { p_box_id: box.id });
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
      .eq('box_id', box.id).in('status', ['open', 'active']).is('archived_at', null),
    // Colonne autorisée obligatoire : `authenticated` n'a pas de SELECT table sur
    // box_members (colonnes de facturation exclues), donc `*` renvoie 42501.
    supabase.from('box_members').select('id', { count: 'exact', head: true }).eq('box_id', box.id).eq('status', 'active'),
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
      .eq('box_id', box.id).is('archived_at', null).order('created_at', { ascending: false }).limit(3),
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

  // Couleurs en jetons : lisibles dans les deux thèmes (le trophée blanc
  // disparaissait en clair), même sens qu'avant (vert = membres actifs,
  // ambre = en attente, violet = messages).
  const kpis = [
    { label: 'Tournois actifs',    value: activeTournaments ?? 0, icon: Trophy,        color: 'var(--ax-text)', href: '/tournaments' },
    { label: 'Membres',            value: membersCount ?? 0,      icon: Users,         color: 'var(--ax-success)', href: '/members' },
    { label: 'Scores en attente',  value: pendingScores ?? 0,     icon: Clock,         color: 'var(--ax-warning)', href: '/tournaments' },
    { label: 'Messages non lus',   value: unreadMessages ?? 0,    icon: MessageSquare, color: 'var(--ax-purple)', href: '/messages' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-medium uppercase tracking-wide text-ax-text">Dashboard</h1>
          <HelpDock page="dashboard" />
        </div>
        <p className="text-sm text-ax-text-secondary mt-1">Bienvenue dans AthleX Manager — {box.name}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, color, href }) => (
          <Link key={label} href={href}
            className="bg-ax-surface border border-ax-border rounded-ax-card p-5 hover:border-ax-input-border transition-colors group">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-ax-control flex items-center justify-center" style={{ backgroundColor: softVar(color, 0.13) }}>
                <Icon size={20} style={{ color }} />
              </div>
              <ChevronRight size={14} className="text-ax-text-muted group-hover:text-ax-text-secondary transition-colors" />
            </div>
            <p className="text-3xl font-black text-ax-text">{value}</p>
            <p className="text-xs text-ax-text-secondary font-medium mt-1">{label}</p>
          </Link>
        ))}
      </div>

      {/* Invite code */}
      {inviteCode && (
        <InviteCodeWidget initialCode={inviteCode} boxName={box.name} />
      )}

      {/* Logo upload */}
      <LogoUploadWidget />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tournois récents */}
        <div className="bg-ax-surface border border-ax-border rounded-ax-card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-bold text-ax-text">Tournois récents</h2>
            <Link href="/tournaments" className="text-xs text-ax-text hover:text-ax-text font-semibold">Voir tout →</Link>
          </div>
          {!recentTournaments?.length ? (
            <p className="text-sm text-ax-text-muted text-center py-6">Aucun tournoi créé.</p>
          ) : (
            <div className="space-y-3">
              {recentTournaments.map((t: any) => {
                const sb = statusBadge(t.status);
                return (
                  <Link key={t.id} href={`/tournaments/${t.id}`}
                    className="flex items-center justify-between py-3 border-b border-ax-border last:border-0 hover:bg-ax-hover rounded-ax-control px-2 -mx-2 transition-colors">
                    <div>
                      <p className="text-sm font-semibold text-ax-text">{t.name}</p>
                      <p className="text-xs text-ax-text-muted mt-0.5">{(t.tournament_participants as any)?.[0]?.count ?? 0} / {t.max_participants} participants</p>
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md" style={{ backgroundColor: softVar(sb.color, 32 / 255), color: `color-mix(in srgb, ${sb.color} 70%, var(--ax-text))` }}>
                      {sb.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Scores à valider */}
        <div className="bg-ax-surface border border-ax-border rounded-ax-card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-bold text-ax-text">Scores à valider</h2>
            <Link href="/tournaments" className="text-xs text-ax-text hover:text-ax-text font-semibold">Voir tout →</Link>
          </div>
          {!normalizedScores.length ? (
            <p className="text-sm text-ax-text-muted text-center py-6">Aucun score en attente. ✅</p>
          ) : (
            <div className="space-y-2">
              {normalizedScores.map((score: any) => (
                <Link key={score.id} href={`/tournaments/${score.tournament_id}/scores`}
                  className="flex items-center gap-3 py-3 border-b border-ax-border last:border-0 hover:bg-ax-hover rounded-ax-control px-2 -mx-2 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-ax-hover flex items-center justify-center text-ax-text text-xs font-black shrink-0">
                    {(score.profile?.username ?? '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ax-text">{score.profile?.username ?? '?'}</p>
                    <p className="text-xs text-ax-text-muted truncate">{score.tw?.title ?? ''} · {score.score_value}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <div className="w-6 h-6 rounded-full bg-ax-success-soft flex items-center justify-center">
                      <CheckCircle size={12} className="text-ax-success" />
                    </div>
                    <div className="w-6 h-6 rounded-full bg-ax-danger-soft flex items-center justify-center">
                      <XCircle size={12} className="text-ax-danger" />
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
