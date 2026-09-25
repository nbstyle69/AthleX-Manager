'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  LifeBuoy, Loader2, Send, ArrowLeft, HelpCircle, Bug, Lightbulb, Check, RotateCcw, Building2,
} from 'lucide-react';
import { chipClass } from '@/components/admin/adminTokens';

type TicketType = 'question' | 'bug' | 'improvement';
type TicketStatus = 'open' | 'answered' | 'resolved';

interface Ticket {
  id: string;
  box_id: string;
  created_by: string;
  type: TicketType;
  subject: string;
  status: TicketStatus;
  admin_unread: boolean;
  last_message_at: string;
  created_at: string;
  box: { name: string } | null;
  creator: { username: string } | null;
}

interface Message {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_role: 'requester' | 'admin';
  body: string;
  created_at: string;
}

// Même sens qu'avant (question bleue, bug rouge, idée ambre), en jetons.
const TYPE_META: Record<TicketType, { label: string; icon: typeof HelpCircle; color: string }> = {
  question:    { label: 'Question',            icon: HelpCircle, color: 'text-ax-info' },
  bug:         { label: 'Bug',                 icon: Bug,        color: 'text-ax-danger' },
  improvement: { label: "Idée d'amélioration", icon: Lightbulb,  color: 'text-ax-warning' },
};

const STATUS_META: Record<TicketStatus, { label: string; cls: string }> = {
  open:     { label: 'Ouvert',  cls: 'bg-ax-warning-soft text-ax-warning border-ax-warning' },
  answered: { label: 'Répondu', cls: 'bg-ax-info-soft text-ax-info border-ax-info' },
  resolved: { label: 'Résolu',  cls: 'bg-ax-success-soft text-ax-success border-ax-success' },
};

const SMALL_ACTION = 'flex items-center gap-1.5 px-3 py-1.5 rounded-ax-control border text-xs font-bold transition-[filter] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus motion-reduce:transition-none';

