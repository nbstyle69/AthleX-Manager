'use client';

import { useEffect, useState } from 'react';
import { X, Loader2, Copy } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

/**
 * « Copier vers une offre » : recopie une semaine (du Whiteboard ou d'une
 * semaine type) dans une semaine d'une offre Marketplace de la box
 * (`copy_week_to_offer`).
 *
 * Depuis le Whiteboard, chaque copie reste liée à son WOD maison (provenance
 * `origin_box_wod_id`) : modifier le WOD met la copie à jour ; les box abonnées
 * gardent ce qu'elles ont déjà reçu. Depuis une semaine type, la copie est
 * indépendante. Le serveur refuse une semaine hors de l'offre et une source vide.
 */

export type CopySource =
  | { kind: 'whiteboard'; boxId: string; monday: string }
  | { kind: 'template'; boxId: string; templateId: string; templateTitle: string };

interface Props {
  source: CopySource;
  onClose: () => void;
  onCopied: (summary: { offerTitle: string; week: number; copied: number; replaced: number }) => void;
}

interface Offer { id: string; title: string; weeks_count: number; is_published: boolean }

interface WeekCount { week_number: number }

export default function CopyWeekToOfferModal({ source, onClose, onCopied }: Props) {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offerId, setOfferId] = useState('');
  const [week, setWeek] = useState(1);
  const [existing, setExisting] = useState<Record<number, number>>({});
  const [replace, setReplace] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const offer = offers.find(o => o.id === offerId) ?? null;
  const weekHas = existing[week] ?? 0;

  useEffect(() => {
    (async () => {
      const { data, error: qError } = await supabase
        .from('box_programming')
        .select('id, title, weeks_count, is_published')
        .eq('publisher_box_id', source.boxId)
        .eq('is_template', false)
        .order('created_at', { ascending: false });
      if (qError) setError(qError.message);
      const rows = (data ?? []) as Offer[];
      setOffers(rows);
      if (rows.length === 1) setOfferId(rows[0].id);
      setLoading(false);
    })();
  }, [source.boxId]);

  useEffect(() => {
    if (!offerId) { setExisting({}); return; }
    (async () => {
      const { data } = await supabase
        .from('box_programming_wods')
        .select('week_number')
        .eq('programming_id', offerId);
      const counts: Record<number, number> = {};
      ((data ?? []) as WeekCount[]).forEach(r => { counts[r.week_number] = (counts[r.week_number] ?? 0) + 1; });
      setExisting(counts);
    })();
  }, [offerId]);

  async function copy() {
    if (!offer) return;
    setSaving(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('copy_week_to_offer', {
      p_source_kind: source.kind,
      p_box_id: source.boxId,
      p_source_monday: source.kind === 'whiteboard' ? source.monday : null,
      p_template_id: source.kind === 'template' ? source.templateId : null,
      p_programming_id: offer.id,
      p_week: week,
      p_replace: replace,
    });
    setSaving(false);
    if (rpcError) { setError(rpcError.message); return; }
    const res = (data ?? {}) as { copied?: number; replaced?: number; week?: number };
    onCopied({ offerTitle: offer.title, week: res.week ?? week, copied: res.copied ?? 0, replaced: res.replaced ?? 0 });
  }

  const inp = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white transition-colors';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#111111] border border-white/10 rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
          <div>
            <h2 className="text-lg font-black text-white">Copier vers une offre</h2>
            <p className="text-xs text-gray-500">
              {source.kind === 'whiteboard'
                ? `Semaine du Whiteboard du ${new Date(source.monday + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`
                : `Semaine type « ${source.templateTitle} »`}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>
          )}

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-4 justify-center">
              <Loader2 size={16} className="animate-spin" /> Chargement des offres…
            </div>
          ) : offers.length === 0 ? (
            <p className="text-sm text-gray-400 leading-relaxed">
              Aucune offre Marketplace. Crée-en une dans <span className="text-white font-semibold">Entraînement → Marketplace → Mes offres</span>, puis reviens copier cette semaine dedans.
            </p>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Offre</label>
                <select className={inp} value={offerId} onChange={e => { setOfferId(e.target.value); setWeek(1); }}>
                  <option value="">— Choisir —</option>
                  {offers.map(o => (
                    <option key={o.id} value={o.id}>{o.title}{o.is_published ? '' : ' (brouillon)'}</option>
                  ))}
                </select>
              </div>

              {offer && (
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Semaine de l&apos;offre</label>
                  <select className={inp} value={week} onChange={e => setWeek(parseInt(e.target.value, 10))}>
                    {Array.from({ length: Math.max(1, offer.weeks_count) }, (_, i) => i + 1).map(w => (
                      <option key={w} value={w}>
                        Semaine {w}{existing[w] ? ` · ${existing[w]} WOD déjà` : ' · vide'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {offer && weekHas > 0 && (
                <label className="flex items-start gap-2 text-xs text-amber-300 bg-amber-500/5 border border-amber-500/20 rounded-xl px-3 py-2 cursor-pointer">
                  <input type="checkbox" checked={replace} onChange={e => setReplace(e.target.checked)} className="mt-0.5" />
                  <span>La semaine {week} porte déjà {weekHas} WOD. Cocher pour les remplacer ; sinon les copies s&apos;ajoutent.</span>
                </label>
              )}

              {offer && (
                <p className="text-[11px] text-gray-500">
                  {source.kind === 'whiteboard'
                    ? 'Les copies restent liées à tes WOD : les modifier met l’offre à jour. Les box abonnées gardent ce qu’elles ont déjà reçu.'
                    : 'Les copies sont indépendantes de la semaine type.'}
                </p>
              )}
            </>
          )}
        </div>

        {!loading && offers.length > 0 && (
          <div className="flex gap-2 justify-end px-6 py-4 border-t border-white/8">
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-bold border border-white/10 text-gray-300 hover:bg-white/5 transition-colors">
              Annuler
            </button>
            <button
              onClick={copy}
              disabled={!offer || saving}
              className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-white/90 disabled:opacity-40 text-[#0A0A0A] text-sm font-bold rounded-xl transition-colors"
            >
              {saving ? <><Loader2 size={14} className="animate-spin" /> Copie…</> : <><Copy size={14} /> Copier</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
