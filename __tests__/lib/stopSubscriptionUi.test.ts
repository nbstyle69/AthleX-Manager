// S2 — interface d'arrêt d'abonnement : bouton selon l'état, boîte à choix
// exclusif (radio, clavier), textes validés, /compte.
import { readFileSync } from 'fs';
import { join } from 'path';
import { createDialogController } from '@/lib/confirmDialog';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const subscribers = read('app/(dashboard)/subscribers/page.tsx');
const manage = read('app/compte/ManageSubscription.tsx');
const compte = read('app/compte/page.tsx');
const dialogView = read('components/ui/confirm-dialog.tsx');

describe('page Abonnés — bouton « Arrêter l’abonnement »', () => {
  it('visible seulement pour une adhésion salle active ou en impayé, sans fin déjà programmée', () => {
    const m = subscribers.match(
      /\{r\.kind === 'membership' && r\.boxMemberId && !r\.cancelAtPeriodEnd\s*&& \(r\.status === 'active' \|\| r\.status === 'past_due'\) && \(\s*<button onClick=\{\(\) => askStopSubscription\(r\)\}/,
    );
    expect(m).not.toBeNull();
  });

  it('affiche « Fin programmée le {date} » quand la fin est déjà programmée', () => {
    expect(subscribers).toMatch(/r\.kind === 'membership' && r\.cancelAtPeriodEnd && \([\s\S]{0,200}Fin programmée\{r\.periodEnd \? ` le \$\{fmtDate\(r\.periodEnd\)\}` : ''\}/);
  });

  it('la boîte est en variante danger, avec le verbe exact', () => {
    expect(subscribers).toContain("confirmLabel: 'Arrêter l’abonnement',");
    expect(subscribers).toMatch(/danger: true,\s*\n\s*run: \(_value, choice\)/);
  });

  it('deux choix pour un abonnement Stripe hors impayé, un seul en impayé, aucun au comptoir', () => {
    // comptoir → pas de radio
    expect(subscribers).toMatch(/const choices: ConfirmChoice\[\] \| undefined = !r\.hasStripeSub\s*\?\s*undefined/);
    // period_end proposé seulement hors impayé et avec une période connue
    expect(subscribers).toMatch(/\.\.\.\(!pastDue && r\.periodEnd \? \[\{\s*value: 'period_end',/);
    expect(subscribers).toContain("value: 'now',");
    expect(subscribers).toContain('label: `À la fin de la période payée, le ${fullDate(r.periodEnd)}.`');
    expect(subscribers).toContain('description: \'Il garde l’accès jusque-là. Aucun prélèvement ensuite.\'');
    expect(subscribers).toContain("label: 'Immédiatement.',");
    expect(subscribers).toContain('L’accès aux réservations s’arrête maintenant et ses réservations à venir sont annulées. Le mois en cours reste encaissé.');
  });

  it('textes du comptoir, du corps commun et de l’engagement', () => {
    expect(subscribers).toContain('Il paie au comptoir : aucun prélèvement à arrêter. Son adhésion passe en inactive dès maintenant et ses réservations à venir sont annulées. Aucun remboursement n’est fait par l’application.');
    expect(subscribers).toContain('sera prévenu par e-mail. L’abonnement ne pourra pas être réactivé : il faudra en souscrire un nouveau.');
    expect(subscribers).toMatch(/Engagement en cours jusqu’au \$\{fullDate\(r\.commitmentEndDate!\)\} \(\$\{monthsLeft\} mois restants\)\. Arrêter l’abonnement lève cet engagement : les \$\{monthsLeft\} mois restants ne seront pas prélevés\./);
  });

  it('l’élément ne montre que ce qui est chargé : comptoir ou période payée', () => {
    expect(subscribers).toMatch(/!r\.hasStripeSub \? 'payé au comptoir' : null,/);
    expect(subscribers).toContain("r.hasStripeSub && r.periodEnd ? `période payée jusqu'au ${fullDate(r.periodEnd)}` : null,");
  });

  it('le mode envoyé suit le choix, comptoir toujours immédiat, avertissement e-mail affiché', () => {
    expect(subscribers).toMatch(/stopMemberSubscription\(r, r\.hasStripeSub && choice === 'period_end' \? 'period_end' : 'now'\)/);
    expect(subscribers).toContain("fetch('/api/members/stop-subscription'");
    expect(subscribers).toMatch(/if \(data\.warning\) inform\(\{ kind: 'info', title: 'E-mail non envoyé', body: data\.warning \}\);/);
  });
});

describe('ConfirmDialog — choix exclusif', () => {
  it('rendu en boutons radio natifs (clavier), dans un fieldset, neutralisés pendant l’action', () => {
    expect(dialogView).toMatch(/<fieldset[^>]*data-testid="confirm-dialog-choices"/);
    expect(dialogView).toMatch(/type="radio"\s*\n\s*name="confirm-dialog-choice"/);
    expect(dialogView).toMatch(/checked=\{state\.choice === c\.value\}/);
    expect(dialogView).toMatch(/disabled=\{busy\}[\s\S]{0,80}onChange=\{\(\) => ctrl\.setChoice\(c\.value\)\}/);
  });

  it('contrôleur : premier choix par défaut, setChoice, transmis à run', async () => {
    const ctrl = createDialogController();
    const run = jest.fn();
    ctrl.ask({
      title: 'T', confirmLabel: 'OK', run,
      choices: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }],
    });
    const st = ctrl.getState();
    expect(st.kind === 'confirm' && st.choice).toBe('a');
    ctrl.setChoice('b');
    await ctrl.confirm();
    expect(run).toHaveBeenCalledWith('', 'b');
  });

  it('contrôleur : sans choix, run reçoit un choix indéfini ; defaultChoice respecté', async () => {
    const ctrl = createDialogController();
    const run = jest.fn();
    ctrl.ask({ title: 'T', confirmLabel: 'OK', run });
    await ctrl.confirm();
    expect(run).toHaveBeenCalledWith('', undefined);

    const run2 = jest.fn();
    ctrl.ask({
      title: 'T', confirmLabel: 'OK', run: run2,
      choices: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }], defaultChoice: 'b',
    });
    await ctrl.confirm();
    expect(run2).toHaveBeenCalledWith('', 'b');
  });

  it('contrôleur : le choix ne bouge plus pendant l’action', async () => {
    const ctrl = createDialogController();
    let resolve!: () => void;
    ctrl.ask({
      title: 'T', confirmLabel: 'OK',
      choices: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }],
      run: () => new Promise<void>(r => { resolve = r; }),
    });
    const p = ctrl.confirm();
    ctrl.setChoice('b');
    const st = ctrl.getState();
    expect(st.kind === 'confirm' && st.choice).toBe('a');
    resolve();
    await p;
  });

  it('bandeau d’avertissement rendu depuis warning', () => {
    expect(dialogView).toMatch(/\{state\.req\.warning && \([\s\S]{0,240}\{state\.req\.warning\}/);
    expect(dialogView).toContain('border-ax-warning bg-ax-warning-soft');
  });
});

describe('/compte du membre', () => {
  it('« Résiliation programmée le {date} » et bouton Résilier masqué', () => {
    expect(manage).toMatch(/\{cancelAtPeriodEnd && \([\s\S]{0,300}Résiliation programmée\{periodEnd \? ` le \$\{fmtDate\(periodEnd\)\}` : ''\}/);
    expect(manage).toMatch(/\{!cancelAtPeriodEnd && \(\s*\n\s*<button\s*\n\s*onClick=\{\(\) => setMode\(engaged \? 'request' : 'cancel'\)\}/);
  });

  it('la page passe l’état de résiliation à ManageSubscription', () => {
    expect(compte).toContain('cancelAtPeriodEnd={!!activeSub.subscription_cancel_at_period_end}');
    expect(compte).toContain('periodEnd={activeSub.subscription_current_period_end}');
  });

  it('libellé « Arrêté » pour les statuts cancelled et canceled', () => {
    expect(compte).toContain("canceled: 'Arrêté', cancelled: 'Arrêté',");
  });
});
