'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getMyBox } from '@/lib/getMyBox';
import { writeFailure } from '@/lib/writeGuard';
import { SITE_URL } from '@/lib/site-url';
import {
  BookOpen, Plus, Pencil, Trash2, X, Globe, Eye, Copy, Check,
  Users, Calendar, Clock, Hash, ChevronLeft, ChevronRight, FileText,
  CreditCard, AlertTriangle, Loader2, Ticket, Percent,
} from 'lucide-react';
import { formatCap, parseCap } from '@/lib/wodFields';

interface Program {
  id: string;
  box_id: string;
  owner_id: string;
  title: string;
  description: string | null;
  price_cents: number;
  currency: string;
  type: 'fixed' | 'ongoing';
  duration_weeks: number | null;
  days_per_week: number;
  invite_code: string;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  member_count?: number;
}

type PlanType = 'subscription' | 'drop_in' | 'pack';

interface MembershipPlan {
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

interface PromoCode {
  id: string;
  box_id: string;
  code: string;
  discount_type: 'percent' | 'amount';
  percent_off: number | null;
  amount_off_cents: number | null;
  currency: string;
  duration: 'once' | 'repeating' | 'forever';
  duration_in_months: number | null;
  max_redemptions: number | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

interface ProgramWOD {
  id: string;
  program_id: string;
  day_number: number | null;
  week_number: number | null;
  title: string;
  description: string;
  wod_type: string | null;
  time_cap_seconds: number | null;
  notes: string | null;
  sort_order: number;
}

const WOD_TYPES = [
  { value: 'for-time', label: 'For Time', color: '#EF4444' },
  { value: 'amrap', label: 'AMRAP', color: '#3B82F6' },
  { value: 'emom', label: 'EMOM', color: '#8B5CF6' },
  { value: 'strength', label: 'Force', color: '#16A34A' },
  { value: 'custom', label: 'Custom', color: '#6B7280' },
];

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const EMPTY_FORM = {
  title: '',
  description: '',
  price: '' as string,
  type: 'fixed' as 'fixed' | 'ongoing',
  duration_weeks: '6',
  days_per_week: '5',
  is_active: true,
};

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

const EMPTY_PROMO_FORM = {
  code: '',
  discount_type: 'percent' as 'percent' | 'amount',
  percent_off: '' as string,
  amount_off: '' as string,          // en euros (converti en cents)
  duration: 'once' as 'once' | 'repeating' | 'forever', // abonnements uniquement
  duration_in_months: '' as string,
  max_redemptions: '' as string,     // vide = illimité
  expires_at: '' as string,          // date locale (yyyy-mm-dd) ou vide
};

function genCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const SITE_BASE_URL = SITE_URL;

export default function BoxOwnerProgramsPage() {
  const supabase = createClient();
  const [boxId, setBoxId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [slug, setSlug] = useState<string>('');
  const [slugSaved, setSlugSaved] = useState<string>('');
  const [slugSaving, setSlugSaving] = useState(false);
  const [slugCopied, setSlugCopied] = useState(false);
  const [slugEditing, setSlugEditing] = useState(false);

  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);

  // Stripe Connect (paiements)
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Abonnements (formules d'abonnement de la salle)
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [editPlanId, setEditPlanId] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState(EMPTY_PLAN_FORM);
  const [planSaving, setPlanSaving] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  const [codeCopied, setCodeCopied] = useState<string | null>(null);

  // Codes promo (réductions saisies au checkout Stripe)
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [showPromoForm, setShowPromoForm] = useState(false);
  const [promoForm, setPromoForm] = useState(EMPTY_PROMO_FORM);
  const [promoSaving, setPromoSaving] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoBusyId, setPromoBusyId] = useState<string | null>(null);

  // WOD Editor state
  const [editorProgram, setEditorProgram] = useState<Program | null>(null);
  const [wods, setWods] = useState<ProgramWOD[]>([]);
  const [wodsLoading, setWodsLoading] = useState(false);
  const [weekIdx, setWeekIdx] = useState(0);
  const [showWodForm, setShowWodForm] = useState(false);
  const [editWodId, setEditWodId] = useState<string | null>(null);
  const [wodForm, setWodForm] = useState({ title: '', description: '', wod_type: 'custom', time_cap: '', notes: '' });
  const [wodDayNumber, setWodDayNumber] = useState(1);
  const [wodSaving, setWodSaving] = useState(false);

  useEffect(() => { loadAll(); }, []);

  // Retour d'onboarding Connect → rafraîchir le statut
  useEffect(() => {
    if (!boxId) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('connect') === 'return' || params.get('connect') === 'refresh') {
      refreshConnect();
      window.history.replaceState({}, '', window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxId]);

  async function loadAll() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const active = await getMyBox(supabase);
    if (!active) { setLoading(false); return; }

    const { data: box } = await supabase
      .from('boxes')
      .select('id, slug, stripe_account_id, stripe_onboarding_complete')
      .eq('id', active.id)
      .maybeSingle();

    if (!box) { setLoading(false); return; }
    setBoxId(box.id);
    setSlug((box as any).slug ?? '');
    setSlugSaved((box as any).slug ?? '');
    setStripeAccountId((box as any).stripe_account_id ?? null);
    setOnboardingComplete(Boolean((box as any).stripe_onboarding_complete));

    const { data: progs } = await supabase
      .from('programs')
      .select('*, program_members(count)')
      .eq('box_id', box.id)
      .order('created_at', { ascending: false });

    const mapped = (progs ?? []).map((p: any) => ({
      ...p,
      member_count: p.program_members?.[0]?.count ?? 0,
    }));
    setPrograms(mapped as Program[]);

    await loadPlans(box.id);
    await loadPromoCodes(box.id);
    setLoading(false);
  }

  async function loadPromoCodes(id: string) {
    try {
      const res = await fetch(`/api/promo-codes?box_id=${encodeURIComponent(id)}`);
      if (!res.ok) { setPromoCodes([]); return; }
      const data = await res.json();
      setPromoCodes((data.codes ?? []) as PromoCode[]);
    } catch { setPromoCodes([]); }
  }

  async function loadPlans(id: string) {
    const { data } = await supabase
      .from('membership_plans')
      .select('id, box_id, name, description, price_cents, max_sessions_per_week, color, is_active, sort_order, plan_type, credits, validity_days, commitment_months, terms')
      .eq('box_id', id)
      .order('sort_order', { ascending: true })
      .order('price_cents', { ascending: true });
    setPlans((data ?? []) as MembershipPlan[]);
  }

  async function startOnboarding() {
    if (!boxId) return;
    setConnectLoading(true);
    try {
      const res = await fetch('/api/connect/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ box_id: boxId }),
      });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; return; }
    } catch { /* noop */ }
    setConnectLoading(false);
  }

