'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getMyBox } from '@/lib/getMyBox';
import { writeFailure } from '@/lib/writeGuard';
import {
  Loader2, UserPlus, Star, CalendarPlus, CalendarClock, Trash2, Check, X, Send, Users,
} from 'lucide-react';

const supabase = createClient();

const INPUT_CLS =
  'w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30';

type Status = 'pending' | 'responded' | 'meeting_booked' | 'offer_sent' | 'converted' | 'lost';

const PIPELINE: { key: Status; label: string; hint: string }[] = [
  { key: 'pending', label: 'Essai réalisé', hint: 'En attente de feedback' },
  { key: 'responded', label: 'Feedback reçu', hint: 'A donné son avis' },
  { key: 'meeting_booked', label: 'RDV pris', hint: 'Créneau réservé' },
  { key: 'offer_sent', label: 'Offre proposée', hint: 'En attente de décision' },
  { key: 'converted', label: 'Converti', hint: 'Devenu adhérent' },
];

interface Followup {
  id: string;
  member_id: string;
  status: Status;
  rating: number | null;
  feedback_comment: string | null;
  first_seen_at: string;
  converted_plan_id: string | null;
  username: string;
  email: string;
}

interface Slot {
  id: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  coach: string | null;
  notes: string | null;
  booked: number;
}

interface Plan {
  id: string;
  name: string;
  plan_type: string;
  price_cents: number | null;
}

