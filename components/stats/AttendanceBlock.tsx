'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, CalendarCheck, ChevronDown, Loader2, UserCheck, UserPlus, Users,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Delta from './Delta';
import { countOf } from '@/lib/plural';

interface AttendanceSummary {
  classes_count: number;
  capacity_total: number;
  reservations_count: number;
  waiting_count: number;
  marked_count: number;
  attended_count: number;
  members_active: number;
  members_ever_booked: number;
  members_at_risk: number;
  members_never_booked: number;
}

interface PersonRow {
  kind: 'at_risk' | 'never_booked';
  member_id: string;
  username: string;
  last_class: string | null;
  reservations_total: number;
  joined_at: string | null;
}

interface HeatCell {
  dow: number;
  hour: number;
  reservations: number;
}

const DOW = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const WINDOW_DAYS = 30;
const RISK_DAYS = 14;

const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : 0);

const dayString = (offset: number) =>
  new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

const SINCE = (iso: string | null) => {
  if (!iso) return 'jamais venu';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return `dernière venue il y a ${days} j`;
};

/**
 * Bloc « Assiduité » de la page Statistiques.
 *
 * Deux populations distinctes, deux actions distinctes : un membre « à risque »
 * a déjà réservé et ne vient plus (on le relance) ; un membre « jamais venu via
 * l'app » n'a jamais réservé (on l'embarque). Les confondre produirait, sur une
 * box qui démarre la réservation en ligne, un mur rouge sans action associée.
 *
 * Le taux de présence est rapporté aux réservations POINTÉES, et le taux de
 * pointage est affiché à côté : sans lui, une box qui ne pointe pas lirait sa
 * fréquentation comme une désertion.
 */
