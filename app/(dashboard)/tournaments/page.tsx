import { createClient, getActiveBox } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Plus, Trophy, Users, Clock, ChevronRight, Archive } from 'lucide-react';
import { formatDate, tournamentStatusInfo } from '@/lib/utils';
import { softVar } from '@/lib/colorVars';
import TopEloCard from '@/components/stats/TopEloCard';
import HelpDock from '@/components/help/HelpDock';
import { countOf } from '@/lib/plural';

export default async function TournamentsPage({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const supabase = await createClient();
  const box = await getActiveBox(supabase);
  if (!box) redirect('/login');

  // Archivage (athlex-app #371) : un tournoi archivé sort de la liste ; le
  // filtre « Archivés » les montre, et sa fiche permet de le désarchiver.
  const showArchived = (await searchParams).vue === 'archives';
  const base = supabase
    .from('tournaments')
    .select('id, name, status, level, max_participants, created_at, start_date, end_date, format')
    .eq('box_id', box.id);
  const { data: tournaments } = await (showArchived ? base.not('archived_at', 'is', null) : base.is('archived_at', null))
    .order('created_at', { ascending: false });

  // Fetch participant counts for all tournaments in one query
  const participantCounts: Record<string, number> = {};
  if (tournaments && tournaments.length > 0) {
    const tournamentIds = tournaments.map((t: any) => t.id);
    const { data: parts } = await supabase
      .from('tournament_participants')
      .select('tournament_id')
      .in('tournament_id', tournamentIds);
    (parts ?? []).forEach((p: any) => {
      participantCounts[p.tournament_id] = (participantCounts[p.tournament_id] ?? 0) + 1;
    });
  }

  const active = (tournaments ?? []).filter((t: any) => t.status !== 'completed');
  const history = (tournaments ?? []).filter((t: any) => t.status === 'completed');

  const renderTable = (rows: any[]) => (
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
          {rows.map((t: any, i: number) => {
            const sb = tournamentStatusInfo(t.status, t.end_date);
            return (
              <tr key={t.id} className={`border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors ${i % 2 === 0 ? '' : 'bg-white/[0.01]'}`}>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white">{t.name}</p>
                    {t.format && t.format !== 'simple' && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/15 text-white">
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
                    {participantCounts[t.id] ?? 0} / {t.max_participants}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg" style={{ backgroundColor: softVar(sb.color, 32 / 255), color: sb.color }}>
                    {sb.label}
                  </span>
                </td>
                <td className="px-5 py-4 text-sm text-gray-400">{formatDate(t.start_date ?? t.created_at)}</td>
                <td className="px-5 py-4">
                  <Link href={`/tournaments/${t.id}`}
                    className="flex items-center gap-1 text-xs text-white hover:text-white font-semibold transition-colors">
                    Gérer <ChevronRight size={13} />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-white">Tournois</h1>
            <HelpDock page="tournaments" />
          </div>
          <p className="text-sm text-gray-400 mt-1">{countOf(tournaments?.length ?? 0, 'tournoi créé', 'tournois créés')}</p>
        </div>
        <Link href="/tournaments/new"
          className="flex items-center gap-2 bg-white hover:bg-white text-[#0A0A0A] text-sm font-bold px-4 py-2.5 rounded-xl transition-colors">
          <Plus size={16} /> Créer un tournoi
        </Link>
      </div>

      <nav aria-label="Tournois actifs ou archivés" className="flex gap-1 p-1 rounded-ax-control border border-ax-border w-fit">
        {([[false, 'Actifs', '/tournaments'], [true, 'Archivés', '/tournaments?vue=archives']] as const).map(([v, label, href]) => (
          <Link key={label} href={href} aria-current={showArchived === v ? 'page' : undefined} data-testid={v ? 'filtre-archives' : 'filtre-actifs'}
            className={`px-3 py-1.5 rounded-ax-control text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus motion-reduce:transition-none ${showArchived === v ? 'bg-ax-accent-soft text-ax-accent-text' : 'text-ax-text-secondary hover:text-ax-text hover:bg-ax-hover'}`}>
            {label}
          </Link>
        ))}
      </nav>

      {showArchived ? (
        tournaments?.length ? renderTable(tournaments) : (
          <div className="bg-[#111111] border border-white/8 rounded-2xl p-8 text-center">
            <p className="text-sm text-ax-text-secondary">Aucun tournoi archivé.</p>
          </div>
        )
      ) : !tournaments?.length ? (
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-12 text-center">
          <Trophy size={40} className="text-gray-600 mx-auto mb-4" />
          <h3 className="text-white font-bold mb-2">Aucun tournoi</h3>
          <p className="text-sm text-gray-500 mb-6">Créez votre premier tournoi pour commencer.</p>
          <Link href="/tournaments/new"
            className="inline-flex items-center gap-2 bg-white hover:bg-white text-[#0A0A0A] text-sm font-bold px-5 py-2.5 rounded-xl transition-colors">
            <Plus size={15} /> Créer un tournoi
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">En cours &amp; à venir</h2>
              <span className="text-xs font-semibold text-gray-500">{active.length}</span>
            </div>
            {active.length ? renderTable(active) : (
              <div className="bg-[#111111] border border-white/8 rounded-2xl p-8 text-center">
                <p className="text-sm text-gray-500">Aucun tournoi actif. Les tournois clôturés sont dans l’historique ci-dessous.</p>
              </div>
            )}
          </section>

          {history.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Archive size={15} className="text-gray-500" />
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Historique</h2>
                <span className="text-xs font-semibold text-gray-500">{history.length}</span>
              </div>
              {renderTable(history)}
            </section>
          )}
        </div>
      )}

      <TopEloCard boxId={box.id} />
    </div>
  );
}
