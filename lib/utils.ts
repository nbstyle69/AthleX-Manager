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
    scaled: '#6B7280', inter: '#3B82F6', rx: '#22C55E',
    'rx+': '#A855F7', gx: '#F59E0B', pro: '#EF4444',
  };
  return map[level] ?? '#6B7280';
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
      color: '#9CA3AF',
      description: 'ELO distribué — le classement final est verrouillé.',
    };
  }
  if (status === 'active' && wods && wods.total > 0 && wods.closed === wods.total) {
    return {
      key: 'review',
      label: 'En révision',
      color: '#F59E0B',
      description: 'Tournoi terminé — vérifie et valide les scores, puis distribue l’ELO pour clôturer.',
    };
  }
  const ended = !!endDate && new Date(endDate).getTime() < Date.now();
  if (ended) {
    return {
      key: 'ended',
      label: 'Date de fin passée',
      color: '#F59E0B',
      description: status === 'active'
        ? 'La date de fin est passée mais des WOD acceptent encore des scores — clique sur « Terminer le tournoi » pour figer le classement.'
        : 'La date de fin est passée et le tournoi est encore en inscriptions — démarre-le, ou corrige la date de fin.',
    };
  }
  if (status === 'active') {
    return {
      key: 'active',
      label: 'En cours',
      color: '#22C55E',
      description: 'Compétition en cours — les athlètes soumettent leurs scores.',
    };
  }
  return {
    key: 'open',
    label: 'Inscriptions ouvertes',
    color: '#3B82F6',
    description: 'Les athlètes peuvent s’inscrire au tournoi.',
  };
}

export function statusBadge(status: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    draft:     { label: 'Brouillon',   color: '#6B7280' },
    open:      { label: 'Inscriptions',color: '#3B82F6' },
    active:    { label: 'En cours',    color: '#22C55E' },
    completed: { label: 'Terminé',     color: '#9CA3AF' },
    pending:   { label: 'En attente',  color: '#D97706' },
    validated: { label: 'Validé',      color: '#22C55E' },
    rejected:  { label: 'Rejeté',      color: '#EF4444' },
    closed:    { label: 'Fermé',       color: '#6B7280' },
  };
  return map[status] ?? { label: status, color: '#6B7280' };
}
