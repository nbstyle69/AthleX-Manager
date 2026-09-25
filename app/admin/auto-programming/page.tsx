'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { RUN_STATUS_LABEL, TRACK_LABEL, type RunStatus, type Track } from '@/lib/autoProgramming';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

/**
 * Journal de la programmation automatique — lecture seule (lot J2).
 *
 * Les runs des huit dernières semaines, par box. Rien n'est modifiable ici :
 * l'interrupteur vit sur `/admin/boxes`, la génération sur le Whiteboard de
 * la box. Cette page répond à « qu'est-ce qui s'est passé, et qu'est-ce qui a
 * échoué », pas à « que faire ».
 */

interface RunRow {
  id: string;
  box_id: string;
  box_name: string;
  track: Track;
  iso_year: number;
  iso_week: number;
  status: RunStatus;
  regen_counter: number;
  rows: number;
  error: string | null;
  generated_at: string;
}

// Même sens qu'avant, en jetons lisibles dans les deux thèmes.
const STATUS_CLASS: Record<RunStatus, string> = {
  done: 'text-ax-success bg-ax-success-soft',
  error: 'text-ax-danger bg-ax-danger-soft',
  running: 'text-ax-info bg-ax-info-soft',
  skipped: 'text-ax-text-secondary bg-ax-neutral-soft',
};

export default function AdminAutoProgrammingPage() {
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch('/api/admin/auto-programming', { cache: 'no-store' });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? `Erreur ${res.status}`);
      setLoading(false);
      return;
    }
    setRuns(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  /** Une section par box, les box les plus récemment générées en premier. */
  const byBox = useMemo(() => {
    const map = new Map<string, RunRow[]>();
    for (const r of runs) {
      const list = map.get(r.box_name) ?? [];
      list.push(r);
      map.set(r.box_name, list);
    }
    return [...map.entries()];
  }, [runs]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 shrink-0 rounded-ax-control bg-ax-accent-soft flex items-center justify-center">
            <Sparkles size={22} className="text-ax-accent-text" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-medium uppercase tracking-wide text-ax-text">Programmation automatique</h1>
            <p className="text-sm text-ax-text-secondary">
              {runs.length} génération{runs.length !== 1 ? 's' : ''} sur les 8 dernières semaines
            </p>
          </div>
        </div>
        <Button variant="ax-outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={16} /> Actualiser
        </Button>
      </div>

      {error && (
        <div role="alert" className="rounded-ax-control border border-ax-danger bg-ax-danger-soft px-4 py-3 text-sm text-ax-danger">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-ax-border border-t-ax-accent-text rounded-full animate-spin" />
        </div>
      ) : runs.length === 0 ? (
        <div className="text-center py-20">
          <Sparkles size={48} className="text-ax-text-muted mx-auto mb-4" />
          <p className="text-ax-text-secondary">Aucune génération sur les 8 dernières semaines.</p>
        </div>
      ) : (
        <div className="space-y-6" data-testid="journal-auto">
          {byBox.map(([boxName, rows]) => (
            <section key={boxName} className="space-y-2">
              <h2 className="text-sm font-bold text-ax-text break-words">{boxName}</h2>
              {/* À 390 px, seul le tableau défile : mêmes colonnes, même ordre. */}
              <Table aria-label={`Générations de ${boxName}`}>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-bold uppercase tracking-wider">Piste</TableHead>
                    <TableHead className="font-bold uppercase tracking-wider whitespace-nowrap">Semaine ISO</TableHead>
                    <TableHead className="font-bold uppercase tracking-wider">Statut</TableHead>
                    <TableHead className="font-bold uppercase tracking-wider text-right">Lignes</TableHead>
                    <TableHead className="font-bold uppercase tracking-wider text-right">Régén.</TableHead>
                    <TableHead className="font-bold uppercase tracking-wider whitespace-nowrap">Générée le</TableHead>
                    <TableHead className="font-bold uppercase tracking-wider">Erreur</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(r => (
                    <TableRow key={r.id} data-testid={`run-${r.id}`}>
                      <TableCell className="text-ax-text">{TRACK_LABEL[r.track] ?? r.track}</TableCell>
                      <TableCell className="text-ax-text-secondary whitespace-nowrap">{r.iso_year}-S{String(r.iso_week).padStart(2, '0')}</TableCell>
                      <TableCell>
                        <span className={`whitespace-nowrap text-[10px] font-bold px-2 py-0.5 rounded-ax-badge ${STATUS_CLASS[r.status] ?? 'text-ax-text-secondary bg-ax-neutral-soft'}`}>
                          {RUN_STATUS_LABEL[r.status] ?? r.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-ax-text font-semibold">{r.rows}</TableCell>
                      <TableCell className="text-right text-ax-text-secondary">{r.regen_counter}</TableCell>
                      <TableCell className="text-ax-text-secondary whitespace-nowrap">
                        {new Date(r.generated_at).toLocaleString('fr-FR', {
                          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                        })}
                      </TableCell>
                      {/* Le message d'erreur se lit en entier : il n'est plus coupé. */}
                      <TableCell className="text-ax-danger text-xs min-w-[16rem] max-w-md break-words">
                        {r.error ?? ''}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
