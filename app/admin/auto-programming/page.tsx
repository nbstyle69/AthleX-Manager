'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { RUN_STATUS_LABEL, TRACK_LABEL, type RunStatus, type Track } from '@/lib/autoProgramming';

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

const STATUS_CLASS: Record<RunStatus, string> = {
  done: 'text-emerald-400 bg-emerald-500/15',
  error: 'text-red-400 bg-red-500/15',
  running: 'text-blue-400 bg-blue-500/15',
  skipped: 'text-gray-400 bg-white/10',
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <Sparkles size={22} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Programmation automatique</h1>
            <p className="text-sm text-gray-400">
              {runs.length} génération{runs.length !== 1 ? 's' : ''} sur les 8 dernières semaines
            </p>
          </div>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-50 text-white text-sm font-bold transition-colors"
        >
          <RefreshCw size={16} /> Actualiser
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : runs.length === 0 ? (
        <div className="text-center py-20">
          <Sparkles size={48} className="text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Aucune génération sur les 8 dernières semaines.</p>
        </div>
      ) : (
        <div className="space-y-6" data-testid="journal-auto">
          {byBox.map(([boxName, rows]) => (
            <div key={boxName} className="bg-[#111111] border border-white/[0.06] rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-white/[0.06]">
                <p className="text-sm font-bold text-white">{boxName}</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">
                    <th className="text-left px-5 py-2">Piste</th>
                    <th className="text-left px-4 py-2">Semaine ISO</th>
                    <th className="text-left px-4 py-2">Statut</th>
                    <th className="text-right px-4 py-2">Lignes</th>
                    <th className="text-right px-4 py-2">Régén.</th>
                    <th className="text-left px-4 py-2">Générée le</th>
                    <th className="text-left px-5 py-2">Erreur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {rows.map(r => (
                    <tr key={r.id} data-testid={`run-${r.id}`}>
                      <td className="px-5 py-2.5 text-gray-300">{TRACK_LABEL[r.track] ?? r.track}</td>
                      <td className="px-4 py-2.5 text-gray-400">{r.iso_year}-S{String(r.iso_week).padStart(2, '0')}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${STATUS_CLASS[r.status] ?? 'text-gray-400 bg-white/10'}`}>
                          {RUN_STATUS_LABEL[r.status] ?? r.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-300 font-semibold">{r.rows}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500">{r.regen_counter}</td>
                      <td className="px-4 py-2.5 text-gray-500">
                        {new Date(r.generated_at).toLocaleString('fr-FR', {
                          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td className="px-5 py-2.5 text-red-400 text-xs max-w-xs truncate" title={r.error ?? ''}>
                        {r.error ?? ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
