'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  LifeBuoy, Plus, Loader2, Send, ArrowLeft, HelpCircle, Bug, Lightbulb, Check,
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
  requester_unread: boolean;
  last_message_at: string;
  created_at: string;
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

export default function OwnerSupport({ boxId, userId }: { boxId: string; userId: string }) {
  const supabase = createClient();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [active, setActive] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  // new ticket form
  const [newType, setNewType] = useState<TicketType>('question');
  const [newSubject, setNewSubject] = useState('');
  const [newBody, setNewBody] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('box_id', boxId)
      .order('last_message_at', { ascending: false });
    setTickets((data ?? []) as Ticket[]);
    setLoading(false);
  }, [supabase, boxId]);

  useEffect(() => { load(); }, [load]);

  async function openTicket(t: Ticket) {
    setActive(t);
    const { data } = await supabase
      .from('support_messages')
      .select('*')
      .eq('ticket_id', t.id)
      .order('created_at', { ascending: true });
    setMessages((data ?? []) as Message[]);
    if (t.requester_unread) {
      await supabase.from('support_tickets').update({ requester_unread: false }).eq('id', t.id);
      setTickets(prev => prev.map(x => x.id === t.id ? { ...x, requester_unread: false } : x));
    }
  }

  async function createTicket() {
    if (!newSubject.trim() || !newBody.trim()) return;
    setSending(true);
    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .insert({ box_id: boxId, created_by: userId, type: newType, subject: newSubject.trim(), status: 'open' })
      .select()
      .single();
    if (!error && ticket) {
      await supabase.from('support_messages').insert({
        ticket_id: (ticket as Ticket).id, sender_id: userId, sender_role: 'requester', body: newBody.trim(),
      });
      setNewSubject(''); setNewBody(''); setNewType('question'); setCreating(false);
      await load();
    }
    setSending(false);
  }

  async function sendReply() {
    if (!active || !reply.trim()) return;
    setSending(true);
    const body = reply.trim();
    const { error } = await supabase.from('support_messages').insert({
      ticket_id: active.id, sender_id: userId, sender_role: 'requester', body,
    });
    if (!error) {
      setReply('');
      const { data } = await supabase
        .from('support_messages').select('*').eq('ticket_id', active.id).order('created_at', { ascending: true });
      setMessages((data ?? []) as Message[]);
    }
    setSending(false);
  }

  async function markResolved() {
    if (!active) return;
    await supabase.from('support_tickets').update({ status: 'resolved' }).eq('id', active.id);
    setActive({ ...active, status: 'resolved' });
    setTickets(prev => prev.map(x => x.id === active.id ? { ...x, status: 'resolved' } : x));
  }

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
            {active.status !== 'resolved' && (
              <button onClick={markResolved} className="ml-auto flex items-center gap-1 text-xs font-bold text-emerald-400 hover:text-emerald-300">
                <Check size={13} /> Marquer résolu
              </button>
            )}
          </div>
        </div>

        <div className="space-y-3 mb-4">
          {messages.map(m => {
            const mine = m.sender_role === 'requester';
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${mine ? 'bg-white/10 text-white' : 'bg-emerald-500/15 border border-emerald-500/20 text-white'}`}>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-60">
                    {mine ? 'Vous' : 'Support AthleX'} · {fmt(m.created_at)}
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{m.body}</p>
                </div>
              </div>
            );
          })}
        </div>

        {active.status !== 'resolved' && (
          <div className="flex gap-2 items-end">
            <textarea
              value={reply} onChange={e => setReply(e.target.value)} rows={2}
              placeholder="Votre message..."
              className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm resize-none focus:outline-none focus:border-white/20"
            />
            <button onClick={sendReply} disabled={sending || !reply.trim()}
              className="bg-white text-[#0A0A0A] font-bold px-4 py-3 rounded-xl text-sm inline-flex items-center gap-1.5 disabled:opacity-40">
              {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── list / create view ───────────────────────────────────────────────
  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-3">
            <LifeBuoy size={24} /> Support
          </h1>
          <p className="text-sm text-gray-400 mt-1">Une question, un bug ou une idée pour AthleX Manager ? Contactez l&apos;équipe AthleX.</p>
        </div>
        {!creating && (
          <button onClick={() => setCreating(true)}
            className="bg-white text-[#0A0A0A] font-bold px-4 py-2.5 rounded-xl text-sm inline-flex items-center gap-1.5 hover:bg-gray-200">
            <Plus size={16} /> Nouvelle demande
          </button>
        )}
      </div>

      {creating && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 space-y-4">
          <div className="flex gap-2">
            {(Object.keys(TYPE_META) as TicketType[]).map(k => {
              const m = TYPE_META[k];
              return (
                <button key={k} onClick={() => setNewType(k)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                    newType === k ? 'bg-white/15 border-white/25 text-white' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}>
                  <m.icon size={14} className={m.color} /> {m.label}
                </button>
              );
            })}
          </div>
          <input value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="Titre de la demande"
            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-white/20" />
          <textarea value={newBody} onChange={e => setNewBody(e.target.value)} rows={4} placeholder="Décrivez votre demande..."
            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm resize-none focus:outline-none focus:border-white/20" />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setCreating(false)} className="px-4 py-2.5 rounded-xl text-sm font-bold text-gray-400 hover:text-white">Annuler</button>
            <button onClick={createTicket} disabled={sending || !newSubject.trim() || !newBody.trim()}
              className="bg-white text-[#0A0A0A] font-bold px-4 py-2.5 rounded-xl text-sm inline-flex items-center gap-1.5 disabled:opacity-40">
              {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Envoyer
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-gray-400 py-8"><Loader2 size={18} className="animate-spin" /> Chargement...</div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <LifeBuoy size={48} className="mx-auto mb-3 opacity-30" />
          <p>Aucune demande pour le moment</p>
        </div>
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
                    {t.requester_unread && <span className="w-2 h-2 rounded-full bg-white shrink-0" />}
                  </div>
                  <p className="text-xs text-gray-500">{m.label} · {fmt(t.last_message_at)}</p>
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
