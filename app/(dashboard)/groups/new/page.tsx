'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function NewGroupPage() {
  const router = useRouter();
  const [name, setName]         = useState('');
  const [desc, setDesc]         = useState('');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError('Non authentifié'); setSaving(false); return; }
    const { data: box } = await supabase.from('boxes').select('id').eq('owner_id', user.id).single();
    if (!box) { setError('Box introuvable'); setSaving(false); return; }
    const { error: err } = await supabase.from('message_groups').insert({ name, description: desc, box_id: box.id, created_by: user.id });
    setSaving(false);
    if (err) { setError(err.message); return; }
    router.push('/groups');
    router.refresh();
  }

  const inp = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-indigo-500 transition-colors';

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/groups" className="text-gray-400 hover:text-white transition-colors"><ArrowLeft size={18} /></Link>
        <h1 className="text-xl font-black text-white">Créer un groupe</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-[#16162A] border border-white/8 rounded-2xl p-6 space-y-5">
        {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>}
        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Nom *</label>
          <input className={inp} value={name} onChange={e => setName(e.target.value)} placeholder="ex: Athlètes RX" required />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Description</label>
          <textarea className={`${inp} min-h-[80px] resize-y`} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description optionnelle..." />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Link href="/groups" className="px-4 py-2.5 text-sm text-gray-400 hover:text-white border border-white/10 rounded-xl">Annuler</Link>
          <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl disabled:opacity-60">
            {saving && <Loader2 size={14} className="animate-spin" />}
            Créer
          </button>
        </div>
      </form>
    </div>
  );
}
