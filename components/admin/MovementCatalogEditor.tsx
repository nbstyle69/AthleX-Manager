'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Plus, Search, X } from 'lucide-react';
import {
  CATALOG_FAMILIES, CATALOG_MODALITIES, CATALOG_PATTERNS, CATALOG_UNITS, LOAD_BANDS, LOAD_BAND_LABEL,
  LOAD_CATEGORIES, LOAD_CATEGORY_LABEL, LOAD_UNITS, MODALITY_LABEL, emptyLoadTable, validateMovementPatch,
  type CatalogFamily, type CatalogModality, type CatalogPattern, type CatalogUnit, type LoadBand, type LoadCategory,
  type LoadTable, type LoadUnit, type MovementCatalogAdminRow, type MovementCatalogPatch,
} from '@/lib/adminCatalog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

/**
 * Onglet « Catalogue » de /admin/movements : liste de `movement_catalog`
 * (inactifs compris), fiche d'édition (nom, famille, pattern, modalité,
 * unités, unité de charge, poids de tirage Functional / Hybrid, actif, notes),
 * bandes de charge en tableau 6 catégories × 3 bandes × H/F, et création avec
 * les champs minimum. Les JSON (cadence, rep_ranges, substitutions, equipment)
 * sont affichés en lecture seule. Écritures via /api/admin/movement-catalog.
 */

