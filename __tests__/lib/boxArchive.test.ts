// Lot 7a — « Archiver » et « Supprimer » une box passent par ConfirmDialog :
// ouverture, Annuler / Échap sans appel, confirmation avec l'appel d'avant.
import { readFileSync } from 'fs';
import { join } from 'path';
import { archiveRequest, deleteBox, deleteRequest, patchArchive } from '@/lib/boxArchive';
import { confirmAction, confirmBlocked, createDialogController, dialogHandlers } from '@/lib/confirmDialog';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\r\n/g, '\n');
const NAME = 'Club d’entraînement des Hauts-de-Seine';

let fetchSpy: jest.SpyInstance;
beforeEach(() => {
  fetchSpy = jest.spyOn(global, 'fetch' as any).mockResolvedValue({ ok: true, status: 200, json: async () => ({}) } as any);
});
afterEach(() => fetchSpy.mockRestore());

describe('Archiver une box', () => {
  it('ouverture : textes d’avant, bouton « Archiver » ambre (ni rouge ni blanc)', async () => {
    const ctrl = createDialogController();
    void ctrl.ask(archiveRequest(NAME, jest.fn()));
    const s = ctrl.getState() as any;
    expect(s.kind).toBe('confirm');
    expect(s.req.title).toBe(`Archiver « ${NAME} » ?`);
    expect(s.req.body).toBe('Ses membres perdront l’accès à la box : elle disparaîtra de leur application, de l’annuaire public et des recherches. La programmation automatique ne la générera plus.\n\nRien n’est supprimé, et l’opération se défait : « Réactiver » remet tout en place.');
    expect(confirmAction(s)).toEqual({ label: 'Archiver', danger: false });
    expect(s.req.tone).toBe('warning');
    expect(confirmBlocked(s)).toBe(false);
  });

  it('Annuler, la croix ou Échap : aucun appel', async () => {
    const run = jest.fn();
    const ctrl = createDialogController();
    const h = dialogHandlers(ctrl);
    void ctrl.ask(archiveRequest(NAME, run));
    h.onCancelClick();
    void ctrl.ask(archiveRequest(NAME, run));
    h.onOpenChange(false); // croix, Échap, clic à côté
    expect(run).not.toHaveBeenCalled();
    expect(ctrl.getState().kind).toBe('idle');
  });

  it('confirmation : l’action part une fois', async () => {
    const run = jest.fn();
    const ctrl = createDialogController();
    void ctrl.ask(archiveRequest(NAME, run));
    await ctrl.confirm();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('appel identique à avant : PATCH …/archive { archived: true }', async () => {
    expect(await patchArchive('b1', true)).toBeNull();
    expect(fetchSpy).toHaveBeenCalledWith('/api/admin/boxes/b1/archive', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ archived: true }),
    });
  });

  it('erreur : message de la route, sinon « Erreur <code> »', async () => {
    fetchSpy.mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ error: 'Migration absente' }) } as any);
    expect(await patchArchive('b1', true)).toBe('Migration absente');
    fetchSpy.mockResolvedValueOnce({ ok: false, status: 500, json: async () => { throw new Error('x'); } } as any);
    expect(await patchArchive('b1', true)).toBe('Erreur 500');
  });
});

describe('Supprimer une box', () => {
  it('ouverture : textes d’avant, champ du nom, bouton rouge « Supprimer »', () => {
    const ctrl = createDialogController();
    void ctrl.ask(deleteRequest(NAME, jest.fn()));
    const s = ctrl.getState() as any;
    expect(s.req.title).toBe(`Supprimer « ${NAME} » ?`);
    expect(s.req.body).toBe('La box et tout ce qui s’y rattache seront supprimés définitivement. Le compte du propriétaire n’est pas touché : il perd seulement son rôle sur cette box.');
    expect(s.req.field).toEqual({ label: 'Retape le nom exact de la box', placeholder: NAME, mustEqual: NAME });
    expect(confirmAction(s)).toEqual({ label: 'Supprimer', danger: true });
  });

  it('comme avant, rien ne part tant que le nom exact n’est pas retapé', async () => {
    const run = jest.fn();
    const ctrl = createDialogController();
    void ctrl.ask(deleteRequest(NAME, run));
    expect(confirmBlocked(ctrl.getState() as any)).toBe(true);
    await ctrl.confirm();
    ctrl.setValue('Club');
    await ctrl.confirm();
    expect(run).not.toHaveBeenCalled();
    expect(ctrl.getState().kind).toBe('confirm');
  });

  it('Annuler après saisie : aucun appel', () => {
    const run = jest.fn();
    const ctrl = createDialogController();
    void ctrl.ask(deleteRequest(NAME, run));
    ctrl.setValue(NAME);
    dialogHandlers(ctrl).onCancelClick();
    expect(run).not.toHaveBeenCalled();
  });

  it('nom exact (espaces autour tolérés, comme avant) : l’action part avec la saisie', async () => {
    const run = jest.fn();
    const ctrl = createDialogController();
    void ctrl.ask(deleteRequest(NAME, run));
    ctrl.setValue(`  ${NAME} `);
    expect(confirmBlocked(ctrl.getState() as any)).toBe(false);
    await ctrl.confirm();
    expect(run).toHaveBeenCalledWith(`  ${NAME} `);
  });

  it('appel identique à avant : DELETE …/deletion avec le nom sans espaces autour', async () => {
    expect(await deleteBox('b1', `  ${NAME} `)).toBeNull();
    expect(fetchSpy).toHaveBeenCalledWith('/api/admin/boxes/b1/deletion', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: NAME }),
    });
  });

  it('erreur : message de la route', async () => {
    fetchSpy.mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ error: 'Cette box n’est pas vide' }) } as any);
    expect(await deleteBox('b1', NAME)).toBe('Cette box n’est pas vide');
  });
});

describe('Branchement dans BoxArchiveBlock et dans la boîte', () => {
  const block = read('components/admin/BoxArchiveBlock.tsx');
  it('les boutons ouvrent la boîte ; plus de boîte maison', () => {
    expect(block).toContain('onClick={askArchive}');
    expect(block).toContain('onClick={askDelete}');
    expect(block).toContain('{dialog}');
    expect(block).not.toMatch(/fixed inset-0/);
    // Seule lecture restante : le décompte (GET). Les deux écritures passent par lib/boxArchive.ts.
    expect(block).not.toMatch(/method: '(?:PATCH|DELETE)'/);
  });
  it('mêmes suites qu’avant : rechargement, erreur affichée, retour à la liste', () => {
    expect(block).toMatch(/const err = await patchArchive\(boxId, next\);\s*if \(err\) \{ setError\(err\); return; \}\s*onChanged\(\);/);
    expect(block).toMatch(/const err = await deleteBox\(boxId, typedName\);\s*if \(err\) \{ setError\(err\); void loadDeletion\(\); return; \}\s*window\.location\.href = '\/admin\/boxes';/);
  });
  it('la boîte grise le bouton tant que la saisie exigée manque, et colore l’avertissement', () => {
    const view = read('components/ui/confirm-dialog.tsx');
    expect(view).toContain('disabled={busy || confirmBlocked(state)}');
    expect(view).toContain("state.req.tone === 'warning' ? WARNING_BUTTON : undefined");
    expect(view).toContain("const WARNING_BUTTON = 'border-ax-warning bg-ax-warning text-ax-background hover:brightness-110';");
  });
});
