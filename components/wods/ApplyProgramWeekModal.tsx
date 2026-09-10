'use client';

import { useCallback, useEffect, useState } from 'react';
import { X, Loader2, AlertTriangle, CalendarPlus, ShieldCheck, Trash2, Copy } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  AUDIENCES, AUDIENCE_LABEL, Audience, isAudience, mondayOfISO, subscriptionColorHex,
} from '@/lib/audience';

/**
 * « Programmation » : pose une semaine type ou une semaine d'une programmation
 * Marketplace sur le calendrier du Whiteboard, avec une visibilité choisie
 * explicitement à ce moment-là.
 *
 * Le geste vit côté serveur (`apply_program_week`), qui vérifie lui-même la
 * souscription active et non expirée, la qualité de gérant/coach,
 * l'appartenance des groupes à la box et exige `p_audience`. Cette UI ne fait
 * que proposer les choix : elle n'est pas la frontière.
 *
 * Deux sources (`source_kind`) : `subscription` pour une programmation souscrite
 * chez une autre box, `template` pour une semaine type interne. Une semaine
 * d'offre sans WOD est proposée désactivée (« vide ») : une offre entièrement
 * vide se lit « Cette offre ne contient encore aucun WOD », rien ne se pose.
 *
 * L'écran affiche les conflits **par jour de calendrier** avec leur provenance,
 * et annonce ce que le remplacement fera vraiment — un WOD qui porte un score
 * ou une complétion est conservé par le serveur, quoi qu'on clique ici.
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
  /** Nombre de WOD par semaine (index 0 = semaine 1). */
  wodCounts: number[];
  color: string | null;
  defaultAudience: Audience | null;
  defaultGroupIds: string[];
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
  /** Abonnement à présélectionner (bannière « Appliquer maintenant »). */
  initialSubscriptionId?: string;
  initialWeek?: number;
  onClose: () => void;
  /** Appelé après une application réussie, pour recharger le calendrier. */
  onApplied: (summary: ApplySummary) => void;
  /** Appelé après la suppression d'une semaine type. */
  onTemplateDeleted?: () => void;
  /** « Copier vers une offre » depuis une semaine type (absent = pas de bouton). */
  onCopyTemplateToOffer?: (template: { id: string; title: string }) => void;
}

interface RawApplicable {
  subscription_id: string;
  title: string | null;
  publisher_box_name: string | null;
  weeks_count: number | null;
  days_per_week: number | null;
  color: string | null;
  default_audience: string | null;
  default_group_ids: string[] | null;
  wod_counts: number[] | null;
}

interface RawTemplate {
  template_id: string;
  title: string | null;
  wods_count: number | null;
  days_count: number | null;
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

const keyOf = (i: { kind: SourceKind; sourceId: string }) => `${i.kind}:${i.sourceId}`;

export default function ApplyProgramWeekModal({
  boxId, defaultMonday, groups, initialSubscriptionId, initialWeek, onClose, onApplied, onTemplateDeleted,
  onCopyTemplateToOffer,
}: Props) {
  const supabase = createClient();

  const [loading, setLoading]   = useState(true);
  const [items, setItems]       = useState<ApplicableSource[]>([]);
  const [sourceKey, setSourceKey] = useState(initialSubscriptionId ? `subscription:${initialSubscriptionId}` : '');
  const [week, setWeek]         = useState(initialWeek ?? 1);
  const [monday, setMonday]     = useState(mondayOfISO(defaultMonday));
  const [audience, setAudience] = useState<Audience | ''>('');
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [conflicts, setConflicts] = useState<ConflictRow[] | null>(null);
  const [applying, setApplying] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);

  const selected = items.find(i => keyOf(i) === sourceKey) ?? null;
  const conflictCount = conflicts?.length ?? 0;
  const protectedCount = (conflicts ?? []).filter(c => c.has_results).length;
  const templates = items.filter(i => i.kind === 'template');
  const subscriptions = items.filter(i => i.kind === 'subscription');

  const offerEmpty = !!selected && selected.kind === 'subscription' && selected.wodCounts.every(n => n === 0);
  const weekEmpty = !!selected && (selected.wodCounts[week - 1] ?? 0) === 0;

