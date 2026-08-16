'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import {
  Loader2, Mail, MailWarning, Copy, Check, QrCode, RefreshCw, Ban, Banknote,
  UserPlus, CreditCard, X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getMyBox } from '@/lib/getMyBox';
import CsvImport from '@/components/invitations/CsvImport';

const supabase = createClient();

const INPUT_CLS =
  'w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30';

interface Plan {
  id: string;
  name: string;
  price_cents: number | null;
  plan_type: string | null;
}

interface Invitation {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  plan_id: string | null;
  payment_mode: 'box' | 'stripe';
  cash_collected: boolean;
  status: 'pending' | 'accepted' | 'revoked';
  expires_at: string;
  created_at: string;
  last_sent_at: string | null;
  last_send_error: string | null;
  send_count: number;
}

/** Lien vivant : le jeton n'étant stocké que haché, il n'existe qu'ici. */
interface FreshLink {
  invitationId: string;
  email: string;
  url: string;
  qr: string | null;
  emailState: 'idle' | 'sending' | 'sent' | 'failed';
  emailError: string | null;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' });
}

function rpcMessage(error: { message: string } | null): string | null {
  if (!error) return null;
  const m = error.message;
  if (m.includes('INVITATION_EXISTS')) return 'Une invitation est déjà en attente pour cette adresse.';
  if (m.includes('PLAN_NOT_IN_BOX')) return 'Cette formule n’appartient pas à la box.';
  if (m.includes('INVALID_EMAIL')) return 'Adresse e-mail invalide.';
  if (m.includes('MEMBER_EXISTS')) return 'Cette personne est déjà membre de ta box.';
  if (m.includes('MEMBER_BANNED')) return 'Cette personne est exclue de la box.';
  if (m.includes('NOT_PENDING')) return 'Cette invitation n’est plus en attente : recrée-la.';
  if (m.includes('ALREADY_ACCEPTED')) return 'Cette invitation a déjà été utilisée.';
  if (m.includes('FORBIDDEN')) return 'Vous n’administrez pas cette box.';
  return m;
}

