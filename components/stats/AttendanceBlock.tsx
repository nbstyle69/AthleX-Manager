'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, CalendarCheck, ChevronDown, Loader2, UserCheck, UserPlus, Users,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Delta from './Delta';

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
      <div className="bg-[#111111] border border-white/8 rounded-2xl p-6 flex items-center gap-3">
        <Loader2 size={16} className="animate-spin text-white" />
        <span className="text-sm text-gray-400">Chargement de l&apos;assiduité…</span>
      </div>
    );
  }

  if (error || !current || !previous) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5">
        <p className="text-sm font-bold text-red-300 flex items-center gap-2">
          <AlertTriangle size={16} /> Assiduité indisponible
        </p>
        <p className="text-xs text-red-200/80 mt-1">{error ?? 'Réponse vide du serveur.'}</p>
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
      sub: `${current.reservations_count} réservation(s) / ${current.capacity_total} place(s)`,
      icon: CalendarCheck,
      delta: <Delta current={fill} previous={prevFill} />,
    },
    {
      key: 'presence',
      label: 'Présence réelle',
      value: current.marked_count === 0 ? '—' : `${presence} %`,
      sub: current.marked_count === 0
        ? 'aucun appel fait sur la période'
        : `${current.attended_count} présent(s) sur ${current.marked_count} pointé(s)`,
      icon: UserCheck,
      delta: current.marked_count === 0 || previous.marked_count === 0
        ? null
        : <Delta current={presence} previous={prevPresence} />,
    },
    {
      key: 'marking',
      label: 'Taux de pointage',
      value: `${marking} %`,
      sub: `${current.marked_count} appel(s) sur ${current.reservations_count} réservation(s)`,
      icon: Users,
      delta: <Delta current={marking} previous={prevMarking} />,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <CalendarCheck size={16} className="text-white" />
          Assiduité
        </h2>
        <span className="text-[11px] text-gray-500">
          {WINDOW_DAYS} derniers jours · vs {WINDOW_DAYS} jours précédents
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {cards.map(({ key, label, value, sub, icon: Icon, delta }) => (
          <div key={key} className="bg-[#111111] border border-white/8 rounded-2xl p-4">
            <div className="flex items-start justify-between">
              <Icon size={16} className="text-gray-400" />
              {delta}
            </div>
            <p className="text-2xl font-black text-white mt-3">{value}</p>
            <p className="text-[11px] text-gray-400 font-medium mt-1">{label}</p>
            <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>
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
            tone: 'text-red-400',
          },
          {
            kind: 'never_booked' as const,
            title: "Jamais venus via l'app",
            hint: "aucune réservation depuis l'inscription — à embarquer",
            rows: neverBooked,
            icon: UserPlus,
            tone: 'text-amber-400',
          },
        ]).map(({ kind, title, hint, rows, icon: Icon, tone }) => (
          <div key={kind} className="bg-[#111111] border border-white/8 rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenList(openList === kind ? null : kind)}
              disabled={rows.length === 0}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.03] disabled:hover:bg-transparent disabled:cursor-default transition-colors"
            >
              <div className="text-left">
                <p className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
                  <Icon size={13} className={rows.length > 0 ? tone : 'text-gray-600'} />
                  {title}
                </p>
                <p className={`text-xl font-black mt-1 ${rows.length > 0 ? tone : 'text-gray-600'}`}>
                  {rows.length} <span className="text-xs font-bold text-gray-500">
                    / {current.members_active} adhérent(s)
                  </span>
                </p>
                <p className="text-[10px] text-gray-600 mt-0.5">{hint}</p>
              </div>
              {rows.length > 0 && (
                <ChevronDown size={16} className={`text-gray-500 transition-transform ${openList === kind ? 'rotate-180' : ''}`} />
              )}
            </button>

            {openList === kind && rows.length > 0 && (
              <div className="border-t border-white/8 divide-y divide-white/5 max-h-80 overflow-y-auto">
                {rows.map(p => (
                  <div key={p.member_id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{p.username}</p>
                      <p className="text-[11px] text-gray-500 truncate">
                        {SINCE(p.last_class)} · {p.reservations_total} réservation(s) au total
                      </p>
                    </div>
                    <Link
                      href={`/members?q=${encodeURIComponent(p.username)}`}
                      className="text-[11px] font-bold text-white bg-white/10 hover:bg-white/20 rounded-lg px-2.5 py-1.5 shrink-0 transition-colors"
                    >
                      Voir la fiche
                    </Link>
                  </div>
                ))}
                <Link href="/messages/new" className="block px-5 py-3 text-xs font-bold text-white hover:bg-white/[0.03] transition-colors">
                  {kind === 'at_risk' ? 'Envoyer un message de relance' : 'Envoyer un message d\u2019accueil'} →
                </Link>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Heatmap jour × heure */}
      <div className="bg-[#111111] border border-white/8 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-white mb-1">Quand la salle est pleine</h3>
        <p className="text-[11px] text-gray-500 mb-5">
          Réservations confirmées par jour et par heure de cours, sur {WINDOW_DAYS} jours.
        </p>
        {hours.length === 0 ? (
          <p className="text-xs text-gray-600 py-6 text-center">Aucune réservation sur la période.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="border-separate border-spacing-1">
              <thead>
                <tr>
                  <th />
                  {hours.map(h => (
                    <th key={h} className="text-[10px] font-medium text-gray-500 px-1">
                      {String(h).padStart(2, '0')}h
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DOW.map((label, i) => (
                  <tr key={label}>
                    <td className="text-[10px] font-medium text-gray-500 pr-2">{label}</td>
                    {hours.map(h => {
                      const n = cellAt(i + 1, h);
                      return (
                        <td key={h}>
                          <div
                            title={`${label} ${String(h).padStart(2, '0')}h · ${n} réservation(s)`}
                            className="w-8 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white"
                            style={{ backgroundColor: n === 0 ? '#ffffff08' : `rgba(255,255,255,${0.15 + (n / maxCell) * 0.75})` }}
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
          <p className="text-[10px] text-gray-600 mt-3">
            {current.waiting_count} réservation(s) en liste d&apos;attente sur la période : des créneaux
            manquent de places, pas de monde.
          </p>
        )}
      </div>
    </div>
  );
}