  const load = useCallback(async () => {
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
        wodCounts: [t.wods_count ?? 0],
        color: null,
        defaultAudience: null,
        defaultGroupIds: [],
      })),
      ...((subs.data ?? []) as RawApplicable[]).map(r => {
        const n = Math.max(r.weeks_count ?? 1, 1);
        const counts = Array.from({ length: n }, (_, i) => r.wod_counts?.[i] ?? 0);
        return {
          kind: 'subscription' as const,
          sourceId: r.subscription_id,
          title: r.title ?? 'Programmation',
          subtitle: r.publisher_box_name,
          weeksCount: n,
          wodCounts: counts,
          color: r.color,
          defaultAudience: isAudience(r.default_audience) ? r.default_audience : null,
          defaultGroupIds: r.default_group_ids ?? [],
        };
      }),
    ];
    setItems(rows);
    if (rows.length === 1) setSourceKey(keyOf(rows[0]));
    setLoading(false);
  }, [boxId]);

  useEffect(() => { void load(); }, [load]);

  // Un abonnement déjà appliqué une fois propose sa dernière visibilité ; le
  // choix reste à confirmer (rien n'est pré-coché sinon).
  useEffect(() => {
    if (!selected) { setAudience(''); setGroupIds([]); return; }
    if (selected.kind === 'subscription' && selected.defaultAudience) {
      setAudience(selected.defaultAudience);
      setGroupIds(selected.defaultAudience === 'groups' ? selected.defaultGroupIds : []);
    } else {
      setAudience('');
      setGroupIds([]);
    }
  }, [selected]);

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
    if (!selected || audience === '') return;
    setApplying(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('apply_program_week', {
      p_source_kind: selected.kind,
      p_source_id: selected.sourceId,
      p_week: week,
      p_target_monday: monday,
      p_audience: audience,
      p_group_ids: audience === 'groups' ? groupIds : null,
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

  async function deleteTemplate(t: ApplicableSource) {
    if (!confirm(`Supprimer la semaine type « ${t.title} » ? Les semaines déjà posées sur le Whiteboard restent.`)) return;
    setDeleting(t.sourceId);
    setError(null);
    const { error: rpcError } = await supabase.rpc('delete_week_template', { p_template_id: t.sourceId });
    setDeleting(null);
    if (rpcError) { setError(rpcError.message); return; }
    if (sourceKey === keyOf(t)) setSourceKey('');
    setLoading(true);
    await load();
    onTemplateDeleted?.();
  }

  const inp = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white transition-colors';
  const canApply = !!selected && !applying && audience !== '' && !offerEmpty && !weekEmpty
    && (audience !== 'groups' || groupIds.length > 0);

  function SourceRow({ i }: { i: ApplicableSource }) {
    const on = keyOf(i) === sourceKey;
    const color = i.kind === 'subscription' ? subscriptionColorHex(i.color) : null;
    return (
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => { setSourceKey(on ? '' : keyOf(i)); setWeek(1); }}
          className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border text-left text-sm transition-colors ${
            on ? 'border-white/40 bg-white/10 text-white' : 'border-white/10 bg-white/[0.02] text-gray-300 hover:bg-white/5'}`}
        >
          {color && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />}
          <span className="font-semibold truncate">{i.title}</span>
          {i.subtitle && <span className="text-xs text-gray-500 truncate">— {i.subtitle}</span>}
          {i.kind === 'subscription' && (
            <span className="ml-auto text-[11px] text-gray-500 shrink-0">
              {i.wodCounts.reduce((a, b) => a + b, 0)} WOD · {i.weeksCount} sem
            </span>
          )}
        </button>
        {i.kind === 'template' && onCopyTemplateToOffer && (
          <button
            type="button"
            onClick={() => onCopyTemplateToOffer({ id: i.sourceId, title: i.title })}
            title="Copier cette semaine type vers une offre Marketplace"
            className="p-2 rounded-xl border border-white/10 text-gray-500 hover:text-white hover:border-white/30"
          >
            <Copy size={14} />
          </button>
        )}
        {i.kind === 'template' && (
          <button
            type="button"
            onClick={() => deleteTemplate(i)}
            disabled={deleting === i.sourceId}
            title="Supprimer cette semaine type"
            className="p-2 rounded-xl border border-white/10 text-gray-500 hover:text-red-400 hover:border-red-400/40 disabled:opacity-40"
          >
            {deleting === i.sourceId ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#111111] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
          <div>
            <h2 className="text-lg font-black text-white">Programmation</h2>
            <p className="text-xs text-gray-500">Poser une semaine type ou une programmation Marketplace</p>
          </div>
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
              Aucune semaine type ni programmation souscrite. Enregistre une semaine du Whiteboard comme <span className="text-white font-semibold">semaine type</span>, ou abonne-toi à une offre dans <span className="text-white font-semibold">Entraînement → Marketplace</span>.
            </p>
          ) : (
            <>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Mes semaines types</label>
                  {templates.length === 0
                    ? <p className="text-xs text-gray-600">Aucune — « Enregistrer comme semaine type » depuis le Whiteboard.</p>
                    : <div className="space-y-1.5">{templates.map(i => <SourceRow key={i.sourceId} i={i} />)}</div>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Programmations Marketplace</label>
                  {subscriptions.length === 0
                    ? <p className="text-xs text-gray-600">Aucun abonnement actif.</p>
                    : <div className="space-y-1.5">{subscriptions.map(i => <SourceRow key={i.sourceId} i={i} />)}</div>}
                </div>
              </div>

              {offerEmpty && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-sm text-amber-300 flex gap-2.5">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span>Cette offre ne contient encore aucun WOD. La box éditrice doit la remplir avant que tu puisses la poser.</span>
                </div>
              )}

              {selected && !offerEmpty && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Semaine source</label>
                    <select
                      className={inp}
                      value={week}
                      onChange={e => setWeek(parseInt(e.target.value, 10))}
                      disabled={selected.weeksCount === 1}
                    >
                      {selected.wodCounts.map((n, i) => (
                        <option key={i + 1} value={i + 1} disabled={n === 0}>
                          Semaine {i + 1}{n === 0 ? ' — vide' : ` · ${n} WOD`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Semaine cible</label>
                    <input
                      type="date"
                      className={inp}
                      value={monday}
                      onChange={e => e.target.value && setMonday(mondayOfISO(e.target.value))}
                    />
                  </div>
                </div>
              )}

              {selected && !offerEmpty && weekEmpty && (
                <p className="text-xs text-amber-300">La semaine {week} est vide : choisis une autre semaine.</p>
              )}

              {selected && !offerEmpty && (
                <p className="text-xs text-gray-500">
                  Les WOD se poseront à partir du lundi <span className="text-gray-300">{frDate(monday)}</span>, aux jours définis dans la source.
                  {selected.kind === 'template'
                    ? ' Ils restent éditables ensuite comme des WOD maison.'
                    : ' Leur contenu reste celui de l’éditeur (non modifiable) ; tu peux les déplacer ou les supprimer.'}
                </p>
              )}

              {selected && !offerEmpty && (
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Qui voit ces WOD ?</label>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Qui voit ces WOD ?">
                    {AUDIENCES.map(a => {
                      const on = audience === a;
                      const disabled = a === 'groups' && groups.length === 0;
                      return (
                        <button key={a} type="button" role="radio" aria-checked={on} disabled={disabled}
                          onClick={() => { setAudience(a); if (a !== 'groups') setGroupIds([]); }}
                          title={disabled ? 'Aucun groupe dans cette box' : undefined}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors disabled:opacity-40 ${
                            on ? 'bg-white text-black border-white' : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'}`}>
                          {AUDIENCE_LABEL[a]}
                        </button>
                      );
                    })}
                  </div>
                  {audience === 'groups' && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {groups.map(g => {
                        const on = groupIds.includes(g.id);
                        return (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => setGroupIds(ids => on ? ids.filter(x => x !== g.id) : [...ids, g.id])}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${on ? 'border-transparent' : 'border-white/10 text-gray-400 hover:text-white hover:border-white/20'}`}
                            style={on ? { backgroundColor: `${g.color}25`, color: g.color, borderColor: `${g.color}50` } : {}}
                          >
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: g.color }} />
                            {g.name}
                          </button>
                        );
                      })}
                      {groupIds.length === 0 && <p className="text-[11px] text-amber-300 w-full">Coche au moins un groupe.</p>}
                    </div>
                  )}
                  {audience === '' && <p className="text-[11px] text-amber-300 mt-1.5">Choisis qui voit ces WOD avant d&apos;appliquer.</p>}
                  {selected.kind === 'subscription' && (
                    <p className="text-[11px] text-gray-500 mt-1.5">Ce choix devient la visibilité par défaut de l&apos;application automatique de cet abonnement.</p>
                  )}
                </div>
              )}

              {/* Conflits par jour de calendrier : la provenance est nommée, le
                  coach choisit en connaissance. Ce bloc ne promet jamais une
                  suppression que le serveur refusera. */}
              {selected && !offerEmpty && conflictCount > 0 && (
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

              {selected && !offerEmpty && protectedCount > 0 && (
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
              disabled={!canApply}
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
