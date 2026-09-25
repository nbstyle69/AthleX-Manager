// S4 — boîte de suppression quand des abonnements Stripe sont actifs, libellé
// du moyen de paiement, bouton d'action qui suit le choix retenu.
import { readFileSync } from 'fs';
import { join } from 'path';
import { askDeleteWithSubscriptions, countOf, subscriptionsChoices, type DeleteKind } from '@/lib/deleteWithSubscriptions';
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

function flow(check: number | Record<string, any>, kind: DeleteKind = 'plan') {
  answers.check = { ok: true, body: { ok: true, ...(typeof check === 'number' ? { active_subscriptions: check } : check) } };
  const ctrl = createDialogController();
  const inform = jest.fn(async () => {});
  const deactivate = jest.fn(async () => {});
  const onDone = jest.fn();
  const done = askDeleteWithSubscriptions({
    ask: ctrl.ask, inform, kind, url: '/api/x/delete', payload: { id: 'p1' },
    title: 'Supprimer ?', body: 'Texte habituel.', confirmLabel: 'Supprimer',
    deactivate, onDone,
  });
  return { ctrl, inform, deactivate, onDone, done };
}
const opened = async (ctrl: ReturnType<typeof createDialogController>) => {
  for (let i = 0; i < 5 && ctrl.getState().kind === 'idle'; i++) await Promise.resolve();
  return ctrl.getState() as any;
};

