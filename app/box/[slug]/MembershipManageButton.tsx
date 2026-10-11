'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Settings2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

/** L'appelant a une adhésion active dans cette box (lignes de get_my_membership_billing). */
export function isActiveMemberOf(rows: { box_id: string; status: string | null }[] | null | undefined, boxId: string) {
  return (rows ?? []).some((r) => r.box_id === boxId && r.status === 'active');
}

/**
 * « Changer de formule » sur la page publique : un lien vers /compte, où se
 * fait le changement (même règle que l'app). Affiché seulement à un membre
 * connecté de cette box ; la page publique est la même pour tous, la
 * vérification se fait donc ici, après le chargement.
 */
export default function MembershipManageButton({ boxId }: { boxId: string }) {
  const [member, setMember] = useState(false);

  useEffect(() => {
    let vivant = true;
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.rpc('get_my_membership_billing');
      if (vivant) setMember(isActiveMemberOf(data as { box_id: string; status: string | null }[] | null, boxId));
    }).catch(() => {});
    return () => { vivant = false; };
  }, [boxId]);

  if (!member) return null;
  return (
    <Link
      href="/compte"
      className="inline-flex items-center gap-2 text-xs font-semibold text-ax-text border border-ax-border hover:bg-ax-hover transition-colors px-4 py-2 rounded-ax-control"
    >
      <Settings2 size={14} /> Changer de formule
    </Link>
  );
}
