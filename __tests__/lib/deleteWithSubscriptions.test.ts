// S4 — boîte de suppression quand des abonnements Stripe sont actifs, libellé
// du moyen de paiement, bouton d'action qui suit le choix retenu.
import { readFileSync } from 'fs';
import { join } from 'path';
import { askDeleteWithSubscriptions, subscriptionsChoices } from '@/lib/deleteWithSubscriptions';
import { confirmAction, createDialogController, ERROR_TITLE } from '@/lib/confirmDialog';
import { paymentMethodLabel } from '@/lib/paymentMethodLabel';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

let fetchSpy: jest.SpyInstance;
let answers: Record<string, { ok: boolean; body: any }>;
const posted = () => fetchSpy.mock.calls.map(c => JSON.parse(c[1].body).action);

beforeEach(() => {
  answers = {};
  fetchSpy = jest.spyOn(global, 'fetch' as any).mockImplementation(async (_url: any, init: any) => {
    const a = answers[JSON.parse(init.body).action] ?? { ok: true, body: { ok: true } };
    return { ok: a.ok, json: async () => a.body } as any;
  });
});
afterEach(() => fetchSpy.mockRestore());

function flow(n: number) {
  answers.check = { ok: true, body: { ok: true, active_subscriptions: n } };
  const ctrl = createDialogController();
  const inform = jest.fn(async () => {});
  const deactivate = jest.fn(async () => {});
  const onDeleted = jest.fn();
  const done = askDeleteWithSubscriptions({
    ask: ctrl.ask, inform, kind: 'plan', url: '/api/membership-plans/delete', payload: { plan_id: 'p1' },
    title: 'Supprimer la formule « Illimité » (60,00 €) ?', body: 'Texte habituel.', confirmLabel: 'Supprimer la formule',
    deactivate, onDeleted,
  });
  return { ctrl, inform, deactivate, onDeleted, done };
}
const opened = async (ctrl: ReturnType<typeof createDialogController>) => {
  for (let i = 0; i < 5 && ctrl.getState().kind === 'idle'; i++) await Promise.resolve();
  return ctrl.getState() as any;
};

