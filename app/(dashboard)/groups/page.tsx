import { createClient, getActiveBox } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Plus, Users2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import HelpDock from '@/components/help/HelpDock';
import { softVar, textTint } from '@/lib/colorVars';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default async function GroupsPage() {
  const supabase = await createClient();
  const box = await getActiveBox(supabase);
  if (!box) redirect('/login');

  const { data: groups } = await supabase
    .from('message_groups')
    .select('id, name, color, created_at, wod_visibility_mode, members')
    .eq('box_id', box.id)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-medium uppercase tracking-wide text-ax-text">Groupes</h1>
            <HelpDock page="groups" />
          </div>
          <p className="text-sm text-ax-text-secondary mt-1">{groups?.length ?? 0} groupe(s)</p>
        </div>
        <Button asChild variant="ax-white">
          <Link href="/groups/new">
            <Plus size={15} /> Nouveau groupe
          </Link>
        </Button>
      </div>

      {!groups?.length ? (
        <div className="bg-ax-surface border border-ax-border rounded-ax-card p-12 text-center">
          <Users2 size={40} className="text-ax-text-muted mx-auto mb-4" />
          <p className="text-ax-text font-bold mb-1">Aucun groupe</p>
          <p className="text-sm text-ax-text-muted">Créez des groupes pour organiser vos membres et envoyer des messages ciblés.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((g: any) => (
            <Link key={g.id} href={`/groups/${g.id}`}
              className="bg-ax-surface border border-ax-border hover:border-ax-input-border rounded-ax-card p-5 transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-ax-control flex items-center justify-center" style={{ backgroundColor: softVar(g.color ?? '#FFFFFF', 0.145) }}>
                  <Users2 size={18} style={{ color: textTint(g.color ?? '#FFFFFF') }} />
                </div>
                <span className="text-xs text-ax-text-muted bg-ax-surface-secondary px-2.5 py-1 rounded-ax-control">
                  {g.members?.length ?? 0} membre(s)
                </span>
              </div>
              <p className="text-sm font-bold text-ax-text break-words">{g.name}</p>
              <div className="flex items-center gap-2 mt-3">
                <Badge variant={(g.wod_visibility_mode ?? 'weekly') === 'daily' ? 'warning' : 'success'} className="text-[10px] font-bold px-1.5 py-0.5">
                  {(g.wod_visibility_mode ?? 'weekly') === 'daily' ? 'Jour par jour' : 'Semaine'}
                </Badge>
                <p className="text-xs text-ax-text-muted">{formatDate(g.created_at)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
