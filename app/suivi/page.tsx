'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Loader2, Star, CalendarClock, Check, PartyPopper } from 'lucide-react';

const supabase = createClient();

type Status = 'pending' | 'responded' | 'meeting_booked' | 'offer_sent' | 'converted' | 'lost';

interface Followup {
  id: string;
  box_id: string;
  status: Status;
  rating: number | null;
  first_seen_at: string;
  converted_plan_id: string | null;
  boxName: string;
  boxSlug: string | null;
  planName: string | null;
  planPriceCents: number | null;
}

interface Slot {
  id: string;
  starts_at: string;
  capacity: number;
  coach: string | null;
  booked: number;
}

function fmt(dt: string) {
  return new Date(dt).toLocaleString('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export default function SuiviPage() {
  const [loading, setLoading] = useState(true);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [slotsByBox, setSlotsByBox] = useState<Record<string, Slot[]>>({});

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: fu } = await supabase
      .from('session_followups')
      .select('id, box_id, status, rating, first_seen_at, converted_plan_id')
      .eq('member_id', user.id)
      .not('status', 'in', '(lost)')
      .order('first_seen_at', { ascending: false });
    const rows = (fu ?? []) as Omit<Followup, 'boxName' | 'boxSlug' | 'planName' | 'planPriceCents'>[];

    const boxIds = [...new Set(rows.map((r) => r.box_id))];
    const boxById = new Map<string, { name: string; slug: string | null }>();
    if (boxIds.length) {
      const { data: boxes } = await supabase.from('boxes').select('id, name, slug').in('id', boxIds);
      for (const b of (boxes ?? []) as { id: string; name: string; slug: string | null }[]) {
        boxById.set(b.id, { name: b.name, slug: b.slug });
      }
    }
    const planIds = rows.map((r) => r.converted_plan_id).filter(Boolean) as string[];
    const planById = new Map<string, { name: string; price_cents: number | null }>();
    if (planIds.length) {
      const { data: plans } = await supabase.from('membership_plans').select('id, name, price_cents').in('id', planIds);
      for (const p of (plans ?? []) as { id: string; name: string; price_cents: number | null }[]) {
        planById.set(p.id, { name: p.name, price_cents: p.price_cents });
      }
    }

    setFollowups(rows.map((r) => ({
      ...r,
      boxName: boxById.get(r.box_id)?.name ?? 'la box',
      boxSlug: boxById.get(r.box_id)?.slug ?? null,
      planName: r.converted_plan_id ? planById.get(r.converted_plan_id)?.name ?? null : null,
      planPriceCents: r.converted_plan_id ? planById.get(r.converted_plan_id)?.price_cents ?? null : null,
    })));

    // Créneaux RDV des box concernées.
    const byBox: Record<string, Slot[]> = {};
    for (const bid of boxIds) {
      const { data: sl } = await supabase
        .from('box_appointment_slots')
        .select('id, starts_at, capacity, coach')
        .eq('box_id', bid)
        .gte('starts_at', new Date().toISOString())
        .order('starts_at', { ascending: true });
      const slotRows = (sl ?? []) as Omit<Slot, 'booked'>[];
      const ids = slotRows.map((s) => s.id);
      const cnt = new Map<string, number>();
      if (ids.length) {
        const { data: bk } = await supabase
          .from('appointment_bookings').select('slot_id').in('slot_id', ids).eq('status', 'booked');
        for (const b of (bk ?? []) as { slot_id: string }[]) cnt.set(b.slot_id, (cnt.get(b.slot_id) ?? 0) + 1);
      }
      byBox[bid] = slotRows.map((s) => ({ ...s, booked: cnt.get(s.id) ?? 0 }));
    }
    setSlotsByBox(byBox);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function submitFeedback(f: Followup, rating: number, comment: string) {
    await supabase.rpc('submit_followup_feedback', {
      p_followup_id: f.id, p_rating: rating, p_comment: comment || null,
    });
    await load();
  }

  async function book(slotId: string) {
    const { error } = await supabase.rpc('book_appointment_slot', { p_slot_id: slotId });
    if (error) { alert(error.message === 'SLOT_FULL' ? 'Ce créneau est complet.' : 'Réservation impossible.'); }
    await load();
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-white/40" /></div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-black text-white mb-1">Ton parcours</h1>
      <p className="text-sm text-gray-400 mb-6">Après ta séance d&apos;essai, on t&apos;accompagne pour la suite.</p>

      {followups.length === 0 ? (
        <div className="bg-[#111] border border-white/8 rounded-2xl p-10 text-center text-gray-400 text-sm">
          Rien à suivre pour l&apos;instant. Tente une première séance dans une box !
        </div>
      ) : (
        <div className="space-y-4">
          {followups.map((f) => (
            <FollowupCard key={f.id} f={f} slots={slotsByBox[f.box_id] ?? []}
              onFeedback={submitFeedback} onBook={book} />
          ))}
        </div>
      )}
    </div>
  );
}

