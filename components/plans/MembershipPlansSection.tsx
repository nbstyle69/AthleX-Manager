'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { writeFailure } from '@/lib/writeGuard';
import {
  Plus, Pencil, Trash2, X, Calendar, CreditCard,
} from 'lucide-react';

export type PlanType = 'subscription' | 'drop_in' | 'pack' | 'trial';

export interface MembershipPlan {
  id: string;
  box_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  max_sessions_per_week: number | null;
  color: string;
  is_active: boolean;
  sort_order: number;
  plan_type: PlanType;
  credits: number | null;
  validity_days: number | null;
  commitment_months: number;
  terms: string | null;
}

const PLAN_COLORS = ['#FFFFFF', '#EF4444', '#3B82F6', '#8B5CF6', '#16A34A', '#F59E0B', '#EC4899'];

const EMPTY_PLAN_FORM = {
  name: '',
  description: '',
  price: '' as string,
  max_sessions_per_week: '' as string,
  color: PLAN_COLORS[0],
  is_active: true,
  plan_type: 'subscription' as PlanType,
  credits: '' as string,          // pack: nb de séances
  validity_months: '' as string,  // pack: validité en mois ; drop_in: converti en jours
  commitment_months: '0' as string, // durée d'engagement (abonnement) ; 0 = sans engagement
  terms: '' as string,            // conditions / mentions affichées à la souscription
};

const formatPrice = (cents: number) => (cents === 0 ? 'Gratuit' : `${(cents / 100).toFixed(2)} €`);

// Le serveur a le dernier mot : ses refus sont nommés, on ne les traduit pas
// tous en « nom déjà pris ».
function planWriteMessage(error: { code?: string; message?: string } | null, fail: string): string {
  const msg = error?.message ?? '';
  if (msg.includes('membership_plans_une_offre_trial_par_box')) {
    return 'Cette box a déjà une offre Essai. Modifie-la au lieu d\'en créer une seconde.';
  }
  if (msg.includes('membership_plans_trial_gratuit')) {
    return 'Une offre Essai est gratuite : son prix doit rester à 0 €.';
  }
  if (error?.code === '23505') return 'Une formule porte déjà ce nom.';
  return `Impossible d'enregistrer la formule : ${fail}`;
}

