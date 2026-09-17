'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Plus, Search, X } from 'lucide-react';
import {
  CATALOG_FAMILIES, CATALOG_MODALITIES, CATALOG_PATTERNS, CATALOG_UNITS, LOAD_BANDS, LOAD_BAND_LABEL,
  LOAD_CATEGORIES, LOAD_CATEGORY_LABEL, LOAD_UNITS, MODALITY_LABEL, emptyLoadTable, validateMovementPatch,
  type CatalogFamily, type CatalogModality, type CatalogPattern, type CatalogUnit, type LoadBand, type LoadCategory,
  type LoadTable, type LoadUnit, type MovementCatalogAdminRow, type MovementCatalogPatch,
} from '@/lib/adminCatalog';

/**
 * Onglet « Catalogue » de /admin/movements : liste de `movement_catalog`
 * (inactifs compris), fiche d'édition (nom, famille, pattern, modalité,
 * unités, unité de charge, poids de tirage Functional / Hybrid, actif, notes),
 * bandes de charge en tableau 6 catégories × 3 bandes × H/F, et création avec
 * les champs minimum. Les JSON (cadence, rep_ranges, substitutions, equipment)
 * sont affichés en lecture seule. Écritures via /api/admin/movement-catalog.
 */

const inp = 'w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50';
const lbl = 'block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1';

interface Draft {
  id: string;
  name: string;
  family: CatalogFamily;
  pattern: CatalogPattern[];
  modality: CatalogModality;
  unit_default: CatalogUnit;
  units_allowed: CatalogUnit[];
  load_unit: LoadUnit | '';
  weight_functional: string;
  weight_hybrid: string;
  active: boolean;
  notes: string;
  loads: LoadTable | null;
}

function draftFromRow(r: MovementCatalogAdminRow): Draft {
  return {
    id: r.id, name: r.name, family: r.family, pattern: r.pattern ?? [], modality: r.modality,
    unit_default: r.unit_default, units_allowed: r.units_allowed ?? [r.unit_default],
    load_unit: r.load_unit ?? '', weight_functional: String(r.weight_functional), weight_hybrid: String(r.weight_hybrid),
    active: r.active, notes: r.notes ?? '', loads: r.loads,
  };
}

const NEW_DRAFT: Draft = {
  id: '', name: '', family: 'barbell', pattern: [], modality: 'W', unit_default: 'reps', units_allowed: ['reps'],
  load_unit: '', weight_functional: '5', weight_hybrid: '0', active: true, notes: '', loads: null,
};

function draftToBody(d: Draft): Record<string, unknown> {
  return {
    id: d.id.trim(),
    name: d.name,
    family: d.family,
    pattern: d.pattern,
    modality: d.modality,
    unit_default: d.unit_default,
    units_allowed: d.units_allowed,
    load_unit: d.load_unit || null,
    weight_functional: Number(d.weight_functional),
    weight_hybrid: Number(d.weight_hybrid),
    active: d.active,
    notes: d.notes.trim() || null,
    loads: d.loads,
  };
}

