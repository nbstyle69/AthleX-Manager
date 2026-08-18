'use client';

import { useCallback, useEffect, useState } from 'react';
import { X, Loader2, AlertTriangle, CalendarPlus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { DAY_LABELS } from '@/lib/wodFields';

/**
 * « Appliquer une programmation » : pose une semaine d'un contenu semaine × jour
 * sur le calendrier du Whiteboard, avec l'accès groupe choisi à ce moment-là.
 *
 * Le geste vit côté serveur (`apply_program_week`), qui vérifie lui-même la
 * souscription active et non expirée, la qualité de gérant/coach et
 * l'appartenance des groupes à la box. Cette UI ne fait que proposer les choix :
 * elle n'est pas la frontière.
 *
 * Deux sources sont prévues par la RPC (`source_kind`) : `subscription` pour une
 * programmation souscrite, `template` pour la future semaine type interne du
 * chantier Musculation. Seule la première est proposée ici.
 */

export interface ApplyGroup { id: string; name: string; color: string }

interface ApplicableProgramming {
  subscriptionId: string;
  title: string;
  publisherBoxName: string | null;
  weeksCount: number;
  daysPerWeek: number;
}

interface Props {
  boxId: string;
  /** Lundi (ISO) de la semaine affichée sur le Whiteboard — cible par défaut. */
  defaultMonday: string;
  groups: ApplyGroup[];
  onClose: () => void;
  /** Appelé après une application réussie, pour recharger le calendrier. */
  onApplied: (summary: { inserted: number; replaced: number }) => void;
}

interface RawApplicable {
  subscription_id: string;
  title: string | null;
  publisher_box_name: string | null;
  weeks_count: number | null;
  days_per_week: number | null;
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

export default function ApplyProgramWeekModal({
  boxId, defaultMonday, groups, onClose, onApplied,
}: Props) {
  const supabase = createClient();

  const [loading, setLoading]   = useState(true);
  const [items, setItems]       = useState<ApplicableProgramming[]>([]);
  const [subId, setSubId]       = useState('');
  const [week, setWeek]         = useState(1);
  const [monday, setMonday]     = useState(mondayOf(defaultMonday));
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [conflicts, setConflicts] = useState<number | null>(null);
  const [applying, setApplying] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const selected = items.find(i => i.subscriptionId === subId) ?? null;

  useEffect(() => {
    (async () => {
      const { data, error: rpcError } = await supabase
        .rpc('list_applicable_programmings', { p_box_id: boxId });
      if (rpcError) {
        setError(rpcError.message);
      } else {
        const rows: ApplicableProgramming[] = ((data ?? []) as RawApplicable[]).map(r => ({
          subscriptionId: r.subscription_id,
          title: r.title ?? 'Programmation',
          publisherBoxName: r.publisher_box_name,
          weeksCount: Math.max(r.weeks_count ?? 1, 1),
          daysPerWeek: r.days_per_week ?? 5,
        }));
        setItems(rows);
        if (rows.length === 1) setSubId(rows[0].subscriptionId);
      }
      setLoading(false);
    })();
  }, [boxId]);

  const checkConflicts = useCallback(async () => {
    if (!subId) { setConflicts(null); return; }
    const { data, error: rpcError } = await supabase.rpc('count_program_week_conflicts', {
      p_source_kind: 'subscription',
      p_source_id: subId,
      p_week: week,
      p_target_monday: monday,
    });
    if (rpcError) { setError(rpcError.message); setConflicts(null); return; }
    setConflicts(typeof data === 'number' ? data : 0);
  }, [subId, week, monday]);

  useEffect(() => { void checkConflicts(); }, [checkConflicts]);

  async function apply(replace: boolean) {
    if (!subId) return;
    setApplying(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('apply_program_week', {
      p_source_kind: 'subscription',
      p_source_id: subId,
      p_week: week,
      p_target_monday: monday,
      p_group_ids: groupIds.length ? groupIds : null,
      p_replace: replace,
    });
    setApplying(false);
    if (rpcError) { setError(rpcError.message); return; }
    const summary = (data ?? {}) as { inserted?: number; replaced?: number };
    onApplied({ inserted: summary.inserted ?? 0, replaced: summary.replaced ?? 0 });
  }

  const inp = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white transition-colors';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#111111] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
          <h2 className="text-lg font-black text-white">Appliquer une programmation</h2>
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
              <Loader2 size={16} className="animate-spin" /> Chargement des programmations…
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-gray-400 leading-relaxed py-4">
              Aucune programmation souscrite active. Rends-toi dans <span className="text-white font-semibold">Entraînement → Programmation</span> pour t&apos;abonner à une offre publiée par une autre box.
            </p>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Programmation</label>
                <select className={inp} value={subId} onChange={e => { setSubId(e.target.value); setWeek(1); }}>
                  <option value="">— Choisir —</option>
                  {items.map(i => (
                    <option key={i.subscriptionId} value={i.subscriptionId}>
                      {i.title}{i.publisherBoxName ? ` — ${i.publisherBoxName}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {selected && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Semaine source</label>
                    <select className={inp} value={week} onChange={e => setWeek(parseInt(e.target.value, 10))}>
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
                  Les WOD se poseront du <span className="text-gray-300">{frDate(monday)}</span> ({DAY_LABELS[0]}) au dimanche suivant, aux jours définis dans la programmation. Ils restent éditables ensuite comme des WOD maison.
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

              {selected && conflicts !== null && conflicts > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-sm text-amber-300 flex gap-2.5">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span>
                    Cette semaine porte déjà <span className="font-bold">{conflicts} WOD</span> issus de cette programmation.
                    Les remplacer supprimera ces WOD (et leurs scores) avant de reposer la semaine {week}.
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
              onClick={() => apply(conflicts !== null && conflicts > 0)}
              disabled={!subId || applying}
              className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-white/90 disabled:opacity-40 text-[#0A0A0A] text-sm font-bold rounded-xl transition-colors"
            >
              {applying
                ? <><Loader2 size={14} className="animate-spin" /> Application…</>
                : <><CalendarPlus size={14} /> {conflicts !== null && conflicts > 0 ? 'Remplacer la semaine' : 'Appliquer'}</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
