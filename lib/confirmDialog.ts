/**
 * Boîtes de confirmation et d'information, sans DOM (testables sous Jest).
 *
 * Règles :
 * - l'action (`run`) ne part QUE depuis `confirm()` (bouton d'action) ;
 *   Annuler, Échap et le clic à côté appellent `cancel()` et n'exécutent rien ;
 * - pendant l'action, la boîte reste ouverte et `busy` : ni Annuler, ni Échap,
 *   ni un second clic ne peuvent l'interrompre ou la relancer ;
 * - une information demandée pendant l'action (erreur) s'affiche à sa fin.
 */

export interface ConfirmField {
  label: string;
  defaultValue?: string;
  placeholder?: string;
}

export interface ConfirmRequest {
  /** Question posée. */
  title: string;
  /** Ligne qui identifie précisément l'élément. */
  element?: string;
  /** Conséquences réelles de l'action. */
  body?: string;
  /** Verbe précis du bouton d'action. */
  confirmLabel: string;
  cancelLabel?: string;
  /** Action destructive ou irréversible : bouton rouge. */
  danger?: boolean;
  /** Champ facultatif (motif…), transmis à `run`. */
  field?: ConfirmField;
  /** Troisième choix, lui aussi exécuté seulement sur clic. */
  secondary?: { label: string; run: () => unknown };
  /** L'action, exécutée seulement après clic sur le bouton d'action. */
  run: (value: string) => unknown;
}

export interface InfoRequest {
  title: string;
  body: string;
  /** Erreur : bouton « Fermer » ; information : « OK ». */
  kind: 'error' | 'info';
}

export type DialogState =
  | { kind: 'idle' }
  | { kind: 'confirm'; req: ConfirmRequest; busy: boolean; value: string }
  | { kind: 'info'; req: InfoRequest };

export interface DialogController {
  getState(): DialogState;
  subscribe(fn: () => void): () => void;
  /** Ouvre une confirmation ; résout `true` si l'action a été lancée, `false` sinon. */
  ask(req: ConfirmRequest): Promise<boolean>;
  /** Ouvre une information ; résout à sa fermeture. */
  inform(req: InfoRequest): Promise<void>;
  cancel(): void;
  setValue(value: string): void;
  confirm(): Promise<void>;
  confirmSecondary(): Promise<void>;
  close(): void;
}

export const ERROR_TITLE = 'L’action n’a pas abouti';

export function createDialogController(): DialogController {
  let state: DialogState = { kind: 'idle' };
  const listeners = new Set<() => void>();
  let settle: ((ran: boolean) => void) | null = null;
  let infoDone: (() => void) | null = null;
  let pendingInfo: { req: InfoRequest; done: () => void } | null = null;

  const set = (next: DialogState) => { state = next; listeners.forEach(l => l()); };
  const finish = (ran: boolean) => { const s = settle; settle = null; s?.(ran); };

  async function execute(fn: () => unknown) {
    if (state.kind !== 'confirm' || state.busy) return;
    set({ ...state, busy: true });
    try {
      await fn();
    } finally {
      finish(true);
      if (pendingInfo) {
        const p = pendingInfo; pendingInfo = null;
        infoDone = p.done;
        set({ kind: 'info', req: p.req });
      } else {
        set({ kind: 'idle' });
      }
    }
  }

  return {
    getState: () => state,
    subscribe(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    ask(req) {
      finish(false);
      return new Promise<boolean>(resolve => {
        settle = resolve;
        set({ kind: 'confirm', req, busy: false, value: req.field?.defaultValue ?? '' });
      });
    },
    inform(req) {
      return new Promise<void>(resolve => {
        if (state.kind === 'confirm' && state.busy) { pendingInfo = { req, done: resolve }; return; }
        finish(false);
        infoDone = resolve;
        set({ kind: 'info', req });
      });
    },
    cancel() {
      if (state.kind !== 'confirm' || state.busy) return;
      finish(false);
      set({ kind: 'idle' });
    },
    setValue(value) {
      if (state.kind === 'confirm' && !state.busy) set({ ...state, value });
    },
    confirm() {
      if (state.kind !== 'confirm') return Promise.resolve();
      const { run } = state.req; const value = state.value;
      return execute(() => run(value));
    },
    confirmSecondary() {
      if (state.kind !== 'confirm' || !state.req.secondary) return Promise.resolve();
      const { run } = state.req.secondary;
      return execute(() => run());
    },
    close() {
      if (state.kind !== 'info') return;
      const d = infoDone; infoDone = null;
      set({ kind: 'idle' });
      d?.();
    },
  };
}

/**
 * Gestionnaires branchés sur le Dialog Radix. Échap, clic à côté et fermeture
 * valent Annuler ; pendant l'action, ils sont neutralisés.
 */
export function dialogHandlers(ctrl: DialogController) {
  const busy = () => { const s = ctrl.getState(); return s.kind === 'confirm' && s.busy; };
  const dismiss = () => { const s = ctrl.getState(); if (s.kind === 'info') ctrl.close(); else ctrl.cancel(); };
  return {
    onOpenChange(open: boolean) { if (!open) dismiss(); },
    onEscapeKeyDown(e: { preventDefault(): void }) { if (busy()) e.preventDefault(); },
    onPointerDownOutside(e: { preventDefault(): void }) { if (busy()) e.preventDefault(); },
    onCancelClick() { ctrl.cancel(); },
    onConfirmClick() { return ctrl.confirm(); },
    onSecondaryClick() { return ctrl.confirmSecondary(); },
    onCloseClick() { ctrl.close(); },
  };
}

/** Date complète affichée dans les confirmations : « mardi 29 septembre 2026 ». */
export function fullDate(iso: string): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso);
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/** « 18:30:00 » → « 18:30 ». */
export const hhmm = (t: string | null | undefined) => (t ?? '').slice(0, 5);
