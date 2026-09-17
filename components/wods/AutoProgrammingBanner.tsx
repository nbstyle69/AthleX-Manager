'use client';

import { useState } from 'react';
import { CalendarPlus, RefreshCw, Sparkles, AlertTriangle } from 'lucide-react';
import {
  everyTrackDone, isoWeekOf, revealLabel, weekDayLabel,
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

/**
 * Bandeau du Whiteboard d'une box en programmation automatique.
 *
 * Il dit trois choses que le gérant ne peut pas déduire des cartes : que la
 * semaine est générée, quand elle se pose, et quand ses athlètes la verront.
 *
 * Les deux boutons agissent sur **la semaine affichée**, celle du sélecteur, et
 * la nomment. Viser « la semaine suivante » quoi qu'affiche l'écran laissait le
 * bouton grisé sur une semaine lointaine et vide, où il y avait précisément
 * quelque chose à générer.
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
  const [busy, setBusy] = useState<'next' | 'regen' | null>(null);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const week = isoWeekOf(displayedMonday);
  const weekLabel = weekDayLabel(displayedMonday);
  const alreadyGenerated = everyTrackDone(runs, tracks, week);
  const confirmed = confirmText.trim().toUpperCase() === REGEN_CONFIRM_WORD;

  function closeConfirm() {
    setConfirmRegen(false);
    setConfirmText('');
  }

  async function run(mode: 'next' | 'regen') {
    setBusy(mode);
    setError(null);
    try {
      const res = await fetch(`/api/box/${boxId}/auto-programming/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, iso_year: week.iso_year, iso_week: week.iso_week }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) {
        setError((json.errors ?? []).join(' · ') || json.error || `Erreur ${res.status}`);
        return;
      }
      const inserted = json.inserted ?? 0;
      const kept = (json.kept_days ?? []).length;
      onRan(
        `Semaine du ${weekLabel} : ${inserted} séance${inserted > 1 ? 's' : ''} posée${inserted > 1 ? 's' : ''}`
        + (kept > 0 ? ` · ${kept} jour${kept > 1 ? 's' : ''} conservé${kept > 1 ? 's' : ''} (score ou modification)` : '')
        + (json.kept > 0 && inserted === 0 ? ' · elle était déjà générée' : ''),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      closeConfirm();
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
            {tracks.length > 0
              ? tracks.map(t => TRACK_LABEL[t]).join(' · ')
              : 'Aucune piste active'}
          </p>
          {error && <p className="text-xs text-red-400 mt-1.5" data-testid="auto-run-error">{error}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void run('next')}
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
            onClick={() => setConfirmRegen(true)}
            disabled={busy !== null}
            data-testid="auto-regenerer"
            title={`Régénérer la semaine du ${weekLabel}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-white/10 text-gray-300 hover:text-white hover:border-white/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw size={13} /> Régénérer la semaine du {weekLabel}
          </button>
        </div>
      </div>

      {confirmRegen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111111] border border-white/[0.08] rounded-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-400" />
              <h2 className="text-lg font-black text-white">Régénérer la semaine du {weekLabel} ?</h2>
            </div>
            <p className="text-sm text-gray-300">
              Les séances de la semaine du {weekLabel} vont être retirées et remplacées
              pour {tracks.length > 1 ? 'les deux pistes' : 'la piste'}{' '}
              {tracks.map(t => TRACK_LABEL[t]).join(' et ')}.
            </p>
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
            <div className="flex items-center gap-3">
              <button
                onClick={closeConfirm}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm font-bold hover:text-white transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => void run('regen')}
                disabled={busy !== null || !confirmed}
                data-testid="auto-regenerer-confirmer"
                title={confirmed ? undefined : `Tape ${REGEN_CONFIRM_WORD} pour activer`}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-black text-sm font-bold transition-colors"
              >
                {busy === 'regen' ? 'Régénération...' : 'Régénérer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