export default function AttendanceBlock({ boxId }: { boxId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<AttendanceSummary | null>(null);
  const [previous, setPrevious] = useState<AttendanceSummary | null>(null);
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [heat, setHeat] = useState<HeatCell[]>([]);
  const [openList, setOpenList] = useState<'at_risk' | 'never_booked' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const args = (from: number, to: number) => ({
      p_box_id: boxId,
      p_from: dayString(from),
      p_to: dayString(to),
    });

    const [curRes, prevRes, peopleRes, heatRes] = await Promise.all([
      supabase.rpc('get_box_attendance_summary', args(-WINDOW_DAYS, 1)),
      supabase.rpc('get_box_attendance_summary', args(-2 * WINDOW_DAYS, -WINDOW_DAYS)),
      supabase.rpc('get_box_attendance_people', { p_box_id: boxId, p_risk_days: RISK_DAYS }),
      supabase.rpc('get_box_reservation_heatmap', args(-WINDOW_DAYS, 1)),
    ]);

    const firstError = curRes.error ?? prevRes.error ?? peopleRes.error ?? heatRes.error;
    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    const one = (data: unknown) =>
      (Array.isArray(data) ? data[0] : data) as AttendanceSummary | undefined;
    setCurrent(one(curRes.data) ?? null);
    setPrevious(one(prevRes.data) ?? null);
    setPeople((peopleRes.data ?? []) as PersonRow[]);
    setHeat((heatRes.data ?? []) as HeatCell[]);
    setLoading(false);
  }, [boxId, supabase]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="bg-ax-surface border border-ax-border rounded-ax-card p-6 flex items-center gap-3">
        <Loader2 size={16} className="animate-spin text-ax-text" />
        <span className="text-sm text-ax-text-secondary">Chargement de l&apos;assiduité…</span>
      </div>
    );
  }

  if (error || !current || !previous) {
    return (
      <div className="bg-ax-danger-soft border border-ax-danger rounded-ax-card p-5">
        <p className="text-sm font-bold text-ax-danger flex items-center gap-2">
          <AlertTriangle size={16} /> Assiduité indisponible
        </p>
        <p className="text-xs text-ax-danger mt-1">{error ?? 'Réponse vide du serveur.'}</p>
      </div>
    );
  }

  const fill = pct(current.reservations_count, current.capacity_total);
  const prevFill = pct(previous.reservations_count, previous.capacity_total);
  const presence = pct(current.attended_count, current.marked_count);
  const prevPresence = pct(previous.attended_count, previous.marked_count);
  const marking = pct(current.marked_count, current.reservations_count);
  const prevMarking = pct(previous.marked_count, previous.reservations_count);

  const atRisk = people.filter(p => p.kind === 'at_risk');
  const neverBooked = people.filter(p => p.kind === 'never_booked');

  const hours = [...new Set(heat.map(h => h.hour))].sort((a, b) => a - b);
  const maxCell = Math.max(...heat.map(h => h.reservations), 1);
  const cellAt = (dow: number, hour: number) =>
    heat.find(h => h.dow === dow && h.hour === hour)?.reservations ?? 0;

  const cards = [
    {
      key: 'fill',
      label: 'Remplissage des cours',
      value: `${fill} %`,
      sub: `${countOf(current.reservations_count, 'réservation', 'réservations')} / ${countOf(current.capacity_total, 'place', 'places')}`,
      icon: CalendarCheck,
      delta: <Delta current={fill} previous={prevFill} />,
    },
    {
      key: 'presence',
      label: 'Présence réelle',
      value: current.marked_count === 0 ? '—' : `${presence} %`,
      sub: current.marked_count === 0
        ? 'aucun appel fait sur la période'
        : `${countOf(current.attended_count, 'présent', 'présents')} sur ${countOf(current.marked_count, 'pointé', 'pointés')}`,
      icon: UserCheck,
      delta: current.marked_count === 0 || previous.marked_count === 0
        ? null
        : <Delta current={presence} previous={prevPresence} />,
    },
    {
      key: 'marking',
      label: 'Taux de pointage',
      value: `${marking} %`,
      sub: `${countOf(current.marked_count, 'appel', 'appels')} sur ${countOf(current.reservations_count, 'réservation', 'réservations')}`,
      icon: Users,
      delta: <Delta current={marking} previous={prevMarking} />,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-bold text-ax-text flex items-center gap-2">
          <CalendarCheck size={16} className="text-ax-text" />
          Assiduité
        </h2>
        <span className="text-[11px] text-ax-text-muted">
          {WINDOW_DAYS} derniers jours · vs {WINDOW_DAYS} jours précédents
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {cards.map(({ key, label, value, sub, icon: Icon, delta }) => (
          <div key={key} className="bg-ax-surface border border-ax-border rounded-ax-card p-4">
            <div className="flex items-start justify-between">
              <Icon size={16} className="text-ax-text-secondary" />
              {delta}
            </div>
            <p className="text-2xl font-black text-ax-text mt-3">{value}</p>
            <p className="text-[11px] text-ax-text-secondary font-medium mt-1">{label}</p>
            <p className="text-[10px] text-ax-text-muted mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Les deux populations, nominatives et dépliables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {([
          {
            kind: 'at_risk' as const,
            title: 'Membres à risque',
            hint: `déjà venus, plus rien depuis ${RISK_DAYS} jours — à relancer`,
            rows: atRisk,
            icon: AlertTriangle,
            tone: 'text-ax-danger',
          },
          {
            kind: 'never_booked' as const,
            title: "Jamais venus via l'app",
            hint: "aucune réservation depuis l'inscription — à embarquer",
            rows: neverBooked,
            icon: UserPlus,
            tone: 'text-ax-warning',
          },
        ]).map(({ kind, title, hint, rows, icon: Icon, tone }) => (
          <div key={kind} className="bg-ax-surface border border-ax-border rounded-ax-card overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenList(openList === kind ? null : kind)}
              disabled={rows.length === 0}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-ax-hover disabled:hover:bg-transparent disabled:cursor-default transition-colors"
            >
              <div className="text-left">
                <p className="text-xs font-bold text-ax-text-secondary flex items-center gap-1.5">
                  <Icon size={13} className={rows.length > 0 ? tone : 'text-ax-text-muted'} />
                  {title}
                </p>
                <p className={`text-xl font-black mt-1 ${rows.length > 0 ? tone : 'text-ax-text-muted'}`}>
                  {rows.length} <span className="text-xs font-bold text-ax-text-muted">
                    / {countOf(current.members_active, 'adhérent', 'adhérents')}
                  </span>
                </p>
                <p className="text-[10px] text-ax-text-muted mt-0.5">{hint}</p>
              </div>
              {rows.length > 0 && (
                <ChevronDown size={16} className={`text-ax-text-muted transition-transform ${openList === kind ? 'rotate-180' : ''}`} />
              )}
            </button>

            {openList === kind && rows.length > 0 && (
              <div className="border-t border-ax-border divide-y divide-ax-border max-h-80 overflow-y-auto">
                {rows.map(p => (
                  <div key={p.member_id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ax-text truncate">{p.username}</p>
                      <p className="text-[11px] text-ax-text-muted truncate">
                        {SINCE(p.last_class)} · {countOf(p.reservations_total, 'réservation', 'réservations')} au total
                      </p>
                    </div>
                    <Link
                      href={`/members?q=${encodeURIComponent(p.username)}`}
                      className="text-[11px] font-bold text-ax-text bg-ax-hover hover:brightness-110 rounded-ax-control px-2.5 py-1.5 shrink-0 transition-colors"
                    >
                      Voir la fiche
                    </Link>
                  </div>
                ))}
                <Link href="/messages/new" className="block px-5 py-3 text-xs font-bold text-ax-text hover:bg-ax-hover transition-colors">
                  {kind === 'at_risk' ? 'Envoyer un message de relance' : 'Envoyer un message d\u2019accueil'} →
                </Link>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Heatmap jour × heure */}
      <div className="bg-ax-surface border border-ax-border rounded-ax-card p-6">
        <h3 className="text-sm font-bold text-ax-text mb-1">Quand la salle est pleine</h3>
        <p className="text-[11px] text-ax-text-muted mb-5">
          Réservations confirmées par jour et par heure de cours, sur {WINDOW_DAYS} jours.
        </p>
        {hours.length === 0 ? (
          <p className="text-xs text-ax-text-muted py-6 text-center">Aucune réservation sur la période.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="border-separate border-spacing-1">
              <thead>
                <tr>
                  <th />
                  {hours.map(h => (
                    <th key={h} className="text-[10px] font-medium text-ax-text-muted px-1">
                      {String(h).padStart(2, '0')}h
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DOW.map((label, i) => (
                  <tr key={label}>
                    <td className="text-[10px] font-medium text-ax-text-muted pr-2">{label}</td>
                    {hours.map(h => {
                      const n = cellAt(i + 1, h);
                      // Chiffre AA sur son fond dans les deux thèmes : texte
                      // normal sur cellule faible, inversé sur cellule forte
                      // (le fond des fortes est relevé hors de la zone grise).
                      const brut = 0.15 + (n / maxCell) * 0.75;
                      const forte = brut >= 0.35;
                      const intensite = forte ? Math.max(brut, 0.65) : brut;
                      return (
                        <td key={h}>
                          <div
                            title={`${label} ${String(h).padStart(2, '0')}h · ${countOf(n, 'réservation', 'réservations')}`}
                            className="w-8 h-6 rounded-md flex items-center justify-center text-[10px] font-bold"
                            style={{
                              backgroundColor: n === 0 ? 'var(--ax-hover)' : `color-mix(in srgb, var(--ax-text) ${Math.round(intensite * 100)}%, transparent)`,
                              color: forte && n > 0 ? 'var(--ax-background)' : 'var(--ax-text)',
                            }}
                          >
                            {n > 0 ? n : ''}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {current.waiting_count > 0 && (
          <p className="text-[10px] text-ax-text-muted mt-3">
            {countOf(current.waiting_count, 'réservation', 'réservations')} en liste d&apos;attente sur la période : des créneaux
            manquent de places, pas de monde.
          </p>
        )}
      </div>
    </div>
  );
}
