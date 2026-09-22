import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function levelColor(level: string): string {
  const map: Record<string, string> = {
    scaled: 'var(--ax-level-scaled)', inter: 'var(--ax-level-inter)', rx: 'var(--ax-level-rx)',
    'rx+': 'var(--ax-level-rx-plus)', gx: 'var(--ax-level-gx)', pro: 'var(--ax-level-pro)',
  };
  return map[level] ?? 'var(--ax-level-scaled)';
}

export interface TournamentStatusInfo {
  key: 'open' | 'active' | 'review' | 'ended' | 'completed';
  label: string;
  color: string;
  description: string;
}

export interface WodProgress {
  total: number;
  closed: number;
}

/**
 * Single source of truth for a tournament's lifecycle state as shown to the owner.
 * DB `status` is one of 'open' | 'active' | 'completed' — the two intermediate
 * states below are derived, not stored :
 *   • « En révision » : tous les WOD sont fermés, plus aucune soumission, mais
 *     l'ELO n'est pas distribué (le classement suit encore les validations) ;
 *   • « Date de fin passée » : la fin est dépassée et des WOD restent ouverts.
 */
export function tournamentStatusInfo(
  status: string,
  endDate?: string | null,
  wods?: WodProgress,
): TournamentStatusInfo {
  if (status === 'completed') {
    return {
      key: 'completed',
      label: 'Clôturé',
      color: 'var(--ax-status-completed)',
      description: 'ELO distribué — le classement final est verrouillé.',
    };
  }
  if (status === 'active' && wods && wods.total > 0 && wods.closed === wods.total) {
    return {
      key: 'review',
      label: 'En révision',
      color: 'var(--ax-status-review)',
      description: 'Tournoi terminé — vérifie et valide les scores, puis distribue l’ELO pour clôturer.',
    };
  }
  const ended = !!endDate && new Date(endDate).getTime() < Date.now();
  if (ended) {
    return {
      key: 'ended',
      label: 'Date de fin passée',
      color: 'var(--ax-status-ended)',
      description: status === 'active'
        ? 'La date de fin est passée mais des WOD acceptent encore des scores — clique sur « Terminer le tournoi » pour figer le classement.'
        : 'La date de fin est passée et le tournoi est encore en inscriptions — démarre-le, ou corrige la date de fin.',
    };
  }
  if (status === 'active') {
    return {
      key: 'active',
      label: 'En cours',
      color: 'var(--ax-status-active)',
      description: 'Compétition en cours — les athlètes soumettent leurs scores.',
    };
  }
  return {
    key: 'open',
    label: 'Inscriptions ouvertes',
    color: 'var(--ax-status-open)',
    description: 'Les athlètes peuvent s’inscrire au tournoi.',
  };
}

export function statusBadge(status: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    draft:     { label: 'Brouillon',   color: 'var(--ax-status-draft)' },
    open:      { label: 'Inscriptions',color: 'var(--ax-status-open)' },
    active:    { label: 'En cours',    color: 'var(--ax-status-active)' },
    completed: { label: 'Terminé',     color: 'var(--ax-status-completed)' },
    pending:   { label: 'En attente',  color: 'var(--ax-status-pending)' },
    validated: { label: 'Validé',      color: 'var(--ax-status-validated)' },
    rejected:  { label: 'Rejeté',      color: 'var(--ax-status-rejected)' },
    closed:    { label: 'Fermé',       color: 'var(--ax-status-closed)' },
  };
  return map[status] ?? { label: status, color: 'var(--ax-status-draft)' };
}
