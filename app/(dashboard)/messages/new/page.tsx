'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Loader2, Send } from 'lucide-react';
import Link from 'next/link';
import { getMyBox } from '@/lib/getMyBox';

const MSG_TYPES = [
  { value: 'announcement', label: 'Annonce', color: 'indigo' },
  { value: 'reminder',     label: 'Rappel',  color: 'amber' },
  { value: 'alert',        label: 'Alerte',  color: 'red' },
  { value: 'info',         label: 'Info',    color: 'gray' },
];

export default function NewMessagePage() {
  const router = useRouter();
  const supabase = createClient();

  const [title,    setTitle]    = useState('');
  const [body,     setBody]     = useState('');
  const [type,     setType]     = useState('announcement');
  const [groupId,  setGroupId]  = useState('');
  const [groups,   setGroups]   = useState<any[]>([]);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    // Pre-fill group from URL query param (?group=xxx)
    const params = new URLSearchParams(window.location.search);
    const gid = params.get('group');
    if (gid) setGroupId(gid);

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const box = await getMyBox(supabase, user.id);
      if (!box) return;
      const { data } = await supabase.from('message_groups').select('id, name').eq('box_id', box.id);
      setGroups(data ?? []);
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSaving(true);
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError('Non authentifié'); setSaving(false); return; }
    const box = await getMyBox(supabase, user.id);
    if (!box) { setError('Box introuvable'); setSaving(false); return; }

    const { error: err } = await supabase.from('box_messages').insert({
      box_id: box.id, title: title.trim() || null, body: body.trim(),
      type, target_group_id: groupId || null, sent_at: new Date().toISOString(),
    });
    if (err) { setSaving(false); setError(err.message); return; }

    // Diffuse aussi dans la table messages pour que l'app le reçoive en temps réel
    const content = title.trim() ? `${title.trim()}\n${body.trim()}` : body.trim();
    const { error: msgErr } = await supabase.from('messages').insert({
      box_id: box.id,
      sender_id: user.id,
      content,
      message_type: 'general',
      is_announcement: true,
    });
    setSaving(false);
    if (msgErr) { setError(`Message envoyé au back office mais erreur app: ${msgErr.message}`); return; }
    router.push('/messages');
    router.refresh();
  }

  const inp = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white transition-colors';

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/messages" className="text-gray-400 hover:text-white transition-colors"><ArrowLeft size={18} /></Link>
        <h1 className="text-xl font-black text-white">Envoyer un message</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-[#111111] border border-white/8 rounded-2xl p-6 space-y-5">
        {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>}

        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Type</label>
          <div className="flex gap-2 flex-wrap">
            {MSG_TYPES.map(t => (
              <button key={t.value} type="button" onClick={() => setType(t.value)}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${
                  type === t.value
                    ? 'border-white bg-white/20 text-white'
                    : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20'
                }`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Titre (optionnel)</label>
          <input className={inp} value={title} onChange={e => setTitle(e.target.value)} placeholder="Titre de la notification..." />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Message *</label>
          <textarea className={`${inp} min-h-[120px] resize-y`} value={body} onChange={e => setBody(e.target.value)} placeholder="Contenu du message..." required />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Groupe cible</label>
          <select className={inp} value={groupId} onChange={e => setGroupId(e.target.value)}>
            <option value="" className="text-black">Tous les membres</option>
            {groups.map((g: any) => <option key={g.id} value={g.id} className="text-black">{g.name}</option>)}
          </select>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link href="/messages" className="px-4 py-2.5 text-sm text-gray-400 hover:text-white border border-white/10 rounded-xl">Annuler</Link>
          <button type="submit" disabled={saving || !body.trim()}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold bg-white hover:bg-white text-[#0A0A0A] rounded-xl disabled:opacity-60 transition-colors">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Envoyer
          </button>
        </div>
      </form>
    </div>
  );
}
