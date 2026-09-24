'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { getMyBox } from '@/lib/getMyBox';
import { Button } from '@/components/ui/button';

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
    const box = await getMyBox(supabase);
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

  const inp = 'w-full min-h-11 px-3 py-2.5 rounded-ax-control bg-ax-surface border border-ax-input-border text-base sm:text-sm text-ax-text placeholder:text-ax-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface transition-colors';

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/groups" className="text-ax-text-secondary hover:text-ax-text transition-colors"><ArrowLeft size={18} /></Link>
        <h1 className="font-display text-xl font-medium uppercase tracking-wide text-ax-text">Créer un groupe</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-ax-surface border border-ax-border rounded-ax-card p-6 space-y-5">
        {error && <div className="bg-ax-danger-soft border border-ax-danger rounded-ax-control px-4 py-3 text-sm text-ax-danger">{error}</div>}

        <div>
          <label className="block text-xs font-semibold text-ax-text-secondary mb-1.5 uppercase tracking-wider">Nom *</label>
          <input className={inp} value={name} onChange={e => setName(e.target.value)} placeholder="ex: Athlètes RX" required />
        </div>

        <div>
          <label className="block text-xs font-semibold text-ax-text-secondary mb-3 uppercase tracking-wider">Couleur</label>
          <div className="flex flex-wrap gap-3">
            {COLORS.map(c => (
              <button
                key={c} type="button"
                onClick={() => setColor(c)}
                aria-pressed={color === c} aria-label={c}
                className={`w-9 h-9 rounded-ax-control border border-ax-border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface ${color === c ? 'ring-2 ring-ax-text ring-offset-2 ring-offset-ax-surface scale-110' : 'hover:scale-105'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex items-center gap-3 mt-3">
            <div className="w-8 h-8 rounded-ax-control shrink-0 border border-ax-border" style={{ backgroundColor: color }} />
            <span className="text-sm text-ax-text-secondary font-mono">{color}</span>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-3 pt-2">
          <Button asChild variant="ax-outline"><Link href="/groups">Annuler</Link></Button>
          <Button type="submit" variant="ax-white" disabled={saving || !name.trim()}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            Créer et ajouter des membres
          </Button>
        </div>
      </form>
    </div>
  );
}