export default function MembershipPlansSection({ boxId }: { boxId: string | null }) {
  const supabase = createClient();
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [editPlanId, setEditPlanId] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState(EMPTY_PLAN_FORM);
  const [planSaving, setPlanSaving] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  const loadPlans = useCallback(async (id: string) => {
    const { data } = await supabase
      .from('membership_plans')
      .select('id, box_id, name, description, price_cents, max_sessions_per_week, color, is_active, sort_order, plan_type, credits, validity_days, commitment_months, terms')
      .eq('box_id', id)
      .order('sort_order', { ascending: true })
      .order('price_cents', { ascending: true });
    setPlans((data ?? []) as MembershipPlan[]);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!boxId) return;
    loadPlans(boxId);
  }, [boxId, loadPlans]);

  function openNewPlan() {
    setEditPlanId(null);
    setPlanForm(EMPTY_PLAN_FORM);
    setPlanError(null);
    setShowPlanForm(true);
  }

  function openEditPlan(pl: MembershipPlan) {
    setEditPlanId(pl.id);
    setPlanForm({
      name: pl.name,
      description: pl.description ?? '',
      price: pl.price_cents ? String(pl.price_cents / 100) : '',
      max_sessions_per_week: pl.max_sessions_per_week ? String(pl.max_sessions_per_week) : '',
      color: pl.color ?? PLAN_COLORS[0],
      is_active: pl.is_active,
      plan_type: pl.plan_type ?? 'subscription',
      credits: pl.credits ? String(pl.credits) : '',
      validity_months: pl.validity_days ? String(Math.round(pl.validity_days / 30)) : '',
      commitment_months: String(pl.commitment_months ?? 0),
      terms: pl.terms ?? '',
    });
    setPlanError(null);
    setShowPlanForm(true);
  }

  async function handleSavePlan() {
    if (!planForm.name.trim() || !boxId) return;
    setPlanSaving(true);
    setPlanError(null);

    const priceCents = planForm.price.trim() === ''
      ? 0
      : Math.round(parseFloat(planForm.price.replace(',', '.')) * 100);
    const maxVal = planForm.max_sessions_per_week.trim() === ''
      ? null
      : parseInt(planForm.max_sessions_per_week);

    if (!Number.isFinite(priceCents) || priceCents < 0) {
      setPlanError('Prix invalide.');
      setPlanSaving(false);
      return;
    }

    const type = planForm.plan_type;

    // Drop-in / Carnet : achat unique -> crédits + validité. Prix obligatoire (> 0).
    let credits: number | null = null;
    let validityDays: number | null = null;
    if (type === 'trial') {
      credits = null;
      validityDays = null;
    } else if (type === 'drop_in') {
      credits = 1;
      validityDays = 14;
    } else if (type === 'pack') {
      credits = parseInt(planForm.credits);
      const months = parseInt(planForm.validity_months);
      if (!Number.isFinite(credits) || credits <= 0) {
        setPlanError('Indique le nombre de séances du carnet.');
        setPlanSaving(false);
        return;
      }
      if (!Number.isFinite(months) || months <= 0) {
        setPlanError('Indique la validité du carnet (en mois).');
        setPlanSaving(false);
        return;
      }
      validityDays = months * 30;
    }
    if ((type === 'drop_in' || type === 'pack') && priceCents <= 0) {
      setPlanError('Une offre Drop-in / Carnet doit avoir un prix > 0.');
      setPlanSaving(false);
      return;
    }

    const payload = {
      box_id: boxId,
      name: planForm.name.trim(),
      description: planForm.description.trim() || null,
      price_cents: type === 'trial' ? 0 : priceCents,
      max_sessions_per_week: type === 'subscription' ? maxVal : null,
      color: planForm.color,
      is_active: planForm.is_active,
      plan_type: type,
      credits,
      validity_days: validityDays,
      commitment_months: type === 'subscription'
        ? (Number.isFinite(parseInt(planForm.commitment_months)) ? Math.max(0, parseInt(planForm.commitment_months)) : 0)
        : 0,
      terms: planForm.terms.trim() || null,
    };

    const { data, error } = editPlanId
      ? await supabase.from('membership_plans').update(payload).eq('id', editPlanId).select('id')
      : await supabase.from('membership_plans').insert(payload).select('id');

    const fail = writeFailure(error, data);
    if (fail) {
      setPlanError(planWriteMessage(error, fail));
      setPlanSaving(false);
      return;
    }

    setPlanSaving(false);
    setShowPlanForm(false);
    await loadPlans(boxId);
  }

  async function handleDeletePlan(id: string) {
    if (!confirm('Supprimer cette formule ? Les membres associés passeront en illimité.')) return;
    const { data, error } = await supabase
      .from('membership_plans').delete().eq('id', id).select('id');
    const fail = writeFailure(error, data);
    if (fail) { alert(`Suppression impossible : ${fail}`); return; }
    if (boxId) await loadPlans(boxId);
  }

  async function togglePlanActive(pl: MembershipPlan) {
    const { data, error } = await supabase
      .from('membership_plans').update({ is_active: !pl.is_active }).eq('id', pl.id).select('id');
    const fail = writeFailure(error, data);
    if (fail) { alert(`Impossible de changer l'état de la formule : ${fail}`); return; }
    if (boxId) await loadPlans(boxId);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-black text-white">Offres d&apos;accès à la salle</h2>
        <button onClick={openNewPlan} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-all">
          <Plus size={16} /> Créer une offre
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        <span className="font-semibold text-gray-400">Abonnement</span> (mensuel, quota séances/semaine) · <span className="font-semibold text-gray-400">Drop-in</span> (1 séance) · <span className="font-semibold text-gray-400">Carnet</span> (N séances valables X mois). Un prix &gt; 0 affiche l&apos;offre sur ta page publique (paiement Stripe). Une formule mensuelle à 0 € reste « gratuite » et s&apos;assigne manuellement dans Membres.
      </p>

      {loading ? (
        <div className="text-center py-10 text-gray-500">Chargement…</div>
      ) : plans.length === 0 ? (
        <div className="text-center py-12 bg-[#111] border border-white/[0.06] rounded-2xl">
          <CreditCard size={36} className="mx-auto text-gray-600 mb-3" />
          <p className="text-gray-500 text-sm">Aucune formule d&apos;abonnement</p>
          <p className="text-gray-600 text-xs mt-1">Créez votre première formule mensuelle</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {plans.map(pl => (
            <div key={pl.id} className={`bg-[#111] border border-white/[0.06] rounded-2xl p-5 ${!pl.is_active ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: pl.color }} />
                    <span className="font-bold text-white text-base truncate">{pl.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                      pl.plan_type === 'drop_in' ? 'bg-blue-500/10 text-blue-400'
                      : pl.plan_type === 'pack' ? 'bg-purple-500/10 text-purple-400'
                      : pl.plan_type === 'trial' ? 'bg-amber-500/10 text-amber-400'
                      : 'bg-emerald-500/10 text-emerald-400'}`}>
                      {pl.plan_type === 'drop_in' ? 'Drop-in'
                        : pl.plan_type === 'pack' ? 'Carnet'
                        : pl.plan_type === 'trial' ? 'Essai'
                        : 'Abonnement'}
                    </span>
                    {!pl.is_active && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 font-semibold">Inactif</span>
                    )}
                  </div>
                  {pl.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{pl.description}</p>}
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
                    <Calendar size={13} />
                    <span className="font-semibold">
                      {pl.plan_type === 'trial'
                        ? '1 séance découverte · gratuite'
                        : pl.plan_type === 'drop_in'
                        ? `1 séance · valable ${pl.validity_days ?? 14} j`
                        : pl.plan_type === 'pack'
                        ? `${pl.credits ?? 0} séances · valable ${Math.round((pl.validity_days ?? 0) / 30)} mois`
                        : pl.max_sessions_per_week
                        ? `${pl.max_sessions_per_week} séance${pl.max_sessions_per_week > 1 ? 's' : ''}/semaine`
                        : 'Séances illimitées'}
                    </span>
                    {pl.plan_type === 'subscription' && (pl.commitment_months ?? 0) > 0 && (
                      <span className="font-semibold text-amber-400/90">· engagement {pl.commitment_months} mois</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                  <span className="text-sm font-black text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl whitespace-nowrap">
                    {formatPrice(pl.price_cents)}
                    {pl.plan_type === 'subscription' && pl.price_cents > 0 && <span className="text-[10px] text-gray-500 font-semibold"> /mois</span>}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/[0.06]">
                <button onClick={() => openEditPlan(pl)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white text-xs font-semibold transition-all">
                  <Pencil size={13} /> Modifier
                </button>
                <button onClick={() => togglePlanActive(pl)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white text-xs font-semibold transition-all">
                  {pl.is_active ? 'Désactiver' : 'Activer'}
                </button>
                <button onClick={() => handleDeletePlan(pl.id)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 text-xs font-semibold transition-all">
                  <Trash2 size={13} /> Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal form — Abonnement (formule) */}
      {showPlanForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#111] border border-white/[0.06] rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-black text-white">
                {editPlanId ? 'Modifier l\'offre' : 'Nouvelle offre'}
              </h2>
              <button onClick={() => setShowPlanForm(false)} className="text-gray-500 hover:text-white"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 mb-2 block">Type d&apos;offre</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { v: 'subscription', label: 'Abonnement', desc: 'Mensuel récurrent' },
                    { v: 'drop_in', label: 'Drop-in', desc: '1 séance' },
                    { v: 'pack', label: 'Carnet', desc: 'N séances / X mois' },
                    { v: 'trial', label: 'Essai', desc: 'Gratuit · 1 séance découverte' },
                  ] as { v: PlanType; label: string; desc: string }[]).map(o => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setPlanForm({ ...planForm, plan_type: o.v })}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${planForm.plan_type === o.v ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 hover:border-white/20'}`}
                    >
                      <span className="text-sm font-bold text-white block">{o.label}</span>
                      <span className="text-[11px] text-gray-500">{o.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 mb-1 block">Nom *</label>
                <input
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50"
                  value={planForm.name} onChange={e => setPlanForm({ ...planForm, name: e.target.value })}
                  placeholder={planForm.plan_type === 'drop_in' ? 'Séance à l\'unité' : planForm.plan_type === 'pack' ? 'Carnet 10 séances' : planForm.plan_type === 'trial' ? 'Séance découverte' : 'Essentiel, Premium…'}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 mb-1 block">Description</label>
                <textarea
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50 min-h-[70px]"
                  value={planForm.description} onChange={e => setPlanForm({ ...planForm, description: e.target.value })}
                  placeholder="Accès illimité aux cours…"
                />
              </div>

              {planForm.plan_type === 'subscription' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-400 mb-1 block">Prix (€/mois)</label>
                    <input
                      type="number" min={0} step="0.01"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50"
                      value={planForm.price} onChange={e => setPlanForm({ ...planForm, price: e.target.value })}
                      placeholder="0 = gratuit"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 mb-1 block">Séances / semaine</label>
                    <input
                      type="number" min={1}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50"
                      value={planForm.max_sessions_per_week} onChange={e => setPlanForm({ ...planForm, max_sessions_per_week: e.target.value })}
                      placeholder="∞ (illimité)"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 mb-1 block">Engagement</label>
                    <select
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50"
                      value={planForm.commitment_months}
                      onChange={e => setPlanForm({ ...planForm, commitment_months: e.target.value })}
                    >
                      <option value="0">Sans engagement</option>
                      <option value="3">3 mois</option>
                      <option value="6">6 mois</option>
                      <option value="12">12 mois</option>
                    </select>
                    <p className="text-[11px] text-gray-500 mt-1.5">Durée minimale avant résiliation libre. Au-delà, l&apos;adhérent peut résilier au mois.</p>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-gray-400 mb-1 block">Conditions / mentions (affichées à la souscription)</label>
                    <textarea
                      rows={3}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50 resize-none"
                      value={planForm.terms} onChange={e => setPlanForm({ ...planForm, terms: e.target.value })}
                      placeholder="Ex. Prix TTC. Horaires d'accès 6h–22h. Résiliation possible pour motif légitime (déménagement, blessure) sur justificatif."
                    />
                  </div>
                </div>
              )}

              {planForm.plan_type === 'trial' && (
                <div className="space-y-3">
                  <div className="px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <p className="text-xs font-bold text-amber-300">Gratuite par construction</p>
                    <p className="text-[11px] text-amber-200/70 mt-1">
                      Pas de prix à saisir : la base refuse une offre Essai payante. Une seule offre Essai par box.
                      Le visiteur réserve un cours à venir sans créer de compte, et son dossier arrive dans Prospects.
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 mb-1 block">Conditions / mentions (affichées au visiteur)</label>
                    <textarea
                      rows={3}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50 resize-none"
                      value={planForm.terms} onChange={e => setPlanForm({ ...planForm, terms: e.target.value })}
                      placeholder="Ex. Une séance d'essai par personne. Prévoir des chaussures de sport. Présente-toi 10 minutes avant le cours."
                    />
                  </div>
                </div>
              )}

              {planForm.plan_type === 'drop_in' && (
                <div>
                  <label className="text-xs font-bold text-gray-400 mb-1 block">Prix (€)</label>
                  <input
                    type="number" min={0} step="0.01"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50"
                    value={planForm.price} onChange={e => setPlanForm({ ...planForm, price: e.target.value })}
                    placeholder="15.00"
                  />
                  <p className="text-[11px] text-gray-500 mt-1.5">Donne droit à 1 réservation, valable 14 jours après l&apos;achat.</p>
                </div>
              )}

              {planForm.plan_type === 'pack' && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-400 mb-1 block">Prix (€)</label>
                    <input
                      type="number" min={0} step="0.01"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50"
                      value={planForm.price} onChange={e => setPlanForm({ ...planForm, price: e.target.value })}
                      placeholder="120.00"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 mb-1 block">Séances</label>
                    <input
                      type="number" min={1}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50"
                      value={planForm.credits} onChange={e => setPlanForm({ ...planForm, credits: e.target.value })}
                      placeholder="10"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 mb-1 block">Validité (mois)</label>
                    <input
                      type="number" min={1}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50"
                      value={planForm.validity_months} onChange={e => setPlanForm({ ...planForm, validity_months: e.target.value })}
                      placeholder="12"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-gray-400 mb-2 block">Couleur</label>
                <div className="flex items-center gap-2">
                  {PLAN_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setPlanForm({ ...planForm, color: c })}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${planForm.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                      aria-label={c}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox" checked={planForm.is_active}
                    onChange={e => setPlanForm({ ...planForm, is_active: e.target.checked })}
                    className="w-4 h-4 rounded accent-emerald-500"
                  />
                  <span className="text-sm text-gray-300 font-semibold">Active (visible pour les athlètes)</span>
                </label>
              </div>

              {planError && <p className="text-xs text-red-400">{planError}</p>}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowPlanForm(false)} className="px-4 py-2.5 rounded-xl text-sm font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-all">Annuler</button>
              <button
                onClick={handleSavePlan}
                disabled={planSaving || !planForm.name.trim()}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold transition-all"
              >
                {planSaving ? 'Enregistrement…' : editPlanId ? 'Modifier' : 'Créer l\'offre'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
