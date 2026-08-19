'use client';

import { useCallback, useEffect, useState } from 'react';
import { X, Loader2, AlertTriangle, CalendarPlus, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

/**
 * « Appliquer une programmation » : pose une semaine d'un contenu semaine × jour
 * sur le calendrier du Whiteboard, avec l'accès groupe choisi à ce moment-là.
 *
 * Le geste vit côté serveur (`apply_program_week`), qui vérifie lui-même la
 * souscription active et non expirée, la qualité de gérant/coach et
 * l'appartenance des groupes à la box. Cette UI ne fait que proposer les choix :
 * elle n'est pas la frontière.
 *
 * Deux sources (`source_kind`) : `subscription` pour une programmation souscrite
 * chez une autre box, `template` pour une semaine type interne.
 *
 * L'écran affiche les conflits **par jour de calendrier** avec leur provenance :
 * ce que voit l'athlète, c'est « deux WOD le mardi ». Et il annonce ce que le
 * remplacement fera vraiment — un WOD qui porte un score ou une complétion est
 * conservé par le serveur, quoi qu'on clique ici.
 */

export interface ApplyGroup { id: string; name: string; color: string }

type SourceKind = 'subscription' | 'template';

interface ApplicableSource {
  kind: SourceKind;
  /** `subscription_id` ou `template_id` selon la source. */
  sourceId: string;
  title: string;
  subtitle: string | null;
  weeksCount: number;
}

interface ConflictRow {
  scheduled_date: string;
  wod_id: string;
  title: string;
  origin: 'manual' | 'template' | 'subscription';
  origin_title: string | null;
  has_results: boolean;
}

export interface ApplySummary {
  inserted: number;
  replaced: number;
  keptWithResults: number;
  skipped: number;
}

interface Props {
  boxId: string;
  /** Lundi (ISO) de la semaine affichée sur le Whiteboard — cible par défaut. */
  defaultMonday: string;
  groups: ApplyGroup[];
  onClose: () => void;
  /** Appelé après une application réussie, pour recharger le calendrier. */
  onApplied: (summary: ApplySummary) => void;
}

interface RawApplicable {
  subscription_id: string;
  title: string | null;
  publisher_box_name: string | null;
  weeks_count: number | null;
  days_per_week: number | null;
}

interface RawTemplate {
  template_id: string;
  title: string | null;
  wods_count: number | null;
  days_count: number | null;
}

function mondayOf(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function frDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

function dayLabel(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long' });
}

const ORIGIN_LABEL: Record<ConflictRow['origin'], string> = {
  manual: 'saisi à la main',
  template: 'd’une semaine type',
  subscription: 'd’une programmation',
};

export default function ApplyProgramWeekModal({
  boxId, defaultMonday, groups, onClose, onApplied,
}: Props) {
  const supabase = createClient();

  const [loading, setLoading]   = useState(true);
  const [items, setItems]       = useState<ApplicableSource[]>([]);
  const [sourceKey, setSourceKey] = useState('');
  const [week, setWeek]         = useState(1);
  const [monday, setMonday]     = useState(mondayOf(defaultMonday));
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [conflicts, setConflicts] = useState<ConflictRow[] | null>(null);
  const [applying, setApplying] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const selected = items.find(i => `${i.kind}:${i.sourceId}` === sourceKey) ?? null;
  const conflictCount = conflicts?.length ?? 0;
  const protectedCount = (conflicts ?? []).filter(c => c.has_results).length;

  useEffect(() => {
    (async () => {
      const [subs, tpls] = await Promise.all([
        supabase.rpc('list_applicable_programmings', { p_box_id: boxId }),
        supabase.rpc('list_week_templates', { p_box_id: boxId }),
      ]);
      if (subs.error) setError(subs.error.message);
      if (tpls.error) setError(tpls.error.message);

      const rows: ApplicableSource[] = [
        ...((tpls.data ?? []) as RawTemplate[]).map(t => ({
          kind: 'template' as const,
          sourceId: t.template_id,
          title: t.title ?? 'Semaine type',
          subtitle: `${t.wods_count ?? 0} WOD · ${t.days_count ?? 0} jour(s)`,
          weeksCount: 1,
        })),
        ...((subs.data ?? []) as RawApplicable[]).map(r => ({
          kind: 'subscription' as const,
          sourceId: r.subscription_id,
          title: r.title ?? 'Programmation',
          subtitle: r.publisher_box_name,
          weeksCount: Math.max(r.weeks_count ?? 1, 1),
        })),
      ];
      setItems(rows);
      if (rows.length === 1) setSourceKey(`${rows[0].kind}:${rows[0].sourceId}`);
      setLoading(false);
    })();
  }, [boxId]);

  const checkConflicts = useCallback(async () => {
    if (!selected) { setConflicts(null); return; }
    const { data, error: rpcError } = await supabase.rpc('list_program_week_conflicts', {
      p_source_kind: selected.kind,
      p_source_id: selected.sourceId,
      p_week: week,
      p_target_monday: monday,
    });
    if (rpcError) { setError(rpcError.message); setConflicts(null); return; }
    setConflicts((data ?? []) as ConflictRow[]);
  }, [selected, week, monday]);

  useEffect(() => { void checkConflicts(); }, [checkConflicts]);

  async function apply(replace: boolean) {
    if (!selected) return;
    setApplying(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('apply_program_week', {
      p_source_kind: selected.kind,
      p_source_id: selected.sourceId,
      p_week: week,
      p_target_monday: monday,
      p_group_ids: groupIds.length ? groupIds : null,
      p_replace: replace,
    });
    setApplying(false);
    if (rpcError) { setError(rpcError.message); return; }
    const summary = (data ?? {}) as {
      inserted?: number; replaced?: number; kept_with_results?: number; skipped?: number;
    };
    onApplied({
      inserted: summary.inserted ?? 0,
      replaced: summary.replaced ?? 0,
      keptWithResults: summary.kept_with_results ?? 0,
      skipped: summary.skipped ?? 0,
    });
  }

  const inp = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white transition-colors';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#111111] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
          <h2 className="text-lg font-black text-white">Appliquer une semaine</h2>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>
          )}

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-6 justify-center">
              <Loader2 size={16} className="animate-spin" /> Chargement des sources…
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-gray-400 leading-relaxed py-4">
              Aucune semaine type ni programmation souscrite. Enregistre une semaine du Whiteboard comme <span className="text-white font-semibold">semaine type</span>, ou abonne-toi à une offre dans <span className="text-white font-semibold">Entraînement → Programmation</span>.
            </p>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Source</label>
                <select className={inp} value={sourceKey} onChange={e => { setSourceKey(e.target.value); setWeek(1); }}>
                  <option value="">— Choisir —</option>
                  {items.some(i => i.kind === 'template') && (
                    <optgroup label="Mes semaines types">
                      {items.filter(i => i.kind === 'template').map(i => (
                        <option key={i.sourceId} value={`template:${i.sourceId}`}>
                          {i.title}{i.subtitle ? ` — ${i.subtitle}` : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {items.some(i => i.kind === 'subscription') && (
                    <optgroup label="Programmations souscrites">
                      {items.filter(i => i.kind === 'subscription').map(i => (
                        <option key={i.sourceId} value={`subscription:${i.sourceId}`}>
                          {i.title}{i.subtitle ? ` — ${i.subtitle}` : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {selected && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Semaine source</label>
                    <select
                      className={inp}
                      value={week}
                      onChange={e => setWeek(parseInt(e.target.value, 10))}
                      disabled={selected.weeksCount === 1}
                    >
                      {Array.from({ length: selected.weeksCount }, (_, i) => i + 1).map(w => (
                        <option key={w} value={w}>Semaine {w}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Semaine cible</label>
                    <input
                      type="date"
                      className={inp}
                      value={monday}
                      onChange={e => e.target.value && setMonday(mondayOf(e.target.value))}
                    />
                  </div>
                </div>
              )}

              {selected && (
                <p className="text-xs text-gray-500">
                  Les WOD se poseront à partir du lundi <span className="text-gray-300">{frDate(monday)}</span>, aux jours définis dans la source. Ils restent éditables ensuite comme des WOD maison.
                </p>
              )}

              {selected && groups.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">
                    Groupes autorisés <span className="text-gray-600 normal-case tracking-normal">(vide = toute la box)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {groups.map(g => {
                      const on = groupIds.includes(g.id);
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => setGroupIds(ids => on ? ids.filter(x => x !== g.id) : [...ids, g.id])}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${on ? 'bg-white text-black border-white' : 'border-white/10 text-gray-400 hover:text-white hover:border-white/20'}`}
                        >
                          {g.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Conflits par jour de calendrier : la provenance est nommée, le
                  coach choisit en connaissance. Ce bloc ne promet jamais une
                  suppression que le serveur refusera. */}
              {selected && conflictCount > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-sm text-amber-300 space-y-2">
                  <div className="flex gap-2.5">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <span>
                      Ces jours portent déjà <span className="font-bold">{conflictCount} WOD</span>, quelle qu&apos;en soit l&apos;origine.
                    </span>
                  </div>
                  <ul className="pl-6 space-y-1 text-xs">
                    {conflicts?.map(c => (
                      <li key={c.wod_id}>
                        <span className="capitalize">{dayLabel(c.scheduled_date)}</span> : {c.title}{' '}
                        <span className="text-amber-300/60">
                          ({ORIGIN_LABEL[c.origin]}{c.origin_title ? ` « ${c.origin_title} »` : ''})
                        </span>
                        {c.has_results && <span className="text-white font-semibold"> — porte un résultat, conservé</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selected && protectedCount > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-300 flex gap-2.5">
                  <ShieldCheck size={16} className="shrink-0 mt-0.5 text-white" />
                  <span>
                    <span className="font-bold text-white">{protectedCount} WOD</span> porte{protectedCount > 1 ? 'nt' : ''} un score ou une complétion : le remplacement ne {protectedCount > 1 ? 'les' : 'le'} touchera pas. Un score alimente l&apos;ELO et l&apos;historique de l&apos;athlète — pour le supprimer, il faut supprimer ce WOD-là, délibérément.
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {!loading && items.length > 0 && (
          <div className="flex gap-2 justify-end px-6 py-4 border-t border-white/8">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-bold border border-white/10 text-gray-300 hover:bg-white/5 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={() => apply(conflictCount > 0)}
              disabled={!selected || applying}
              className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-white/90 disabled:opacity-40 text-[#0A0A0A] text-sm font-bold rounded-xl transition-colors"
            >
              {applying
                ? <><Loader2 size={14} className="animate-spin" /> Application…</>
                : <><CalendarPlus size={14} /> {conflictCount > 0 ? 'Remplacer les WOD vierges' : 'Appliquer'}</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