function fmt(dt: string) {
  return new Date(dt).toLocaleString('fr-FR', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export default function ProspectsPage() {
  const [boxId, setBoxId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pipeline' | 'slots'>('pipeline');

  const [followups, setFollowups] = useState<Followup[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);

  const load = useCallback(async (bid: string) => {
    // Prospects + profils
    const { data: fu } = await supabase
      .from('session_followups')
      .select('id, member_id, status, rating, feedback_comment, first_seen_at, converted_plan_id')
      .eq('box_id', bid)
      .order('first_seen_at', { ascending: false });
    const rows = (fu ?? []) as Omit<Followup, 'username' | 'email'>[];
    const memberIds = [...new Set(rows.map((r) => r.member_id))];
    const profByeId = new Map<string, { username: string; email: string }>();
    if (memberIds.length) {
      const { data: profs } = await supabase
        .from('profiles').select('id, username, email').in('id', memberIds);
      for (const p of (profs ?? []) as { id: string; username: string; email: string }[]) {
        profByeId.set(p.id, { username: p.username, email: p.email });
      }
    }
    setFollowups(rows.map((r) => ({
      ...r,
      username: profByeId.get(r.member_id)?.username ?? '—',
      email: profByeId.get(r.member_id)?.email ?? '',
    })));

    // Créneaux RDV + nb réservés
    const { data: sl } = await supabase
      .from('box_appointment_slots')
      .select('id, starts_at, ends_at, capacity, coach, notes')
      .eq('box_id', bid)
      .gte('starts_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
      .order('starts_at', { ascending: true });
    const slotRows = (sl ?? []) as Omit<Slot, 'booked'>[];
    const slotIds = slotRows.map((s) => s.id);
    const bookedBySlot = new Map<string, number>();
    if (slotIds.length) {
      const { data: bk } = await supabase
        .from('appointment_bookings')
        .select('slot_id')
        .in('slot_id', slotIds)
        .eq('status', 'booked');
      for (const b of (bk ?? []) as { slot_id: string }[]) {
        bookedBySlot.set(b.slot_id, (bookedBySlot.get(b.slot_id) ?? 0) + 1);
      }
    }
    setSlots(slotRows.map((s) => ({ ...s, booked: bookedBySlot.get(s.id) ?? 0 })));

    // Offres de la box (pour la conversion)
    const { data: pl } = await supabase
      .from('membership_plans')
      .select('id, name, plan_type, price_cents')
      .eq('box_id', bid)
      .order('price_cents', { ascending: true });
    setPlans((pl ?? []) as Plan[]);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const box = await getMyBox(supabase, user.id);
      if (!box) { setLoading(false); return; }
      setBoxId(box.id);
      await load(box.id);
      setLoading(false);
    })();
  }, [load]);

  async function setStatus(f: Followup, status: Status, planId?: string) {
    const { data, error } = await supabase.from('session_followups')
      .update({ status, converted_plan_id: planId ?? f.converted_plan_id, updated_at: new Date().toISOString() })
      .eq('id', f.id)
      .select('id');
    const fail = writeFailure(error, data);
    if (fail) { alert(`Impossible de mettre à jour ce prospect : ${fail}`); return; }
    if (boxId) await load(boxId);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-white/40" /></div>;
  }
  if (!boxId) {
    return <p className="text-gray-400">Aucune box active.</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <UserPlus size={22} /> Prospects
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Suivi des essais &amp; Drop-in : feedback, RDV, conversion en abonnement.
          </p>
        </div>
        <div className="flex gap-1 bg-white/5 rounded-xl p-1">
          <button onClick={() => setTab('pipeline')}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold ${tab === 'pipeline' ? 'bg-white text-black' : 'text-gray-400'}`}>
            Pipeline
          </button>
          <button onClick={() => setTab('slots')}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold ${tab === 'slots' ? 'bg-white text-black' : 'text-gray-400'}`}>
            Créneaux RDV
          </button>
        </div>
      </div>

      {tab === 'pipeline' ? (
        <Pipeline followups={followups} plans={plans} onStatus={setStatus} />
      ) : (
        <Slots
          boxId={boxId}
          slots={slots}
          onAdded={(s) => setSlots((prev) =>
            [...prev, s].sort((a, b) => a.starts_at.localeCompare(b.starts_at)))}
          onRemoved={(id) => setSlots((prev) => prev.filter((s) => s.id !== id))}
          onChange={() => load(boxId)}
        />
      )}
    </div>
  );
}

function Pipeline({
  followups, plans, onStatus,
}: {
  followups: Followup[];
  plans: Plan[];
  onStatus: (f: Followup, s: Status, planId?: string) => void;
}) {
  if (followups.length === 0) {
    return (
      <div className="bg-[#111] border border-white/8 rounded-2xl p-10 text-center">
        <Users className="mx-auto text-white/20 mb-3" size={32} />
        <p className="text-gray-400 text-sm">
          Aucun prospect pour l&apos;instant. Dès qu&apos;un non-abonné est marqué « présent »
          à une première séance, il apparaît ici automatiquement.
        </p>
      </div>
    );
  }
  const lost = followups.filter((f) => f.status === 'lost');
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {PIPELINE.map((col) => {
          const items = followups.filter((f) => f.status === col.key);
          return (
            <div key={col.key} className="bg-[#0d0d0d] border border-white/8 rounded-2xl p-3">
              <div className="mb-3 px-1">
                <p className="text-sm font-black text-white">{col.label}</p>
                <p className="text-[11px] text-gray-500">{col.hint} · {items.length}</p>
              </div>
              <div className="space-y-2">
                {items.map((f) => (
                  <ProspectCard key={f.id} f={f} plans={plans} onStatus={onStatus} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {lost.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Perdus</p>
          <div className="flex flex-wrap gap-2">
            {lost.map((f) => (
              <span key={f.id} className="text-xs text-gray-500 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
                {f.username}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function ProspectCard({
  f, plans, onStatus,
}: {
  f: Followup;
  plans: Plan[];
  onStatus: (f: Followup, s: Status, planId?: string) => void;
}) {
  const [offering, setOffering] = useState(false);
  const [planId, setPlanId] = useState<string>('');

  return (
    <div className="bg-[#161616] border border-white/10 rounded-xl p-3">
      <p className="text-sm font-bold text-white truncate">{f.username}</p>
      <p className="text-[11px] text-gray-500 truncate">{f.email}</p>
      <p className="text-[11px] text-gray-600 mt-1">Essai le {fmt(f.first_seen_at)}</p>

      {f.rating != null && (
        <div className="flex items-center gap-0.5 mt-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star key={n} size={12} className={n <= (f.rating ?? 0) ? 'text-yellow-400 fill-yellow-400' : 'text-white/15'} />
          ))}
        </div>
      )}
      {f.feedback_comment && (
        <p className="text-[11px] text-gray-400 mt-1 italic line-clamp-3">« {f.feedback_comment} »</p>
      )}

      {f.status !== 'converted' && f.status !== 'lost' && (
        <div className="mt-3 space-y-1.5">
          {!offering ? (
            <div className="flex gap-1.5">
              <button onClick={() => setOffering(true)}
                className="flex-1 flex items-center justify-center gap-1 text-[11px] font-bold bg-white/10 hover:bg-white/20 text-white rounded-lg py-1.5">
                <Send size={11} /> Proposer une offre
              </button>
              <button onClick={() => onStatus(f, 'lost')} title="Marquer perdu"
                className="px-2 text-gray-500 hover:text-red-400 rounded-lg py-1.5 bg-white/5">
                <X size={13} />
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <select value={planId} onChange={(e) => setPlanId(e.target.value)} className={INPUT_CLS}>
                <option value="">Choisir une offre…</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.price_cents != null ? `— ${(p.price_cents / 100).toFixed(0)} €` : ''}
                    {p.plan_type === 'drop_in' ? ' (Drop-in)' : p.plan_type === 'pack' ? ' (Carnet)' : ''}
                  </option>
                ))}
              </select>
              <div className="flex gap-1.5">
                <button
                  disabled={!planId}
                  onClick={() => { onStatus(f, 'offer_sent', planId); setOffering(false); }}
                  className="flex-1 text-[11px] font-bold bg-white text-black rounded-lg py-1.5 disabled:opacity-40">
                  Envoyer l&apos;offre
                </button>
                <button onClick={() => setOffering(false)} className="px-2 text-gray-500 bg-white/5 rounded-lg py-1.5">
                  <X size={13} />
                </button>
              </div>
            </div>
          )}
          {f.status === 'offer_sent' && (
            <button onClick={() => onStatus(f, 'converted')}
              className="w-full flex items-center justify-center gap-1 text-[11px] font-bold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg py-1.5">
              <Check size={12} /> Marquer converti
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Slots({
  boxId, slots, onAdded, onRemoved, onChange,
}: {
  boxId: string;
  slots: Slot[];
  onAdded: (s: Slot) => void;
  onRemoved: (id: string) => void;
  onChange: () => Promise<void>;
}) {
  const [date, setDate] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [capacity, setCapacity] = useState('1');
  const [coach, setCoach] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function addSlot() {
    setErr(null);
    if (!date || !start || !end) { setErr('Renseigne la date et les horaires.'); return; }
    const startsAt = new Date(`${date}T${start}`);
    const endsAt = new Date(`${date}T${end}`);
    if (endsAt <= startsAt) { setErr('L\u2019heure de fin doit suivre le début.'); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: inserted, error } = await supabase.from('box_appointment_slots').insert({
      box_id: boxId,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      capacity: Math.max(1, Number(capacity) || 1),
      coach: coach || null,
      created_by: user?.id ?? null,
    }).select('id, starts_at, ends_at, capacity, coach, notes').single();
    setSaving(false);
    if (error) { setErr(error.message); return; }
    if (inserted) onAdded({ ...(inserted as Omit<Slot, 'booked'>), booked: 0 });
    setDate(''); setStart(''); setEnd(''); setCapacity('1'); setCoach('');
    void onChange();
  }

  async function del(id: string) {
    const { data, error } = await supabase
      .from('box_appointment_slots').delete().eq('id', id).select('id');
    const fail = writeFailure(error, data);
    if (fail) { alert(`Suppression du créneau impossible : ${fail}`); return; }
    onRemoved(id);
    void onChange();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-[#111] border border-white/8 rounded-2xl p-4">
        <p className="text-sm font-black text-white flex items-center gap-2 mb-3">
          <CalendarPlus size={16} /> Ouvrir un créneau
        </p>
        <div className="space-y-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT_CLS} />
          <div className="flex gap-2">
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={INPUT_CLS} />
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={INPUT_CLS} />
          </div>
          <input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)}
            placeholder="Capacité" className={INPUT_CLS} />
          <input value={coach} onChange={(e) => setCoach(e.target.value)} placeholder="Coach (optionnel)" className={INPUT_CLS} />
          <button onClick={addSlot} disabled={saving}
            className="w-full bg-white text-black font-bold rounded-lg py-2 text-sm disabled:opacity-50">
            {saving ? 'Ajout…' : 'Ajouter le créneau'}
          </button>
          {err && <p className="text-xs text-red-400">{err}</p>}
        </div>
      </div>

      <div className="lg:col-span-2 bg-[#111] border border-white/8 rounded-2xl p-4">
        <p className="text-sm font-black text-white flex items-center gap-2 mb-3">
          <CalendarClock size={16} /> Créneaux à venir
        </p>
        {slots.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun créneau ouvert.</p>
        ) : (
          <div className="space-y-2">
            {slots.map((s) => (
              <div key={s.id} className="flex items-center justify-between bg-[#161616] border border-white/10 rounded-xl px-4 py-2.5">
                <div>
                  <p className="text-sm font-bold text-white">{fmt(s.starts_at)}</p>
                  <p className="text-[11px] text-gray-500">
                    {s.booked}/{s.capacity} réservé{s.booked > 1 ? 's' : ''}{s.coach ? ` · ${s.coach}` : ''}
                  </p>
                </div>
                <button onClick={() => del(s.id)} className="text-gray-500 hover:text-red-400 p-1.5">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
