'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Loader2, UserPlus, UserMinus, Users2, MessageSquare } from 'lucide-react';
import Link from 'next/link';

interface Member { id: string; username: string; level: string; email: string; }

export default function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = use(params);
  const router = useRouter();
  const supabase = createClient();

  const [group,        setGroup]        = useState<{ id: string; name: string; color: string } | null>(null);
  const [members,      setMembers]      = useState<Member[]>([]);
  const [allMembers,   setAllMembers]   = useState<Member[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [toggling,     setToggling]     = useState<string | null>(null);
  const [deleting,     setDeleting]     = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    const { data: box } = await supabase.from('boxes').select('id').eq('owner_id', user.id).single();
    if (!box) { router.push('/login'); return; }

    const [{ data: grp }, { data: grpMembers }, { data: boxMembers }] = await Promise.all([
      supabase.from('message_groups').select('id, name, color').eq('id', groupId).single(),
      supabase.from('message_group_members')
        .select('member_id, profiles(id, username, level, email)')
        .eq('group_id', groupId),
      supabase.from('box_members')
        .select('member_id, profiles(id, username, level, email)')
        .eq('box_id', box.id)
        .eq('status', 'active'),
    ]);

    if (!grp) { router.push('/groups'); return; }
    setGroup(grp);

    const inGroup = (grpMembers ?? []).map((m: any) => {
      const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      return p ? { id: p.id, username: p.username, level: p.level, email: p.email ?? '' } : null;
    }).filter(Boolean) as Member[];
    setMembers(inGroup);

    const all = (boxMembers ?? []).map((m: any) => {
      const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      return p ? { id: p.id, username: p.username, level: p.level, email: p.email ?? '' } : null;
    }).filter(Boolean) as Member[];
    setAllMembers(all);

    setLoading(false);
  }, [groupId]);

  useEffect(() => { load(); }, [load]);

  const inGroupIds = new Set(members.map(m => m.id));

  async function toggleMember(memberId: string) {
    setToggling(memberId);
    setError(null);
    if (inGroupIds.has(memberId)) {
      const { error: e } = await supabase.from('message_group_members')
        .delete().eq('group_id', groupId).eq('member_id', memberId);
      if (e) { setError(e.message); } else { setMembers(prev => prev.filter(m => m.id !== memberId)); }
    } else {
      const { error: e } = await supabase.from('message_group_members')
        .insert({ group_id: groupId, member_id: memberId });
      if (e) { setError(e.message); } else {
        const added = allMembers.find(m => m.id === memberId);
        if (added) setMembers(prev => [...prev, added]);
      }
    }
    setToggling(null);
  }

  async function deleteGroup() {
    if (!confirm('Supprimer ce groupe ? Les messages associés resteront.')) return;
    setDeleting(true);
    await supabase.from('message_group_members').delete().eq('group_id', groupId);
    await supabase.from('message_groups').delete().eq('id', groupId);
    router.push('/groups');
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[200px]">
      <Loader2 size={24} className="animate-spin text-[#C9A227]" />
    </div>
  );

  if (!group) return null;

  const notInGroup = allMembers.filter(m => !inGroupIds.has(m.id));

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/groups" className="text-gray-400 hover:text-white transition-colors"><ArrowLeft size={18} /></Link>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${group.color}25` }}>
              <Users2 size={18} style={{ color: group.color }} />
            </div>
            <div>
              <h1 className="text-xl font-black text-white">{group.name}</h1>
              <p className="text-xs text-gray-500">{members.length} membre(s)</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/messages/new?group=${groupId}`}
            className="flex items-center gap-1.5 text-sm font-bold px-3 py-2 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-colors">
            <MessageSquare size={13} /> Message
          </Link>
          <button onClick={deleteGroup} disabled={deleting}
            className="text-xs font-bold px-3 py-2 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors">
            {deleting ? <Loader2 size={12} className="animate-spin" /> : 'Supprimer'}
          </button>
        </div>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>}

      {/* Members in group */}
      <div className="bg-[#111111] border border-white/8 rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-white/8">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Membres du groupe</p>
        </div>
        {members.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-500">Aucun membre dans ce groupe.</div>
        ) : (
          members.map(m => (
            <div key={m.id} className="flex items-center justify-between px-5 py-3.5 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-[#C9A227] bg-[#C9A227]/10">
                  {(m.username ?? '?')[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{m.username}</p>
                  <p className="text-xs text-gray-500">{m.email}</p>
                </div>
              </div>
              <button onClick={() => toggleMember(m.id)} disabled={toggling === m.id}
                className="flex items-center gap-1.5 text-xs font-bold text-red-400 hover:text-red-300 transition-colors">
                {toggling === m.id ? <Loader2 size={12} className="animate-spin" /> : <UserMinus size={13} />}
                Retirer
              </button>
            </div>
          ))
        )}
      </div>

      {/* Members to add */}
      {notInGroup.length > 0 && (
        <div className="bg-[#111111] border border-white/8 rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-white/8">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Ajouter des membres</p>
          </div>
          {notInGroup.map(m => (
            <div key={m.id} className="flex items-center justify-between px-5 py-3.5 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-gray-400 bg-white/5">
                  {(m.username ?? '?')[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-300">{m.username}</p>
                  <p className="text-xs text-gray-600">{m.level?.toUpperCase()}</p>
                </div>
              </div>
              <button onClick={() => toggleMember(m.id)} disabled={toggling === m.id}
                className="flex items-center gap-1.5 text-xs font-bold text-[#C9A227] hover:text-[#C9A227]/80 transition-colors">
                {toggling === m.id ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={13} />}
                Ajouter
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
