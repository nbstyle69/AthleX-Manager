'use client';

import { useState } from 'react';
import { CalendarPlus, RefreshCw, Sparkles, AlertTriangle } from 'lucide-react';
import {
  everyTrackDone, isoWeekOf, revealLabel, trackChoices, trackListLabel, weekDayLabel,
  GENERATION_LABEL, REGEN_CONFIRM_WORD, TRACK_LABEL,
  type AutoRun, type RevealSettings, type Track,
} from '@/lib/autoProgramming';

/**
 * Marque discrète d'une carte posée par la génération automatique.
 *
 * « modifiée » suit `box_wods.edited_at`, posé par le trigger
 * `box_wods_mark_edited` dès qu'une main humaine touche la ligne — y compris
 * un simple déplacement de jour ou un changement de publication. C'est voulu :
 * la box a pris la main sur ce jour, et la régénération le conservera.
 *
 * Le badge n'existe que dans le Manager : l'app athlète ne change pas.
 */
export function AutoBadge({ wod }: { wod: { source?: string | null; edited_at?: string | null } }) {
  if (wod.source !== 'auto') return null;
  const edited = !!wod.edited_at;
  return (
    <span
      data-testid={edited ? 'badge-auto-modifiee' : 'badge-auto'}
      title={edited
        ? 'Posée automatiquement, puis modifiée : la régénération la conservera'
        : 'Posée par la programmation automatique'}
      className={`text-[8px] font-black tracking-wider px-1 py-0.5 rounded shrink-0 ${
        edited ? 'text-amber-300 bg-amber-500/15' : 'text-emerald-300 bg-emerald-500/15'}`}
    >
      {edited ? 'AUTO · MODIFIÉE' : 'AUTO'}
    </span>
  );
}

type Mode = 'next' | 'regen';

/**
 * Bandeau du Whiteboard d'une box en programmation automatique.
 *
 * Il dit trois choses que le gérant ne peut pas déduire des cartes : que la
 * semaine est générée, quand elle se pose, et quand ses athlètes la verront.
 *
 * Les deux boutons agissent sur **la semaine affichée**, la nomment, et
 * ouvrent une confirmation avec **une case par piste active**, toutes cochées
 * par défaut. Seules les pistes cochées sont envoyées : la fonction (v8) borne
 * la génération à ce qu'on lui demande. Une case qui n'aurait pas cet effet
 * serait une interface qui ment — c'est pour ça que ce choix n'existait pas
 * avant que la fonction sache le respecter.
 *
 * Tout passe par `/api/box/[id]/auto-programming/run` : le secret de la
 * fonction est côté serveur, jamais ici.
 */
