'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Gauge, Loader2, Lock } from 'lucide-react';
import {
  CATALOG_UNITS, validateVolumeCapPatch,
  type CatalogUnit, type SkeletonRow, type VolumeCapRow,
} from '@/lib/adminCatalog';

/**
 * Plafonds de volume par mouvement (§5.4, `wod_volume_caps`) : les 19 lignes
 * sont éditables (total RX, unité, actif). Les multiplicateurs par catégorie
 * (×0,7 Scaled/Inter, ×1,3 Elite/Pro) restent des constantes du moteur.
 * La banque de squelettes (`wod_skeletons`) est listée en lecture seule.
 */

interface CapDraft { rx_total: string; unit: CatalogUnit; active: boolean }

function draftOf(c: VolumeCapRow): CapDraft {
  return { rx_total: String(c.rx_total), unit: c.unit, active: c.active };
}

export default function AdminVolumeCapsPage() {
  const [caps, setCaps] = useState<VolumeCapRow[]>([]);
  const [skeletons, setSkeletons] = useState<SkeletonRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, CapDraft>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [savedLabel, setSavedLabel] = useState<string | null>(null);
  const [openSkeleton, setOpenSkeleton] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const res = await fetch('/api/admin/volume-caps', { cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json.error ?? `Erreur ${res.status}`); setLoading(false); return; }
    const c = json.caps as VolumeCapRow[];
    setCaps(c);
    setSkeletons(json.skeletons as SkeletonRow[]);
    setDrafts(Object.fromEntries(c.map(x => [x.label, draftOf(x)])));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const patch = (label: string, p: Partial<CapDraft>) =>
    setDrafts(d => ({ ...d, [label]: { ...d[label], ...p } }));

  function isDirty(c: VolumeCapRow): boolean {
    const d = drafts[c.label];
    return !!d && (Number(d.rx_total) !== c.rx_total || d.unit !== c.unit || d.active !== c.active);
  }

  async function save(c: VolumeCapRow) {
    const d = drafts[c.label];
    const body = { label: c.label, rx_total: Number(d.rx_total), unit: d.unit, active: d.active };
    const { errors } = validateVolumeCapPatch(body);
    if (errors.length) { setError(errors.join(' · ')); return; }
    setSaving(c.label); setError(null); setSavedLabel(null);
    const res = await fetch('/api/admin/volume-caps', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(null);
    if (!res.ok) { setError(json.error ?? `Erreur ${res.status}`); return; }
    const row = json as VolumeCapRow;
    setCaps(prev => prev.map(x => (x.label === row.label ? row : x)));
    setDrafts(prev => ({ ...prev, [row.label]: draftOf(row) }));
    setSavedLabel(row.label);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
          <Gauge size={22} className="text-amber-400" />
        </div>
        <div>
          <h1 className="text-xl font-black text-white">Plafonds de volume &amp; squelettes</h1>
          <p className="text-sm text-gray-400">
            Table §5.4 du générateur (total RX par WOD ; Scaled/Inter ×0,7, Elite/Pro ×1,3 dans le moteur) · banque de squelettes en lecture seule
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-red-400" data-testid="caps-error">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <section>
            <h2 className="text-sm font-black text-white mb-3">Plafonds ({caps.length})</h2>
            <div className="overflow-hidden rounded-2xl border border-white/[0.06]">
              <table className="w-full text-sm" data-testid="caps-table">
                <thead>
                  <tr className="bg-white/[0.03] text-left">
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Plafond</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Cible</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Total RX</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Unité</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Actif</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {caps.map(c => {
                    const d = drafts[c.label];
                    return (
                      <tr key={c.label} data-testid={`cap-row-${c.label}`} className={c.active ? '' : 'opacity-60'}>
                        <td className="px-4 py-2.5 font-bold text-white">{c.label}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-400 font-mono">
                          {c.family ? `famille ${c.family}${c.band ? ` · ${c.band}` : ''}` : (c.ids ?? []).join(', ')}
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="number" min={1}
                            value={d.rx_total}
                            onChange={e => patch(c.label, { rx_total: e.target.value })}
                            data-testid={`cap-total-${c.label}`}
                            className="w-24 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white font-black text-emerald-400 focus:outline-none focus:border-emerald-500/50"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <select
                            value={d.unit}
                            onChange={e => patch(c.label, { unit: e.target.value as CatalogUnit })}
                            className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                          >
                            {CATALOG_UNITS.map(u => <option key={u} value={u} className="text-black">{u}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-2.5">
                          <input type="checkbox" checked={d.active} onChange={e => patch(c.label, { active: e.target.checked })} className="accent-emerald-500" data-testid={`cap-active-${c.label}`} />
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {savedLabel === c.label && !isDirty(c) ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-400" data-testid={`cap-saved-${c.label}`}><Check size={12} /> enregistré</span>
                          ) : (
                            <button
                              onClick={() => save(c)}
                              disabled={!isDirty(c) || saving === c.label}
                              data-testid={`cap-save-${c.label}`}
                              className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-500 text-black text-xs font-bold hover:bg-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                              {saving === c.label && <Loader2 size={12} className="animate-spin" />}
                              Enregistrer
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-black text-white mb-1 flex items-center gap-2">
              <Lock size={14} className="text-gray-500" /> Squelettes ({skeletons.length}) · lecture seule
            </h2>
            <p className="text-xs text-gray-500 mb-3">La banque est maintenue dans le package `wod-engine` (athlex-app) et exportée en base ; elle ne s&apos;édite pas ici.</p>
            <div className="overflow-hidden rounded-2xl border border-white/[0.06]">
              <table className="w-full text-sm" data-testid="skeletons-table">
                <thead>
                  <tr className="bg-white/[0.03] text-left">
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Id</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Discipline</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Format</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Actif</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Version</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {skeletons.map(s => (
                    <SkeletonRows key={s.id} s={s} open={openSkeleton === s.id} onToggle={() => setOpenSkeleton(o => (o === s.id ? null : s.id))} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function SkeletonRows({ s, open, onToggle }: { s: SkeletonRow; open: boolean; onToggle: () => void }) {
  return (
    <>
      <tr onClick={onToggle} className="cursor-pointer hover:bg-white/[0.02]" data-testid={`skeleton-row-${s.id}`}>
        <td className="px-4 py-2.5 font-mono text-xs text-white">{s.id}</td>
        <td className="px-4 py-2.5 text-gray-300">{s.discipline}</td>
        <td className="px-4 py-2.5 text-gray-300">{s.format}</td>
        <td className="px-4 py-2.5 text-xs">{s.active ? <span className="text-emerald-400">actif</span> : <span className="text-gray-500">inactif</span>}</td>
        <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">v{s.version}</td>
      </tr>
      {open && (
        <tr>
          <td colSpan={5} className="px-4 pb-3">
            <pre className="p-3 rounded-xl bg-black/40 text-[11px] text-gray-400 overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(s.definition, null, 2)}</pre>
          </td>
        </tr>
      )}
    </>
  );
}