// Champs, listes et zone de texte aux jetons du lot 1 (même rendu que `Input`).
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus';
const inp = `w-full min-w-0 min-h-11 rounded-ax-control border border-ax-input-border bg-ax-surface px-3 py-2 text-base text-ax-text placeholder:text-ax-text-muted sm:text-sm ${FOCUS} focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface`;
const lbl = 'block text-[11px] font-bold uppercase tracking-wider text-ax-text-secondary mb-1';
/** Pastille à bascule (pattern, unité) : choisie ou non. */
const toggleChip = (on: boolean, tone: 'accent' | 'info') =>
  `px-2 py-1 rounded-ax-control text-xs font-bold border transition-colors motion-reduce:transition-none ${FOCUS} ${
    on
      ? tone === 'accent' ? 'bg-ax-accent-soft border-ax-accent-text text-ax-accent-text' : 'bg-ax-info-soft border-ax-info text-ax-info'
      : 'bg-transparent border-ax-border text-ax-text-secondary hover:text-ax-text hover:bg-ax-hover'
  }`;

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

  const selectRow = (id: string) => { setCreating(false); setSelectedId(id); };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ax-text-secondary">
          {rows.length} mouvements · {inactiveCount} inactifs (proposés aux coachs, ignorés par le générateur)
        </p>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <label className="flex items-center gap-2 text-xs text-ax-text-secondary cursor-pointer">
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="w-4 h-4 accent-[var(--ax-accent)]" />
            Afficher les inactifs
          </label>
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ax-text-muted pointer-events-none" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher (nom ou id)..."
              aria-label="Rechercher un mouvement (nom ou id)"
              className="pl-9"
            />
          </div>
          <Button variant="ax-mint" onClick={startCreate} data-testid="catalog-new">
            <Plus size={14} /> Nouveau mouvement
          </Button>
        </div>
      </div>

      {loadError && <p className="text-sm text-ax-danger">{loadError}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-ax-border border-t-ax-accent-text rounded-full animate-spin" />
        </div>
      ) : (
        // Sous 1280 px, la fiche passe au-dessus du tableau, pleine largeur :
        // côte à côte, elle recouvrait le tableau et en bloquait les clics.
        <div className="flex flex-col xl:flex-row gap-6 items-stretch xl:items-start">
          <div className="flex-1 min-w-0 order-2 xl:order-none">
            <Table aria-label="Catalogue des mouvements" data-testid="catalog-table">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-bold uppercase tracking-wider">Mouvement</TableHead>
                  <TableHead className="font-bold uppercase tracking-wider">Famille</TableHead>
                  <TableHead className="font-bold uppercase tracking-wider">Unités</TableHead>
                  <TableHead className="font-bold uppercase tracking-wider whitespace-nowrap" title="Poids de tirage Functional / Hybrid">F / H</TableHead>
                  <TableHead className="font-bold uppercase tracking-wider">Actif</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(r => (
                  <TableRow
                    key={r.id}
                    onClick={() => selectRow(r.id)}
                    // Même action au clavier qu'à la souris ; le bouton actif/inactif garde la sienne.
                    tabIndex={0}
                    onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); selectRow(r.id); } }}
                    data-state={selectedId === r.id ? 'selected' : undefined}
                    data-testid={`catalog-row-${r.id}`}
                    className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ax-focus"
                  >
                    <TableCell className="min-w-[12rem]">
                      <span className={`font-bold break-words ${r.active ? 'text-ax-text' : 'text-ax-text-secondary'}`}>{r.name}</span>
                      <span className="ml-2 font-mono text-[10px] text-ax-text-secondary break-all">{r.id}</span>
                    </TableCell>
                    <TableCell className="text-ax-text-secondary">{r.family}</TableCell>
                    <TableCell className="text-ax-text-secondary whitespace-nowrap">
                      {(r.units_allowed ?? []).join(' · ')}
                      {r.load_unit && <span className="ml-2 px-1.5 py-0.5 rounded-ax-badge bg-ax-warning-soft text-ax-warning text-[10px] font-bold uppercase">{r.load_unit}</span>}
                    </TableCell>
                    <TableCell className="text-ax-text-secondary font-mono text-xs whitespace-nowrap">{r.weight_functional} / {r.weight_hybrid}</TableCell>
                    <TableCell>
                      <button
                        onClick={e => { e.stopPropagation(); toggleActive(r); }}
                        data-testid={`catalog-toggle-${r.id}`}
                        className={`px-2 py-0.5 rounded-ax-badge border text-[11px] font-bold transition-colors motion-reduce:transition-none ${FOCUS} ${
                          r.active ? 'border-ax-success bg-ax-success-soft text-ax-success hover:brightness-110' : 'border-ax-border bg-ax-neutral-soft text-ax-text-secondary hover:text-ax-text'
                        }`}
                        title={r.active ? 'Désactiver (le générateur ne le tirera plus)' : 'Réactiver'}
                      >
                        {r.active ? 'actif' : 'inactif'}
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow className="hover:bg-transparent"><TableCell colSpan={5} className="py-10 text-center text-ax-text-secondary">Aucun mouvement trouvé</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {draft && (
            <div className="w-full xl:w-[26rem] shrink-0 order-1 xl:order-none" data-testid="catalog-form">
              <div className="bg-ax-surface border border-ax-border rounded-ax-card p-5 space-y-4 xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-sm font-black text-ax-text break-words min-w-0">{creating ? 'Nouveau mouvement' : draft.name}</h2>
                  {creating ? (
                    <button onClick={cancelCreate} aria-label="Fermer" className={`p-1 rounded-ax-control text-ax-text-secondary hover:text-ax-text hover:bg-ax-hover shrink-0 ${FOCUS}`}><X size={16} /></button>
                  ) : (
                    <span className="font-mono text-[10px] text-ax-text-secondary break-all text-right">{draft.id} · v{selected?.version}</span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {creating && (
                    <div className="sm:col-span-2">
                      <label className={lbl}>id (snake_case, définitif)</label>
                      <input value={draft.id} onChange={e => patchDraft({ id: e.target.value })} placeholder="ex. db_box_step_up" className={inp} data-testid="catalog-id" />
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <label className={lbl}>Nom (affiché aux coachs et aux athlètes)</label>
                    <input value={draft.name} onChange={e => patchDraft({ name: e.target.value })} className={inp} data-testid="catalog-name" />
                  </div>
                  <div>
                    <label className={lbl}>Famille</label>
                    <select value={draft.family} onChange={e => patchDraft({ family: e.target.value as CatalogFamily })} className={inp} data-testid="catalog-family">
                      {CATALOG_FAMILIES.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Modalité</label>
                    <select value={draft.modality} onChange={e => patchDraft({ modality: e.target.value as CatalogModality })} className={inp} data-testid="catalog-modality">
                      {CATALOG_MODALITIES.map(m => <option key={m} value={m}>{MODALITY_LABEL[m]}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={lbl}>Pattern</label>
                    <div className="flex flex-wrap gap-1.5">
                      {CATALOG_PATTERNS.map(p => (
                        <button
                          key={p} type="button" onClick={() => togglePattern(p)}
                          data-testid={`catalog-pattern-${p}`}
                          aria-pressed={draft.pattern.includes(p)}
                          className={toggleChip(draft.pattern.includes(p), 'accent')}
                        >{p}</button>
                      ))}
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={lbl}>Unités autorisées · unité par défaut</label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {CATALOG_UNITS.map(u => (
                        <button
                          key={u} type="button" onClick={() => toggleUnit(u)}
                          data-testid={`catalog-unit-${u}`}
                          aria-pressed={draft.units_allowed.includes(u)}
                          className={toggleChip(draft.units_allowed.includes(u), 'info')}
                        >{u}</button>
                      ))}
                      <select
                        value={draft.unit_default}
                        onChange={e => patchDraft({ unit_default: e.target.value as CatalogUnit })}
                        aria-label="Unité par défaut"
                        className={`ml-auto rounded-ax-control border border-ax-input-border bg-ax-surface px-2 py-1 text-xs text-ax-text ${FOCUS}`}
                        data-testid="catalog-unit-default"
                      >
                        {draft.units_allowed.map(u => <option key={u} value={u}>défaut : {u}</option>)}
                      </select>
                    </div>
                  </div>
                  {/* Pleine ligne : « aucune (poids du corps) » se lit en entier. */}
                  <div className="sm:col-span-2">
                    <label className={lbl}>Unité de charge</label>
                    <select value={draft.load_unit} onChange={e => patchDraft({ load_unit: e.target.value as LoadUnit | '' })} className={inp} data-testid="catalog-load-unit">
                      <option value="">aucune (poids du corps)</option>
                      {LOAD_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2 grid grid-cols-2 gap-2">
                    <div>
                      <label className={lbl}>Poids F</label>
                      <input type="number" min={0} max={10} value={draft.weight_functional} onChange={e => patchDraft({ weight_functional: e.target.value })} className={inp} data-testid="catalog-weight-functional" />
                    </div>
                    <div>
                      <label className={lbl}>Poids H</label>
                      <input type="number" min={0} max={10} value={draft.weight_hybrid} onChange={e => patchDraft({ weight_hybrid: e.target.value })} className={inp} data-testid="catalog-weight-hybrid" />
                    </div>
                  </div>
                  <div className="sm:col-span-2 flex items-center justify-between gap-3 rounded-ax-control bg-ax-surface-secondary px-3 py-2">
                    <span className="text-sm text-ax-text">Actif (tirable par le générateur)</span>
                    <button
                      type="button" onClick={() => patchDraft({ active: !draft.active })}
                      data-testid="catalog-active"
                      aria-label="Actif (tirable par le générateur)"
                      className={`w-11 h-6 shrink-0 rounded-full border transition-colors relative motion-reduce:transition-none ${FOCUS} ${draft.active ? 'bg-ax-accent border-ax-accent' : 'bg-ax-neutral-soft border-ax-input-border'}`}
                      aria-pressed={draft.active}
                    >
                      <span className={`absolute top-0.5 w-[18px] h-[18px] rounded-full transition-all motion-reduce:transition-none ${draft.active ? 'left-[22px] bg-ax-accent-foreground' : 'left-0.5 bg-ax-text-secondary'}`} />
                    </button>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={lbl}>Notes</label>
                    <textarea value={draft.notes} onChange={e => patchDraft({ notes: e.target.value })} rows={2} className={`${inp} resize-y`} />
                  </div>
                </div>

                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <label className={lbl + ' mb-0'}>Bandes de charge ({draft.load_unit || 'kg'}) · H / F</label>
                    {draft.loads ? (
                      <button type="button" onClick={() => patchDraft({ loads: null })} className={`rounded-ax-control text-[11px] font-bold text-ax-danger hover:underline ${FOCUS}`}>retirer</button>
                    ) : (
                      <button type="button" onClick={() => patchDraft({ loads: emptyLoadTable() })} data-testid="catalog-loads-add" className={`rounded-ax-control text-[11px] font-bold text-ax-accent-text hover:underline ${FOCUS}`}>ajouter les bandes</button>
                    )}
                  </div>
                  {draft.loads ? (
                    // Les 36 champs gardent une largeur lisible : le tableau défile seul s'il le faut.
                    <div className="overflow-x-auto rounded-ax-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus" role="region" aria-label="Bandes de charge" tabIndex={0}>
                      <table className="w-full min-w-[24rem] text-xs" data-testid="catalog-loads">
                        <thead>
                          <tr className="text-ax-text-secondary">
                            <th className="text-left py-1 font-bold"></th>
                            {LOAD_BANDS.map(b => <th key={b} className="py-1 font-bold text-center" colSpan={2}>{LOAD_BAND_LABEL[b]}</th>)}
                          </tr>
                          <tr className="text-ax-text-secondary">
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
                              <td className="py-1 pr-2 text-ax-text font-bold whitespace-nowrap">{LOAD_CATEGORY_LABEL[c]}</td>
                              {LOAD_BANDS.map(b => ([0, 1] as const).map(sex => (
                                <td key={`${b}-${sex}`} className="px-0.5 py-1">
                                  <input
                                    type="number" min={0}
                                    value={draft.loads![c][b][sex]}
                                    onChange={e => setLoad(c, b, sex, e.target.value)}
                                    aria-label={`${LOAD_CATEGORY_LABEL[c]} ${LOAD_BAND_LABEL[b]} ${sex === 0 ? 'H' : 'F'}`}
                                    data-testid={`catalog-load-${c}-${b}-${sex === 0 ? 'h' : 'f'}`}
                                    className={`w-full min-w-[2.75rem] rounded-ax-control border border-ax-input-border bg-ax-surface px-1 py-1 text-center text-ax-text ${FOCUS}`}
                                  />
                                </td>
                              )))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-ax-text-secondary">Aucune bande : mouvement sans charge prescrite.</p>
                  )}
                </div>

                {selected && !creating && (
                  <details className="text-xs">
                    <summary className={`cursor-pointer rounded-ax-control text-ax-text-secondary hover:text-ax-text ${FOCUS}`}>Champs en lecture seule (cadence, plages de reps, substitutions, équipement)</summary>
                    <pre className="mt-2 p-3 rounded-ax-control bg-ax-surface-secondary border border-ax-border text-ax-text-secondary overflow-x-auto whitespace-pre-wrap break-all">
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
                  <div className="space-y-1.5 p-3 rounded-ax-control bg-ax-surface-secondary border border-ax-border" data-testid="catalog-muscu">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-ax-text-secondary">
                      Musculation · lecture seule
                    </p>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      {([
                        ['Muscle principal', selected.muscle_primary ?? '—'],
                        ['Muscles secondaires', (selected.muscle_secondary ?? []).join(', ') || '—'],
                        ['Polyarticulaire', selected.compound ? 'oui' : 'non'],
                        ['Niveau minimum', selected.level_min ?? '—'],
                        ['Mode de charge', selected.load_mode ?? '—'],
                        ['Priorité', selected.priority == null ? '—' : String(selected.priority)],
                      ] as const).map(([label, value]) => (
                        <div key={label} className="flex items-baseline justify-between gap-2">
                          <dt className="text-ax-text-secondary">{label}</dt>
                          <dd className="text-ax-text font-semibold text-right break-words min-w-0">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}

                {saveError && <p className="text-xs text-ax-danger" data-testid="catalog-error">{saveError}</p>}
                {saved && <p className="text-xs text-ax-success flex items-center gap-1" data-testid="catalog-saved"><Check size={12} /> {saved}</p>}

                <Button
                  variant="ax-mint"
                  onClick={save}
                  disabled={saving || !dirty}
                  data-testid="catalog-save"
                  className="w-full"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {creating ? 'Créer le mouvement' : 'Enregistrer'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
