'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Destination du logo sur les pages publiques, résolue par le rôle.
 *
 * La source est la même que côté serveur (`get_my_admin_boxes()`) : gérant et
 * co-gérant rentrent au back-office, coach au Whiteboard, adhérent connecté
 * dans son espace, visiteur sur la landing. Le repli est `/landing` : tant que
 * le rôle n'est pas prononcé, le lien vaut celui d'un visiteur, jamais celui
 * d'un gérant.
 */
export function useHomeHref(): string {
  const [href, setHref] = useState('/landing');

  useEffect(() => {
    let vivant = true;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase.rpc('get_my_admin_boxes');
      if (!vivant) return;
      if (error) {
        setHref('/compte');
        return;
      }
      const boxes: { my_role: string }[] = data ?? [];
      if (boxes.some((b) => b.my_role === 'owner')) setHref('/');
      else if (boxes.length > 0) setHref('/wods');
      else setHref('/compte');
    })();
    return () => { vivant = false; };
  }, []);

  return href;
}
