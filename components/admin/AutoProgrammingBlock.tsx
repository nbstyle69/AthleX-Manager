'use client';

import { useState } from 'react';
import { Save, Sparkles } from 'lucide-react';
import {
  DOW_LABEL, TRACKS, TRACK_LABEL,
  type RevealSettings, type Track,
} from '@/lib/autoProgramming';
import { Button } from '@/components/ui/button';

const TRACK_DESC: Record<Track, string> = {
  functional: 'Six séances lundi → samedi, autour de 60 minutes.',
  hybrid: 'Six séances orientées course, stations et simulation, plus une séance test de 75 minutes toutes les huit semaines.',
  musculation: 'Cinq séances, objectif tournant sur un cycle de six semaines.',
};

/**
 * Programmation automatique d'une box, dans sa fiche d'administration.
 *
 * Le réglage vit ici et pas dans la liste : il comporte cinq contrôles et se
 * décide box par box, comme les formats de tournoi autorisés — la liste, elle,
 * se parcourt, et n'a besoin que de dire lesquelles sont concernées.
 *
 * `boxes.auto_programming` et `auto_programming_tracks` sont fermés par le
 * trigger `boxes_auto_programming_guard` : l'écriture passe par
 * `PATCH /api/admin/boxes/[id]/auto-programming`, qui revérifie le rôle et
 * écrit en service role. Une écriture depuis le client serait refusée par la
 * base — et doit l'être.
 */
export default function AutoProgrammingBlock({
  boxId, enabled: currentEnabled, tracks: currentTracks, reveal: currentReveal, onSaved,
}: {
  boxId: string;
  enabled: boolean;
  tracks: Track[];
  reveal: RevealSettings;
  onSaved: () => void;
}) {
  const [enabled, setEnabled] = useState(currentEnabled);
  const [tracks, setTracks] = useState<Track[]>(currentTracks);
  const [reveal, setReveal] = useState<RevealSettings>(currentReveal);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = enabled !== currentEnabled
    || tracks.length !== currentTracks.length
    || tracks.some(t => !currentTracks.includes(t))
    || reveal.mode !== currentReveal.mode
    || reveal.dow !== currentReveal.dow
    || reveal.time !== currentReveal.time;

  // Une box allumée sans piste ne générerait rien : la route la refuse, on le
  // dit avant de laisser cliquer.
  const invalid = enabled && tracks.length === 0;

  function toggleTrack(t: Track) {
    setTracks(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/boxes/${boxId}/auto-programming`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auto_programming: enabled,
          tracks,
          reveal_mode: reveal.mode,
          reveal_dow: reveal.dow,
          reveal_time: reveal.time,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? `Erreur ${res.status}`);
        return;
      }
      // La migration `20261221` peut ne pas être appliquée : le dire plutôt que
      // d'afficher un réglage qui n'a pas été enregistré.
      setMsg(json.reveal_saved === false
        ? 'Interrupteur et pistes enregistrés — la révélation attend la migration 20261221.'
        : 'Sauvegardé');
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-ax-surface border border-ax-border rounded-ax-card p-6 space-y-3" data-testid={`auto-programming-${boxId}`}>
      <h3 className="text-sm font-bold text-ax-text-secondary uppercase tracking-wider flex items-center gap-2">
        <Sparkles size={14} /> Programmation automatique
      </h3>
      <p className="text-xs text-ax-text-secondary">
        Réservée à l&apos;administration de la plateforme. Quand elle est active, la semaine suivante
        est générée chaque samedi 8h pour les pistes cochées.
      </p>

      <label className="flex items-center justify-between gap-3 p-3 rounded-ax-control border border-ax-border cursor-pointer">
        <span className="text-sm font-bold text-ax-text">Générer les semaines automatiquement</span>
        <input
          type="checkbox"
          checked={enabled}
          data-testid={`auto-switch-${boxId}`}
          onChange={e => {
            const on = e.target.checked;
            setEnabled(on);
            // Allumer sans piste ne génère rien : on propose les deux.
            if (on && tracks.length === 0) setTracks([...TRACKS]);
          }}
          className="w-4 h-4 shrink-0 accent-[var(--ax-accent-text)]"
        />
      </label>

      {enabled && (
        <>
          <div className="space-y-2">
            {TRACKS.map(t => {
              const on = tracks.includes(t);
              return (
                <label
                  key={t}
                  className={`flex items-start gap-3 p-3 rounded-ax-control border cursor-pointer transition-colors ${
                    on ? 'border-ax-accent-text bg-ax-accent-soft' : 'border-ax-border hover:border-ax-input-border'}`}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    data-testid={`auto-track-${t}-${boxId}`}
                    onChange={() => toggleTrack(t)}
                    className="mt-0.5 w-4 h-4 shrink-0 accent-[var(--ax-accent-text)]"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-ax-text">{TRACK_LABEL[t]}</div>
                    <div className="text-xs text-ax-text-secondary">{TRACK_DESC[t]}</div>
                  </div>
                </label>
              );
            })}
          </div>

          <div className="p-3 rounded-ax-control border border-ax-border space-y-2">
            <p className="text-sm font-bold text-ax-text">Révélation aux athlètes</p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-ax-text-secondary">
              <select
                value={reveal.mode}
                data-testid={`auto-reveal-mode-${boxId}`}
                onChange={e => setReveal(r => ({ ...r, mode: e.target.value as RevealSettings['mode'] }))}
                className={FIELD}
              >
                <option value="daily">chaque jour</option>
                <option value="weekly">une fois par semaine</option>
              </select>
              {reveal.mode === 'weekly' && (
                <select
                  value={reveal.dow}
                  data-testid={`auto-reveal-dow-${boxId}`}
                  onChange={e => setReveal(r => ({ ...r, dow: Number(e.target.value) }))}
                  className={FIELD}
                >
                  {DOW_LABEL.map((label, i) => (
                    <option key={label} value={i}>le {label}</option>
                  ))}
                </select>
              )}
              <span>à</span>
              <input
                type="time"
                value={reveal.time}
                data-testid={`auto-reveal-time-${boxId}`}
                onChange={e => setReveal(r => ({ ...r, time: e.target.value }))}
                className={FIELD}
              />
            </div>
            <p className="text-xs text-ax-text-secondary">
              {reveal.mode === 'daily'
                ? 'Chaque séance apparaît le jour où elle a lieu.'
                : 'Toute la semaine apparaît d’un coup, le jour choisi qui précède le lundi visé.'}
            </p>
          </div>
        </>
      )}

      {invalid && (
        <p className="text-xs text-ax-warning">Coche au moins une piste, sinon rien ne sera généré.</p>
      )}
      {error && <p className="text-xs text-ax-danger" data-testid={`auto-error-${boxId}`}>{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        {msg && <span className="text-xs text-ax-text-secondary">{msg}</span>}
        <Button
          variant="ax-mint"
          onClick={() => void save()}
          disabled={!dirty || saving || invalid}
          data-testid={`auto-save-${boxId}`}
          className="ml-auto"
        >
          <Save size={14} /> {saving ? 'Sauvegarde...' : 'Enregistrer'}
        </Button>
      </div>
    </div>
  );
}

// Listes et heure : même champ que le reste de l'app (fond de surface, bordure de saisie).
const FIELD = 'rounded-ax-control border border-ax-input-border bg-ax-surface px-2 py-1.5 text-sm text-ax-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus';
