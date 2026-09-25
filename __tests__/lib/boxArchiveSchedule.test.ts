// Archivage PR 2 — boîtes de la fiche admin (sans DOM) et textes des e-mails.
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  archiveAthlexOnlyRequest, archiveNowRequest, archiveScheduleRequest, askArchiveBox, askRelaunchStops, relaunchRequest, scheduledStateLabel, unscheduleRequest,
  type ArchiveCheckView,
} from '@/lib/boxArchive';
import { confirmAction, createDialogController, dialogHandlers } from '@/lib/confirmDialog';
import { arretDe, counterMemberArchiveEmail, ownerArchiveEmail, programArchiveEmail, publisherArchiveEmail } from '@/lib/boxArchiveSchedule';
import { stopEmailContent } from '@/lib/members/stopMembership';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\r\n/g, '\n');
const NAME = 'Box Test';
const DEC1 = '2026-12-01T10:00:00.000Z';

const check = (over: Partial<ArchiveCheckView> = {}): ArchiveCheckView => ({
  members: { active: 3, past_due: 1, committed: 1, to_stop: 2, already_stopping: 1 },
  counter_members: 2,
  programs: { active: 1 }, offers_sold: { active: 0 }, offers_bought: { active: 1 }, pending: { active: 0 },
  box_subscription: { source: 'stripe', status: 'active', stopping: false, period_end: DEC1, to_stop: true },
  to_stop: 5, past_due: 1, last_end: DEC1, still_paying: true, only_athlex: false,
  ...over,
});

let fetchSpy: jest.SpyInstance;
beforeEach(() => {
  fetchSpy = jest.spyOn(global, 'fetch' as any);
});
afterEach(() => fetchSpy.mockRestore());

describe('boîte « Archiver », avec des abonnés qui paient', () => {
  it('texte du relevé, date au plus tard, bouton ambre « Programmer l’archivage »', () => {
    const req = archiveScheduleRequest(NAME, check(), jest.fn());
    expect(req.title).toBe('Archiver « Box Test » ?');
    expect(req.body).toBe('Si tu confirmes : les abonnements des membres s’arrêtent à la fin de leur période payée, ceux en impayé tout de suite, sans remboursement, et chaque membre reçoit un e-mail. L’abonnement de la box à AthleX s’arrête lui aussi à la fin de sa période. Plus aucune adhésion, invitation ni achat n’est accepté. Tout le monde garde l’accès jusqu’à la fin de sa période payée, au plus tard le mardi 1 décembre 2026 : la box sera alors archivée automatiquement.\n\nLes entrées ferment dès ta confirmation, avant les arrêts. Si Stripe refuse un arrêt, l’archivage reste programmé : tu pourras relancer les arrêts depuis cette fiche.');
    expect(req.confirmLabel).toBe('Programmer l’archivage');
    expect(req.tone).toBe('warning');
    expect(req.danger).toBeUndefined();
  });

  it('bandeau : membres par Stripe dont impayés, autres abonnements, engagements levés, comptoir', () => {
    expect(archiveScheduleRequest(NAME, check(), jest.fn()).warning).toBe(
      '3 membres paient encore par Stripe, dont 1 en impayé. Paient aussi par Stripe : 1 abonnement à un programme, 1 offre achetée à une autre box. 1 membre est encore engagé : l’arrêt lève son engagement. 2 membres paient au comptoir : ils gardent l’accès jusqu’à l’archivage et reçoivent un e-mail.');
  });

  it('abonnement AthleX `manual` : la phrase AthleX disparaît', () => {
    const req = archiveScheduleRequest(NAME, check({ box_subscription: { source: 'manual', status: 'active', stopping: false, period_end: null, to_stop: false } }), jest.fn());
    expect(req.body).not.toContain('AthleX');
  });
});

