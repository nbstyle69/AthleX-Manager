import { useEffect, useRef } from 'react';

/**
 * Fenêtres maison du super-admin (Changelog, Partenaires ; lot 7b) : Échap
 * ferme sans rien enregistrer, comme les boîtes `ConfirmDialog`, et le focus
 * revient sur le bouton qui a ouvert la fenêtre.
 */

type KeyEventLike = Pick<KeyboardEvent, 'key' | 'defaultPrevented' | 'preventDefault'>;

interface DocLike {
  activeElement: unknown;
  addEventListener(type: 'keydown', fn: (e: KeyEventLike) => void): void;
  removeEventListener(type: 'keydown', fn: (e: KeyEventLike) => void): void;
}

/** Échap seul appelle `close` ; une touche déjà traitée ailleurs est ignorée. */
export function escapeHandler(close: () => void) {
  return (e: KeyEventLike) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    e.preventDefault();
    close();
  };
}

/**
 * Écoute Échap tant que la fenêtre est ouverte. Le nettoyage (à la fermeture,
 * quelle qu'en soit la voie) rend le focus à l'élément actif à l'ouverture.
 */
export function bindModalEscape(doc: DocLike, close: () => void): () => void {
  const opener = doc.activeElement as { focus?: () => void } | null;
  const onKey = escapeHandler(close);
  doc.addEventListener('keydown', onKey);
  return () => {
    doc.removeEventListener('keydown', onKey);
    opener?.focus?.();
  };
}

export function useModalEscape(open: boolean, close: () => void) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    return bindModalEscape(document as unknown as DocLike, () => closeRef.current());
  }, [open]);
}