export default function AutoProgrammingBanner({
  boxId, tracks, reveal, runs, displayedMonday, onRan,
}: {
  boxId: string;
  tracks: Track[];
  reveal: RevealSettings;
  runs: AutoRun[];
  /** Lundi (ISO) de la semaine affichée : cible des deux boutons. */
  displayedMonday: string;
  onRan: (message: string) => void;
}) {
  const [busy, setBusy] = useState<Mode | null>(null);
  const [confirm, setConfirm] = useState<Mode | null>(null);
  const [chosen, setChosen] = useState<Track[]>([]);
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const week = isoWeekOf(displayedMonday);
  const weekLabel = weekDayLabel(displayedMonday);
  const alreadyGenerated = everyTrackDone(runs, tracks, week);
  const choices = confirm ? trackChoices(confirm, runs, tracks, week) : [];
  const wordOk = confirm !== 'regen' || confirmText.trim().toUpperCase() === REGEN_CONFIRM_WORD;
  const canSubmit = chosen.length > 0 && wordOk && busy === null;

  function open(mode: Mode) {
    // Toutes les cases cochables sont cochées d'emblée : le cas courant est
    // « tout », la case sert à retirer une piste, pas à en ajouter une.
    setChosen(trackChoices(mode, runs, tracks, week).filter(c => c.enabled).map(c => c.track));
    setConfirmText('');
    setError(null);
    setConfirm(mode);
  }

  function close() {
    setConfirm(null);
    setChosen([]);
    setConfirmText('');
  }

  function toggle(track: Track) {
    setChosen(prev => prev.includes(track) ? prev.filter(t => t !== track) : [...prev, track]);
  }

  async function run(mode: Mode) {
    setBusy(mode);
    setError(null);
    try {
      const res = await fetch(`/api/box/${boxId}/auto-programming/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, iso_year: week.iso_year, iso_week: week.iso_week, tracks: chosen }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) {
        setError((json.errors ?? []).join(' · ') || json.error || `Erreur ${res.status}`);
        return;
      }
      const inserted = json.inserted ?? 0;
      const kept = (json.kept_days ?? []).length;
      onRan(
        `Semaine du ${weekLabel}, ${trackListLabel(chosen)} : ${inserted} séance${inserted > 1 ? 's' : ''} posée${inserted > 1 ? 's' : ''}`
        + (kept > 0 ? ` · ${kept} jour${kept > 1 ? 's' : ''} conservé${kept > 1 ? 's' : ''} (score ou modification)` : '')
        + (json.kept > 0 && inserted === 0 ? ' · elle était déjà générée' : ''),
      );
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2" data-testid="banniere-auto-programmation">
      <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] px-4 py-3">
        <Sparkles size={15} className="shrink-0 mt-0.5 text-emerald-400" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-300">
            Semaine générée automatiquement · générée {GENERATION_LABEL} ·{' '}
            <span className="text-white font-semibold">visible par les athlètes {revealLabel(reveal)}</span>
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {tracks.length > 0 ? trackListLabel(tracks) : 'Aucune piste active'}
          </p>
          {error && !confirm && <p className="text-xs text-red-400 mt-1.5" data-testid="auto-run-error">{error}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => open('next')}
            disabled={busy !== null || alreadyGenerated}
            data-testid="auto-generer"
            title={alreadyGenerated
              ? `La semaine du ${weekLabel} est déjà générée pour toutes les pistes`
              : `Générer la semaine du ${weekLabel}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-white/10 text-gray-300 hover:text-white hover:border-white/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <CalendarPlus size={13} />
            {busy === 'next' ? 'Génération...' : `Générer la semaine du ${weekLabel}`}
          </button>
          <button
            type="button"
            onClick={() => open('regen')}
            disabled={busy !== null}
            data-testid="auto-regenerer"
            title={`Régénérer la semaine du ${weekLabel}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-white/10 text-gray-300 hover:text-white hover:border-white/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw size={13} /> Régénérer la semaine du {weekLabel}
          </button>
        </div>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111111] border border-white/[0.08] rounded-2xl p-6 w-full max-w-md space-y-4" data-testid={`confirmation-${confirm}`}>
            <div className="flex items-center gap-2">
              {confirm === 'regen'
                ? <AlertTriangle size={18} className="text-amber-400" />
                : <CalendarPlus size={18} className="text-emerald-400" />}
              <h2 className="text-lg font-black text-white">
                {confirm === 'regen' ? 'Régénérer' : 'Générer'} la semaine du {weekLabel} ?
              </h2>
            </div>

            <p className="text-sm text-gray-300">
              {confirm === 'regen'
                ? 'Les séances des pistes cochées vont être retirées et remplacées.'
                : 'Les séances des pistes cochées vont être posées sur la semaine.'}
            </p>

            <fieldset className="space-y-2" data-testid="choix-pistes">
              <legend className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Pistes</legend>
              {choices.map(({ track, enabled, reason }) => (
                <label
                  key={track}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border transition-colors ${
                    !enabled ? 'opacity-40 cursor-not-allowed border-white/5'
                      : chosen.includes(track) ? 'border-emerald-500/40 bg-emerald-500/5 cursor-pointer'
                        : 'border-white/10 bg-white/[0.02] hover:border-white/20 cursor-pointer'}`}
                >
                  <input
                    type="checkbox"
                    checked={chosen.includes(track)}
                    disabled={!enabled}
                    onChange={() => toggle(track)}
                    data-testid={`piste-${track}`}
                    className="w-4 h-4 accent-emerald-500"
                  />
                  <span className="text-sm font-bold text-white">{TRACK_LABEL[track]}</span>
                  {reason && <span className="text-[11px] text-gray-500 ml-auto">{reason}</span>}
                </label>
              ))}
            </fieldset>

            {confirm === 'regen' && (
              <>
                <p className="text-sm text-emerald-300">
                  Les jours qui ont déjà un score, ou que tu as modifiés à la main, sont conservés :
                  ils ne seront ni supprimés ni remplacés.
                </p>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                    Tape {REGEN_CONFIRM_WORD} pour confirmer
                  </label>
                  <input
                    value={confirmText}
                    onChange={e => setConfirmText(e.target.value)}
                    autoFocus
                    placeholder={REGEN_CONFIRM_WORD}
                    data-testid="auto-regenerer-saisie"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </>
            )}

            {error && <p className="text-xs text-red-400" data-testid="auto-run-error">{error}</p>}

            <div className="flex items-center gap-3">
              <button
                onClick={close}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm font-bold hover:text-white transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => void run(confirm)}
                disabled={!canSubmit}
                data-testid={confirm === 'regen' ? 'auto-regenerer-confirmer' : 'auto-generer-confirmer'}
                title={chosen.length === 0 ? 'Coche au moins une piste'
                  : !wordOk ? `Tape ${REGEN_CONFIRM_WORD} pour activer` : undefined}
                className={`flex-1 py-2.5 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed text-sm font-bold transition-colors ${
                  confirm === 'regen' ? 'bg-amber-500 hover:bg-amber-600 text-black' : 'bg-emerald-500 hover:bg-emerald-600 text-white'}`}
              >
                {busy ? (confirm === 'regen' ? 'Régénération...' : 'Génération...')
                  : `${confirm === 'regen' ? 'Régénérer' : 'Générer'} ${chosen.length > 0 ? trackListLabel(chosen) : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