describe('boîte « Archiver », plus rien ne paie', () => {
  const nothing = check({ members: { active: 0, past_due: 0, committed: 0, to_stop: 0, already_stopping: 0 }, programs: { active: 0 }, offers_bought: { active: 0 }, still_paying: false, last_end: null, counter_members: 0 });
  it('texte d’avant (archivage immédiat), bouton « Archiver »', () => {
    const req = archiveNowRequest(NAME, { ...nothing, box_subscription: null }, jest.fn());
    expect(req.body).toBe('Ses membres perdront l’accès à la box : elle disparaîtra de leur application, de l’annuaire public et des recherches. La programmation automatique ne la générera plus.\n\nRien n’est supprimé, et l’opération se défait : « Réactiver » remet tout en place.');
    expect(req.confirmLabel).toBe('Archiver');
  });
  it('plus une ligne sur l’abonnement AthleX s’il y en a un', () => {
    expect(archiveNowRequest(NAME, { ...nothing, box_subscription: { source: 'manual', status: 'active', stopping: false, period_end: null, to_stop: false } }, jest.fn()).body)
      .toMatch(/\n\nL’abonnement de la box à AthleX \(géré hors Stripe\) n’est pas touché\.$/);
    expect(archiveNowRequest(NAME, { ...nothing, box_subscription: { source: 'stripe', status: 'past_due', stopping: false, period_end: null, to_stop: true } }, jest.fn()).body)
      .toMatch(/\n\nL’abonnement de la box à AthleX, en impayé, s’arrête tout de suite\.$/);
  });
});