function fmt(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

const FILTERS: { value: TicketStatus | 'all'; label: string }[] = [
  { value: 'open',     label: 'Ouverts' },
  { value: 'answered', label: 'Répondus' },
  { value: 'resolved', label: 'Résolus' },
  { value: 'all',      label: 'Tous' },
];

export default function AdminSupportInbox({ userId, accent = 'emerald' }: { userId: string; accent?: 'emerald' | 'white' }) {
  const supabase = createClient();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TicketStatus | 'all'>('open');
  const [active, setActive] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('support_tickets')
      .select('*, box:boxes(name), creator:profiles!support_tickets_created_by_fkey(username)')
      .order('last_message_at', { ascending: false })
      .limit(300);
    if (filter !== 'all') q = q.eq('status', filter);
    const { data } = await q;
    setTickets(((data ?? []) as unknown[]).map(r => {
      const row = r as Ticket & { box: unknown; creator: unknown };
      return {
        ...row,
        box: Array.isArray(row.box) ? row.box[0] : row.box,
        creator: Array.isArray(row.creator) ? row.creator[0] : row.creator,
      } as Ticket;
    }));
    setLoading(false);
  }, [supabase, filter]);

  useEffect(() => { load(); }, [load]);

  async function openTicket(t: Ticket) {
    setActive(t);
    const { data } = await supabase
      .from('support_messages').select('*').eq('ticket_id', t.id).order('created_at', { ascending: true });
    setMessages((data ?? []) as Message[]);
    if (t.admin_unread) {
      await supabase.from('support_tickets').update({ admin_unread: false }).eq('id', t.id);
      setTickets(prev => prev.map(x => x.id === t.id ? { ...x, admin_unread: false } : x));
    }
  }

  async function sendReply() {
    if (!active || !reply.trim()) return;
    setSending(true);
    const { error } = await supabase.from('support_messages').insert({
      ticket_id: active.id, sender_id: userId, sender_role: 'admin', body: reply.trim(),
    });
    if (!error) {
      setReply('');
      const { data } = await supabase
        .from('support_messages').select('*').eq('ticket_id', active.id).order('created_at', { ascending: true });
      setMessages((data ?? []) as Message[]);
      setActive({ ...active, status: active.status === 'resolved' ? 'resolved' : 'answered' });
    }
    setSending(false);
  }

  async function setStatus(status: TicketStatus) {
    if (!active) return;
    await supabase.from('support_tickets').update({ status }).eq('id', active.id);
    setActive({ ...active, status });
    setTickets(prev => prev.map(x => x.id === active.id ? { ...x, status } : x));
  }

  // Deux accents, chacun garde son sens : menthe (couleur du super-admin) sur
  // /admin/support, blanc plein (bouton principal du dashboard) sur /support/admin.
  const accentBtn = accent === 'emerald'
    ? 'border border-ax-accent-text bg-ax-accent-soft text-ax-accent-text hover:brightness-110'
    : 'border border-ax-text bg-ax-text text-ax-background hover:brightness-110';

  // ── thread view ──────────────────────────────────────────────────────
  if (active) {
    const meta = TYPE_META[active.type];
    return (
      <div className="max-w-3xl">
        <button onClick={() => { setActive(null); load(); }} className="flex items-center gap-2 rounded-ax-control text-sm text-ax-text-secondary hover:text-ax-text mb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus">
          <ArrowLeft size={16} /> Retour aux demandes
        </button>
        <div className="bg-ax-surface border border-ax-border rounded-ax-card p-5 mb-4">
          <div className="flex items-start gap-3 flex-wrap">
            <meta.icon size={18} className={`${meta.color} shrink-0 mt-1`} />
            <h2 className="min-w-0 flex-1 font-display text-xl font-medium tracking-wide text-ax-text break-words">{active.subject}</h2>
            <span className={`px-2 py-0.5 rounded-ax-badge border text-[10px] font-bold uppercase tracking-wider ${STATUS_META[active.status].cls}`}>
              {STATUS_META[active.status].label}
            </span>
          </div>
          <p className="text-xs text-ax-text-secondary mt-2 flex items-start gap-1.5 break-words">
            <Building2 size={13} className="shrink-0 mt-0.5" /> <span className="min-w-0">{active.box?.name ?? 'Box inconnue'} · demandé par {active.creator?.username ?? '—'}</span>
          </p>
        </div>

        <div className="space-y-3 mb-4">
          {messages.map(m => {
            const isAdmin = m.sender_role === 'admin';
            return (
              <div key={m.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] sm:max-w-[80%] min-w-0 rounded-ax-card px-4 py-2.5 border text-ax-text ${isAdmin ? 'bg-ax-accent-soft border-ax-accent-text' : 'bg-ax-surface-secondary border-ax-border'}`}>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-1 text-ax-text-secondary break-words">
                    {isAdmin ? 'Vous (Support)' : (active.creator?.username ?? 'Demandeur')} · {fmt(m.created_at)}
                  </p>
                  <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2 items-end mb-3">
          <textarea
            value={reply} onChange={e => setReply(e.target.value)} rows={2}
            placeholder="Répondre au demandeur..."
            aria-label="Réponse"
            className="flex-1 min-w-0 rounded-ax-control border border-ax-input-border bg-ax-surface p-3 text-base text-ax-text placeholder:text-ax-text-muted sm:text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-background"
          />
          <button onClick={sendReply} disabled={sending || !reply.trim()} aria-label="Envoyer"
            className={`font-bold px-4 py-3 rounded-ax-control text-sm inline-flex items-center gap-1.5 transition-[filter] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus motion-reduce:transition-none ${accentBtn}`}>
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </div>
        <div className="flex gap-2">
          {active.status !== 'resolved'
            ? <button onClick={() => setStatus('resolved')} className={`${SMALL_ACTION} border-ax-success bg-ax-success-soft text-ax-success`}><Check size={13} /> Marquer résolu</button>
            : <button onClick={() => setStatus('open')} className={`${SMALL_ACTION} border-ax-warning bg-ax-warning-soft text-ax-warning`}><RotateCcw size={13} /> Rouvrir</button>}
        </div>
      </div>
    );
  }

  // ── list view ────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium uppercase tracking-wide text-ax-text flex items-center gap-3"><LifeBuoy size={24} className="shrink-0" /> Support — demandes des boxs</h1>
        <p className="text-sm text-ax-text-secondary mt-1">Toutes les demandes des owners/coachs. Répondez dans le fil et mettez à jour le statut.</p>
      </div>

      {/* À 390 px, les filtres passent à la ligne au lieu de sortir de l'écran. */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <button key={f.value} onClick={() => setFilter(f.value)} aria-pressed={filter === f.value}
            className={`${chipClass(filter === f.value)} px-4 py-2`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-ax-text-secondary py-8"><Loader2 size={18} className="animate-spin" /> Chargement...</div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-16 text-ax-text-secondary"><LifeBuoy size={48} className="mx-auto mb-3 text-ax-text-muted" /><p>Aucune demande</p></div>
      ) : (
        <div className="space-y-2">
          {tickets.map(t => {
            const m = TYPE_META[t.type];
            return (
              <button key={t.id} onClick={() => openTicket(t)}
                className="w-full text-left bg-ax-surface border border-ax-border rounded-ax-control p-4 hover:bg-ax-hover transition-colors flex items-start sm:items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus motion-reduce:transition-none">
                <m.icon size={18} className={`${m.color} shrink-0 mt-0.5 sm:mt-0`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    {/* Objet saisi par la box : lisible en entier. */}
                    <p className="text-sm font-bold text-ax-text break-words min-w-0">{t.subject}</p>
                    {t.admin_unread && <span className="w-2 h-2 rounded-full bg-ax-text shrink-0 mt-1.5" aria-label="Non lu" role="img" />}
                  </div>
                  <p className="text-xs text-ax-text-secondary flex items-start gap-1.5 break-words">
                    <Building2 size={12} className="shrink-0 mt-0.5" /> <span className="min-w-0">{t.box?.name ?? '—'} · {t.creator?.username ?? '—'} · {fmt(t.last_message_at)}</span>
                  </p>
                </div>
                <span className={`px-2 py-0.5 rounded-ax-badge border text-[10px] font-bold uppercase tracking-wider shrink-0 ${STATUS_META[t.status].cls}`}>
                  {STATUS_META[t.status].label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
