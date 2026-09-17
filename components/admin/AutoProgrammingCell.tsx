'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import {
  DOW_LABEL, TRACKS, TRACK_LABEL,
  type RevealSettings, type Track,
} from '@/lib/autoProgramming';

/**
 * Programmation automatique d'une box, dans la liste `/admin/boxes`.
 *
 * L'interrupteur, les pistes et le réglage de révélation passent tous par
 * `PATCH /api/admin/boxes/[id]/auto-programming` : les colonnes sont fermées
 * par le trigger `boxes_auto_programming_guard`, une écriture depuis le client
 * serait refusée par la base — et doit l'être.
 */
export default function AutoProgrammingCell({
  boxId, enabled, tracks, reveal, onSaved,
}: {
  boxId: string;
  enabled: boolean;
  tracks: Track[];
  reveal: RevealSettings;
  onSaved: (patch: { enabled: boolean; tracks: Track[]; reveal: RevealSettings }) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function save(next: { enabled: boolean; tracks: Track[]; reveal: RevealSettings }) {
    setSaving(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch(`/api/admin/boxes/${boxId}/auto-programming`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auto_programming: next.enabled,
          tracks: next.tracks,
          reveal_mode: next.reveal.mode,
          reveal_dow: next.reveal.dow,
          reveal_time: next.reveal.time,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? `Erreur ${res.status}`);
        return;
      }
      // La migration `20261221` (réglage de révélation) peut ne pas être
      // appliquée : le dire plutôt que d'afficher un réglage non enregistré.
      if (json.reveal_saved === false) {
        setNote("Interrupteur et pistes enregistrés. Le réglage de révélation attend la migration 20261221.");
      }
      onSaved(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const toggleTrack = (t: Track) => {
    const next = tracks.includes(t) ? tracks.filter(x => x !== t) : [...tracks, t];
    // Une box allumée sans piste ne générerait rien : la route la refuse.
    if (enabled && next.length === 0) {
      setError('Une box allumée doit garder au moins une piste.');
      return;
    }
    void save({ enabled, tracks: next, reveal });
  };

  return (
    <div
      className="space-y-2 mt-4 pt-3 border-t border-white/[0.04]"
      data-testid={`auto-programming-${boxId}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[10px] text-gray-500 uppercase tracking-wider font-bold">
          <Sparkles size={11} className={enabled ? 'text-emerald-400' : 'text-gray-600'} />
          Programmation automatique
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={saving}
          data-testid={`auto-switch-${boxId}`}
          onClick={() => void save({
            enabled: !enabled,
            // Allumer une box sans piste ne génère rien : on propose les deux.
            tracks: !enabled && tracks.length === 0 ? [...TRACKS] : tracks,
            reveal,
          })}
          className={`relative w-9 h-5 rounded-full transition-colors disabled:opacity-50 ${
            enabled ? 'bg-emerald-500' : 'bg-white/10'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
            enabled ? 'left-4.5' : 'left-0.5'}`} style={{ left: enabled ? 18 : 2 }} />
        </button>
      </div>

      {enabled && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            {TRACKS.map(t => (
              <label key={t} className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tracks.includes(t)}
                  disabled={saving}
                  data-testid={`auto-track-${t}-${boxId}`}
                  onChange={() => toggleTrack(t)}
                  className="accent-emerald-500"
                />
                {TRACK_LABEL[t]}
              </label>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
            <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500">Révélation</span>
            <select
              value={reveal.mode}
              disabled={saving}
              data-testid={`auto-reveal-mode-${boxId}`}
              onChange={e => void save({
                enabled, tracks,
                reveal: { ...reveal, mode: e.target.value as RevealSettings['mode'] },
              })}
              className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
            >
              <option value="daily" className="text-black">chaque jour</option>
              <option value="weekly" className="text-black">une fois par semaine</option>
            </select>
            {reveal.mode === 'weekly' && (
              <select
                value={reveal.dow}
                disabled={saving}
                data-testid={`auto-reveal-dow-${boxId}`}
                onChange={e => void save({
                  enabled, tracks, reveal: { ...reveal, dow: Number(e.target.value) },
                })}
                className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
              >
                {DOW_LABEL.map((label, i) => (
                  <option key={label} value={i} className="text-black">le {label}</option>
                ))}
              </select>
            )}
            <span>à</span>
            <input
              type="time"
              value={reveal.time}
              disabled={saving}
              data-testid={`auto-reveal-time-${boxId}`}
              onChange={e => void save({ enabled, tracks, reveal: { ...reveal, time: e.target.value } })}
              className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
            />
          </div>
        </>
      )}

      {error && <p className="text-[11px] text-red-400" data-testid={`auto-error-${boxId}`}>{error}</p>}
      {note && <p className="text-[11px] text-amber-400">{note}</p>}
    </div>
  );
}
