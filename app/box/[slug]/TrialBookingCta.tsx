'use client';

import { useMemo, useState } from 'react';
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

/** Horizon affiché d'emblée. Le serveur en ouvre 21 : les suivants se demandent. */
const FIRST_DAYS = 7;

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
  const [day, setDay] = useState<string | null>(null);
  const [allDays, setAllDays] = useState(false);
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

  function shortDayLabel(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1)).toLocaleDateString(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    });
  }

  const days = useMemo(() => [...new Set(slots.map((s) => s.scheduled_date))].sort(), [slots]);
  const shownDays = allDays ? days : days.slice(0, FIRST_DAYS);
  const activeDay = day && shownDays.includes(day) ? day : (shownDays[0] ?? null);
  const daySlots = slots.filter((s) => s.scheduled_date === activeDay);

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
    setDay(null);
    setAllDays(false);
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
          <div className="relative flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-card p-6">
            <button
              onClick={reset}
              className="absolute right-4 top-4 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={tr.close}
            >
              <X size={18} />
            </button>

            {step === 'form' && (
              <div className="overflow-y-auto">
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
              </div>
            )}

            {step === 'slots' && (
              <div className="flex min-h-0 flex-1 flex-col">
                <h3 className="mb-1 font-display text-lg font-bold">{tr.slotsTitle}</h3>
                <p className="mb-4 text-xs text-muted-foreground">{tr.slotsHint}</p>

                {slots.length === 0 ? (
                  <p className="rounded-xl border border-border bg-background p-4 text-xs text-muted-foreground">
                    {tr.noSlots}
                  </p>
                ) : (
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      {tr.pickDay}
                    </p>
                    <div className="mb-4 flex flex-wrap gap-2">
                      {shownDays.map((d) => (
                        <button
                          key={d}
                          onClick={() => {
                            setDay(d);
                            setChosen(null);
                            setError(null);
                          }}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                            d === activeDay
                              ? 'border-foreground bg-foreground text-background'
                              : 'border-border bg-background text-foreground hover:border-foreground/40'
                          }`}
                        >
                          {shortDayLabel(d)}
                        </button>
                      ))}
                      {days.length > shownDays.length ? (
                        <button
                          onClick={() => setAllDays(true)}
                          className="rounded-lg border border-dashed border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
                        >
                          {tr.moreDays}
                        </button>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                    {daySlots.map((s) => {
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
                            <span className="text-sm font-semibold text-foreground">
                              {hhmm(s.start_time)}
                              {s.end_time ? ` – ${hhmm(s.end_time)}` : ''} · {s.title}
                            </span>
                            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-muted-foreground">
                              <Users size={11} /> {seatsLabel(s.seats_left)}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs capitalize text-muted-foreground">
                            {dayLabel(s.scheduled_date)}
                            {s.coach ? ` · ${s.coach}` : ''}
                          </p>
                        </button>
                      );
                    })}
                    {daySlots.length === 0 ? (
                      <p className="rounded-xl border border-border bg-background p-4 text-xs text-muted-foreground">
                        {tr.noSlotsThatDay}
                      </p>
                    ) : null}
                    </div>
                    {allDays && days.length > FIRST_DAYS ? (
                      <p className="mt-3 text-[11px] text-muted-foreground">{tr.horizonAll}</p>
                    ) : null}
                  </div>
                )}

                {error && <p className="mt-3 text-xs font-semibold text-red-500">{error}</p>}

                <div className="mt-4 flex shrink-0 gap-3 border-t border-border bg-card pt-4">
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
              </div>
            )}

            {step === 'done' && booked && (
              <div className="overflow-y-auto">
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
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