describe('askDeleteWithSubscriptions — formule', () => {
  it('sans abonnement : boîte habituelle, suppression par la route (delete)', async () => {
    const { ctrl, onDone } = flow(0);
    const s = await opened(ctrl);
    expect(s.req.choices).toBeUndefined();
    expect(s.req.danger).toBe(true);
    await ctrl.confirm();
    expect(posted()).toEqual(['check', 'delete']);
    expect(onDone).toHaveBeenCalled();
  });

  it('avec abonnements : deux choix exclusifs, « Désactiver » par défaut, pluriels exacts', async () => {
    const { ctrl } = flow(3);
    const s = await opened(ctrl);
    expect(s.req.choices.map((c: any) => c.value)).toEqual(['deactivate', 'stop_then_delete']);
    expect(s.choice).toBe('deactivate');
    expect(s.req.warning).toBe('3 membres paient encore la formule par Stripe : tu ne peux pas la supprimer telle quelle.');
    expect(s.req.choices[1].label).toBe('Arrêter les 3 abonnements à la fin de leur période, puis supprimer');
  });

  it('un seul abonnement : singulier partout', async () => {
    const { ctrl } = flow(1);
    const s = await opened(ctrl);
    expect(s.req.warning).toBe('1 membre paie encore la formule par Stripe : tu ne peux pas la supprimer telle quelle.');
    expect(s.req.choices[1].label).toBe('Arrêter l’abonnement à la fin de sa période, puis supprimer');
  });

  it('« Désactiver » : aucun appel à la route de suppression (donc aucun appel Stripe)', async () => {
    const { ctrl, deactivate, onDone } = flow(2);
    await opened(ctrl);
    await ctrl.confirm();
    expect(deactivate).toHaveBeenCalledTimes(1);
    expect(posted()).toEqual(['check']);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('« Arrêter puis supprimer » : stop_then_delete, puis rechargement', async () => {
    const { ctrl, deactivate, onDone } = flow(2);
    const s = await opened(ctrl);
    ctrl.setChoice(s.req.choices[1].value); // le second radio affiché
    await ctrl.confirm();
    expect(posted()).toEqual(['check', 'stop_then_delete']);
    expect(deactivate).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalled();
  });

  it('échec partiel : information d’erreur avec le message de la route, écran inchangé', async () => {
    const { ctrl, inform, onDone } = flow(2);
    answers.stop_then_delete = { ok: false, body: { error: 'Stripe a refusé l’arrêt de 1 abonnement : membre2.' } };
    await opened(ctrl);
    ctrl.setChoice('stop_then_delete');
    await ctrl.confirm();
    expect(inform).toHaveBeenCalledWith({ kind: 'error', title: ERROR_TITLE, body: 'Stripe a refusé l’arrêt de 1 abonnement : membre2.' });
    expect(onDone).not.toHaveBeenCalled();
  });

  it('impayés et engagés : lignes ajoutées sous le choix 2', async () => {
    const { ctrl } = flow({ active_subscriptions: 4, past_due: 2, engaged: 1 });
    const d = (await opened(ctrl)).req.choices[1].description;
    expect(d).toContain('\n2 abonnements en impayé seront arrêtés tout de suite.');
    expect(d).toContain('\n1 membre est encore engagé : l’arrêt lève son engagement.');
  });

  it('check en échec : aucune boîte de suppression, l’erreur est montrée', async () => {
    answers.check = { ok: false, body: { error: 'Non autorisé pour cette box.' } };
    const ctrl = createDialogController();
    const inform = jest.fn(async () => {});
    const r = await askDeleteWithSubscriptions({
      ask: ctrl.ask, inform, kind: 'offer', url: '/x', payload: {}, title: 't', body: 'b', confirmLabel: 'c',
      deactivate: jest.fn(), onDone: jest.fn(),
    });
    expect(r).toBe(false);
    expect(ctrl.getState().kind).toBe('idle');
    expect(inform).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error', body: 'Non autorisé pour cette box.' }));
  });
});

describe('askDeleteWithSubscriptions — programme et offre', () => {
  it('programme : choix 2 « … et désactiver le programme », route stop_then_deactivate, jamais delete', async () => {
    const { ctrl, onDone } = flow({ active_subscriptions: 4, to_stop: 4 }, 'program');
    const s = await opened(ctrl);
    expect(s.req.warning).toBe('4 acheteurs paient encore le programme par Stripe : tu ne peux pas le supprimer tel quel.');
    expect(s.req.choices[1]).toMatchObject({
      value: 'stop_then_deactivate',
      label: 'Arrêter les 4 abonnements à la fin de leur période et désactiver le programme',
      confirmLabel: 'Arrêter et désactiver', danger: true,
    });
    expect(s.req.choices[1].description).toBe('Chaque acheteur garde l’accès jusqu’à la fin de sa période payée ; aucun nouveau prélèvement, et chacun reçoit un e-mail. Le programme est désactivé tout de suite et pourra être supprimé quand le dernier abonnement sera terminé.');
    ctrl.setChoice('stop_then_deactivate');
    await ctrl.confirm();
    expect(posted()).toEqual(['check', 'stop_then_deactivate']);
    expect(onDone).toHaveBeenCalled();
  });

  it('offre : textes de la box abonnée, impayé au singulier', async () => {
    const { ctrl } = flow({ active_subscriptions: 1, to_stop: 1, past_due: 1 }, 'offer');
    const s = await opened(ctrl);
    expect(s.req.warning).toBe('1 box abonnée paie encore l’offre par Stripe : tu ne peux pas la supprimer telle quelle.');
    expect(s.req.choices[1].label).toBe('Arrêter l’abonnement à la fin de sa période et désactiver l’offre');
    expect(s.req.choices[1].description).toBe('Chaque box abonnée reçoit ses semaines jusqu’à la fin de sa période payée ; aucun nouveau prélèvement, et chacune reçoit un e-mail. L’offre est désactivée tout de suite et pourra être supprimée quand le dernier abonnement sera terminé.\n1 abonnement en impayé sera arrêté tout de suite.');
  });

  it('le choix 2 compte ce qu’il reste à arrêter', async () => {
    const { ctrl } = flow({ active_subscriptions: 3, to_stop: 1 }, 'program');
    const s = await opened(ctrl);
    expect(s.req.warning).toContain('3 acheteurs paient');
    expect(s.req.choices[1].label).toBe('Arrêter l’abonnement à la fin de sa période et désactiver le programme');
  });

  it('tout est déjà en voie d’arrêt : information, aucune boîte d’action ni appel', async () => {
    const { ctrl, inform, done } = flow({ active_subscriptions: 2, to_stop: 0, last_end: '2026-10-13T00:00:00Z' }, 'program');
    expect(await done).toBe(false);
    expect(ctrl.getState().kind).toBe('idle');
    expect(inform).toHaveBeenCalledWith({
      kind: 'info', title: 'Suppression pas encore possible',
      body: 'Les 2 abonnements Stripe restants sont déjà programmés pour s’arrêter à la fin de leur période payée, au plus tard le mardi 13 octobre 2026. Le programme pourra être supprimé ensuite.',
    });
    expect(posted()).toEqual(['check']);
  });
});

describe('textes des choix', () => {
  it('« Désactiver » accordé ; l’engagement ne s’affiche que pour la formule', () => {
    expect(subscriptionsChoices('offer', { active: 1 }).choices![0].label).toBe('Désactiver l’offre');
    expect(subscriptionsChoices('plan', { active: 1 }).choices![0].description).toContain('Les abonnés actuels continuent normalement');
    expect(subscriptionsChoices('program', { active: 2, engaged: 2 }).choices![1].description).not.toContain('engagé');
    expect(subscriptionsChoices('plan', { active: 3, engaged: 3 }).choices![1].description).toContain('3 membres sont encore engagés : l’arrêt lève leur engagement.');
  });
  it('countOf : 0 et 1 au singulier', () => {
    expect(countOf(0, 'acheteur', 'acheteurs')).toBe('0 acheteur');
    expect(countOf(1, 'semaine', 'semaines')).toBe('1 semaine');
    expect(countOf(4, 'séance liée', 'séances liées')).toBe('4 séances liées');
  });
  it('plus de « (s) » dans les éléments des boîtes de suppression', () => {
    expect(read('components/programs/AthleteProgramsWorkspace.tsx')).toContain("countOf(p.member_count ?? 0, 'acheteur', 'acheteurs')");
    expect(read('components/marketplace/MarketplaceWorkspace.tsx')).toContain("countOf(o.weeks_count, 'semaine', 'semaines')");
    expect(read('app/(dashboard)/members/page.tsx')).toContain('`${count} membre y est rattaché.`');
    for (const f of ['lib/deleteWithSubscriptions.ts', 'lib/stopProductSubscriptions.ts', 'app/api/membership-plans/delete/route.ts',
      'app/api/programs/delete/route.ts', 'app/api/marketplace/offers/delete/route.ts']) {
      expect(read(f)).not.toMatch(/[a-zé]\(s\)/);
    }
  });
});

describe('bouton d’action selon le choix retenu', () => {
  it('libellé et couleur du choix, sinon ceux de la boîte', () => {
    const req: any = { title: 't', ...subscriptionsChoices('plan', { active: 2 }), run: () => {} };
    expect(confirmAction({ req, choice: 'deactivate' })).toEqual({ label: 'Désactiver la formule', danger: false });
    expect(confirmAction({ req, choice: 'stop_then_delete' })).toEqual({ label: 'Arrêter et supprimer', danger: true });
    expect(confirmAction({ req: { title: 't', confirmLabel: 'X', danger: true, run: () => {} }, choice: '' })).toEqual({ label: 'X', danger: true });
  });
  it('la boîte affiche le bouton calculé, et les lignes ajoutées du choix', () => {
    const v = read('components/ui/confirm-dialog.tsx');
    expect(v).toContain('{confirmAction(state).label}');
    expect(v).toContain('block whitespace-pre-line text-xs');
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
