'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Loader2 } from 'lucide-react';
import { useMemo, useReducer, useEffect, useRef, type MutableRefObject, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  confirmAction,
  createDialogController,
  dialogHandlers,
  infoButtonLabel,
  type ConfirmRequest,
  type InfoRequest,
} from '@/lib/confirmDialog';

/**
 * Boîte de confirmation (et d'information) de l'application, bâtie sur le
 * Dialog Radix déjà présent. Toute la logique vit dans `lib/confirmDialog.ts` :
 * ce composant ne fait que l'afficher.
 *
 * Usage : `const { dialog, ask, inform } = useConfirmDialog();` puis
 * `{dialog}` dans le rendu et `ask({ …, run: () => action() })` au clic.
 */
export function useConfirmDialog(): {
  dialog: ReactNode;
  ask: (req: ConfirmRequest) => Promise<boolean>;
  inform: (req: InfoRequest) => Promise<void>;
} {
  const ctrl = useMemo(() => createDialogController(), []);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  useEffect(() => ctrl.subscribe(rerender), [ctrl]);
  // Sans `Dialog.Trigger`, Radix ne sait pas à qui rendre le focus : on retient
  // l'élément actif au moment d'ouvrir (le bouton qui a déclenché la boîte).
  const returnFocus = useRef<HTMLElement | null>(null);
  const remember = () => {
    if (ctrl.getState().kind === 'idle' && typeof document !== 'undefined') {
      returnFocus.current = document.activeElement as HTMLElement | null;
    }
  };
  return {
    dialog: <ConfirmDialogView ctrl={ctrl} returnFocus={returnFocus} />,
    ask: req => { remember(); return ctrl.ask(req); },
    inform: req => { remember(); return ctrl.inform(req); },
  };
}

function ConfirmDialogView({ ctrl, returnFocus }: {
  ctrl: ReturnType<typeof createDialogController>;
  returnFocus: MutableRefObject<HTMLElement | null>;
}) {
  const state = ctrl.getState();
  const h = useMemo(() => dialogHandlers(ctrl), [ctrl]);
  const defaultFocus = useRef<HTMLButtonElement>(null);
  const open = state.kind !== 'idle';
  const busy = state.kind === 'confirm' && state.busy;
  // Une erreur qui remplace la confirmation ouverte ne repasse pas par
  // l'ouverture de Radix : le focus va à son bouton « Fermer ».
  useEffect(() => { if (state.kind === 'info') defaultFocus.current?.focus(); }, [state.kind]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={h.onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-ax-overlay backdrop-blur-sm" />
        <DialogPrimitive.Content
          data-testid="confirm-dialog"
          role={state.kind === 'confirm' ? 'alertdialog' : 'dialog'}
          onOpenAutoFocus={e => { e.preventDefault(); defaultFocus.current?.focus(); }}
          onCloseAutoFocus={e => { e.preventDefault(); returnFocus.current?.focus(); returnFocus.current = null; }}
          onEscapeKeyDown={h.onEscapeKeyDown}
          onPointerDownOutside={h.onPointerDownOutside}
          aria-busy={busy || undefined}
          className="fixed left-1/2 top-1/2 z-[60] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 max-h-[calc(100vh-2rem)] overflow-y-auto rounded-ax-panel border border-ax-border bg-ax-surface p-5 text-ax-text shadow-ax-panel outline-none sm:p-6"
        >
          {state.kind === 'confirm' && (
            <>
              <DialogPrimitive.Title className="font-display text-xl font-medium tracking-wide text-ax-text break-words">
                {state.req.title}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description asChild>
                <div className="mt-3 space-y-2 text-sm">
                  {state.req.element && <p className="font-semibold text-ax-text break-words">{state.req.element}</p>}
                  {state.req.warning && (
                    <p className="rounded-ax-control border border-ax-warning bg-ax-warning-soft px-3 py-2 font-semibold leading-relaxed text-ax-warning break-words">
                      {state.req.warning}
                    </p>
                  )}
                  {state.req.body && <p className="whitespace-pre-line leading-relaxed text-ax-text-secondary break-words">{state.req.body}</p>}
                </div>
              </DialogPrimitive.Description>
              {state.req.choices && state.req.choices.length > 0 && (
                <fieldset className="mt-4 space-y-2" data-testid="confirm-dialog-choices">
                  <legend className="sr-only">{state.req.title}</legend>
                  {state.req.choices.map(c => (
                    <label
                      key={c.value}
                      className={`flex cursor-pointer items-start gap-3 rounded-ax-control border px-3 py-2.5 transition-colors ${
                        state.choice === c.value ? 'border-ax-focus bg-ax-hover' : 'border-ax-border hover:border-ax-input-border'
                      }`}
                    >
                      <input
                        type="radio"
                        name="confirm-dialog-choice"
                        value={c.value}
                        checked={state.choice === c.value}
                        disabled={busy}
                        onChange={() => ctrl.setChoice(c.value)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-ax-accent"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-ax-text break-words">{c.label}</span>
                        {c.description && (
                          <span className="mt-0.5 block text-xs leading-relaxed text-ax-text-secondary break-words">{c.description}</span>
                        )}
                      </span>
                    </label>
                  ))}
                </fieldset>
              )}
              {state.req.field && (
                <label className="mt-4 block text-xs font-semibold text-ax-text-secondary">
                  {state.req.field.label}
                  <Input
                    className="mt-1.5"
                    value={state.value}
                    placeholder={state.req.field.placeholder}
                    disabled={busy}
                    onChange={e => ctrl.setValue(e.target.value)}
                  />
                </label>
              )}
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                <Button ref={defaultFocus} variant="ax-outline" onClick={h.onCancelClick} disabled={busy}>
                  {state.req.cancelLabel ?? 'Annuler'}
                </Button>
                {state.req.secondary && (
                  <Button variant="ax-outline" onClick={h.onSecondaryClick} disabled={busy}>
                    {state.req.secondary.label}
                  </Button>
                )}
                <Button
                  variant={confirmAction(state).danger ? 'ax-danger' : 'ax-white'}
                  onClick={h.onConfirmClick}
                  disabled={busy}
                  data-testid="confirm-dialog-action"
                >
                  {busy && <Loader2 size={15} className="animate-spin" aria-hidden />}
                  {confirmAction(state).label}
                </Button>
              </div>
            </>
          )}
          {state.kind === 'info' && (
            <>
              <DialogPrimitive.Title className="font-display text-xl font-medium tracking-wide text-ax-text break-words">
                {state.req.title}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ax-text-secondary break-words">
                {state.req.body}
              </DialogPrimitive.Description>
              <div className="mt-6 flex justify-end">
                <Button ref={defaultFocus} variant="ax-white" onClick={h.onCloseClick} className="w-full sm:w-auto">
                  {infoButtonLabel(state.req)}
                </Button>
              </div>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
