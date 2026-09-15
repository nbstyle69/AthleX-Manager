'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  getMovementCatalog,
  getMovementCatalogSource,
  loadMovementCatalog,
  type CatalogMovement,
  type MovementCatalogSource,
} from '@/lib/movementCatalog';

let pending: Promise<MovementCatalogSource> | null = null;

/**
 * Catalogue de mouvements côté client : rend immédiatement le store (snapshot
 * embarqué), puis la liste Supabase une fois chargée (une seule requête par
 * page, partagée entre les composants). Inactifs compris.
 */
export function useMovementCatalog(): { catalog: CatalogMovement[]; source: MovementCatalogSource } {
  const [catalog, setCatalog] = useState<CatalogMovement[]>(getMovementCatalog);
  const [source, setSource] = useState<MovementCatalogSource>(getMovementCatalogSource);

  useEffect(() => {
    let alive = true;
    if (getMovementCatalogSource() === 'supabase') {
      setCatalog(getMovementCatalog());
      setSource('supabase');
      return;
    }
    pending ??= loadMovementCatalog(createClient()).finally(() => { pending = null; });
    pending.then(src => {
      if (!alive) return;
      setCatalog(getMovementCatalog());
      setSource(src);
    });
    return () => { alive = false; };
  }, []);

  return { catalog, source };
}
