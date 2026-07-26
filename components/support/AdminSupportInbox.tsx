'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  LifeBuoy, Loader2, Send, ArrowLeft, HelpCircle, Bug, Lightbulb, Check, RotateCcw, Building2,
} from 'lucide-react';

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

const TYPE_META: Record<TicketType, { label: string; icon: typeof HelpCircle; color: string }> = {
  question:    { label: 'Question',            icon: HelpCircle, color: 'text-blue-400' },
  bug:         { label: 'Bug',                 icon: Bug,        color: 'text-red-400' },
  improvement: { label: "Idée d'amélioration", icon: Lightbulb,  color: 'text-amber-400' },
};

const STATUS_META: Record<TicketStatus, { label: string; cls: string }> = {
  open:     { label: 'Ouvert',  cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  answered: { label: 'Répondu', cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  resolved: { label: 'Résolu',  cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
};

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

  const accentBtn = accent === 'emerald'
    ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400'
    : 'bg-white text-[#0A0A0A] hover:bg-gray-200';

  // ── thread view ──────────────────────────────────────────────────────
  if (active) {
    const meta = TYPE_META[active.type];
    return (
      <div className="max-w-3xl">
        <button onClick={() => { setActive(null); load(); }} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-4">
          <ArrowLeft size={16} /> Retour aux demandes
        </button>
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <meta.icon size={18} className={meta.color} />
            <h2 className="text-lg font-black text-white">{active.subject}</h2>
            <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider ${STATUS_META[active.status].cls}`}>
              {STATUS_META[active.status].label}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-2 flex items-center gap-1.5">
            <Building2 size={13} /> {active.box?.name ?? 'Box inconnue'} · demandé par {active.creator?.username ?? '—'}
          </p>
        </div>

        <div className="space-y-3 mb-4">
          {messages.map(m => {
            const isAdmin = m.sender_role === 'admin';
            return (
              <div key={m.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${isAdmin ? 'bg-emerald-500/15 border border-emerald-500/20 text-white' : 'bg-white/10 text-white'}`}>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-60">
                    {isAdmin ? 'Vous (Support)' : (active.creator?.username ?? 'Demandeur')} · {fmt(m.created_at)}
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{m.body}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2 items-end mb-3">
          <textarea
            value={reply} onChange={e => setReply(e.target.value)} rows={2}
            placeholder="Répondre au demandeur..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm resize-none focus:outline-none focus:border-white/20"
          />
          <button onClick={sendReply} disabled={sending || !reply.trim()}
            className={`font-bold px-4 py-3 rounded-xl text-sm inline-flex items-center gap-1.5 disabled:opacity-40 ${accentBtn}`}>
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </div>
        <div className="flex gap-2">
          {active.status !== 'resolved'
            ? <button onClick={() => setStatus('resolved')} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg text-xs font-bold"><Check size={13} /> Marquer résolu</button>
            : <button onClick={() => setStatus('open')} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg text-xs font-bold"><RotateCcw size={13} /> Rouvrir</button>}
        </div>
      </div>
    );
  }

  // ── list view ────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-3"><LifeBuoy size={24} /> Support — demandes des box</h1>
        <p className="text-sm text-gray-400 mt-1">Toutes les demandes des owners/coachs. Répondez dans le fil et mettez à jour le statut.</p>
      </div>

      <div className="flex gap-2">
        {FILTERS.map(f => (
          <button key={f.value} onClick={() => setFilter(f.value)}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all ${
              filter === f.value ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-400 py-8"><Loader2 size={18} className="animate-spin" /> Chargement...</div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-16 text-gray-500"><LifeBuoy size={48} className="mx-auto mb-3 opacity-30" /><p>Aucune demande</p></div>
      ) : (
        <div className="space-y-2">
          {tickets.map(t => {
            const m = TYPE_META[t.type];
            return (
              <button key={t.id} onClick={() => openTicket(t)}
                className="w-full text-left bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 hover:bg-white/[0.04] transition-all flex items-center gap-3">
                <m.icon size={18} className={`${m.color} shrink-0`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-white truncate">{t.subject}</p>
                    {t.admin_unread && <span className="w-2 h-2 rounded-full bg-white shrink-0" />}
                  </div>
                  <p className="text-xs text-gray-500 flex items-center gap-1.5">
                    <Building2 size={12} /> {t.box?.name ?? '—'} · {t.creator?.username ?? '—'} · {fmt(t.last_message_at)}
                  </p>
                </div>
                <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider shrink-0 ${STATUS_META[t.status].cls}`}>
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
