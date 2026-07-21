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
  key: 'open' | 'active' | 'ended' | 'completed';
  label: string;
  color: string;
  description: string;
}

/**
 * Single source of truth for a tournament's lifecycle state as shown to the owner.
 * DB `status` is one of 'open' | 'active' | 'completed'. When the end date has
 * passed but the tournament hasn't been closed yet, we surface a derived
 * "à clôturer" state so the owner knows to distribute ELO.
 */
export function tournamentStatusInfo(
  status: string,
  endDate?: string | null,
): TournamentStatusInfo {
  if (status === 'completed') {
    return {
      key: 'completed',
      label: 'Clôturé',
      color: '#9CA3AF',
      description: 'ELO distribué — le classement final est verrouillé.',
    };
  }
  const ended = !!endDate && new Date(endDate).getTime() < Date.now();
  if (ended) {
    return {
      key: 'ended',
      label: 'Terminé — à clôturer',
      color: '#F59E0B',
      description: 'La date de fin est passée. Valide les scores en attente, puis clôture pour distribuer l’ELO.',
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
