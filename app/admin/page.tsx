import { createClient, getServerProfile } from '@/lib/supabase/server';
import { Shield, Swords, Users, Trophy, CalendarClock, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { fullDate } from '@/lib/confirmDialog';
import { overdueAlertText, type OverdueBox } from '@/lib/boxArchiveOverdue';

// Pastille violette : pas de jeton « doux » pour --ax-purple, même dosage que les autres.
const PURPLE_SOFT = 'bg-[color-mix(in_srgb,var(--ax-purple)_12%,var(--ax-surface))]';

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

  // Archivage (PR 3) : l'alerte des 2 jours, seulement si elle liste une box.
  const { data: overdueData } = await supabase.rpc('box_archive_overdue');
  const overdue = (overdueData ?? []) as OverdueBox[];
  const overdueText = overdueAlertText(overdue.length);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 shrink-0 rounded-ax-control bg-ax-accent-soft flex items-center justify-center">
            <Shield size={22} className="text-ax-accent-text" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-medium uppercase tracking-wide text-ax-text">Panneau Super Admin</h1>
            <p className="text-sm text-ax-text-secondary break-words">Bonjour, {profile?.username ?? 'Admin'}</p>
          </div>
        </div>
      </div>

      {overdue.length > 0 && (
        <div role="alert" data-testid="alerte-archivage-retard" className="bg-ax-warning-soft border border-ax-warning rounded-ax-card p-5">
          <div className="flex items-start gap-3">
            <CalendarClock size={22} className="text-ax-warning shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-ax-text">{overdueText.title}</p>
              <p className="text-xs text-ax-text-secondary mt-1">{overdueText.body}</p>
            </div>
          </div>
          <ul className="mt-3 space-y-2">
            {overdue.map(b => (
              <li key={b.box_id}>
                <Link
                  href={`/admin/boxes/${b.box_id}`}
                  className="flex items-center justify-between gap-3 rounded-ax-control bg-ax-surface border border-ax-border px-3 py-2 hover:border-ax-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ax-text break-words">{b.box_name}</span>
                    <span className="block text-xs text-ax-text-secondary">Dernier abonnement terminé le {fullDate(b.last_period_end)}</span>
                  </span>
                  <ChevronRight size={16} className="text-ax-text-secondary shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/admin/daily-contests" className="group rounded-ax-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-background">
          <Card className="p-5 h-full transition-colors group-hover:border-ax-danger motion-reduce:transition-none">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-ax-control bg-ax-danger-soft flex items-center justify-center">
                <Swords size={18} className="text-ax-danger" />
              </div>
              <span className="text-xs font-bold text-ax-text-secondary uppercase tracking-wider">Contestations</span>
            </div>
            <p className="text-3xl font-black text-ax-text">{contestedCount ?? 0}</p>
            <p className="text-xs text-ax-text-secondary mt-1">scores contestés à vérifier</p>
          </Card>
        </Link>

        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-ax-control bg-ax-success-soft flex items-center justify-center">
              <Trophy size={18} className="text-ax-success" />
            </div>
            <span className="text-xs font-bold text-ax-text-secondary uppercase tracking-wider">Daily actifs</span>
          </div>
          <p className="text-3xl font-black text-ax-text">{activeDailies ?? 0}</p>
          <p className="text-xs text-ax-text-secondary mt-1">tournois en cours</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-ax-control bg-ax-info-soft flex items-center justify-center">
              <Trophy size={18} className="text-ax-info" />
            </div>
            <span className="text-xs font-bold text-ax-text-secondary uppercase tracking-wider">Total Daily</span>
          </div>
          <p className="text-3xl font-black text-ax-text">{totalDailies ?? 0}</p>
          <p className="text-xs text-ax-text-secondary mt-1">tournois créés</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-9 h-9 rounded-ax-control ${PURPLE_SOFT} flex items-center justify-center`}>
              <Users size={18} className="text-ax-purple" />
            </div>
            <span className="text-xs font-bold text-ax-text-secondary uppercase tracking-wider">Utilisateurs</span>
          </div>
          <p className="text-3xl font-black text-ax-text">{totalUsers ?? 0}</p>
          <p className="text-xs text-ax-text-secondary mt-1">athlètes inscrits</p>
        </Card>
      </div>

      {/* Quick actions */}
      {(contestedCount ?? 0) > 0 && (
        <Link href="/admin/daily-contests" className="block rounded-ax-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-background">
          <div className="bg-ax-danger-soft border border-ax-danger rounded-ax-card p-5 flex items-center gap-4 hover:brightness-105 transition-[filter] cursor-pointer motion-reduce:transition-none">
            <Swords size={24} className="text-ax-danger shrink-0" />
            <div>
              <p className="text-sm font-bold text-ax-text">{contestedCount} contestation{(contestedCount ?? 0) > 1 ? 's' : ''} en attente</p>
              <p className="text-xs text-ax-text-secondary">Cliquez pour vérifier et valider ou rejeter les scores contestés</p>
            </div>
          </div>
        </Link>
      )}
    </div>
  );
}