  async function refreshConnect() {
    if (!boxId) return;
    setConnectLoading(true);
    try {
      const res = await fetch('/api/connect/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ box_id: boxId }),
      });
      const data = await res.json();
      setOnboardingComplete(Boolean(data.onboarding_complete));
    } catch { /* noop */ }
    setConnectLoading(false);
  }

  async function saveSlug() {
    if (!boxId || !slug.trim()) return;
    setSlugSaving(true);
    const clean = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/--+/g, '-');
    const { data, error } = await supabase
      .from('boxes').update({ slug: clean }).eq('id', boxId).select('id');
    const fail = writeFailure(error, data);
    if (fail) alert(`Impossible d'enregistrer l'adresse publique : ${fail}`);
    else { setSlug(clean); setSlugSaved(clean); setSlugEditing(false); }
    setSlugSaving(false);
  }

  function copyUrl() {
    navigator.clipboard.writeText(`${SITE_BASE_URL}/box/${slugSaved}`);
    setSlugCopied(true);
    setTimeout(() => setSlugCopied(false), 2000);
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCodeCopied(code);
    setTimeout(() => setCodeCopied(null), 2000);
  }

  function openNew() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(p: Program) {
    setEditId(p.id);
    setForm({
      title: p.title,
      description: p.description ?? '',
      price: String(p.price_cents / 100),
      type: p.type,
      duration_weeks: p.duration_weeks ? String(p.duration_weeks) : '',
      days_per_week: String(p.days_per_week),
      is_active: p.is_active,
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.title.trim() || !boxId || !userId) return;
    setSaving(true);

    const cents = Math.round(parseFloat(form.price || '0') * 100);
    if (isNaN(cents) || cents < 0) { setSaving(false); return; }

    const payload: any = {
      box_id: boxId,
      owner_id: userId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      price_cents: cents,
      type: form.type,
      duration_weeks: form.type === 'fixed' ? (parseInt(form.duration_weeks) || 6) : null,
      days_per_week: parseInt(form.days_per_week) || 5,
      is_active: form.is_active,
      updated_at: new Date().toISOString(),
    };

    let res;
    if (editId) {
      res = await supabase.from('programs').update(payload).eq('id', editId).select('id');
    } else {
      payload.invite_code = genCode();
      res = await supabase.from('programs').insert(payload).select('id');
    }

    setSaving(false);
    const fail = writeFailure(res.error, res.data);
    if (fail) { alert(`Impossible d'enregistrer le programme : ${fail}`); return; }
    setShowForm(false);
    loadAll();
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce programme et tous ses WODs ?')) return;
    const { data, error } = await supabase.from('programs').delete().eq('id', id).select('id');
    const fail = writeFailure(error, data);
    if (fail) { alert(`Suppression impossible : ${fail}`); return; }
    loadAll();
  }

  async function toggleActive(p: Program) {
    const { data, error } = await supabase
      .from('programs').update({ is_active: !p.is_active }).eq('id', p.id).select('id');
    const fail = writeFailure(error, data);
    if (fail) { alert(`Impossible de changer l'état du programme : ${fail}`); return; }
    loadAll();
  }

  // ── Abonnements (formules) ──
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
    if (type === 'drop_in') {
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
      price_cents: priceCents,
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
      setPlanError(
        error?.code === '23505'
          ? 'Une formule porte déjà ce nom.'
          : `Impossible d'enregistrer la formule : ${fail}`,
      );
      setPlanSaving(false);
      return;
    }

    setPlanSaving(false);
    setShowPlanForm(false);
    if (boxId) await loadPlans(boxId);
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

  // ── Codes promo ──
  function openNewPromo() {
    setPromoForm(EMPTY_PROMO_FORM);
    setPromoError(null);
    setShowPromoForm(true);
  }

  async function handleSavePromo() {
    if (!boxId) return;
    setPromoError(null);

    const code = promoForm.code.trim().toUpperCase();
    if (!/^[A-Z0-9]{3,30}$/.test(code)) {
      setPromoError('Le code doit faire 3 à 30 caractères (lettres/chiffres, sans espace).');
      return;
    }

    const body: Record<string, unknown> = {
      box_id: boxId,
      code,
      discount_type: promoForm.discount_type,
      duration: promoForm.duration,
      max_redemptions: promoForm.max_redemptions.trim() || null,
      expires_at: promoForm.expires_at ? new Date(promoForm.expires_at).toISOString() : null,
    };

    if (promoForm.discount_type === 'percent') {
      const pct = parseFloat(promoForm.percent_off.replace(',', '.'));
      if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
        setPromoError('Pourcentage invalide (1 à 100).');
        return;
      }
      body.percent_off = pct;
    } else {
      const eur = parseFloat(promoForm.amount_off.replace(',', '.'));
      if (!Number.isFinite(eur) || eur <= 0) {
        setPromoError('Montant invalide.');
        return;
      }
      body.amount_off_cents = Math.round(eur * 100);
    }

    if (promoForm.duration === 'repeating') {
      const months = parseInt(promoForm.duration_in_months);
      if (!Number.isFinite(months) || months <= 0) {
        setPromoError('Indique le nombre de mois de la remise.');
        return;
      }
      body.duration_in_months = months;
    }

    setPromoSaving(true);
    try {
      const res = await fetch('/api/promo-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setPromoError(data.error ?? 'Impossible de créer le code.');
        setPromoSaving(false);
        return;
      }
      setShowPromoForm(false);
      await loadPromoCodes(boxId);
    } catch {
      setPromoError('Erreur réseau.');
    }
    setPromoSaving(false);
  }

  async function handleTogglePromo(promo: PromoCode) {
    setPromoBusyId(promo.id);
    try {
      await fetch(`/api/promo-codes/${promo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !promo.is_active }),
      });
      if (boxId) await loadPromoCodes(boxId);
    } catch { /* noop */ }
    setPromoBusyId(null);
  }

  async function handleDeletePromo(promo: PromoCode) {
    if (!confirm(`Supprimer le code ${promo.code} ? Il ne sera plus utilisable au paiement.`)) return;
    setPromoBusyId(promo.id);
    try {
      await fetch(`/api/promo-codes/${promo.id}`, { method: 'DELETE' });
      if (boxId) await loadPromoCodes(boxId);
    } catch { /* noop */ }
    setPromoBusyId(null);
  }

  // ── WOD Editor functions ──
  async function openEditor(p: Program) {
    setEditorProgram(p);
    setWeekIdx(0);
    await loadWods(p.id);
  }

  async function loadWods(programId: string) {
    setWodsLoading(true);
    const { data } = await supabase
      .from('program_wods')
      .select('*')
      .eq('program_id', programId)
      .order('day_number')
      .order('sort_order');
    setWods((data ?? []) as ProgramWOD[]);
    setWodsLoading(false);
  }

  function wodsForDay(dayNum: number) {
    return wods.filter(w => w.day_number === dayNum);
  }

  function openWodCreate(dayNumber: number) {
    setEditWodId(null);
    setWodForm({ title: '', description: '', wod_type: 'custom', time_cap: '', notes: '' });
    setWodDayNumber(dayNumber);
    setShowWodForm(true);
  }

  function openWodEdit(w: ProgramWOD) {
    setEditWodId(w.id);
    setWodForm({
      title: w.title,
      description: w.description,
      wod_type: w.wod_type ?? 'custom',
      time_cap: formatCap(w.time_cap_seconds),
      notes: w.notes ?? '',
    });
    setWodDayNumber(w.day_number ?? 1);
    setShowWodForm(true);
  }

  async function saveWod() {
    if (!wodForm.title.trim() || !wodForm.description.trim() || !editorProgram) return;
    setWodSaving(true);
    const payload: any = {
      program_id: editorProgram.id,
      day_number: wodDayNumber,
      week_number: Math.ceil(wodDayNumber / 7),
      title: wodForm.title.trim(),
      description: wodForm.description.trim(),
      wod_type: wodForm.wod_type,
      time_cap_seconds: parseCap(wodForm.time_cap),
      notes: wodForm.notes.trim() || null,
    };
    let res;
    if (editWodId) {
      res = await supabase.from('program_wods').update(payload).eq('id', editWodId).select('id');
    } else {
      payload.sort_order = wodsForDay(wodDayNumber).length;
      res = await supabase.from('program_wods').insert(payload).select('id');
    }
    setWodSaving(false);
    const fail = writeFailure(res.error, res.data);
    if (fail) { alert(`Impossible d'enregistrer le WOD : ${fail}`); return; }
    setShowWodForm(false);
    loadWods(editorProgram.id);
  }

  async function deleteWod(id: string) {
    if (!confirm('Supprimer ce WOD ?') || !editorProgram) return;
    const { data, error } = await supabase.from('program_wods').delete().eq('id', id).select('id');
    const fail = writeFailure(error, data);
    if (fail) { alert(`Suppression impossible : ${fail}`); return; }
    loadWods(editorProgram.id);
  }

  async function duplicateWeek() {
    if (!editorProgram) return;
    const weekStart = weekIdx * 7;
    const currentWods = wods.filter(w => (w.day_number ?? 0) > weekStart && (w.day_number ?? 0) <= weekStart + 7);
    if (currentWods.length === 0) { alert('Aucun WOD cette semaine.'); return; }
    const inserts = currentWods.map(w => ({
      program_id: editorProgram.id,
      day_number: (w.day_number ?? 1) + 7,
      week_number: (w.week_number ?? 1) + 1,
      title: w.title,
      description: w.description,
      wod_type: w.wod_type,
      time_cap_seconds: w.time_cap_seconds,
      notes: w.notes,
      sort_order: w.sort_order,
    }));
    const { data, error } = await supabase.from('program_wods').insert(inserts).select('id');
    const fail = writeFailure(error, data);
    if (fail) { alert(`Duplication impossible : ${fail}`); return; }
    setWeekIdx(prev => prev + 1);
    loadWods(editorProgram.id);
  }

  const formatPrice = (cents: number) => {
    if (cents === 0) return 'Gratuit';
    return `${(cents / 100).toFixed(2)} €`;
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black text-white">Offres & Programmation</h1>
        <p className="text-sm text-gray-500 mt-1">Gérez vos abonnements de salle et vos programmes de coaching</p>
      </div>

      {/* Slug / Public page */}
      <div className="bg-[#111] border border-white/[0.06] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Globe size={16} className="text-emerald-400" />
          <h2 className="text-sm font-black text-white uppercase tracking-widest">Page publique</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white/5 rounded-xl border border-white/10 overflow-hidden flex-1">
            <span className="text-xs text-gray-500 pl-3 pr-1 whitespace-nowrap">{SITE_BASE_URL}/box/</span>
            <input
              className={`flex-1 bg-transparent text-sm py-2.5 pr-3 outline-none font-semibold ${slugEditing ? 'text-white' : 'text-gray-400'}`}
              value={slug}
              onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="mon-slug"
              readOnly={!slugEditing}
            />
          </div>
          {slugEditing ? (
            <div className="flex items-center gap-2">
              <button onClick={() => { setSlug(slugSaved); setSlugEditing(false); }} className="px-3 py-2.5 rounded-xl text-sm font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-all whitespace-nowrap">Annuler</button>
              <button onClick={saveSlug} disabled={slugSaving || slug === slugSaved || !slug.trim()} className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white text-sm font-bold transition-all whitespace-nowrap">{slugSaving ? '...' : 'Enregistrer'}</button>
            </div>
          ) : (
            <button onClick={() => setSlugEditing(true)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-sm font-bold transition-all whitespace-nowrap"><Pencil size={14} /> Modifier</button>
          )}
        </div>
        {slugSaved && (
          <div className="flex items-center gap-3 mt-3">
            <a href={`${SITE_BASE_URL}/box/${slugSaved}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"><Eye size={13} /> Voir ma page</a>
            <button onClick={copyUrl} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white font-semibold transition-colors">
              {slugCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              {slugCopied ? 'Copié !' : 'Copier le lien'}
            </button>
          </div>
        )}
      </div>

      {/* Paiements (Stripe Connect) */}
      <div className="bg-[#111] border border-white/[0.06] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard size={16} className="text-emerald-400" />
          <h2 className="text-sm font-black text-white uppercase tracking-widest">Paiements</h2>
        </div>
        {onboardingComplete ? (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <Check size={18} className="text-emerald-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-white">Paiements activés</p>
              <p className="text-xs text-gray-500">Tu peux vendre tes programmes. Les paiements arrivent directement sur ton compte (commission AthleX 4 %).</p>
            </div>
            <button onClick={refreshConnect} disabled={connectLoading} className="text-xs text-gray-500 hover:text-white font-semibold transition-colors disabled:opacity-50">
              {connectLoading ? '...' : 'Actualiser'}
            </button>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
              <AlertTriangle size={18} className="text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-white">Active les paiements pour vendre tes programmes</p>
              <p className="text-xs text-gray-500 mb-3">
                Connecte ton compte via Stripe (2 min). Les programmes gratuits restent accessibles sans cette étape.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={startOnboarding}
                  disabled={connectLoading}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-gray-200 text-black text-sm font-bold transition-all disabled:opacity-60"
                >
                  {connectLoading ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />}
                  {stripeAccountId ? 'Continuer la configuration' : 'Activer les paiements'}
                </button>
                {stripeAccountId && (
                  <button onClick={refreshConnect} disabled={connectLoading} className="text-xs text-gray-500 hover:text-white font-semibold transition-colors disabled:opacity-50">
                    J'ai terminé — actualiser
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Abonnements (formules de la salle) */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-black text-white">Offres d'accès à la salle</h2>
          <button onClick={openNewPlan} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-all">
            <Plus size={16} /> Créer une offre
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          <span className="font-semibold text-gray-400">Abonnement</span> (mensuel, quota séances/semaine) · <span className="font-semibold text-gray-400">Drop-in</span> (1 séance) · <span className="font-semibold text-gray-400">Carnet</span> (N séances valables X mois). Un prix &gt; 0 affiche l'offre sur ta page publique (paiement Stripe). Une formule mensuelle à 0 € reste « gratuite » et s'assigne manuellement dans Membres.
        </p>

        {loading ? (
          <div className="text-center py-10 text-gray-500">Chargement…</div>
        ) : plans.length === 0 ? (
          <div className="text-center py-12 bg-[#111] border border-white/[0.06] rounded-2xl">
            <CreditCard size={36} className="mx-auto text-gray-600 mb-3" />
            <p className="text-gray-500 text-sm">Aucune formule d'abonnement</p>
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
                        : 'bg-emerald-500/10 text-emerald-400'}`}>
                        {pl.plan_type === 'drop_in' ? 'Drop-in' : pl.plan_type === 'pack' ? 'Carnet' : 'Abonnement'}
                      </span>
                      {!pl.is_active && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 font-semibold">Inactif</span>
                      )}
                    </div>
                    {pl.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{pl.description}</p>}
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
                      <Calendar size={13} />
                      <span className="font-semibold">
                        {pl.plan_type === 'drop_in'
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
      </div>

      {/* Codes promo */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-black text-white">Codes promo</h2>
          <button
            onClick={openNewPromo}
            disabled={!onboardingComplete}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold transition-all"
          >
            <Plus size={16} /> Créer un code
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Des réductions que l'athlète saisit au moment de payer (page Stripe). Valables sur toutes tes offres (abonnements, Drop-in, Carnet, programmes). Stripe vérifie le code, l'expiration et le quota automatiquement.
          {!onboardingComplete && <span className="block mt-1 text-amber-400/90 font-semibold">Active d'abord les paiements (Stripe) plus haut pour créer des codes.</span>}
        </p>

        {loading ? (
          <div className="text-center py-10 text-gray-500">Chargement…</div>
        ) : promoCodes.length === 0 ? (
          <div className="text-center py-12 bg-[#111] border border-white/[0.06] rounded-2xl">
            <Ticket size={36} className="mx-auto text-gray-600 mb-3" />
            <p className="text-gray-500 text-sm">Aucun code promo</p>
            <p className="text-gray-600 text-xs mt-1">Ex. <span className="font-mono">RENTREE25</span> : -20 % sur les 3 premiers mois</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {promoCodes.map(pc => {
              const expired = pc.expires_at ? new Date(pc.expires_at).getTime() < Date.now() : false;
              const discountLabel = pc.discount_type === 'percent'
                ? `-${pc.percent_off}%`
                : `-${((pc.amount_off_cents ?? 0) / 100).toFixed(2)} €`;
              const durationLabel = pc.duration === 'forever'
                ? 'à vie'
                : pc.duration === 'repeating'
                ? `${pc.duration_in_months} mois`
                : '1 fois';
              return (
                <div key={pc.id} className={`bg-[#111] border border-white/[0.06] rounded-2xl p-5 ${(!pc.is_active || expired) ? 'opacity-50' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-black text-white text-base tracking-wider">{pc.code}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-emerald-500/10 text-emerald-400">{discountLabel}</span>
                        {!pc.is_active && <span className="text-[10px] px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 font-semibold">Désactivé</span>}
                        {pc.is_active && expired && <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 font-semibold">Expiré</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 flex-wrap">
                        <span className="flex items-center gap-1"><Percent size={12} /> Abonnement : {durationLabel}</span>
                        <span className="flex items-center gap-1"><Users size={12} /> {pc.max_redemptions != null ? `${pc.max_redemptions} utilisation${pc.max_redemptions > 1 ? 's' : ''} max` : 'Illimité'}</span>
                        {pc.expires_at && (
                          <span className="flex items-center gap-1"><Clock size={12} /> Expire le {new Date(pc.expires_at).toLocaleDateString('fr-FR')}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/[0.06]">
                    <button onClick={() => copyCode(pc.code)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white text-xs font-semibold transition-all">
                      {codeCopied === pc.code ? <Check size={13} /> : <Copy size={13} />} {codeCopied === pc.code ? 'Copié !' : 'Copier'}
                    </button>
                    <button onClick={() => handleTogglePromo(pc)} disabled={promoBusyId === pc.id} className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white text-xs font-semibold transition-all disabled:opacity-40">
                      {promoBusyId === pc.id ? <Loader2 size={13} className="animate-spin" /> : null}
                      {pc.is_active ? 'Désactiver' : 'Activer'}
                    </button>
                    <button onClick={() => handleDeletePromo(pc)} disabled={promoBusyId === pc.id} className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 text-xs font-semibold transition-all disabled:opacity-40">
                      <Trash2 size={13} /> Supprimer
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Programs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-white">Mes programmes</h2>
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-all">
            <Plus size={16} /> Créer un programme
          </button>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-500">Chargement…</div>
        ) : programs.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen size={40} className="mx-auto text-gray-600 mb-3" />
            <p className="text-gray-500 text-sm">Aucun programme</p>
            <p className="text-gray-600 text-xs mt-1">Créez votre premier programme de coaching</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {programs.map(p => (
              <div key={p.id} className={`bg-[#111] border border-white/[0.06] rounded-2xl p-5 ${!p.is_active ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-base truncate">{p.title}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${p.type === 'fixed' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'}`}>
                        {p.type === 'fixed' ? `${p.duration_weeks} sem.` : 'Ongoing'}
                      </span>
                      {!p.is_active && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 font-semibold">Inactif</span>
                      )}
                    </div>
                    {p.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{p.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    <span className="text-sm font-black text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl">
                      {formatPrice(p.price_cents)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Users size={13} /> <span className="font-semibold">{p.member_count ?? 0} acheteurs</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Calendar size={13} /> <span className="font-semibold">{p.days_per_week}j/sem</span>
                  </div>
                  <button onClick={() => copyCode(p.invite_code)} className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg hover:bg-emerald-500/20 transition-all">
                    {codeCopied === p.invite_code ? <Check size={12} /> : <Hash size={12} />}
                    {codeCopied === p.invite_code ? 'Copié !' : p.invite_code}
                  </button>
                </div>

                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/[0.06]">
                  <button onClick={() => openEditor(p)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-emerald-500/10 text-emerald-400 hover:text-emerald-300 text-xs font-semibold transition-all">
                    <FileText size={13} /> Séances
                  </button>
                  <button onClick={() => openEdit(p)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white text-xs font-semibold transition-all">
                    <Pencil size={13} /> Modifier
                  </button>
                  <button onClick={() => toggleActive(p)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white text-xs font-semibold transition-all">
                    {p.is_active ? 'Désactiver' : 'Activer'}
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 text-xs font-semibold transition-all">
                    <Trash2 size={13} /> Supprimer
                  </button>
                  <div className="flex-1" />
                  <span className="text-[10px] text-gray-600">Commission plateforme : 4%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#111] border border-white/[0.06] rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-black text-white">
                {editId ? 'Modifier le programme' : 'Nouveau programme'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 mb-1 block">Titre *</label>
                <input
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50"
                  value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="Force 6 semaines"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 mb-1 block">Description</label>
                <textarea
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50 min-h-[80px]"
                  value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Programme de force progressive…"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 mb-1 block">Prix (€) *</label>
                <input
                  type="number" step="0.01"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50"
                  value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}
                  placeholder="49.00"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 mb-2 block">Type de programme</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setForm({ ...form, type: 'fixed' })}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${form.type === 'fixed' ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 hover:border-white/20'}`}
                  >
                    <span className="text-sm font-bold text-white block">Programme fixe</span>
                    <span className="text-xs text-gray-500">Durée définie (6, 8, 12 sem.)</span>
                  </button>
                  <button
                    onClick={() => setForm({ ...form, type: 'ongoing' })}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${form.type === 'ongoing' ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 hover:border-white/20'}`}
                  >
                    <span className="text-sm font-bold text-white block">Ongoing</span>
                    <span className="text-xs text-gray-500">Programme continu</span>
                  </button>
                </div>
              </div>

              {form.type === 'fixed' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-400 mb-1 block">Durée (semaines)</label>
                    <input
                      type="number"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50"
                      value={form.duration_weeks} onChange={e => setForm({ ...form, duration_weeks: e.target.value })}
                      placeholder="6"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 mb-1 block">Jours / semaine</label>
                    <input
                      type="number"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50"
                      value={form.days_per_week} onChange={e => setForm({ ...form, days_per_week: e.target.value })}
                      placeholder="5"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox" checked={form.is_active}
                    onChange={e => setForm({ ...form, is_active: e.target.checked })}
                    className="w-4 h-4 rounded accent-emerald-500"
                  />
                  <span className="text-sm text-gray-300 font-semibold">Actif (visible pour les athlètes)</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded-xl text-sm font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-all">Annuler</button>
              <button
                onClick={handleSave}
                disabled={saving || !form.title.trim()}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold transition-all"
              >
                {saving ? 'Enregistrement…' : editId ? 'Modifier' : 'Créer le programme'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal code promo */}
      {showPromoForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-[#111] border border-white/[0.06] rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-black text-white">Nouveau code promo</h2>
              <button onClick={() => setShowPromoForm(false)} className="text-gray-500 hover:text-white"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 mb-1 block">Code *</label>
                <input
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white font-mono tracking-wider uppercase outline-none focus:border-emerald-500/50"
                  value={promoForm.code}
                  onChange={e => setPromoForm({ ...promoForm, code: e.target.value.toUpperCase() })}
                  placeholder="RENTREE25"
                  maxLength={30}
                />
                <p className="text-[11px] text-gray-600 mt-1">3 à 30 caractères, lettres et chiffres uniquement.</p>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 mb-2 block">Type de remise</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { v: 'percent', label: 'Pourcentage', desc: 'ex. -20 %' },
                    { v: 'amount', label: 'Montant fixe', desc: 'ex. -10 €' },
                  ] as { v: 'percent' | 'amount'; label: string; desc: string }[]).map(o => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setPromoForm({ ...promoForm, discount_type: o.v })}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${promoForm.discount_type === o.v ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 hover:border-white/20'}`}
                    >
                      <span className="text-sm font-bold text-white block">{o.label}</span>
                      <span className="text-[11px] text-gray-500">{o.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {promoForm.discount_type === 'percent' ? (
                <div>
                  <label className="text-xs font-bold text-gray-400 mb-1 block">Pourcentage de remise *</label>
                  <div className="relative">
                    <input
                      type="number" min="1" max="100"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 pr-8 text-sm text-white outline-none focus:border-emerald-500/50"
                      value={promoForm.percent_off}
                      onChange={e => setPromoForm({ ...promoForm, percent_off: e.target.value })}
                      placeholder="20"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">%</span>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-bold text-gray-400 mb-1 block">Montant de remise *</label>
                  <div className="relative">
                    <input
                      type="number" min="0" step="0.01"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 pr-8 text-sm text-white outline-none focus:border-emerald-500/50"
                      value={promoForm.amount_off}
                      onChange={e => setPromoForm({ ...promoForm, amount_off: e.target.value })}
                      placeholder="10"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">€</span>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-gray-400 mb-2 block">Durée de la remise (abonnements)</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { v: 'once', label: '1 fois', desc: '1re facture' },
                    { v: 'repeating', label: 'N mois', desc: 'plusieurs mois' },
                    { v: 'forever', label: 'À vie', desc: 'toujours' },
                  ] as { v: 'once' | 'repeating' | 'forever'; label: string; desc: string }[]).map(o => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setPromoForm({ ...promoForm, duration: o.v })}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${promoForm.duration === o.v ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 hover:border-white/20'}`}
                    >
                      <span className="text-sm font-bold text-white block">{o.label}</span>
                      <span className="text-[11px] text-gray-500">{o.desc}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-gray-600 mt-1">Sur un achat unique (Drop-in / Carnet / programme), la remise s'applique une seule fois quel que soit ce réglage.</p>
              </div>

              {promoForm.duration === 'repeating' && (
                <div>
                  <label className="text-xs font-bold text-gray-400 mb-1 block">Nombre de mois *</label>
                  <input
                    type="number" min="1"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50"
                    value={promoForm.duration_in_months}
                    onChange={e => setPromoForm({ ...promoForm, duration_in_months: e.target.value })}
                    placeholder="3"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-400 mb-1 block">Utilisations max</label>
                  <input
                    type="number" min="1"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50"
                    value={promoForm.max_redemptions}
                    onChange={e => setPromoForm({ ...promoForm, max_redemptions: e.target.value })}
                    placeholder="Illimité"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 mb-1 block">Expire le</label>
                  <input
                    type="date"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50"
                    value={promoForm.expires_at}
                    onChange={e => setPromoForm({ ...promoForm, expires_at: e.target.value })}
                  />
                </div>
              </div>

              {promoError && (
                <div className="flex items-start gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {promoError}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button onClick={() => setShowPromoForm(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-white text-sm font-bold transition-all">
                Annuler
              </button>
              <button
                onClick={handleSavePromo}
                disabled={promoSaving}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold transition-all"
              >
                {promoSaving ? <Loader2 size={16} className="animate-spin" /> : <Ticket size={16} />}
                {promoSaving ? 'Création…' : 'Créer le code'}
              </button>
            </div>
          </div>
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
                <label className="text-xs font-bold text-gray-400 mb-2 block">Type d'offre</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { v: 'subscription', label: 'Abonnement', desc: 'Mensuel récurrent' },
                    { v: 'drop_in', label: 'Drop-in', desc: '1 séance' },
                    { v: 'pack', label: 'Carnet', desc: 'N séances / X mois' },
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
                  placeholder={planForm.plan_type === 'drop_in' ? 'Séance à l\'unité' : planForm.plan_type === 'pack' ? 'Carnet 10 séances' : 'Essentiel, Premium…'}
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
                    <p className="text-[11px] text-gray-500 mt-1.5">Durée minimale avant résiliation libre. Au-delà, l'adhérent peut résilier au mois.</p>
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

              {planForm.plan_type === 'drop_in' && (
                <div>
                  <label className="text-xs font-bold text-gray-400 mb-1 block">Prix (€)</label>
                  <input
                    type="number" min={0} step="0.01"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50"
                    value={planForm.price} onChange={e => setPlanForm({ ...planForm, price: e.target.value })}
                    placeholder="15.00"
                  />
                  <p className="text-[11px] text-gray-500 mt-1.5">Donne droit à 1 réservation, valable 14 jours après l'achat.</p>
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

      {/* WOD Editor panel */}
      {editorProgram && (
        <div className="fixed inset-0 z-50 bg-[#0A0A0A] overflow-y-auto">
          {/* Editor Header */}
          <div className="sticky top-0 z-10 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/[0.06]">
            <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
              <button onClick={() => setEditorProgram(null)} className="text-gray-400 hover:text-white">
                <ChevronLeft size={20} />
              </button>
              <div className="flex-1">
                <h2 className="text-lg font-black text-white">{editorProgram.title}</h2>
                <p className="text-xs text-gray-500">
                  {editorProgram.type === 'fixed' ? `${editorProgram.duration_weeks} semaines` : 'Ongoing'} · {editorProgram.days_per_week}j/sem · {wods.length} séance{wods.length > 1 ? 's' : ''}
                </p>
              </div>
              <button onClick={duplicateWeek} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300 transition-all">
                <Copy size={13} /> Dupliquer sem. {weekIdx + 1} → {weekIdx + 2}
              </button>
            </div>

            {/* Week navigation */}
            <div className="max-w-5xl mx-auto px-6 pb-3 flex items-center gap-4">
              <button
                onClick={() => setWeekIdx(w => Math.max(0, w - 1))}
                disabled={weekIdx === 0}
                className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 transition-all"
              >
                <ChevronLeft size={18} className="text-gray-400" />
              </button>
              <span className="text-sm font-bold text-white">
                Semaine {weekIdx + 1}{editorProgram.type === 'fixed' ? ` / ${editorProgram.duration_weeks}` : ''}
              </span>
              <button
                onClick={() => setWeekIdx(w => editorProgram.type === 'fixed' ? Math.min((editorProgram.duration_weeks ?? 12) - 1, w + 1) : w + 1)}
                disabled={editorProgram.type === 'fixed' && weekIdx >= (editorProgram.duration_weeks ?? 12) - 1}
                className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 transition-all"
              >
                <ChevronRight size={18} className="text-gray-400" />
              </button>
            </div>
          </div>

          {/* Days grid */}
          <div className="max-w-5xl mx-auto px-6 py-6">
            {wodsLoading ? (
              <div className="text-center py-20 text-gray-500">Chargement…</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 7 }, (_, i) => {
                  const dayNum = weekIdx * 7 + i + 1;
                  const dayWods = wodsForDay(dayNum);
                  const isRest = i >= editorProgram.days_per_week;
                  return (
                    <div key={dayNum} className={`rounded-2xl border p-4 ${isRest ? 'border-white/[0.03] bg-white/[0.01]' : 'border-white/[0.06] bg-[#111]'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <span className={`text-xs font-bold ${isRest ? 'text-gray-600' : 'text-gray-400'}`}>
                          {DAY_LABELS[i]} — J{dayNum}
                        </span>
                        {isRest && <span className="text-[10px] text-gray-600 font-bold">REPOS</span>}
                      </div>

                      {dayWods.map(w => {
                        const typeInfo = WOD_TYPES.find(t => t.value === w.wod_type);
                        return (
                          <div key={w.id} className="bg-white/[0.03] rounded-xl p-3 mb-2">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold text-white flex-1" title={w.title}>{w.title}</span>
                              {typeInfo && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: `${typeInfo.color}20`, color: typeInfo.color }}>
                                  {typeInfo.label}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-gray-500 line-clamp-3 whitespace-pre-line mb-2">{w.description}</p>
                            {w.time_cap_seconds && (
                              <div className="flex items-center gap-1 text-[10px] text-gray-600 mb-2">
                                <Clock size={10} /> {formatCap(w.time_cap_seconds)}
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <button onClick={() => openWodEdit(w)} className="text-[10px] font-semibold text-gray-500 hover:text-white px-2 py-1 rounded hover:bg-white/5 transition-all">
                                <Pencil size={10} />
                              </button>
                              <button onClick={() => deleteWod(w.id)} className="text-[10px] font-semibold text-gray-500 hover:text-red-400 px-2 py-1 rounded hover:bg-red-500/10 transition-all">
                                <Trash2 size={10} />
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {!isRest && (
                        <button
                          onClick={() => openWodCreate(dayNum)}
                          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/5 text-xs font-semibold text-gray-500 hover:text-emerald-400 transition-all"
                        >
                          <Plus size={14} /> Ajouter
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* WOD create/edit modal */}
      {showWodForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#111] border border-white/[0.06] rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-black text-white">
                {editWodId ? 'Modifier la séance' : `Nouvelle séance — J${wodDayNumber}`}
              </h2>
              <button onClick={() => setShowWodForm(false)} className="text-gray-500 hover:text-white"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 mb-1 block">Titre *</label>
                <input
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50"
                  value={wodForm.title} onChange={e => setWodForm({ ...wodForm, title: e.target.value })}
                  placeholder="Back Squat 5x5 + MetCon"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 mb-1 block">Contenu de la séance *</label>
                <textarea
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50 min-h-[140px] font-mono"
                  value={wodForm.description} onChange={e => setWodForm({ ...wodForm, description: e.target.value })}
                  placeholder={"A) Back Squat 5x5 @80%\nRest 2:00\n\nB) 3 Rounds For Time:\n12 Thrusters 42.5/30\n12 C2B Pull-ups\n400m Run"}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 mb-2 block">Type</label>
                <div className="flex flex-wrap gap-2">
                  {WOD_TYPES.map(t => (
                    <button
                      key={t.value}
                      onClick={() => setWodForm({ ...wodForm, wod_type: t.value })}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${wodForm.wod_type === t.value ? 'ring-2 ring-offset-1 ring-offset-[#111]' : 'opacity-50 hover:opacity-80'}`}
                      style={{ backgroundColor: `${t.color}20`, color: t.color, ...(wodForm.wod_type === t.value ? { ringColor: t.color } : {}) }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-400 mb-1 block">Time Cap (mm:ss)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50"
                    value={wodForm.time_cap} onChange={e => setWodForm({ ...wodForm, time_cap: e.target.value })}
                    placeholder="12:30"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 mb-1 block">Jour</label>
                  <input
                    type="number"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50"
                    value={wodDayNumber} onChange={e => setWodDayNumber(parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 mb-1 block">Notes coach</label>
                <textarea
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50 min-h-[60px]"
                  value={wodForm.notes} onChange={e => setWodForm({ ...wodForm, notes: e.target.value })}
                  placeholder="Scaling: 35/25kg, Pull-ups stricts…"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowWodForm(false)} className="px-4 py-2.5 rounded-xl text-sm font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-all">Annuler</button>
              <button
                onClick={saveWod}
                disabled={wodSaving || !wodForm.title.trim() || !wodForm.description.trim()}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold transition-all"
              >
                {wodSaving ? 'Enregistrement…' : editWodId ? 'Modifier' : 'Ajouter la séance'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