export default function MovementCatalogEditor() {
  const [rows, setRows] = useState<MovementCatalogAdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setLoadError(null);
    const res = await fetch('/api/admin/movement-catalog', { cache: 'no-store' });
    if (!res.ok) {
      setLoadError((await res.json().catch(() => ({}))).error ?? `Erreur ${res.status}`);
      setLoading(false);
      return;
    }
    setRows(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const selected = useMemo(() => rows.find(r => r.id === selectedId) ?? null, [rows, selectedId]);

  useEffect(() => {
    if (creating) return;
    setDraft(selected ? draftFromRow(selected) : null);
    setSaveError(null); setSaved(null);
  }, [selected, creating]);

  const filtered = rows.filter(r =>
    (showInactive || r.active) &&
    (r.name.toLowerCase().includes(search.toLowerCase()) || r.id.includes(search.toLowerCase())),
  );
  const inactiveCount = rows.filter(r => !r.active).length;

  function startCreate() {
    setCreating(true); setSelectedId(null); setDraft({ ...NEW_DRAFT }); setSaveError(null); setSaved(null);
  }
  function cancelCreate() {
    setCreating(false); setDraft(null);
  }

  const patchDraft = (p: Partial<Draft>) => setDraft(d => (d ? { ...d, ...p } : d));

  function toggleUnit(u: CatalogUnit) {
    if (!draft) return;
    const has = draft.units_allowed.includes(u);
    const next = has ? draft.units_allowed.filter(x => x !== u) : [...draft.units_allowed, u];
    if (next.length === 0) return;
    patchDraft({ units_allowed: next, unit_default: next.includes(draft.unit_default) ? draft.unit_default : next[0] });
  }

  function togglePattern(p: CatalogPattern) {
    if (!draft) return;
    patchDraft({ pattern: draft.pattern.includes(p) ? draft.pattern.filter(x => x !== p) : [...draft.pattern, p] });
  }

  function setLoad(c: LoadCategory, b: LoadBand, sex: 0 | 1, value: string) {
    if (!draft) return;
    const table = draft.loads ?? emptyLoadTable();
    const pair: [number, number] = [...table[c][b]] as [number, number];
    pair[sex] = Math.max(0, Number(value) || 0);
    patchDraft({ loads: { ...table, [c]: { ...table[c], [b]: pair } } });
  }

  async function save() {
    if (!draft) return;
    const body = draftToBody(draft);
    const { errors } = validateMovementPatch(body, creating);
    if (errors.length) { setSaveError(errors.join(' · ')); return; }
    setSaving(true); setSaveError(null); setSaved(null);
    const res = await fetch('/api/admin/movement-catalog', {
      method: creating ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setSaveError(json.error ?? `Erreur ${res.status}`); return; }
    const row = json as MovementCatalogAdminRow;
    setRows(prev => {
      const others = prev.filter(r => r.id !== row.id);
      return [...others, row].sort((a, b) => a.name.localeCompare(b.name));
    });
    setCreating(false);
    setSelectedId(row.id);
    setSaved(creating ? 'Mouvement créé' : 'Enregistré');
  }

  async function toggleActive(row: MovementCatalogAdminRow) {
    const res = await fetch('/api/admin/movement-catalog', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: row.id, active: !row.active } satisfies MovementCatalogPatch & { id: string }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setSaveError(json.error ?? `Erreur ${res.status}`); return; }
    setRows(prev => prev.map(r => (r.id === row.id ? (json as MovementCatalogAdminRow) : r)));
  }

  const dirty = !!draft && (creating || (selected && JSON.stringify(draftToBody(draft)) !== JSON.stringify(draftToBody(draftFromRow(selected)))));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-400">
          {rows.length} mouvements · {inactiveCount} inactifs (proposés aux coachs, ignorés par le générateur)
        </p>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="accent-emerald-500" />
            Afficher les inactifs
          </label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher (nom ou id)..."
              className="pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 w-64"
            />
          </div>
          <button
            onClick={startCreate}
            data-testid="catalog-new"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 text-black text-sm font-bold hover:bg-emerald-400 transition-colors"
          >
            <Plus size={14} /> Nouveau mouvement
          </button>
        </div>
      </div>

      {loadError && <p className="text-sm text-red-400">{loadError}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex gap-6 items-start">
          <div className="flex-1 min-w-0 overflow-hidden rounded-2xl border border-white/[0.06]">
            <table className="w-full text-sm" data-testid="catalog-table">
              <thead>
                <tr className="bg-white/[0.03] text-left">
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Mouvement</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Famille</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Unités</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider" title="Poids de tirage Functional / Hybrid">F / H</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Actif</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filtered.map(r => (
                  <tr
                    key={r.id}
                    onClick={() => { setCreating(false); setSelectedId(r.id); }}
                    data-testid={`catalog-row-${r.id}`}
                    className={`cursor-pointer transition-colors ${selectedId === r.id ? 'bg-emerald-500/10' : 'hover:bg-white/[0.02]'} ${r.active ? '' : 'opacity-60'}`}
                  >
                    <td className="px-4 py-2.5">
                      <span className="font-bold text-white">{r.name}</span>
                      <span className="ml-2 font-mono text-[10px] text-gray-600">{r.id}</span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-300">{r.family}</td>
                    <td className="px-4 py-2.5 text-gray-400">
                      {(r.units_allowed ?? []).join(' · ')}
                      {r.load_unit && <span className="ml-2 px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 text-[10px] font-bold uppercase">{r.load_unit}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-gray-300 font-mono text-xs">{r.weight_functional} / {r.weight_hybrid}</td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={e => { e.stopPropagation(); toggleActive(r); }}
                        data-testid={`catalog-toggle-${r.id}`}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-colors ${
                          r.active ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                        }`}
                        title={r.active ? 'Désactiver (le générateur ne le tirera plus)' : 'Réactiver'}
                      >
                        {r.active ? 'actif' : 'inactif'}
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-600">Aucun mouvement trouvé</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {draft && (
            <div className="w-[26rem] shrink-0" data-testid="catalog-form">
              <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-5 space-y-4 sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-black text-white">{creating ? 'Nouveau mouvement' : draft.name}</h2>
                  {creating ? (
                    <button onClick={cancelCreate} className="p-1 rounded-lg text-gray-500 hover:text-white hover:bg-white/5"><X size={16} /></button>
                  ) : (
                    <span className="font-mono text-[10px] text-gray-600">{draft.id} · v{selected?.version}</span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {creating && (
                    <div className="col-span-2">
                      <label className={lbl}>id (snake_case, définitif)</label>
                      <input value={draft.id} onChange={e => patchDraft({ id: e.target.value })} placeholder="ex. db_box_step_up" className={inp} data-testid="catalog-id" />
                    </div>
                  )}
                  <div className="col-span-2">
                    <label className={lbl}>Nom (affiché aux coachs et aux athlètes)</label>
                    <input value={draft.name} onChange={e => patchDraft({ name: e.target.value })} className={inp} data-testid="catalog-name" />
                  </div>
                  <div>
                    <label className={lbl}>Famille</label>
                    <select value={draft.family} onChange={e => patchDraft({ family: e.target.value as CatalogFamily })} className={inp} data-testid="catalog-family">
                      {CATALOG_FAMILIES.map(f => <option key={f} value={f} className="text-black">{f}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Modalité</label>
                    <select value={draft.modality} onChange={e => patchDraft({ modality: e.target.value as CatalogModality })} className={inp} data-testid="catalog-modality">
                      {CATALOG_MODALITIES.map(m => <option key={m} value={m} className="text-black">{MODALITY_LABEL[m]}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className={lbl}>Pattern</label>
                    <div className="flex flex-wrap gap-1.5">
                      {CATALOG_PATTERNS.map(p => (
                        <button
                          key={p} type="button" onClick={() => togglePattern(p)}
                          data-testid={`catalog-pattern-${p}`}
                          className={`px-2 py-1 rounded-lg text-xs font-bold border transition-colors ${
                            draft.pattern.includes(p) ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                          }`}
                        >{p}</button>
                      ))}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className={lbl}>Unités autorisées · unité par défaut</label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {CATALOG_UNITS.map(u => (
                        <button
                          key={u} type="button" onClick={() => toggleUnit(u)}
                          data-testid={`catalog-unit-${u}`}
                          className={`px-2 py-1 rounded-lg text-xs font-bold border transition-colors ${
                            draft.units_allowed.includes(u) ? 'bg-sky-500/15 border-sky-500/40 text-sky-300' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                          }`}
                        >{u}</button>
                      ))}
                      <select
                        value={draft.unit_default}
                        onChange={e => patchDraft({ unit_default: e.target.value as CatalogUnit })}
                        className="ml-auto bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                        data-testid="catalog-unit-default"
                      >
                        {draft.units_allowed.map(u => <option key={u} value={u} className="text-black">défaut : {u}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>Unité de charge</label>
                    <select value={draft.load_unit} onChange={e => patchDraft({ load_unit: e.target.value as LoadUnit | '' })} className={inp} data-testid="catalog-load-unit">
                      <option value="" className="text-black">aucune (poids du corps)</option>
                      {LOAD_UNITS.map(u => <option key={u} value={u} className="text-black">{u}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={lbl}>Poids F</label>
                      <input type="number" min={0} max={10} value={draft.weight_functional} onChange={e => patchDraft({ weight_functional: e.target.value })} className={inp} data-testid="catalog-weight-functional" />
                    </div>
                    <div>
                      <label className={lbl}>Poids H</label>
                      <input type="number" min={0} max={10} value={draft.weight_hybrid} onChange={e => patchDraft({ weight_hybrid: e.target.value })} className={inp} data-testid="catalog-weight-hybrid" />
                    </div>
                  </div>
                  <div className="col-span-2 flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2">
                    <span className="text-sm text-gray-300">Actif (tirable par le générateur)</span>
                    <button
                      type="button" onClick={() => patchDraft({ active: !draft.active })}
                      data-testid="catalog-active"
                      className={`w-11 h-6 rounded-full transition-colors relative ${draft.active ? 'bg-emerald-500' : 'bg-white/10'}`}
                      aria-pressed={draft.active}
                    >
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${draft.active ? 'left-[22px]' : 'left-0.5'}`} />
                    </button>
                  </div>
                  <div className="col-span-2">
                    <label className={lbl}>Notes</label>
                    <textarea value={draft.notes} onChange={e => patchDraft({ notes: e.target.value })} rows={2} className={inp} />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className={lbl + ' mb-0'}>Bandes de charge ({draft.load_unit || 'kg'}) · H / F</label>
                    {draft.loads ? (
                      <button type="button" onClick={() => patchDraft({ loads: null })} className="text-[11px] text-gray-500 hover:text-red-400">retirer</button>
                    ) : (
                      <button type="button" onClick={() => patchDraft({ loads: emptyLoadTable() })} data-testid="catalog-loads-add" className="text-[11px] text-emerald-400 hover:text-emerald-300">ajouter les bandes</button>
                    )}
                  </div>
                  {draft.loads ? (
                    <table className="w-full text-xs" data-testid="catalog-loads">
                      <thead>
                        <tr className="text-gray-500">
                          <th className="text-left py-1 font-bold"></th>
                          {LOAD_BANDS.map(b => <th key={b} className="py-1 font-bold text-center" colSpan={2}>{LOAD_BAND_LABEL[b]}</th>)}
                        </tr>
                        <tr className="text-gray-600">
                          <th></th>
                          {LOAD_BANDS.map(b => (
                            <Fragment key={b}>
                              <th className="font-normal">H</th>
                              <th className="font-normal">F</th>
                            </Fragment>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {LOAD_CATEGORIES.map(c => (
                          <tr key={c}>
                            <td className="py-1 pr-2 text-gray-300 font-bold">{LOAD_CATEGORY_LABEL[c]}</td>
                            {LOAD_BANDS.map(b => ([0, 1] as const).map(sex => (
                              <td key={`${b}-${sex}`} className="px-0.5 py-1">
                                <input
                                  type="number" min={0}
                                  value={draft.loads![c][b][sex]}
                                  onChange={e => setLoad(c, b, sex, e.target.value)}
                                  data-testid={`catalog-load-${c}-${b}-${sex === 0 ? 'h' : 'f'}`}
                                  className="w-full bg-white/5 border border-white/10 rounded-md px-1.5 py-1 text-center text-white focus:outline-none focus:border-emerald-500/50"
                                />
                              </td>
                            )))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-xs text-gray-600">Aucune bande : mouvement sans charge prescrite.</p>
                  )}
                </div>

                {selected && !creating && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-gray-500 hover:text-gray-300">Champs en lecture seule (cadence, plages de reps, substitutions, équipement)</summary>
                    <pre className="mt-2 p-3 rounded-xl bg-black/40 text-gray-400 overflow-x-auto whitespace-pre-wrap break-all">
                      {JSON.stringify({
                        equipment: selected.equipment, grip: selected.grip, shoulder_load: selected.shoulder_load,
                        cadence: selected.cadence, rep_ranges: selected.rep_ranges, substitutions: selected.substitutions,
                        variant_up: selected.variant_up, badge_key: selected.badge_key,
                      }, null, 2)}
                    </pre>
                  </details>
                )}

                {/* Musculation : métadonnées du générateur M1, en lecture seule.
                    Leur édition viendra dans un lot ultérieur — les cacher
                    laisserait croire que ces lignes n'en ont pas. */}
                {selected?.discipline_muscu && (
                  <div className="space-y-1.5 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]" data-testid="catalog-muscu">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                      Musculation · lecture seule
                    </p>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      {([
                        ['Muscle principal', selected.muscle_primary ?? '—'],
                        ['Muscles secondaires', (selected.muscle_secondary ?? []).join(', ') || '—'],
                        ['Polyarticulaire', selected.compound ? 'oui' : 'non'],
                        ['Niveau minimum', selected.level_min ?? '—'],
                        ['Mode de charge', selected.load_mode ?? '—'],
                        ['Priorité', selected.priority == null ? '—' : String(selected.priority)],
                      ] as const).map(([label, value]) => (
                        <div key={label} className="flex items-baseline justify-between gap-2">
                          <dt className="text-gray-500">{label}</dt>
                          <dd className="text-gray-300 font-semibold text-right">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}

                {saveError && <p className="text-xs text-red-400" data-testid="catalog-error">{saveError}</p>}
                {saved && <p className="text-xs text-emerald-400 flex items-center gap-1" data-testid="catalog-saved"><Check size={12} /> {saved}</p>}

                <button
                  onClick={save}
                  disabled={saving || !dirty}
                  data-testid="catalog-save"
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500 text-black text-sm font-bold hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {creating ? 'Créer le mouvement' : 'Enregistrer'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
