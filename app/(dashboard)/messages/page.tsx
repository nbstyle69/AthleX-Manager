'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Send, MessageSquare, Users2, Loader2, Hash, Megaphone } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getMyBox } from '@/lib/getMyBox';

interface Group { id: string; name: string; color: string | null; }
interface ChatMessage {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: { username: string };
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}
function formatDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (d.toDateString() === yesterday.toDateString()) return 'Hier';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function MessagesPage() {
  const supabase = createClient();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [boxId, setBoxId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const profilesCache = useRef<Record<string, { username: string }>>({});

  // Load groups + auth
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);
      const box = await getMyBox(supabase, user.id);
      if (!box) { setLoading(false); return; }
      setBoxId(box.id);
      const { data: grps } = await supabase
        .from('message_groups').select('id, name, color')
        .eq('box_id', box.id).order('created_at');
      setGroups(grps ?? []);
      if (grps?.length) setSelectedGroup(grps[0].id);
      setLoading(false);
    })();
  }, []);

  // Load messages for selected group
  const loadMessages = useCallback(async () => {
    if (!selectedGroup) return;
    setLoadingMsgs(true);
    const { data } = await supabase
      .from('group_messages')
      .select('id, group_id, sender_id, content, created_at')
      .eq('group_id', selectedGroup)
      .order('created_at', { ascending: true })
      .limit(200);
    const msgs = data ?? [];
    const unknownIds = [...new Set(msgs.map(m => m.sender_id))].filter(id => !profilesCache.current[id]);
    if (unknownIds.length) {
      const { data: profiles } = await supabase
        .from('profiles').select('id, username').in('id', unknownIds);
      (profiles ?? []).forEach((p: any) => {
        profilesCache.current[p.id] = { username: p.username };
      });
    }
    setMessages(msgs.map(m => ({
      ...m,
      sender: profilesCache.current[m.sender_id] ?? { username: 'Inconnu' },
    })));
    setLoadingMsgs(false);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, [selectedGroup]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  // Mark this box's messages as seen (dashboard "Messages non lus" reads this
  // cookie). Refreshed whenever the owner is viewing messages so anything that
  // arrives after they leave the page counts as unread.
  useEffect(() => {
    if (!boxId) return;
    document.cookie = `msg_seen_${boxId}=${new Date().toISOString()}; path=/; max-age=31536000; samesite=lax`;
  }, [boxId, messages]);

  // Realtime subscription
  useEffect(() => {
    if (!selectedGroup) return;
    const channel = supabase
      .channel(`group_chat:${selectedGroup}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'group_messages',
        filter: `group_id=eq.${selectedGroup}`,
      }, async (payload: any) => {
        const msg = payload.new as ChatMessage;
        if (!profilesCache.current[msg.sender_id]) {
          const { data: p } = await supabase.from('profiles').select('id, username').eq('id', msg.sender_id).single();
          if (p) profilesCache.current[p.id] = { username: p.username };
        }
        msg.sender = profilesCache.current[msg.sender_id] ?? { username: 'Inconnu' };
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedGroup]);

  // Send message
  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || !selectedGroup || !userId || sending) return;
    setSending(true);
    const { error } = await supabase.from('group_messages').insert({
      group_id: selectedGroup,
      sender_id: userId,
      content: newMessage.trim(),
    });
    setSending(false);
    if (!error) {
      setNewMessage('');
      // If realtime doesn't fire fast enough, reload
      setTimeout(() => loadMessages(), 300);
    }
  }

  const selectedGroupData = groups.find(g => g.id === selectedGroup);

  // Group messages by date
  function groupByDate(msgs: ChatMessage[]) {
    const result: { date: string; messages: ChatMessage[] }[] = [];
    let curDate = '';
    for (const msg of msgs) {
      const d = formatDate(msg.created_at);
      if (d !== curDate) {
        curDate = d;
        result.push({ date: d, messages: [msg] });
      } else {
        result[result.length - 1].messages.push(msg);
      }
    }
    return result;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-100px)]">
        <Loader2 className="animate-spin text-white" size={28} />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-100px)] gap-4">
      {/* Groups sidebar */}
      <div className="w-72 shrink-0 bg-[#111111] border border-white/8 rounded-2xl flex flex-col overflow-hidden">
        <div className="px-4 py-4 border-b border-white/8">
          <h2 className="text-sm font-black text-white">Conversations</h2>
          <p className="text-xs text-gray-500 mt-0.5">{groups.length} groupe(s)</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {groups.length === 0 ? (
            <div className="p-6 text-center">
              <Users2 size={28} className="text-gray-600 mx-auto mb-2" />
              <p className="text-xs text-gray-500">Aucun groupe</p>
              <Link href="/groups/new" className="text-xs text-white hover:underline mt-1 inline-block">
                Créer un groupe
              </Link>
            </div>
          ) : (
            groups.map(g => (
              <button
                key={g.id}
                onClick={() => setSelectedGroup(g.id)}
                className={`w-full text-left px-4 py-3.5 border-b border-white/5 transition-colors ${
                  selectedGroup === g.id ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${g.color ?? '#FFFFFF'}20` }}>
                    <Hash size={14} style={{ color: g.color ?? '#FFFFFF' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-bold truncate ${selectedGroup === g.id ? 'text-white' : 'text-gray-300'}`}>
                      {g.name}
                    </p>
                  </div>
                  {selectedGroup === g.id && (
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: g.color ?? '#FFFFFF' }} />
                  )}
                </div>
              </button>
            ))
          )}
        </div>
        {/* Announcement shortcut */}
        <Link href="/messages/new"
          className="flex items-center gap-2 px-4 py-3 border-t border-white/8 text-xs font-bold text-gray-400 hover:text-white transition-colors">
          <Megaphone size={13} /> Envoyer une annonce
        </Link>
      </div>

      {/* Chat area */}
      <div className="flex-1 bg-[#111111] border border-white/8 rounded-2xl flex flex-col overflow-hidden">
        {!selectedGroup ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare size={40} className="text-gray-600 mx-auto mb-3" />
              <p className="text-white font-bold">Sélectionnez un groupe</p>
              <p className="text-sm text-gray-500 mt-1">Choisissez une conversation pour discuter</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="px-5 py-3.5 border-b border-white/8 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${selectedGroupData?.color ?? '#FFFFFF'}20` }}>
                <Hash size={14} style={{ color: selectedGroupData?.color ?? '#FFFFFF' }} />
              </div>
              <div>
                <p className="text-sm font-bold text-white">{selectedGroupData?.name}</p>
              </div>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {loadingMsgs ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="animate-spin text-gray-500" size={20} />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <MessageSquare size={32} className="text-gray-700 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Aucun message</p>
                    <p className="text-xs text-gray-600 mt-0.5">Envoyez le premier message !</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {groupByDate(messages).map(dateGroup => (
                    <div key={dateGroup.date}>
                      {/* Date separator */}
                      <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px bg-white/5" />
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{dateGroup.date}</span>
                        <div className="flex-1 h-px bg-white/5" />
                      </div>
                      {/* Messages */}
                      {dateGroup.messages.map((msg, idx) => {
                        const isMe = msg.sender_id === userId;
                        const prev = dateGroup.messages[idx - 1];
                        const showName = !isMe && (!prev || prev.sender_id !== msg.sender_id);
                        return (
                          <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${showName ? 'mt-3' : 'mt-0.5'}`}>
                            <div className={`max-w-[70%]`}>
                              {showName && (
                                <p className="text-[10px] font-bold text-gray-500 mb-1 ml-1">
                                  {msg.sender?.username ?? 'Inconnu'}
                                </p>
                              )}
                              <div className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${
                                isMe
                                  ? 'bg-white text-[#0A0A0A] rounded-br-md'
                                  : 'bg-white/[0.06] text-gray-200 rounded-bl-md'
                              }`}>
                                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                                <p className={`text-[9px] mt-1 ${isMe ? 'text-white/50' : 'text-gray-600'}`}>
                                  {formatTime(msg.created_at)}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Message input */}
            <form onSubmit={sendMessage} className="px-4 py-3 border-t border-white/8">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder={`Message dans ${selectedGroupData?.name ?? 'le groupe'}...`}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white transition-colors"
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e); } }}
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || sending}
                  className="p-2.5 bg-white hover:bg-white/90 disabled:opacity-40 text-[#0A0A0A] rounded-xl transition-colors"
                >
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
