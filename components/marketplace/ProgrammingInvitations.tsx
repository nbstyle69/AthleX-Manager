'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useEffect, useRef, useState } from 'react';
import {
  Building2, ChevronDown, ChevronUp, Info, Loader2, Mail, RotateCcw, Search, Send, X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  MESSAGE_MAX, SEARCH_DEBOUNCE_MS, formatOfferPrice, invitationAction, invitationDateLine, pricingChoices,
  pricingLabel, searchQuery, serverMessage, statusBadge,
  type InvitationPricing, type OfferPrice, type SentInvitation,
} from '@/lib/programmingInvitations';

export interface InviteOffer extends OfferPrice { id: string; title: string }
export interface InvitePreset { boxId: string; boxName: string; pricing: InvitationPricing }

interface FoundBox { box_id: string; name: string; already_subscribed: boolean; invitation_pending: boolean }

const FIELD = 'w-full min-h-11 rounded-ax-control border border-ax-input-border bg-ax-surface px-3 py-2.5 text-base sm:text-sm text-ax-text placeholder:text-ax-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface';
const LABEL = 'text-xs font-semibold text-ax-text-secondary mb-1.5 block';

/**
 * « Inviter une box » : recherche (RPC search_boxes_for_invitation, 300 ms
 * après la frappe, 2 lettres au moins), puis tarif, message et envoi
 * (send_programming_invitation). Fenêtre Radix : Échap et focus gardé ; en
 * feuille en bas d'écran sous 640 px.
 */
