import { readFileSync } from 'fs';
import { join } from 'path';

// Chaque action destructive des sections A et B du relevé (fix/confirm-dialogs)
// passe par la boîte de confirmation : le bouton de l'écran ouvre la boîte
// (`ask…`), et l'action n'est lancée que par son bouton d'action (`run`).
const lire = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

interface Site {
  id: string;
  file: string;
  /** Appel posé sur le bouton de l'écran : il ouvre la boîte. */
  opens: string;
  /** Appel direct de l'action : il ne doit plus être posé sur un bouton. */
  direct: string;
  /** Dans la fonction qui ouvre la boîte, `run` lance l'action. */
  run: RegExp;
}

const SITES: Site[] = [
  { id: 'A1', file: 'app/(dashboard)/schedules/page.tsx', opens: 'askKick(p)', direct: 'kickMember(p.reservation_id)', run: /function askKick[\s\S]{0,1500}run: \(\) => kickMember\(p\.reservation_id\)/ },
  { id: 'A2', file: 'app/(dashboard)/schedules/page.tsx', opens: 'askDelete(item)', direct: 'handleDelete(item)', run: /function askDelete[\s\S]{0,1200}run: \(\) => handleDelete\(item\)/ },
  { id: 'A3', file: 'app/(dashboard)/templates/page.tsx', opens: 'askDelete(t)', direct: 'handleDelete(t.id)', run: /function askDelete[\s\S]{0,900}run: \(\) => handleDelete\(t\.id\)/ },
  { id: 'A4', file: 'components/TemplatesDrawer.tsx', opens: 'askDelete(t)', direct: 'handleDelete(t.id)', run: /function askDelete[\s\S]{0,900}run: \(\) => handleDelete\(t\.id\)/ },
  { id: 'A5', file: 'components/wods/ApplyProgramWeekModal.tsx', opens: 'askDeleteTemplate(i)', direct: 'deleteTemplate(i)', run: /function askDeleteTemplate[\s\S]{0,600}run: \(\) => deleteTemplate\(t\)/ },
  { id: 'A6', file: 'app/(dashboard)/articles/page.tsx', opens: 'askDeleteArticle(a)', direct: 'deleteArticle(a)', run: /function askDeleteArticle[\s\S]{0,700}run: \(\) => deleteArticle\(article\)/ },
  { id: 'A7a', file: 'app/(dashboard)/wods/page.tsx', opens: 'deleteWOD(wod)', direct: "from('box_wods').delete().eq('id', wod.id)", run: /function deleteWOD\(wod: BoxWOD\) \{\s*ask\(\{[\s\S]{0,700}run: async \(\) => \{\s*const \{ error \} = await supabase\.from\('box_wods'\)\.delete\(\)\.eq\('id', wod\.id\)/ },
  { id: 'A7b', file: 'app/(dashboard)/wods/page.tsx', opens: 'deleteAllWodsThisWeek', direct: '.gte(\'scheduled_date\', startISO)', run: /const count {4}= wods\.length;\s*ask\(\{[\s\S]{0,800}run: async \(\) => \{\s*const \{ error \} = await supabase\s*\.from\('box_wods'\)\s*\.delete\(\)/ },
  { id: 'B1', file: 'app/(dashboard)/groups/[id]/page.tsx', opens: 'onClick={askDeleteGroup}', direct: 'onClick={deleteGroup}', run: /function askDeleteGroup[\s\S]{0,900}run: deleteGroup,/ },
  { id: 'B2', file: 'app/(dashboard)/invitations/page.tsx', opens: 'askRevoke(inv)', direct: 'revoke(inv)', run: /function askRevoke[\s\S]{0,900}run: \(\) => revoke\(invitation\)/ },
  { id: 'B3', file: 'app/(dashboard)/members/page.tsx', opens: 'onChange={changeRole}', direct: 'onChange={applyRole}', run: /async function changeRole[\s\S]{0,700}ask\(newRole === 'owner'[\s\S]{0,600}run: \(\) => applyRole\(member, newRole\)[\s\S]{0,600}run: \(\) => applyRole\(member, newRole\)/ },
  // B4, B5, B10, B11 (S4) : la boîte passe par askDeleteWithSubscriptions
  // (lib/deleteWithSubscriptions.ts, testé dans deleteWithSubscriptions.test.ts).
  { id: 'B4', file: 'app/(dashboard)/members/page.tsx', opens: 'askDeletePlan(p)', direct: 'askDeleteWithSubscriptions(', run: /function askDeletePlan[\s\S]{0,200}return askDeleteWithSubscriptions\(\{\s*ask, inform, kind: 'plan'/ },
  { id: 'B5', file: 'components/plans/MembershipPlansSection.tsx', opens: 'askDeletePlan(pl)', direct: 'askDeleteWithSubscriptions(', run: /function askDeletePlan[\s\S]{0,200}return askDeleteWithSubscriptions\(\{\s*ask, inform, kind: 'plan'/ },
  { id: 'B6', file: 'components/plans/PromoCodesSection.tsx', opens: 'askDeletePromo(pc)', direct: 'handleDeletePromo(pc)', run: /function askDeletePromo[\s\S]{0,1100}run: \(\) => handleDeletePromo\(promo\)/ },
  { id: 'B7', file: 'app/(dashboard)/subscribers/page.tsx', opens: 'askCashPayment(r)', direct: 'recordCashPayment(r)', run: /function askCashPayment[\s\S]{0,700}run: \(\) => recordCashPayment\(r\)/ },
  { id: 'B8a', file: 'app/(dashboard)/subscribers/page.tsx', opens: "askReview(req, 'approve')", direct: "reviewRequest(req.id, 'approve')", run: /function askReview[\s\S]{0,700}run: \(\) => reviewRequest\(req\.id, 'approve'\)/ },
  { id: 'B8b', file: 'app/(dashboard)/subscribers/page.tsx', opens: "askReview(req, 'reject')", direct: "reviewRequest(req.id, 'reject')", run: /function askReview[\s\S]{0,1400}field: \{ label: 'Motif du refus \(facultatif\)' \},[\s\S]{0,120}run: note => reviewRequest\(req\.id, 'reject', note\)/ },
  { id: 'B10', file: 'components/programs/AthleteProgramsWorkspace.tsx', opens: 'askDeleteProgram(p)', direct: 'askDeleteWithSubscriptions(', run: /function askDeleteProgram[\s\S]{0,200}return askDeleteWithSubscriptions\(\{\s*ask, inform, kind: 'program'/ },
  { id: 'B11', file: 'components/marketplace/MarketplaceWorkspace.tsx', opens: 'askRemove(o)', direct: 'askDeleteWithSubscriptions(', run: /function askRemove[\s\S]{0,600}return askDeleteWithSubscriptions\(\{\s*ask, inform, kind: 'offer'/ },
];

describe('Sections A et B : le bouton de l’écran ouvre la boîte, l’action part de son bouton d’action', () => {
  it.each(SITES.map(s => [s.id, s] as const))('%s', (_id, s) => {
    const src = lire(s.file);
    expect(src).toContain(s.opens);
    // L'action n'est plus déclenchée directement par un clic : hors de son
    // `run`, elle n'apparaît derrière aucun gestionnaire (`=> action` ou
    // `stopPropagation(); action`).
    const sansRun = src.split(`run: () => ${s.direct}`).join('');
    if (s.direct.startsWith('onClick') || s.direct.startsWith('onChange')) {
      expect(sansRun).not.toContain(s.direct);
    } else if (s.direct.includes("from('") || s.direct.startsWith('.')) {
      // Requête inline : une seule occurrence, celle du `run` vérifié ci-dessous.
      expect(src.split(s.direct).length - 1).toBe(1);
    } else {
      expect(sansRun).not.toContain(`=> ${s.direct}`);
      expect(sansRun).not.toContain(`; ${s.direct}`);
    }
    expect(src).toMatch(s.run);
  });

  it('B9 : le retrait comptoir passe par la boîte (voir comptoir-programmes.test.ts)', () => {
    expect(lire('components/programs/AthleteProgramsWorkspace.tsx')).toMatch(/run: \(\) => executerRetrait\(row\)/);
  });

  it('aucune boîte native ne reste dans les fichiers des sections A et B', () => {
    for (const file of [...new Set(SITES.map(s => s.file))]) {
      const src = lire(file).replace(/async function confirm\(\)/g, '');
      expect(src).not.toMatch(/(^|[^\w.])(window\.)?(confirm|prompt)\(/m);
    }
  });

  it('chaque écran affiche la boîte', () => {
    for (const file of [...new Set(SITES.map(s => s.file))]) {
      expect(lire(file)).toMatch(/\{dialog\}/);
    }
  });
});