describe('askDeleteWithSubscriptions', () => {
  it('sans abonnement : boîte habituelle, suppression par la route (delete)', async () => {
    const { ctrl, onDeleted } = flow(0);
    const s = await opened(ctrl);
    expect(s.req.choices).toBeUndefined();
    expect(s.req.danger).toBe(true);
    await ctrl.confirm();
    expect(posted()).toEqual(['check', 'delete']);
    expect(onDeleted).toHaveBeenCalled();
  });

  it('avec abonnements : deux choix exclusifs, « Désactiver » par défaut', async () => {
    const { ctrl } = flow(3);
    const s = await opened(ctrl);
    expect(s.req.choices.map((c: any) => c.value)).toEqual(['deactivate', 'stop_then_delete']);
    expect(s.choice).toBe('deactivate');
    expect(s.req.warning).toContain('3 membre(s)');
    expect(s.req.choices[1].label).toBe('Arrêter les 3 abonnements à la fin de leur période, puis supprimer');
  });

  it('« Désactiver » : aucun appel à la route de suppression (donc aucun appel Stripe)', async () => {
    const { ctrl, deactivate, onDeleted } = flow(2);
    await opened(ctrl);
    await ctrl.confirm();
    expect(deactivate).toHaveBeenCalledTimes(1);
    expect(posted()).toEqual(['check']);
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('« Arrêter puis supprimer » : stop_then_delete, puis rechargement', async () => {
    const { ctrl, deactivate, onDeleted } = flow(2);
    await opened(ctrl);
    ctrl.setChoice('stop_then_delete');
    await ctrl.confirm();
    expect(posted()).toEqual(['check', 'stop_then_delete']);
    expect(deactivate).not.toHaveBeenCalled();
    expect(onDeleted).toHaveBeenCalled();
  });

  it('échec partiel : information d’erreur avec le message de la route, rien retiré de l’écran', async () => {
    const { ctrl, inform, onDeleted } = flow(2);
    answers.stop_then_delete = { ok: false, body: { error: 'Stripe a refusé l’arrêt de 1 abonnement(s) : membre2.' } };
    await opened(ctrl);
    ctrl.setChoice('stop_then_delete');
    await ctrl.confirm();
    expect(inform).toHaveBeenCalledWith({ kind: 'error', title: ERROR_TITLE, body: 'Stripe a refusé l’arrêt de 1 abonnement(s) : membre2.' });
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('check en échec : aucune boîte de suppression, l’erreur est montrée', async () => {
    answers.check = { ok: false, body: { error: 'Non autorisé pour cette box.' } };
    const ctrl = createDialogController();
    const inform = jest.fn(async () => {});
    const r = await askDeleteWithSubscriptions({
      ask: ctrl.ask, inform, kind: 'offer', url: '/x', payload: {}, title: 't', body: 'b', confirmLabel: 'c',
      deactivate: jest.fn(), onDeleted: jest.fn(),
    });
    expect(r).toBe(false);
    expect(ctrl.getState().kind).toBe('idle');
    expect(inform).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error', body: 'Non autorisé pour cette box.' }));
  });
});

describe('textes des choix', () => {
  it('le programme et l’offre accordent leurs textes', () => {
    expect(subscriptionsChoices('program', 2).warning).toBe('2 acheteur(s) paient encore le programme par Stripe : tu ne peux pas le supprimer tel quel.');
    expect(subscriptionsChoices('offer', 1).choices![0].label).toBe('Désactiver l’offre');
    expect(subscriptionsChoices('plan', 1).choices![0].description).toContain('Les abonnés actuels continuent normalement');
  });
});

describe('bouton d’action selon le choix retenu', () => {
  it('libellé et couleur du choix, sinon ceux de la boîte', () => {
    const req: any = { title: 't', ...subscriptionsChoices('plan', 2), run: () => {} };
    expect(confirmAction({ req, choice: 'deactivate' })).toEqual({ label: 'Désactiver la formule', danger: false });
    expect(confirmAction({ req, choice: 'stop_then_delete' })).toEqual({ label: 'Arrêter et supprimer', danger: true });
    expect(confirmAction({ req: { title: 't', confirmLabel: 'X', danger: true, run: () => {} }, choice: '' })).toEqual({ label: 'X', danger: true });
  });
  it('la boîte affiche le bouton calculé', () => {
    expect(read('components/ui/confirm-dialog.tsx')).toContain('{confirmAction(state).label}');
  });
});

describe('moyen de paiement de la boîte d’arrêt', () => {
  it('carte, prélèvement SEPA, comptoir ; repli sur l’affichage actuel', () => {
    expect(paymentMethodLabel(true, 'card')).toBe('carte');
    expect(paymentMethodLabel(true, 'sepa_debit')).toBe('prélèvement SEPA');
    expect(paymentMethodLabel(false, null)).toBe('payé au comptoir');
    expect(paymentMethodLabel(true, undefined)).toBeNull();
    expect(paymentMethodLabel(true, 'link')).toBeNull();
  });
});

describe('bannissement : confirmation avant l’appel', () => {
  const page = read('app/(dashboard)/members/page.tsx');
  it('« Bannir » ouvre la boîte ; la route n’est appelée que depuis son run', () => {
    expect(page).toMatch(/if \(!member\.is_banned\) \{ askBan\(member\); return; \}/);
    expect(page).toMatch(/function askBan[\s\S]{0,900}run: \(\) => banMember\(member\)/);
    expect(page.split("fetch('/api/members/ban'").length - 1).toBe(1);
    expect(page).not.toMatch(/update\(\{ status: newStatus \}\)/);
  });
  it('la boîte dit la conséquence sur l’abonnement', () => {
    expect(page).toContain('l’abonnement est arrêté aujourd’hui, sans remboursement, et le membre reçoit un e-mail');
  });
});