export function InviteBoxModal({ offer, preset, onClose, onSent }: {
  offer: InviteOffer; preset: InvitePreset | null; onClose: () => void; onSent: () => void;
}) {
  const supabase = useRef(createClient()).current;
  const choices = pricingChoices(offer);
  const price = formatOfferPrice(offer);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<FoundBox[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [box, setBox] = useState<{ id: string; name: string } | null>(preset ? { id: preset.boxId, name: preset.boxName } : null);
  const [pricing, setPricing] = useState<InvitationPricing>(
    preset && choices.includes(preset.pricing) ? preset.pricing : 'offered');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (box) return;
    const query = searchQuery(q);
    if (!query) { setResults(null); setSearching(false); return; }
    let stale = false;
    setSearching(true);
    const t = setTimeout(async () => {
      const { data, error: err } = await supabase.rpc('search_boxes_for_invitation', { p_programming_id: offer.id, p_q: query });
      if (stale) return;
      setSearching(false);
      if (err) { setError(serverMessage(err.message)); setResults([]); return; }
      setError(null);
      setResults((data ?? []) as FoundBox[]);
    }, SEARCH_DEBOUNCE_MS);
    return () => { stale = true; clearTimeout(t); };
  }, [q, box, offer.id, supabase]);

  async function send() {
    if (!box) return;
    setSending(true);
    setError(null);
    const { error: err } = await supabase.rpc('send_programming_invitation', {
      p_programming_id: offer.id, p_invited_box_id: box.id, p_pricing: pricing, p_message: message.trim() || null,
    });
    setSending(false);
    if (err) { setError(serverMessage(err.message)); return; }
    onSent();
  }

  function change() {
    setBox(null);
    setError(null);
    setTimeout(() => searchRef.current?.focus(), 0);
  }

  return (
    <DialogPrimitive.Root open onOpenChange={(o) => { if (!o && !sending) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ax-overlay backdrop-blur-ax-glass" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed z-50 inset-x-4 bottom-4 max-h-[calc(100vh-2rem)] overflow-y-auto rounded-ax-panel border border-ax-border bg-ax-surface p-6 text-ax-text shadow-ax-panel outline-none sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[calc(100vw-2rem)] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2"
        >
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-lg font-black text-ax-text">Inviter une box</DialogPrimitive.Title>
              <p className="text-xs text-ax-text-secondary break-words">{offer.title} · {price}</p>
            </div>
            <DialogPrimitive.Close className="text-ax-text-muted hover:text-ax-text rounded-ax-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus" aria-label="Fermer" disabled={sending}>
              <X size={18} />
            </DialogPrimitive.Close>
          </div>

          {!box ? (
            <div className="mb-5">
              <label htmlFor="invite-box-q" className={LABEL}>Box à inviter</label>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ax-text-muted" />
                <input id="invite-box-q" ref={searchRef} autoFocus value={q} onChange={(e) => setQ(e.target.value)}
                  className={`${FIELD} pl-9`} autoComplete="off" />
              </div>
              <p className="text-[11px] text-ax-text-muted mt-1.5">
                Toutes les box AthleX, sauf celle qui programme (tes autres box comprises). Tape au moins 2 lettres.
              </p>
              {searching && <p className="mt-2 flex items-center gap-2 text-xs text-ax-text-muted"><Loader2 size={12} className="animate-spin" /> Recherche…</p>}
              {!searching && results && results.length === 0 && !error && (
                <p className="mt-2 text-xs text-ax-text-muted">Aucune box ne correspond.</p>
              )}
              {!searching && results && results.length > 0 && (
                <ul className="mt-2 rounded-ax-control border border-ax-border overflow-hidden divide-y divide-ax-border">
                  {results.map((r) => {
                    const blocked = r.already_subscribed ? 'Déjà abonnée' : r.invitation_pending ? 'Invitation en attente' : null;
                    return (
                      <li key={r.box_id}>
                        <button type="button" disabled={!!blocked} onClick={() => { setBox({ id: r.box_id, name: r.name }); setError(null); }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm font-semibold bg-ax-surface-secondary ${blocked ? 'text-ax-text-muted cursor-not-allowed' : 'text-ax-text hover:bg-ax-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ax-focus'}`}>
                          <Building2 size={15} className="shrink-0" />
                          <span className="flex-1 min-w-0 break-words">{r.name}</span>
                          {blocked && <span className="text-[11px] font-normal shrink-0">{blocked}</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : (
            <div className="space-y-4 mb-5">
              <div>
                <span className={LABEL}>Box à inviter</span>
                <div className="flex items-center gap-2.5 rounded-ax-control border border-ax-input-border px-3 py-2.5">
                  <Building2 size={15} className="shrink-0 text-ax-text-secondary" />
                  <span className="flex-1 min-w-0 break-words text-sm font-bold text-ax-text">{box.name}</span>
                  <button type="button" onClick={change} disabled={sending}
                    className="text-xs font-semibold text-ax-text-secondary hover:text-ax-text rounded-ax-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus">
                    Changer
                  </button>
                </div>
              </div>

              <fieldset>
                <legend className={LABEL}>Tarif pour cette box</legend>
                <div className="space-y-2" role="radiogroup">
                  {choices.map((c) => {
                    const on = pricing === c;
                    return (
                      <label key={c} className={`flex items-start gap-3 rounded-ax-control border px-3 py-2.5 cursor-pointer ${on ? 'border-ax-input-border bg-ax-surface-secondary' : 'border-ax-border'}`}>
                        <input type="radio" name="invite-pricing" value={c} checked={on} onChange={() => setPricing(c)}
                          className="mt-1 accent-[var(--ax-text)]" />
                        <span className="min-w-0">
                          <span className="block text-sm font-bold text-ax-text">
                            {c === 'offered' ? 'Offerte' : `Au prix de l’offre · ${price}`}
                          </span>
                          <span className="block text-xs text-ax-text-secondary">
                            {c === 'offered'
                              ? `Abonnement gratuit pour ${box.name}, sans date de fin. Il s’arrête si ${box.name} se désabonne ou si tu supprimes l’offre.`
                              : `${box.name} paie par Stripe, comme depuis le catalogue.`}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <div>
                <label htmlFor="invite-message" className={LABEL}>Message (facultatif)</label>
                <textarea id="invite-message" value={message} maxLength={MESSAGE_MAX} rows={3}
                  onChange={(e) => setMessage(e.target.value.slice(0, MESSAGE_MAX))}
                  className={`${FIELD} [field-sizing:content] min-h-[5.5rem]`} />
                <p className="text-[11px] text-ax-text-muted mt-1.5">280 caractères maximum. Il apparaît dans la notification et l&apos;e-mail.</p>
              </div>

              <div className="flex items-start gap-2 rounded-ax-control border border-ax-border px-3 py-2.5 text-xs text-ax-text-secondary">
                <Info size={13} className="shrink-0 mt-0.5" />
                <p>Le gérant de {box.name} reçoit une notification dans le Manager et un e-mail. L&apos;invitation expire dans 14 jours.</p>
              </div>
            </div>
          )}

          {error && <p role="alert" className="text-xs text-ax-danger mb-3">{error}</p>}

          <div className="flex gap-2 justify-end flex-wrap">
            <Button type="button" variant="ax-outline" disabled={sending} onClick={onClose}>Annuler</Button>
            <Button type="button" variant="ax-white" disabled={!box || sending} onClick={send}>
              {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Envoyer l&apos;invitation
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/**
 * « Invitations envoyées · N » dans la carte d'une offre. Absent quand N = 0 ;
 * ouvert d'emblée quand une invitation attend.
 */
export function SentInvitationsBlock({ invitations, defaultOpen, busyId, onCancel, onResend, onRevoke }: {
  invitations: SentInvitation[]; defaultOpen: boolean; busyId: string | null;
  onCancel: (i: SentInvitation) => void; onResend: (i: SentInvitation) => void; onRevoke: (i: SentInvitation) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (invitations.length === 0) return null;
  return (
    <div className="mt-4 rounded-ax-control border border-ax-border">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs font-bold text-ax-text rounded-ax-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus">
        <Mail size={13} className="text-ax-text-secondary" />
        <span className="flex-1">Invitations envoyées · {invitations.length}</span>
        {open ? <ChevronUp size={14} className="text-ax-text-muted" /> : <ChevronDown size={14} className="text-ax-text-muted" />}
      </button>
      {open && (
        <ul className="divide-y divide-ax-border border-t border-ax-border">
          {invitations.map((i) => {
            const badge = statusBadge(i.status);
            const action = invitationAction(i);
            const busy = busyId === i.invitation_id;
            return (
              <li key={i.invitation_id} className="flex flex-col items-start gap-1.5 px-3 py-3 sm:flex-row sm:items-center sm:gap-3">
                <span className="text-sm font-bold text-ax-text break-words sm:w-44 sm:shrink-0">{i.invited_box_name ?? 'Box'}</span>
                <span className="text-xs text-ax-text-secondary sm:w-36 sm:shrink-0">{pricingLabel(i.pricing)}</span>
                <Badge variant={badge.variant} className="text-[10px] font-black uppercase px-2 py-0.5">{badge.label}</Badge>
                <span className="text-xs text-ax-text-secondary sm:flex-1">{invitationDateLine(i)}</span>
                {action && (
                  <Button type="button" variant="ax-outline" size="ax-compact" disabled={busy} className="text-xs"
                    onClick={() => (action === 'cancel' ? onCancel(i) : action === 'resend' ? onResend(i) : onRevoke(i))}>
                    {busy ? <Loader2 size={12} className="animate-spin" /> : action === 'resend' && <RotateCcw size={12} />}
                    {action === 'cancel' ? 'Annuler' : action === 'resend' ? 'Renvoyer' : 'Retirer l’accès offert'}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
