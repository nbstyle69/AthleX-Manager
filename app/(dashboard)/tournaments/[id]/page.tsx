import { createClient, getOwnerBox } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ClipboardList, CheckSquare, BarChart2, Users, Edit } from 'lucide-react';
import { formatDate, statusBadge } from '@/lib/utils';
import TournamentForm from '@/components/tournaments/TournamentForm';

interface Props { params: Promise<{ id: string }> }

export default async function TournamentDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const box = await getOwnerBox(supabase);
  if (!box) redirect('/login');

  const { data: t } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', id).eq('box_id', box.id).single();

  if (!t) notFound();

  const [{ count: wodsCount }, { count: scoresCount }, { count: pendingCount }] = await Promise.all([
    supabase.from('tournament_wods').select('*', { count: 'exact', head: true }).eq('tournament_id', id),
    supabase.from('tournament_scores').select('*', { count: 'exact', head: true }).eq('tournament_id', id),
    supabase.from('tournament_scores').select('*', { count: 'exact', head: true }).eq('tournament_id', id).eq('status', 'pending'),
  ]);

  const sb = statusBadge(t.status);
  const tabs = [
    { href: `/tournaments/${id}/wods`,         label: 'WODs',        icon: ClipboardList, count: wodsCount ?? 0 },
    { href: `/tournaments/${id}/scores`,        label: 'Scores',      icon: CheckSquare,   count: scoresCount ?? 0, badge: pendingCount ?? 0 },
    { href: `/tournaments/${id}/leaderboard`,   label: 'Classement',  icon: BarChart2 },
    { href: `/tournaments/${id}/participants`,  label: 'Participants', icon: Users, count: t.current_participants ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/tournaments" className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-black text-white">{t.name}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{formatDate(t.start_date ?? t.created_at)}</p>
        </div>
        <span className="text-xs font-bold px-2.5 py-1 rounded-lg" style={{ backgroundColor: `${sb.color}20`, color: sb.color }}>
          {sb.label}
        </span>
      </div>

      {/* Navigation tabs */}
      <div className="flex gap-2 border-b border-white/8 pb-0">
        {tabs.map(({ href, label, icon: Icon, count, badge }) => (
          <Link key={href} href={href}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-gray-400 hover:text-white border-b-2 border-transparent hover:border-indigo-500 transition-colors -mb-px">
            <Icon size={15} />
            {label}
            {count !== undefined && count > 0 && (
              <span className="text-[10px] bg-white/10 text-gray-300 font-bold px-1.5 py-0.5 rounded">{count}</span>
            )}
            {badge !== undefined && badge > 0 && (
              <span className="text-[10px] bg-amber-500 text-white font-black px-1.5 py-0.5 rounded">{badge}</span>
            )}
          </Link>
        ))}
      </div>

      {/* Edit form */}
      <div className="max-w-2xl">
        <div className="flex items-center gap-2 mb-5">
          <Edit size={15} className="text-gray-400" />
          <h2 className="text-sm font-bold text-gray-300">Modifier le tournoi</h2>
        </div>
        <TournamentForm boxId={box.id} initial={t} />
      </div>
    </div>
  );
}
