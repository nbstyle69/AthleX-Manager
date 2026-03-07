import { createClient, getOwnerBox } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Plus, MessageSquare } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

export default async function MessagesPage() {
  const supabase = await createClient();
  const box = await getOwnerBox(supabase);
  if (!box) redirect('/login');

  const { data: messages } = await supabase
    .from('box_messages')
    .select('id, title, body, type, sent_at, target_group_id, message_groups(name)')
    .eq('box_id', box.id)
    .order('sent_at', { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Messages</h1>
          <p className="text-sm text-gray-400 mt-1">Notifications envoyées aux membres</p>
        </div>
        <Link href="/messages/new"
          className="flex items-center gap-2 bg-[#C9A227] hover:bg-[#C9A227] text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors">
          <Plus size={15} /> Envoyer un message
        </Link>
      </div>

      {!messages?.length ? (
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-12 text-center">
          <MessageSquare size={40} className="text-gray-600 mx-auto mb-4" />
          <p className="text-white font-bold mb-1">Aucun message envoyé</p>
          <p className="text-sm text-gray-500">Envoyez des notifications push à vos membres directement depuis ici.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((msg: any) => {
            const group = Array.isArray(msg.message_groups) ? msg.message_groups[0] : msg.message_groups;
            return (
              <div key={msg.id} className="bg-[#111111] border border-white/8 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      msg.type === 'announcement' ? 'bg-[#C9A227]/20' :
                      msg.type === 'alert'        ? 'bg-red-500/20' :
                      msg.type === 'reminder'     ? 'bg-amber-500/20' : 'bg-gray-500/20'
                    }`}>
                      <MessageSquare size={16} className={
                        msg.type === 'announcement' ? 'text-[#C9A227]' :
                        msg.type === 'alert'        ? 'text-red-400' :
                        msg.type === 'reminder'     ? 'text-amber-400' : 'text-gray-400'
                      } />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="text-sm font-bold text-white">{msg.title}</p>
                        <span className="text-[10px] font-bold uppercase text-gray-500 bg-white/5 px-2 py-0.5 rounded">{msg.type ?? 'info'}</span>
                        {group && <span className="text-[10px] text-[#C9A227] bg-[#C9A227]/10 px-2 py-0.5 rounded">→ {group.name}</span>}
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
