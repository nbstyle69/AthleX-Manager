'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { getMyBox } from '@/lib/getMyBox';

const COLORS = [
  '#FFFFFF', '#8B5CF6', '#EC4899', '#EF4444',
  '#F59E0B', '#10B981', '#3B82F6', '#14B8A6',
  '#F97316', '#84CC16',
];

export default function NewGroupPage() {
  const router = useRouter();
  const [name,   setName]   = useState('');
  const [color,  setColor]  = useState('#FFFFFF');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError('Non authentifié'); setSaving(false); return; }
    const box = await getMyBox(supabase, user.id);
    if (!box) { setError('Box introuvable'); setSaving(false); return; }
    const { data: created, error: err } = await supabase
      .from('message_groups')
      .insert({ name, color, box_id: box.id, created_by: user.id, members: [] })
      .select('id')
      .single();
    setSaving(false);
    if (err) { setError(err.message); return; }
    router.push(`/groups/${created.id}`);
  }

  const inp = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white transition-colors';

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/groups" className="text-gray-400 hover:text-white transition-colors"><ArrowLeft size={18} /></Link>
        <h1 className="text-xl font-black text-white">Créer un groupe</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-[#111111] border border-white/8 rounded-2xl p-6 space-y-5">
        {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>}

        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Nom *</label>
          <input className={inp} value={name} onChange={e => setName(e.target.value)} placeholder="ex: Athlètes RX" required />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider">Couleur</label>
          <div className="flex flex-wrap gap-3">
            {COLORS.map(c => (
              <button
                key={c} type="button"
                onClick={() => setColor(c)}
                className={`w-9 h-9 rounded-xl transition-all ${color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[#111111] scale-110' : 'hover:scale-105'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex items-center gap-3 mt-3">
            <div className="w-8 h-8 rounded-xl shrink-0" style={{ backgroundColor: color }} />
            <span className="text-sm text-gray-400 font-mono">{color}</span>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link href="/groups" className="px-4 py-2.5 text-sm text-gray-400 hover:text-white border border-white/10 rounded-xl">Annuler</Link>
          <button type="submit" disabled={saving || !name.trim()} className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold bg-white hover:bg-white text-[#0A0A0A] rounded-xl disabled:opacity-60">
            {saving && <Loader2 size={14} className="animate-spin" />}
            Créer et ajouter des membres
          </button>
        </div>
      </form>
    </div>
  );
}
