'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Gauge, Loader2, Lock } from 'lucide-react';
import {
  CATALOG_UNITS, validateVolumeCapPatch,
  type CatalogUnit, type SkeletonRow, type VolumeCapRow,
} from '@/lib/adminCatalog';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

/**
 * Plafonds de volume par mouvement (§5.4, `wod_volume_caps`) : les 19 lignes
 * sont éditables (total RX, unité, actif). Les multiplicateurs par catégorie
 * (×0,7 Scaled/Inter, ×1,3 Elite/Pro) restent des constantes du moteur.
 * La banque de squelettes (`wod_skeletons`) est listée en lecture seule.
 */

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus';

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
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 shrink-0 rounded-ax-control bg-ax-warning-soft flex items-center justify-center">
          <Gauge size={22} className="text-ax-warning" />
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-medium uppercase tracking-wide text-ax-text">Plafonds de volume &amp; squelettes</h1>
          <p className="text-sm text-ax-text-secondary break-words">
            Table §5.4 du générateur (total RX par WOD ; Scaled/Inter ×0,7, Elite/Pro ×1,3 dans le moteur) · banque de squelettes en lecture seule
          </p>
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-ax-danger" data-testid="caps-error">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-ax-border border-t-ax-accent-text rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <section>
            <h2 className="text-sm font-black text-ax-text mb-3">Plafonds ({caps.length})</h2>
            {/* À 390 px, seul le tableau défile : champs et bouton restent entiers. */}
            <Table aria-label="Plafonds de volume" data-testid="caps-table">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-bold uppercase tracking-wider">Plafond</TableHead>
                  <TableHead className="font-bold uppercase tracking-wider">Cible</TableHead>
                  <TableHead className="font-bold uppercase tracking-wider whitespace-nowrap">Total RX</TableHead>
                  <TableHead className="font-bold uppercase tracking-wider">Unité</TableHead>
                  <TableHead className="font-bold uppercase tracking-wider">Actif</TableHead>
                  <TableHead className="relative"><span className="sr-only">Enregistrer</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {caps.map(c => {
                  const d = drafts[c.label];
                  return (
                    // Inactif : fond secondaire au lieu d'une transparence qui
                    // rendait la ligne illisible ; la case « Actif » dit l'état.
                    <TableRow key={c.label} data-testid={`cap-row-${c.label}`} className={c.active ? '' : 'bg-ax-surface-secondary'}>
                      <TableCell className={`font-bold min-w-[10rem] break-words ${c.active ? 'text-ax-text' : 'text-ax-text-secondary'}`}>{c.label}</TableCell>
                      <TableCell className="text-xs text-ax-text-secondary font-mono min-w-[10rem] break-words">
                        {c.family ? `famille ${c.family}${c.band ? ` · ${c.band}` : ''}` : (c.ids ?? []).join(', ')}
                      </TableCell>
                      <TableCell>
                        <input
                          type="number" min={1}
                          value={d.rx_total}
                          onChange={e => patch(c.label, { rx_total: e.target.value })}
                          aria-label={`Total RX · ${c.label}`}
                          data-testid={`cap-total-${c.label}`}
                          className={`w-24 rounded-ax-control border border-ax-input-border bg-ax-surface px-2 py-1 font-black text-ax-success ${FOCUS}`}
                        />
                      </TableCell>
                      <TableCell>
                        <select
                          value={d.unit}
                          onChange={e => patch(c.label, { unit: e.target.value as CatalogUnit })}
                          aria-label={`Unité · ${c.label}`}
                          className={`rounded-ax-control border border-ax-input-border bg-ax-surface px-2 py-1 text-xs text-ax-text ${FOCUS}`}
                        >
                          {CATALOG_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </TableCell>
                      <TableCell>
                        <input type="checkbox" checked={d.active} onChange={e => patch(c.label, { active: e.target.checked })} aria-label={`Actif · ${c.label}`} className="w-4 h-4 accent-[var(--ax-accent)]" data-testid={`cap-active-${c.label}`} />
                      </TableCell>
                      <TableCell className="text-right">
                        {savedLabel === c.label && !isDirty(c) ? (
                          <span className="inline-flex items-center gap-1 text-xs text-ax-success whitespace-nowrap" data-testid={`cap-saved-${c.label}`}><Check size={12} /> enregistré</span>
                        ) : (
                          <Button
                            variant="ax-mint"
                            size="ax-compact"
                            onClick={() => save(c)}
                            disabled={!isDirty(c) || saving === c.label}
                            data-testid={`cap-save-${c.label}`}
                          >
                            {saving === c.label && <Loader2 size={12} className="animate-spin" />}
                            Enregistrer
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </section>

          <section>
            <h2 className="text-sm font-black text-ax-text mb-1 flex items-center gap-2">
              <Lock size={14} className="text-ax-text-muted" /> Squelettes ({skeletons.length}) · lecture seule
            </h2>
            <p className="text-xs text-ax-text-secondary mb-3">La banque est maintenue dans le package `wod-engine` (athlex-app) et exportée en base ; elle ne s&apos;édite pas ici.</p>
            <Table aria-label="Squelettes" data-testid="skeletons-table">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-bold uppercase tracking-wider">Id</TableHead>
                  <TableHead className="font-bold uppercase tracking-wider">Discipline</TableHead>
                  <TableHead className="font-bold uppercase tracking-wider">Format</TableHead>
                  <TableHead className="font-bold uppercase tracking-wider">Actif</TableHead>
                  <TableHead className="font-bold uppercase tracking-wider">Version</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {skeletons.map(s => (
                  <SkeletonRows key={s.id} s={s} open={openSkeleton === s.id} onToggle={() => setOpenSkeleton(o => (o === s.id ? null : s.id))} />
                ))}
              </TableBody>
            </Table>
          </section>
        </>
      )}
    </div>
  );
}

function SkeletonRows({ s, open, onToggle }: { s: SkeletonRow; open: boolean; onToggle: () => void }) {
  return (
    <>
      <TableRow
        onClick={onToggle}
        // Même action au clavier qu'à la souris.
        tabIndex={0}
        aria-expanded={open}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
        className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ax-focus"
        data-testid={`skeleton-row-${s.id}`}
      >
        <TableCell className="font-mono text-xs text-ax-text break-all min-w-[8rem]">{s.id}</TableCell>
        <TableCell className="text-ax-text-secondary">{s.discipline}</TableCell>
        <TableCell className="text-ax-text-secondary">{s.format}</TableCell>
        <TableCell className="text-xs">{s.active ? <span className="text-ax-success">actif</span> : <span className="text-ax-text-secondary">inactif</span>}</TableCell>
        <TableCell className="text-ax-text-secondary font-mono text-xs">v{s.version}</TableCell>
      </TableRow>
      {open && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={5} className="pt-0">
            <pre className="p-3 rounded-ax-control bg-ax-surface-secondary border border-ax-border text-[11px] text-ax-text-secondary overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(s.definition, null, 2)}</pre>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