export default function InvitationsPage() {
  const router = useRouter();
  const [boxId, setBoxId] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onlyToCollect, setOnlyToCollect] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [link, setLink] = useState<FreshLink | null>(null);
  const [copied, setCopied] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [planId, setPlanId] = useState('');
  const [paymentMode, setPaymentMode] = useState<'box' | 'stripe'>('box');
  const [cashCollected, setCashCollected] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    const box = await getMyBox(supabase, user.id);
    if (!box) { router.push('/login'); return; }
    setBoxId(box.id);

    const [{ data: plansData }, { data: invitationsData, error: invError }] = await Promise.all([
      supabase.from('membership_plans')
        .select('id, name, price_cents, plan_type')
        .eq('box_id', box.id).eq('is_active', true)
        .order('sort_order', { ascending: true }),
      supabase.from('box_invitations')
        .select('id, email, first_name, last_name, plan_id, payment_mode, cash_collected, status, expires_at, created_at, last_sent_at, last_send_error, send_count')
        .eq('box_id', box.id)
        .order('created_at', { ascending: false }),
    ]);

    setPlans((plansData ?? []) as Plan[]);
    setInvitations((invitationsData ?? []) as Invitation[]);
    setError(invError ? invError.message : null);
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const openLink = useCallback(async (invitationId: string, to: string, token: string) => {
    const url = `${window.location.origin}/rejoindre/${token}`;
    const qr = await QRCode.toDataURL(url, { width: 320, margin: 1 }).catch(() => null);
    setCopied(false);
    setLink({ invitationId, email: to, url, qr, emailState: 'idle', emailError: null });
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!boxId) return;
    setCreating(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('create_box_invitation', {
      p_box_id: boxId,
      p_email: email.trim().toLowerCase(),
      p_first_name: firstName.trim() || null,
      p_last_name: lastName.trim() || null,
      p_plan_id: planId || null,
      p_payment_mode: paymentMode,
      p_cash_collected: paymentMode === 'box' && cashCollected,
    });
    setCreating(false);

    const message = rpcMessage(rpcError);
    if (message) { setError(message); return; }

    const created = data as { id: string; token: string; email: string };
    setFirstName(''); setLastName(''); setEmail(''); setCashCollected(false);
    await load();
    await openLink(created.id, created.email, created.token);
  }

  async function resend(invitation: Invitation) {
    setBusy(invitation.id);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('rotate_box_invitation_token', {
      p_invitation_id: invitation.id,
    });
    setBusy(null);
    const message = rpcMessage(rpcError);
    if (message) { setError(message); return; }
    const rotated = data as { token: string; email: string };
    await load();
    await openLink(invitation.id, rotated.email, rotated.token);
  }

  async function revoke(invitation: Invitation) {
    if (!confirm(`Révoquer l'invitation de ${invitation.email} ? Le lien deviendra inutilisable.`)) return;
    setBusy(invitation.id);
    const { error: rpcError } = await supabase.rpc('revoke_box_invitation', {
      p_invitation_id: invitation.id,
    });
    setBusy(null);
    setError(rpcMessage(rpcError));
    await load();
  }

  async function markPaid(invitation: Invitation) {
    setBusy(invitation.id);
    const { error: rpcError } = await supabase.rpc('mark_box_invitation_paid', {
      p_invitation_id: invitation.id,
    });
    setBusy(null);
    setError(rpcMessage(rpcError));
    await load();
  }

  async function sendEmail() {
    if (!link) return;
    setLink({ ...link, emailState: 'sending', emailError: null });

    const token = link.url.split('/rejoindre/')[1] ?? '';
    let sent = false;
    let failure: string | null = null;
    try {
      const res = await fetch('/api/invitations/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitation_id: link.invitationId, token }),
      });
      const payload = await res.json().catch(() => ({}));
      sent = res.ok && payload?.sent === true;
      failure = sent ? null : (payload?.error ?? `Erreur ${res.status}`);
    } catch (err) {
      failure = err instanceof Error ? err.message : 'Envoi impossible';
    }

    // La trace passe par la RPC (soumise à is_box_admin), pas par la route.
    await supabase.rpc('mark_box_invitation_sent', {
      p_invitation_id: link.invitationId,
      p_error: failure,
    });

    setLink(prev => prev && prev.invitationId === link.invitationId
      ? { ...prev, emailState: sent ? 'sent' : 'failed', emailError: failure }
      : prev);
    await load();
  }

  const planName = useCallback(
    (id: string | null) => plans.find(p => p.id === id)?.name ?? 'Sans formule',
    [plans],
  );

  const toCollectCount = useMemo(
    () => invitations.filter(i => i.status === 'pending' && i.payment_mode === 'box' && !i.cash_collected).length,
    [invitations],
  );

  const visible = useMemo(
    () => (onlyToCollect
      ? invitations.filter(i => i.status === 'pending' && i.payment_mode === 'box' && !i.cash_collected)
      : invitations),
    [invitations, onlyToCollect],
  );

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-gray-500" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">Invitations</h1>
        <p className="text-sm text-gray-400 mt-1">
          Inscris un adhérent nominativement : il reçoit un lien personnel, choisit son pseudo et son mot de passe, et arrive dans ta box avec sa formule.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
      )}

      <form onSubmit={create} className="bg-[#111111] border border-white/8 rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2"><UserPlus size={15} /> Nouvelle invitation</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input className={INPUT_CLS} placeholder="Prénom" value={firstName} onChange={e => setFirstName(e.target.value)} />
          <input className={INPUT_CLS} placeholder="Nom" value={lastName} onChange={e => setLastName(e.target.value)} />
          <input className={INPUT_CLS} type="email" required placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select className={INPUT_CLS} value={planId} onChange={e => setPlanId(e.target.value)}>
            <option value="">Sans formule</option>
            {plans.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}{p.price_cents ? ` — ${(p.price_cents / 100).toFixed(2)} €` : ''}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            {(['box', 'stripe'] as const).map(mode => (
              <button key={mode} type="button" onClick={() => setPaymentMode(mode)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${paymentMode === mode ? 'border-white/50 bg-white/10 text-white' : 'border-white/10 text-gray-400 hover:text-white'}`}>
                {mode === 'box' ? <Banknote size={13} /> : <CreditCard size={13} />}
                {mode === 'box' ? 'Encaissement box' : 'Paiement Stripe'}
              </button>
            ))}
          </div>
        </div>

        {paymentMode === 'box' ? (
          <label className="flex items-center gap-2 text-xs text-gray-300">
            <input type="checkbox" checked={cashCollected} onChange={e => setCashCollected(e.target.checked)} />
            Paiement déjà encaissé — le membre est actif dès qu’il crée son compte
          </label>
        ) : (
          <p className="text-xs text-gray-500">
            Le membre créera son compte puis paiera par Stripe. Il ne sera actif qu’une fois le paiement confirmé.
          </p>
        )}

        <button type="submit" disabled={creating || !email.trim()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-black text-sm font-bold disabled:opacity-40">
          {creating ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />} Créer l’invitation
        </button>
      </form>

      {boxId && (
        <CsvImport boxId={boxId} plans={plans} onImported={load} />
      )}

      <div className="flex items-center gap-3">
        <button onClick={() => setOnlyToCollect(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${onlyToCollect ? 'border-white/50 bg-white/10 text-white' : 'border-white/10 text-gray-400 hover:text-white'}`}>
          <Banknote size={13} /> À encaisser{toCollectCount > 0 ? ` (${toCollectCount})` : ''}
        </button>
        <span className="text-xs text-gray-500">{visible.length} invitation(s)</span>
      </div>

      <div className="space-y-2">
        {visible.length === 0 && (
          <p className="text-xs text-gray-600 italic">Aucune invitation.</p>
        )}
        {visible.map(inv => {
          const expired = inv.status === 'pending' && new Date(inv.expires_at).getTime() < Date.now();
          const toCollect = inv.status === 'pending' && inv.payment_mode === 'box' && !inv.cash_collected;
          return (
            <div key={inv.id} className="bg-[#111111] border border-white/8 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
              <div className="min-w-[220px] flex-1">
                <p className="text-sm font-semibold text-white">
                  {[inv.first_name, inv.last_name].filter(Boolean).join(' ') || inv.email}
                </p>
                <p className="text-xs text-gray-500">{inv.email} · {planName(inv.plan_id)}</p>
              </div>

              <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${
                inv.status === 'accepted' ? 'bg-white/10 text-white'
                  : inv.status === 'revoked' ? 'bg-white/5 text-gray-500'
                  : expired ? 'bg-white/5 text-gray-500' : 'bg-white/10 text-gray-200'}`}>
                {inv.status === 'accepted' ? 'Acceptée' : inv.status === 'revoked' ? 'Révoquée' : expired ? 'Expirée' : `Valide jusqu’au ${fmtDate(inv.expires_at)}`}
              </span>

              {toCollect && (
                <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-white/10 text-white flex items-center gap-1">
                  <Banknote size={11} /> À encaisser
                </span>
              )}

              {inv.payment_mode === 'stripe' && (
                <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-white/5 text-gray-400 flex items-center gap-1">
                  <CreditCard size={11} /> Stripe
                </span>
              )}

              {inv.last_send_error ? (
                <span title={inv.last_send_error}
                  className="text-[10px] font-bold px-2 py-1 rounded-lg bg-white/5 text-gray-300 flex items-center gap-1">
                  <MailWarning size={11} /> e-mail non parti — utilise le QR ou le lien
                </span>
              ) : inv.last_sent_at ? (
                <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-white/5 text-gray-400 flex items-center gap-1">
                  <Mail size={11} /> envoyé le {fmtDate(inv.last_sent_at)}
                </span>
              ) : null}

              {inv.status === 'pending' && (
                <div className="flex items-center gap-1.5 ml-auto">
                  {toCollect && (
                    <button onClick={() => markPaid(inv)} disabled={busy === inv.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white text-black text-xs font-bold disabled:opacity-40">
                      <Banknote size={12} /> Encaissé
                    </button>
                  )}
                  <button onClick={() => resend(inv)} disabled={busy === inv.id}
                    title="Régénère le lien : l’ancien devient inutilisable"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/10 text-gray-300 hover:text-white text-xs font-bold disabled:opacity-40">
                    {busy === inv.id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Relancer
                  </button>
                  <button onClick={() => revoke(inv)} disabled={busy === inv.id}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/10 text-gray-400 hover:text-white text-xs font-bold disabled:opacity-40">
                    <Ban size={12} /> Révoquer
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {link && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md bg-[#111111] border border-white/10 rounded-2xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2"><QrCode size={15} /> Lien d’invitation</h3>
                <p className="text-xs text-gray-500 mt-1">Pour {link.email}</p>
              </div>
              <button onClick={() => setLink(null)} className="text-gray-500 hover:text-white"><X size={16} /></button>
            </div>

            <p className="text-xs text-gray-500">
              Ce lien n’est affiché qu’une fois : il n’est pas conservé en clair. Tu pourras en régénérer un avec « Relancer ».
            </p>

            {link.qr && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={link.qr} alt="QR code du lien d’invitation" className="w-56 h-56 mx-auto rounded-xl bg-white p-2" />
            )}

            <div className="flex items-center gap-2">
              <input readOnly value={link.url} className={`${INPUT_CLS} text-xs`} />
              <button onClick={() => { navigator.clipboard.writeText(link.url); setCopied(true); }}
                className="flex items-center gap-1 px-3 py-2 rounded-lg bg-white text-black text-xs font-bold">
                {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copié' : 'Copier'}
              </button>
            </div>

            <button onClick={sendEmail} disabled={link.emailState === 'sending'}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-white text-sm font-bold disabled:opacity-40">
              {link.emailState === 'sending' ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
              Envoyer par e-mail
            </button>

            {link.emailState === 'sent' && (
              <p className="text-xs text-gray-300 flex items-center gap-1.5"><Check size={13} /> E-mail envoyé à {link.email}.</p>
            )}
            {link.emailState === 'failed' && (
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-xs text-white font-bold flex items-center gap-1.5">
                  <MailWarning size={13} /> E-mail non parti — utilise le QR code ou le lien.
                </p>
                <p className="text-[10px] text-gray-500 mt-1 break-all">{link.emailError}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
