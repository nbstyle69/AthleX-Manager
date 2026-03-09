'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Plus, MessageSquare, Users2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Group { id: string; name: string; color: string | null; }
interface Msg   { id: string; title: string | null; body: string; type: string; sent_at: string; target_group_id: string | null; message_groups: { name: string } | null; }

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function MessagesPage() {
  const supabase = createClient();
  const [groups,     setGroups]     = useState<Group[]>([]);
  const [messages,   setMessages]   = useState<Msg[]>([]);
  const [activeTab,  setActiveTab]  = useState<string | null>(null); // null = "Tous"
  const [loading,    setLoading]    = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data: box } = await supabase.from('boxes').select('id').eq('owner_id', user.id).single();
    if (!box) { setLoading(false); return; }

    const [{ data: grps }, { data: msgs }] = await Promise.all([
      supabase.from('message_groups').select('id, name, color').eq('box_id', box.id).order('created_at'),
      supabase.from('box_messages')
        .select('id, title, body, type, sent_at, target_group_id, message_groups(name)')
        .eq('box_id', box.id)
        .order('sent_at', { ascending: false })
        .limit(100),
    ]);
    setGroups(grps ?? []);
    setMessages((msgs ?? []).map((m: any) => ({
      ...m,
      message_groups: Array.isArray(m.message_groups) ? m.message_groups[0] ?? null : m.message_groups,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = activeTab === null
    ? messages
    : messages.filter(m => m.target_group_id === activeTab);

  const typeColor = (t: string) =>
    t === 'announcement' ? { bg: 'bg-[#C9A227]/20', txt: 'text-[#C9A227]' } :
    t === 'alert'        ? { bg: 'bg-red-500/20',   txt: 'text-red-400'   } :
    t === 'reminder'     ? { bg: 'bg-amber-500/20', txt: 'text-amber-400' } :
                           { bg: 'bg-gray-500/20',  txt: 'text-gray-400'  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Messages</h1>
          <p className="text-sm text-gray-400 mt-1">Notifications envoyées aux membres</p>
        </div>
        <Link href="/messages/new"
          className="flex items-center gap-2 bg-[#C9A227] text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors hover:opacity-90">
          <Plus size={15} /> Envoyer un message
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setActiveTab(null)}
          className={`text-sm font-bold px-4 py-2 rounded-xl border transition-colors ${
            activeTab === null
              ? 'bg-[#C9A227] border-[#C9A227] text-white'
              : 'border-white/10 text-gray-400 hover:border-white/20 hover:text-white'
          }`}>
          Tous
        </button>
        {groups.map(g => (
          <button key={g.id}
            onClick={() => setActiveTab(g.id)}
            className={`text-sm font-bold px-4 py-2 rounded-xl border transition-colors ${
              activeTab === g.id
                ? 'text-white border-transparent'
                : 'border-white/10 text-gray-400 hover:border-white/20 hover:text-white'
            }`}
            style={activeTab === g.id ? { backgroundColor: g.color ?? '#C9A227', borderColor: g.color ?? '#C9A227' } : {}}>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: g.color ?? '#C9A227' }} />
              {g.name}
            </span>
          </button>
        ))}
        {!loading && groups.length === 0 && (
          <Link href="/groups/new" className="text-xs text-[#C9A227] hover:underline flex items-center gap-1">
            <Users2 size={12} /> Créer un groupe
          </Link>
        )}
      </div>

      {/* Messages list */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 text-sm">Chargement…</div>
      ) : !filtered.length ? (
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-12 text-center">
          <MessageSquare size={40} className="text-gray-600 mx-auto mb-4" />
          <p className="text-white font-bold mb-1">Aucun message {activeTab ? 'dans ce groupe' : 'envoyé'}</p>
          <p className="text-sm text-gray-500">Envoyez des notifications à vos membres depuis ici.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(msg => {
            const c = typeColor(msg.type);
            return (
              <div key={msg.id} className="bg-[#111111] border border-white/8 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${c.bg}`}>
                      <MessageSquare size={16} className={c.txt} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        {msg.title && <p className="text-sm font-bold text-white">{msg.title}</p>}
                        <span className="text-[10px] font-bold uppercase text-gray-500 bg-white/5 px-2 py-0.5 rounded">{msg.type}</span>
                        {msg.message_groups && (
                          <span className="text-[10px] text-[#C9A227] bg-[#C9A227]/10 px-2 py-0.5 rounded">→ {msg.message_groups.name}</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400 line-clamp-2">{msg.body}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 shrink-0 mt-0.5">{formatDateTime(msg.sent_at)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