function FollowupCard({
  f, slots, onFeedback, onBook,
}: {
  f: Followup;
  slots: Slot[];
  onFeedback: (f: Followup, rating: number, comment: string) => void;
  onBook: (slotId: string) => void;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  return (
    <div className="bg-[#111] border border-white/8 rounded-2xl p-5">
      <p className="text-lg font-black text-white">{f.boxName}</p>
      <p className="text-xs text-gray-500 mb-4">Séance d&apos;essai le {fmt(f.first_seen_at)}</p>

      {/* Étape feedback */}
      {f.status === 'pending' && (
        <div className="bg-[#161616] border border-white/10 rounded-xl p-4">
          <p className="text-sm font-bold text-white mb-2">Comment était ta séance ?</p>
          <div className="flex items-center gap-1 mb-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setRating(n)}>
                <Star size={26} className={n <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-white/20'} />
              </button>
            ))}
          </div>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)}
            placeholder="Un mot sur ton ressenti (optionnel)"
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30 mb-3" rows={2} />
          <button disabled={rating === 0} onClick={() => onFeedback(f, rating, comment)}
            className="bg-white text-black font-bold rounded-lg px-4 py-2 text-sm disabled:opacity-40">
            Envoyer mon avis
          </button>
        </div>
      )}

      {/* Étape RDV */}
      {(f.status === 'responded' || f.status === 'meeting_booked') && (
        <div className="bg-[#161616] border border-white/10 rounded-xl p-4">
          <p className="text-sm font-bold text-white flex items-center gap-2 mb-1">
            <CalendarClock size={16} /> {f.status === 'meeting_booked' ? 'Ton RDV est réservé' : 'Réserve un moment avec la box'}
          </p>
          {f.status === 'meeting_booked' ? (
            <p className="text-xs text-emerald-300 flex items-center gap-1"><Check size={13} /> À bientôt !</p>
          ) : slots.length === 0 ? (
            <p className="text-xs text-gray-500">Aucun créneau ouvert pour l&apos;instant. La box te recontactera.</p>
          ) : (
            <div className="space-y-2 mt-2">
              {slots.map((s) => {
                const full = s.booked >= s.capacity;
                return (
                  <div key={s.id} className="flex items-center justify-between bg-[#0d0d0d] border border-white/10 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm text-white">{fmt(s.starts_at)}</p>
                      {s.coach && <p className="text-[11px] text-gray-500">avec {s.coach}</p>}
                    </div>
                    <button disabled={full} onClick={() => onBook(s.id)}
                      className="text-xs font-bold bg-white text-black rounded-lg px-3 py-1.5 disabled:opacity-40 disabled:bg-white/10 disabled:text-gray-500">
                      {full ? 'Complet' : 'Réserver'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Étape offre */}
      {f.status === 'offer_sent' && (
        <div className="bg-[#161616] border border-white/10 rounded-xl p-4">
          <p className="text-sm font-bold text-white mb-1">Une offre pour toi 🎯</p>
          {f.planName ? (
            <p className="text-sm text-gray-300 mb-3">
              {f.planName}{f.planPriceCents != null ? ` — ${(f.planPriceCents / 100).toFixed(0)} €` : ''}
            </p>
          ) : (
            <p className="text-sm text-gray-400 mb-3">La box t&apos;a préparé une formule adaptée.</p>
          )}
          {f.boxSlug && (
            <Link href={`/box/${f.boxSlug}`}
              className="inline-block bg-white text-black font-bold rounded-lg px-4 py-2 text-sm">
              Voir l&apos;offre &amp; m&apos;abonner
            </Link>
          )}
        </div>
      )}

      {/* Converti */}
      {f.status === 'converted' && (
        <div className="flex items-center gap-2 text-emerald-300 text-sm font-bold">
          <PartyPopper size={18} /> Bienvenue dans la communauté !
        </div>
      )}
    </div>
  );
}
