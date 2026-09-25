import { CalendarClock } from 'lucide-react';

/**
 * Bandeau « archivage programmé » (archivage, PR 3) : information seule, sans
 * bouton — l'annulation reste réservée au super-admin.
 */
export default function ArchiveScheduledBanner({ lead, rest }: { lead: string; rest: string }) {
  return (
    <div
      role="status"
      data-testid="bandeau-archivage-programme"
      className="mb-6 flex items-start gap-3 rounded-ax-control border border-ax-warning bg-ax-warning-soft px-4 py-3 text-sm text-ax-warning"
    >
      <CalendarClock size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <p className="min-w-0 break-words">
        <strong className="font-bold">{lead}</strong> {rest}
      </p>
    </div>
  );
}
