'use client';

import { useState } from 'react';
import { X, Loader2, CalendarCheck, Users } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';

interface Slot {
  schedule_id: string;
  title: string;
  coach: string | null;
  scheduled_date: string;
  start_time: string;
  end_time: string | null;
  max_capacity: number;
  seats_left: number;
}

interface BookedSlot {
  title: string;
  scheduled_date: string;
  start_time: string;
}

type Step = 'form' | 'slots' | 'done';

export default function TrialBookingCta({
  boxId,
  planName,
}: {
  boxId: string;
  planName: string;
}) {
  const { t, lang } = useLanguage();
  const tr = t.boxPage.trial;

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('form');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [booked, setBooked] = useState<BookedSlot | null>(null);
  const [mailSent, setMailSent] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const locale = lang === 'en' ? 'en-GB' : 'fr-FR';

  /** Un refus a un nom : on le traduit, on n'affiche pas un message générique. */
  function refusal(reason: string | undefined): string {
    const table = tr.errors as Record<string, string | undefined>;
    return (reason && table[reason]) || tr.errors.reservation_impossible;
  }

  function dayLabel(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1)).toLocaleDateString(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    });
  }

  const hhmm = (time: string) => time.slice(0, 5);

  function seatsLabel(n: number): string {
    return (n > 1 ? tr.seatsLeftPlural : tr.seatsLeft).replace('{n}', String(n));
  }

  function reset() {
    setOpen(false);
    setStep('form');
    setError(null);
    setChosen(null);
    setBooked(null);
    setSlots([]);
  }

  async function loadSlots() {
    if (!firstName.trim() || !email.trim()) {
      setError(tr.errors.champs_manquants);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/trial/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ box_id: boxId }),
      });
      const data = await res.json();
      if (!data?.ok) {
        setError(refusal(data?.reason));
        return;
      }
      setSlots((data.slots ?? []) as Slot[]);
      setStep('slots');
    } catch {
      setError(tr.errors.lecture_impossible);
    } finally {
      setBusy(false);
    }
  }

  async function book() {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/trial/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          box_id: boxId,
          schedule_id: chosen,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          phone: phone.trim(),
        }),
      });
      const data = await res.json();
      if (!data?.ok) {
        setError(refusal(data?.reason));
        // Un créneau qui vient de se remplir n'est plus proposable : la liste
        // se rafraîchit au lieu de laisser le visiteur rejouer un refus.
        if (data?.reason === 'creneau_complet' || data?.reason === 'creneau_passe') {
          setSlots((prev) => prev.filter((s) => s.schedule_id !== chosen));
          setChosen(null);
        }
        return;
      }
      setBooked(data.slot as BookedSlot);
      setMailSent(Boolean(data.email_sent));
      setStep('done');
    } catch {
      setError(tr.errors.reservation_impossible);
    } finally {
      setBusy(false);
    }
  }

  const field =
    'w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-foreground/40';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-xs font-bold text-background transition-opacity hover:opacity-90"
      >
        <CalendarCheck size={14} /> {tr.cta}
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-6">
            <button
              onClick={reset}
              className="absolute right-4 top-4 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={tr.close}
            >
              <X size={18} />
            </button>

            {step === 'form' && (
              <>
                <h3 className="mb-1 font-display text-lg font-bold">{planName}</h3>
                <p className="mb-5 text-xs text-muted-foreground">{tr.formHint}</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      className={field}
                      placeholder={tr.firstName}
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                    <input
                      className={field}
                      placeholder={tr.lastName}
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                  </div>
                  <input
                    className={field}
                    type="email"
                    placeholder={tr.email}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <input
                    className={field}
                    type="tel"
                    placeholder={tr.phone}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                {error && <p className="mt-3 text-xs font-semibold text-red-500">{error}</p>}
                <button
                  onClick={loadSlots}
                  disabled={busy}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-3 text-sm font-bold text-background disabled:opacity-50"
                >
                  {busy ? <Loader2 size={15} className="animate-spin" /> : null}
                  {busy ? tr.loading : tr.next}
                </button>
              </>
            )}

            {step === 'slots' && (
              <>
                <h3 className="mb-1 font-display text-lg font-bold">{tr.slotsTitle}</h3>
                <p className="mb-4 text-xs text-muted-foreground">{tr.slotsHint}</p>

                {slots.length === 0 ? (
                  <p className="rounded-xl border border-border bg-background p-4 text-xs text-muted-foreground">
                    {tr.noSlots}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {slots.map((s) => {
                      const active = chosen === s.schedule_id;
                      return (
                        <button
                          key={s.schedule_id}
                          onClick={() => setChosen(s.schedule_id)}
                          className={`w-full rounded-xl border p-3 text-left transition-colors ${
                            active
                              ? 'border-foreground bg-secondary/60'
                              : 'border-border bg-background hover:border-foreground/40'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-semibold text-foreground">{s.title}</span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
                              <Users size={11} /> {seatsLabel(s.seats_left)}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs capitalize text-muted-foreground">
                            {dayLabel(s.scheduled_date)} · {hhmm(s.start_time)}
                            {s.end_time ? ` – ${hhmm(s.end_time)}` : ''}
                            {s.coach ? ` · ${s.coach}` : ''}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}

                {error && <p className="mt-3 text-xs font-semibold text-red-500">{error}</p>}

                <div className="mt-5 flex gap-3">
                  <button
                    onClick={() => setStep('form')}
                    className="rounded-xl border border-border px-4 py-3 text-sm font-bold text-foreground"
                  >
                    {tr.back}
                  </button>
                  <button
                    onClick={book}
                    disabled={busy || !chosen}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-3 text-sm font-bold text-background disabled:opacity-50"
                  >
                    {busy ? <Loader2 size={15} className="animate-spin" /> : null}
                    {busy ? tr.loading : tr.confirm}
                  </button>
                </div>
              </>
            )}

            {step === 'done' && booked && (
              <>
                <h3 className="mb-2 font-display text-lg font-bold">{tr.successTitle}</h3>
                <p className="text-sm text-foreground">
                  {tr.successBody
                    .replace('{title}', booked.title)
                    .replace(
                      '{when}',
                      `${dayLabel(booked.scheduled_date)} · ${hhmm(booked.start_time)}`,
                    )}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {mailSent ? tr.successMail : tr.successNoMail}
                </p>
                <button
                  onClick={reset}
                  className="mt-5 w-full rounded-xl bg-foreground px-4 py-3 text-sm font-bold text-background"
                >
                  {tr.close}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
