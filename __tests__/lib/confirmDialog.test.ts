import { createDialogController, dialogHandlers, fullDate, hhmm, ERROR_TITLE } from '@/lib/confirmDialog';

const base = { title: 'Supprimer ce cours ?', confirmLabel: 'Supprimer le cours' };
const tick = () => new Promise(r => setTimeout(r, 0));

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => { resolve = r; });
  return { promise, resolve };
}

describe('ConfirmDialog — l’action ne part qu’après clic sur le bouton d’action', () => {
  it('ouvrir la boîte n’exécute rien ; le bouton d’action exécute une fois', async () => {
    const c = createDialogController();
    const run = jest.fn();
    const ran = c.ask({ ...base, run });
    expect(c.getState().kind).toBe('confirm');
    await tick();
    expect(run).not.toHaveBeenCalled();
    await dialogHandlers(c).onConfirmClick();
    expect(run).toHaveBeenCalledTimes(1);
    await expect(ran).resolves.toBe(true);
    expect(c.getState().kind).toBe('idle');
  });

  it('Annuler ferme sans rien exécuter', async () => {
    const c = createDialogController();
    const run = jest.fn();
    const ran = c.ask({ ...base, run });
    dialogHandlers(c).onCancelClick();
    await expect(ran).resolves.toBe(false);
    expect(run).not.toHaveBeenCalled();
    expect(c.getState().kind).toBe('idle');
  });

  it('Échap et clic à côté (fermeture Radix) valent Annuler', async () => {
    const c = createDialogController();
    const run = jest.fn();
    const ran = c.ask({ ...base, run });
    const h = dialogHandlers(c);
    const e = { preventDefault: jest.fn() };
    h.onEscapeKeyDown(e);
    h.onPointerDownOutside(e);
    expect(e.preventDefault).not.toHaveBeenCalled();
    h.onOpenChange(false);
    await expect(ran).resolves.toBe(false);
    expect(run).not.toHaveBeenCalled();
  });

  it('pendant l’action : bouton neutralisé, Annuler, Échap et clic à côté sans effet', async () => {
    const c = createDialogController();
    const d = deferred();
    const run = jest.fn(() => d.promise);
    c.ask({ ...base, run });
    const h = dialogHandlers(c);
    const first = h.onConfirmClick();
    const s = c.getState();
    expect(s.kind === 'confirm' && s.busy).toBe(true);
    await h.onConfirmClick();
    expect(run).toHaveBeenCalledTimes(1);
    h.onCancelClick();
    h.onOpenChange(false);
    expect(c.getState().kind).toBe('confirm');
    const e = { preventDefault: jest.fn() };
    h.onEscapeKeyDown(e);
    h.onPointerDownOutside(e);
    expect(e.preventDefault).toHaveBeenCalledTimes(2);
    d.resolve();
    await first;
    expect(c.getState().kind).toBe('idle');
  });

  it('le champ est transmis à l’action, et Annuler ne l’envoie pas', async () => {
    const c = createDialogController();
    const run = jest.fn();
    c.ask({ ...base, field: { label: 'Motif du refus (facultatif)' }, run });
    c.setValue('Justificatif illisible');
    dialogHandlers(c).onCancelClick();
    expect(run).not.toHaveBeenCalled();
    c.ask({ ...base, field: { label: 'Motif', defaultValue: 'D2' }, run });
    c.setValue('Division élite');
    await dialogHandlers(c).onConfirmClick();
    expect(run).toHaveBeenCalledWith('Division élite');
  });

  it('troisième bouton : n’exécute que son action, et Annuler ne fait rien', async () => {
    const c = createDialogController();
    const run = jest.fn();
    const keep = jest.fn();
    c.ask({ ...base, secondary: { label: 'Garder la date', run: keep }, run });
    dialogHandlers(c).onCancelClick();
    expect(keep).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
    c.ask({ ...base, secondary: { label: 'Garder la date', run: keep }, run });
    await dialogHandlers(c).onSecondaryClick();
    expect(keep).toHaveBeenCalledTimes(1);
    expect(run).not.toHaveBeenCalled();
  });
});

describe('Boîte d’information', () => {
  it('une erreur signalée pendant l’action s’affiche à sa fin, puis se ferme', async () => {
    const c = createDialogController();
    let shown: Promise<void> | null = null;
    c.ask({ ...base, run: () => { shown = c.inform({ kind: 'error', title: ERROR_TITLE, body: 'permission denied' }); } });
    await dialogHandlers(c).onConfirmClick();
    const s = c.getState();
    expect(s.kind).toBe('info');
    expect(s.kind === 'info' && s.req.body).toBe('permission denied');
    dialogHandlers(c).onOpenChange(false);
    await shown;
    expect(c.getState().kind).toBe('idle');
  });

  it('s’ouvre directement hors action et se ferme avec son bouton', async () => {
    const c = createDialogController();
    const p = c.inform({ kind: 'info', title: 'Créneaux générés', body: '12 créneaux' });
    expect(c.getState().kind).toBe('info');
    dialogHandlers(c).onCloseClick();
    await p;
    expect(c.getState().kind).toBe('idle');
  });
});

describe('Formats', () => {
  it('date complète et heure', () => {
    expect(fullDate('2026-09-29')).toBe('mardi 29 septembre 2026');
    expect(hhmm('18:30:00')).toBe('18:30');
  });
});
