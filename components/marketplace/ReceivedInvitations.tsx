'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useEffect, useRef, useState } from 'react';
import { Info, Loader2, Mail, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  acceptLabel, acceptTariff, contentLine, publisherName, receivedBadge, receivedLine, receivedTitle, serverMessage,
  type ReceivedInvitation,
} from '@/lib/programmingInvitations';

/**
 * « Invitations reçues » en tête du Catalogue (#461, PR 3) : invitations en
 * attente de la box active (list_my_programming_invitations). Absente quand il
 * n'y en a pas. `highlightId` : invitation du lien de l'e-mail, mise en évidence.
 */
export function ReceivedInvitationsSection({ invitations, highlightId, busyId, onDetail, onDecline, onAccept }: {
  invitations: ReceivedInvitation[]; highlightId: string | null; busyId: string | null;
  onDetail: (i: ReceivedInvitation) => void; onDecline: (i: ReceivedInvitation) => void; onAccept: (i: ReceivedInvitation) => void;
}) {
  const highlightRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (highlightId) highlightRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [highlightId, invitations.length]);
  if (invitations.length === 0) return null;
  return (
    <section className="mb-6" aria-labelledby="invitations-recues">
      <h2 id="invitations-recues" className="mb-3 flex items-center gap-2 font-display text-base font-medium uppercase tracking-wide text-ax-text">
        Invitations reçues
        <span className="min-w-5 rounded-full bg-ax-accent px-1.5 py-0.5 text-center font-sans text-[10px] font-black leading-none text-ax-accent-foreground">
          {invitations.length}
        </span>
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {invitations.map((i) => {
          const badge = receivedBadge(i);
          const hl = i.invitation_id === highlightId;
          const busy = busyId === i.invitation_id;
          return (
            <div key={i.invitation_id} ref={hl ? highlightRef : undefined} data-invitation={i.invitation_id}
              className={`rounded-ax-card border bg-ax-surface p-4 sm:p-5 ${hl ? 'border-ax-accent ring-2 ring-ax-accent' : 'border-ax-border'}`}>
              <div className="flex items-start justify-between gap-3">
                <p className="flex min-w-0 items-start gap-2 text-sm font-bold text-ax-text">
                  <Mail size={15} className="mt-0.5 shrink-0" />
                  <span className="min-w-0 break-words">{receivedTitle(i)}</span>
                </p>
                <Badge variant={badge.variant} className="shrink-0 text-[10px] font-black uppercase px-2 py-0.5">{badge.label}</Badge>
              </div>
              <p className="mt-2 text-xs text-ax-text-secondary">{receivedLine(i)}</p>
              {i.message && (
                <p className="mt-2 border-l-2 border-ax-input-border pl-3 text-xs italic text-ax-text-secondary break-words">« {i.message} »</p>
              )}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <button type="button" onClick={() => onDetail(i)}
                  className="flex items-center gap-1 rounded-ax-control text-xs font-semibold text-ax-text-secondary hover:text-ax-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus">
                  <Info size={12} /> Voir le détail
                </button>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="ax-outline" size="ax-compact" disabled={busy} onClick={() => onDecline(i)}>Refuser</Button>
                  <Button type="button" variant="ax-white" size="ax-compact" disabled={busy} onClick={() => onAccept(i)}>
                    {busy && <Loader2 size={12} className="animate-spin" />} {acceptLabel(i.pricing)}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * « Accepter l'invitation » : « Offerte » → accept_programming_invitation ;
 * « Au prix de l'offre » → checkout Stripe Connect avec l'invitation, puis
 * redirection (l'abonnement s'active au webhook). Fenêtre Radix : Échap et
 * focus gardé ; en feuille en bas d'écran sous 640 px.
 */
export function AcceptInvitationModal({ invitation: i, boxId, boxName, onClose, onAccepted }: {
  invitation: ReceivedInvitation; boxId: string; boxName: string; onClose: () => void; onAccepted: () => void;
}) {
  const supabase = useRef(createClient()).current;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paid = i.pricing === 'offer_price';

  async function accept() {
    setBusy(true);
    setError(null);
    if (!paid) {
      const { error: err } = await supabase.rpc('accept_programming_invitation', { p_invitation_id: i.invitation_id });
      setBusy(false);
      if (err) { setError(serverMessage(err.message)); return; }
      onAccepted();
      return;
    }
    try {
      const res = await fetch('/api/create-programming-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ programming_id: i.programming_id, subscriber_box_id: boxId, invitation_id: i.invitation_id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.url) { setBusy(false); setError(serverMessage(json.error ?? 'Impossible de démarrer le paiement.')); return; }
      window.location.href = json.url;
    } catch (e) {
      setBusy(false);
      setError((e as Error).message);
    }
  }

  const rows: [string, string][] = [['Pour', boxName], ['Tarif', acceptTariff(i)], ['Contenu', contentLine(i)]];
  return (
    <DialogPrimitive.Root open onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ax-overlay backdrop-blur-ax-glass" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed z-50 inset-x-4 bottom-4 max-h-[calc(100vh-2rem)] overflow-y-auto rounded-ax-panel border border-ax-border bg-ax-surface p-6 text-ax-text shadow-ax-panel outline-none sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[calc(100vw-2rem)] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2"
        >
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-lg font-black text-ax-text">Accepter l&apos;invitation</DialogPrimitive.Title>
              <p className="text-xs text-ax-text-secondary break-words">{i.title} · par {publisherName(i)}</p>
            </div>
            <DialogPrimitive.Close className="text-ax-text-muted hover:text-ax-text rounded-ax-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus" aria-label="Fermer" disabled={busy}>
              <X size={18} />
            </DialogPrimitive.Close>
          </div>

          <dl className="mb-4 space-y-2">
            {rows.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[6rem_1fr] gap-3">
                <dt className="text-xs text-ax-text-muted">{k}</dt>
                <dd className="text-sm font-bold text-ax-text break-words">{v}</dd>
              </div>
            ))}
          </dl>

          {paid ? (
            <div className="mb-5 flex items-start gap-2 rounded-ax-control border border-ax-warning bg-ax-warning-soft px-3 py-2.5 text-xs text-ax-warning">
              <Info size={13} className="mt-0.5 shrink-0" />
              <p>Paiement sécurisé Stripe : tu es redirigé vers la page de paiement, l&apos;abonnement s&apos;active une fois le paiement confirmé.</p>
            </div>
          ) : (
            <div className="mb-5 flex items-start gap-2 rounded-ax-control border border-ax-border px-3 py-2.5 text-xs text-ax-text-secondary">
              <Info size={13} className="mt-0.5 shrink-0" />
              <p>Rien ne se pose tout seul : active l&apos;application automatique ensuite dans Marketplace, ou pose les semaines depuis le Whiteboard (« Programmation »), en choisissant qui les voit.</p>
            </div>
          )}

          {error && <p role="alert" className="text-xs text-ax-danger mb-3">{error}</p>}

          <div className="flex gap-2 justify-end flex-wrap">
            <Button type="button" variant="ax-outline" disabled={busy} onClick={onClose}>Annuler</Button>
            <Button type="button" variant="ax-white" disabled={busy} onClick={accept}>
              {busy && <Loader2 size={15} className="animate-spin" />} {acceptLabel(i.pricing)}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