describe('déroulé : check, boîte, schedule seulement sur le bouton d’action', () => {
  const answer = (data: any, ok = true) => ({ ok, status: ok ? 200 : 502, json: async () => data }) as any;

  it('check puis boîte « Programmer » ; Annuler : aucun schedule', async () => {
    fetchSpy.mockResolvedValue(answer(check()));
    const ctrl = createDialogController();
    const onDone = jest.fn();
    void askArchiveBox({ ask: r => ctrl.ask(r), inform: r => ctrl.inform(r), boxId: 'b1', boxName: NAME, onDone });
    await new Promise(r => setTimeout(r, 0));
    const s = ctrl.getState() as any;
    expect(confirmAction(s).label).toBe('Programmer l’archivage');
    dialogHandlers(ctrl).onCancelClick();
    const bodies = fetchSpy.mock.calls.map(c => JSON.parse(c[1].body).action);
    expect(bodies).toEqual(['check']);
    expect(fetchSpy.mock.calls[0][0]).toBe('/api/admin/boxes/b1/archive-schedule');
    expect(onDone).not.toHaveBeenCalled();
  });

  it('confirmation : un seul schedule, puis rechargement', async () => {
    fetchSpy.mockResolvedValueOnce(answer(check())).mockResolvedValueOnce(answer({ ok: true, scheduled: true }));
    const ctrl = createDialogController();
    const onDone = jest.fn();
    void askArchiveBox({ ask: r => ctrl.ask(r), inform: r => ctrl.inform(r), boxId: 'b1', boxName: NAME, onDone });
    await new Promise(r => setTimeout(r, 0));
    await ctrl.confirm();
    expect(fetchSpy.mock.calls.map(c => JSON.parse(c[1].body).action)).toEqual(['check', 'schedule']);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('échec partiel (502) : message affiché tel quel, puis rechargement à sa fermeture (la box est programmée)', async () => {
    const msg = 'Stripe a refusé l’arrêt d’1 abonnement : membre2. L’archivage est programmé et les entrées sont fermées ; les autres abonnements sont bien arrêtés.';
    fetchSpy.mockResolvedValueOnce(answer(check())).mockResolvedValueOnce(answer({ error: msg }, false));
    const ctrl = createDialogController();
    const onDone = jest.fn();
    void askArchiveBox({ ask: r => ctrl.ask(r), inform: r => ctrl.inform(r), boxId: 'b1', boxName: NAME, onDone });
    await new Promise(r => setTimeout(r, 0));
    await ctrl.confirm();
    await new Promise(r => setTimeout(r, 0));
    const s = ctrl.getState() as any;
    expect(s.kind).toBe('info');
    expect(s.req.body).toBe(msg);
    // Pas de rechargement tant que le message est ouvert : il démonterait le bloc et sa boîte (vu au banc).
    expect(onDone).not.toHaveBeenCalled();
    dialogHandlers(ctrl).onCloseClick();
    await new Promise(r => setTimeout(r, 0));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('e-mail non parti : l’avertissement s’affiche avant le rechargement', async () => {
    fetchSpy.mockResolvedValueOnce(answer(check())).mockResolvedValueOnce(answer({ ok: true, scheduled: true, warning: '1 e-mail n’est pas parti.' }));
    const ctrl = createDialogController();
    const onDone = jest.fn();
    void askArchiveBox({ ask: r => ctrl.ask(r), inform: r => ctrl.inform(r), boxId: 'b1', boxName: NAME, onDone });
    await new Promise(r => setTimeout(r, 0));
    void ctrl.confirm();
    await new Promise(r => setTimeout(r, 0));
    expect((ctrl.getState() as any).req.body).toBe('1 e-mail n’est pas parti.');
    expect(onDone).not.toHaveBeenCalled();
    dialogHandlers(ctrl).onOpenChange(false);
    await new Promise(r => setTimeout(r, 0));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('seul l’abonnement AthleX paie : la variante sans les membres', async () => {
    fetchSpy.mockResolvedValue(answer(check({ only_athlex: true, last_end: '2026-11-20T10:00:00.000Z' })));
    const ctrl = createDialogController();
    void askArchiveBox({ ask: r => ctrl.ask(r), inform: r => ctrl.inform(r), boxId: 'b1', boxName: NAME, onDone: jest.fn() });
    await new Promise(r => setTimeout(r, 0));
    const s = ctrl.getState() as any;
    expect(s.req.body).toBe("Seul l'abonnement de la box à AthleX est encore en cours : il s'arrête le vendredi 20 novembre 2026, puis la box sera archivée.");
    expect(s.req.warning).toBeUndefined();
    expect(confirmAction(s).label).toBe('Programmer l’archivage');
    expect(s.req.tone).toBe('warning');
    expect(archiveAthlexOnlyRequest(NAME, check({ only_athlex: true, last_end: null }), jest.fn()).body)
      .toBe("Seul l'abonnement de la box à AthleX est encore en cours : il s'arrête à la fin de sa période, puis la box sera archivée.");
  });

  it('plus rien ne paie : la boîte d’avant', async () => {
    fetchSpy.mockResolvedValue(answer(check({ still_paying: false })));
    const ctrl = createDialogController();
    void askArchiveBox({ ask: r => ctrl.ask(r), inform: r => ctrl.inform(r), boxId: 'b1', boxName: NAME, onDone: jest.fn() });
    await new Promise(r => setTimeout(r, 0));
    expect(confirmAction(ctrl.getState() as any).label).toBe('Archiver');
  });
});

describe('box en archivage programmé : état et annulation', () => {
  it('état « au plus tard le {date} »', () => {
    expect(scheduledStateLabel(DEC1)).toBe('Archivage programmé, au plus tard le mardi 1 décembre 2026');
    expect(scheduledStateLabel(null)).toBe('Archivage programmé, à la fin du dernier abonnement');
  });
  it('sa propre boîte : les abonnements arrêtés ne sont pas relancés', () => {
    const req = unscheduleRequest(NAME, jest.fn());
    expect(req.title).toBe('Annuler l’archivage programmé de « Box Test » ?');
    expect(req.body).toContain('Les abonnements déjà arrêtés ne sont pas relancés');
    expect(req.confirmLabel).toBe('Annuler l’archivage programmé');
    expect(req.cancelLabel).toBe('Garder l’archivage programmé');
  });
  it('fiche : l’état et le bouton, branchés sur la bonne action', () => {
    const block = read('components/admin/BoxArchiveBlock.tsx');
    expect(block).toContain("const r = await postArchiveSchedule(boxId, 'unschedule');");
    expect(block).toContain('scheduledStateLabel(lastEnd)');
    expect(block).toContain('onClick={askUnschedule}');
    expect(block).toContain('const canDelete = deletion?.empty === true && !archived && !scheduled;');
    expect(read('app/admin/boxes/[id]/page.tsx')).toContain('archiveScheduledAt={box.archive_scheduled_at ?? null}');
  });
});

describe('pluriels : le nombre est connu, jamais de « (s) » (règle S4)', () => {
  it('message d’échec : « d’1 abonnement » / « de 3 abonnements »', () => {
    expect(arretDe(1)).toBe('d’1 abonnement');
    expect(arretDe(3)).toBe('de 3 abonnements');
  });
  it('relance et fiche : « 1 abonnement n’est pas… » / « 3 abonnements ne sont pas… »', () => {
    expect(relaunchRequest(NAME, 1, jest.fn()).body).toMatch(/^1 abonnement n’est pas encore arrêté chez Stripe\./);
    expect(relaunchRequest(NAME, 3, jest.fn()).body).toMatch(/^3 abonnements ne sont pas encore arrêtés chez Stripe\./);
    const block = read('components/admin/BoxArchiveBlock.tsx');
    expect(block).toContain("{toStop === 1 ? '1 abonnement n’est pas encore arrêté' : `${toStop} abonnements ne sont pas encore arrêtés`}");
  });
  it('bandeau de la boîte : singulier et pluriel accordés', () => {
    const one = archiveScheduleRequest(NAME, check({ members: { active: 1, past_due: 0, committed: 1, to_stop: 1, already_stopping: 0 }, counter_members: 1 }), jest.fn()).warning;
    expect(one).toBe('1 membre paie encore par Stripe. Paient aussi par Stripe : 1 abonnement à un programme, 1 offre achetée à une autre box. 1 membre est encore engagé : l’arrêt lève son engagement. 1 membre paie au comptoir : il garde l’accès jusqu’à l’archivage et reçoit un e-mail.');
  });
  it('aucun « (s) » dans les textes de l’archivage', () => {
    for (const f of ['lib/boxArchiveSchedule.ts', 'lib/boxArchive.ts', 'components/admin/BoxArchiveBlock.tsx', 'lib/boxEntryGuard.ts']) {
      // Un mot suivi de « (s) » puis d'une espace ou d'une ponctuation : du texte, pas un appel `f(s);`.
      expect(read(f)).not.toMatch(/[a-zà-ÿ]\(s\)(?=[\s.,:!?’'])/i);
    }
  });
});

describe('relancer les arrêts d’une box programmée', () => {
  it('sa boîte : combien restent, rien de rappelé, e-mail d’archivage à la fin ; bouton ambre', () => {
    const req = relaunchRequest(NAME, 2, jest.fn());
    expect(req.title).toBe('Relancer les arrêts de « Box Test » ?');
    expect(req.body).toBe('2 abonnements ne sont pas encore arrêtés chez Stripe. Les abonnements déjà arrêtés ne seront pas rappelés. Quand tout sera arrêté, le gérant et les membres au comptoir recevront l’e-mail d’archivage.');
    expect(req.confirmLabel).toBe('Relancer les arrêts');
    expect(req.tone).toBe('warning');
  });
  it('schedule seulement sur le bouton d’action, puis rechargement', async () => {
    fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, scheduled: true }) } as any);
    const ctrl = createDialogController();
    const onDone = jest.fn();
    void askRelaunchStops({ ask: r => ctrl.ask(r), inform: r => ctrl.inform(r), boxId: 'b1', boxName: NAME, toStop: 1, onDone });
    expect(fetchSpy).not.toHaveBeenCalled();
    await ctrl.confirm();
    expect(fetchSpy.mock.calls.map(c => JSON.parse(c[1].body).action)).toEqual(['schedule']);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
  it('fiche : le bouton n’apparaît que s’il reste des arrêts', () => {
    const block = read('components/admin/BoxArchiveBlock.tsx');
    expect(block).toContain('{toStop > 0 && (');
    expect(block).toContain('setToStop(r.ok ? Number(r.data.to_stop) || 0 : 0);');
    expect(block).toContain('void askRelaunchStops({ ask, inform, boxId, boxName, toStop, onDone: onChanged });');
  });
});

describe('e-mails d’archivage (textes)', () => {
  it('gérant : objet et texte du relevé', () => {
    const e = ownerArchiveEmail({ firstName: 'Camille', boxName: NAME, date: DEC1, boxPaysAthlex: true, boughtOffers: false });
    expect(e.subject).toBe('Box Test sera archivée le mardi 1 décembre 2026');
    expect(e.bodyText).toBe("Bonjour Camille, l'archivage de Box Test est programmé. Les abonnements de tes membres s'arrêtent à la fin de leur période payée, et l'abonnement de Box Test à AthleX aussi : aucun nouveau prélèvement, aucun remboursement. D'ici là, toi et tes membres gardez l'accès ; les nouvelles adhésions, invitations et ventes sont fermées. Le mardi 1 décembre 2026, Box Test sera archivée : rien n'est supprimé. Pour toute question, réponds à cet e-mail.");
  });
  it('gérant sans abonnement AthleX par Stripe : la clause disparaît', () => {
    const e = ownerArchiveEmail({ firstName: 'Camille', boxName: NAME, date: DEC1, boxPaysAthlex: false, boughtOffers: false });
    expect(e.bodyText).toContain("s'arrêtent à la fin de leur période payée : aucun nouveau prélèvement");
  });
  it('comptoir : fermeture de la box à la date', () => {
    const e = counterMemberArchiveEmail({ firstName: 'Nour', boxName: NAME, date: DEC1 });
    expect(e.subject).toBe('Box Test ferme le mardi 1 décembre 2026');
    expect(e.bodyText).toBe("Bonjour Nour, Box Test va être archivée le mardi 1 décembre 2026 : ton accès à la box et à ses cours s'arrêtera à cette date. D'ici là, rien ne change pour toi. Les ventes au comptoir sont fermées. Pour toute question, réponds à cet e-mail : il arrive directement à Box Test.");
  });
  it('comptoir, archivage immédiat : même texte, sans date future', () => {
    const e = counterMemberArchiveEmail({ firstName: 'Nour', boxName: NAME, date: null, immediate: true });
    expect(e.subject).toBe("Box Test ferme aujourd'hui");
    expect(e.bodyText).toBe("Bonjour Nour, Box Test est archivée aujourd'hui : ton accès à la box et à ses cours s'arrête dès maintenant. Les ventes au comptoir sont fermées. Pour toute question, réponds à cet e-mail : il arrive directement à Box Test.");
  });
  it('programme arrêté par la fermeture : fin de période, et impayé arrêté aujourd’hui', () => {
    const e = programArchiveEmail({ mode: 'period_end', firstName: 'Lucas', boxName: NAME, title: 'Force', periodEnd: DEC1 });
    expect(e.subject).toBe('Box Test ferme : ton abonnement au programme Force prendra fin le mardi 1 décembre 2026');
    expect(e.bodyText).toBe("Bonjour Lucas, Box Test ferme : ton abonnement au programme Force prendra fin le mardi 1 décembre 2026, sans nouveau prélèvement. Tu gardes l'accès au programme jusque-là. Pour toute question, réponds à cet e-mail : il arrive directement à Box Test.");
    const n = programArchiveEmail({ mode: 'now', firstName: 'Lucas', boxName: NAME, title: 'Force', periodEnd: DEC1 });
    expect(n.subject).toBe('Ton abonnement au programme Force est arrêté');
    expect(n.bodyText).toBe("Bonjour Lucas, Box Test ferme : ton abonnement au programme Force, qui était en impayé, est arrêté aujourd'hui. Aucun prélèvement ne sera plus fait. Pour toute question, réponds à cet e-mail : il arrive directement à Box Test.");
  });
  it('éditeur d’une offre achetée par la box', () => {
    const e = publisherArchiveEmail({ mode: 'period_end', firstName: 'Sam', boxName: NAME, title: 'Endurance', periodEnd: DEC1 });
    expect(e.subject).toBe('Box Test arrête son abonnement à Endurance');
    expect(e.bodyText).toBe("Bonjour Sam, Box Test ferme : son abonnement à ton offre de programmation Endurance prendra fin le mardi 1 décembre 2026, sans nouveau prélèvement. Rien n'est à faire de ton côté. Pour toute question, réponds à cet e-mail : il arrive directement à Box Test.");
    const n = publisherArchiveEmail({ mode: 'now', firstName: 'Sam', boxName: NAME, title: 'Endurance', periodEnd: null });
    expect(n.bodyText).toBe("Bonjour Sam, Box Test ferme : son abonnement à ton offre de programmation Endurance, qui était en impayé, est arrêté aujourd'hui. Rien n'est à faire de ton côté. Pour toute question, réponds à cet e-mail : il arrive directement à Box Test.");
  });
  it('sans prénom : « Bonjour, » (et S2 inchangé avec un prénom)', () => {
    expect(stopEmailContent({ mode: 'now', firstName: '', boxName: NAME, planName: 'Illimité', periodEnd: null }).bodyText).toMatch(/^Bonjour, Box Test a arrêté/);
    expect(stopEmailContent({ mode: 'now', firstName: 'Inès', boxName: NAME, planName: 'Illimité', periodEnd: null }).bodyText).toMatch(/^Bonjour Inès, Box Test a arrêté/);
    expect(programArchiveEmail({ mode: 'now', firstName: '', boxName: NAME, title: 'Force', periodEnd: null }).bodyText).toMatch(/^Bonjour, Box Test ferme/);
  });
});
