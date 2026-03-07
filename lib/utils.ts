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
