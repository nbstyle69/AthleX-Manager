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
    'w-full rounded-ax-control border border-ax-border bg-ax-background px-3 py-2.5 text-sm text-ax-text outline-none focus:border-ax-focus';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-ax-control bg-ax-text px-4 py-2 text-xs font-bold text-ax-background transition-opacity hover:opacity-90"
      >
        <CalendarCheck size={14} /> {tr.cta}
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ax-overlay p-4 backdrop-blur-sm">
          <div className="relative flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-ax-card border border-ax-border bg-ax-surface p-6">
            <button
              onClick={reset}
              className="absolute right-4 top-4 text-ax-text-secondary transition-colors hover:text-ax-text"
              aria-label={tr.close}
            >
              <X size={18} />
            </button>

            {step === 'form' && (
              <div className="overflow-y-auto">
                <h3 className="mb-1 font-display text-lg font-bold">{planName}</h3>
                <p className="mb-5 text-xs text-ax-text-secondary">{tr.formHint}</p>
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
                {error && <p className="mt-3 text-xs font-semibold text-ax-danger">{error}</p>}
                <button
                  onClick={loadSlots}
                  disabled={busy}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-ax-control bg-ax-text px-4 py-3 text-sm font-bold text-ax-background disabled:opacity-50"
                >
                  {busy ? <Loader2 size={15} className="animate-spin" /> : null}
                  {busy ? tr.loading : tr.next}
                </button>
              </div>
            )}

            {step === 'slots' && (
              <div className="flex min-h-0 flex-1 flex-col">
                <h3 className="mb-1 font-display text-lg font-bold">{tr.slotsTitle}</h3>
                <p className="mb-4 text-xs text-ax-text-secondary">{tr.slotsHint}</p>

                {slots.length === 0 ? (
                  <p className="rounded-ax-control border border-ax-border bg-ax-background p-4 text-xs text-ax-text-secondary">
                    {tr.noSlots}
                  </p>
                ) : (
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ax-text-secondary">
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
                          className={`rounded-ax-control border px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                            d === activeDay
                              ? 'border-ax-text bg-ax-text text-ax-background'
                              : 'border-ax-border bg-ax-background text-ax-text hover:border-ax-input-border'
                          }`}
                        >
                          {shortDayLabel(d)}
                        </button>
                      ))}
                      {days.length > shownDays.length ? (
                        <button
                          onClick={() => setAllDays(true)}
                          className="rounded-ax-control border border-dashed border-ax-border px-3 py-1.5 text-xs font-semibold text-ax-text-secondary hover:text-ax-text"
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
                          className={`w-full rounded-ax-control border p-3 text-left transition-colors ${
                            active
                              ? 'border-ax-text bg-ax-hover'
                              : 'border-ax-border bg-ax-background hover:border-ax-input-border'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-semibold text-ax-text">
                              {hhmm(s.start_time)}
                              {s.end_time ? ` – ${hhmm(s.end_time)}` : ''} · {s.title}
                            </span>
                            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-ax-text-secondary">
                              <Users size={11} /> {seatsLabel(s.seats_left)}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs capitalize text-ax-text-secondary">
                            {dayLabel(s.scheduled_date)}
                            {s.coach ? ` · ${s.coach}` : ''}
                          </p>
                        </button>
                      );
                    })}
                    {daySlots.length === 0 ? (
                      <p className="rounded-ax-control border border-ax-border bg-ax-background p-4 text-xs text-ax-text-secondary">
                        {tr.noSlotsThatDay}
                      </p>
                    ) : null}
                    </div>
                    {allDays && days.length > FIRST_DAYS ? (
                      <p className="mt-3 text-[11px] text-ax-text-secondary">{tr.horizonAll}</p>
                    ) : null}
                  </div>
                )}

                {error && <p className="mt-3 text-xs font-semibold text-ax-danger">{error}</p>}

                <div className="mt-4 flex shrink-0 gap-3 border-t border-ax-border bg-ax-surface pt-4">
                  <button
                    onClick={() => setStep('form')}
                    className="rounded-ax-control border border-ax-border px-4 py-3 text-sm font-bold text-ax-text"
                  >
                    {tr.back}
                  </button>
                  <button
                    onClick={book}
                    disabled={busy || !chosen}
                    className="flex flex-1 items-center justify-center gap-2 rounded-ax-control bg-ax-text px-4 py-3 text-sm font-bold text-ax-background disabled:opacity-50"
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
                <p className="text-sm text-ax-text">
                  {tr.successBody
                    .replace('{title}', booked.title)
                    .replace(
                      '{when}',
                      `${dayLabel(booked.scheduled_date)} · ${hhmm(booked.start_time)}`,
                    )}
                </p>
                <p className="mt-2 text-xs text-ax-text-secondary">
                  {mailSent ? tr.successMail : tr.successNoMail}
                </p>
                <button
                  onClick={reset}
                  className="mt-5 w-full rounded-ax-control bg-ax-text px-4 py-3 text-sm font-bold text-ax-background"
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
