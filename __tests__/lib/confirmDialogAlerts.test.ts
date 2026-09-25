import { readFileSync } from 'fs';
import { join } from 'path';
import { ERROR_TITLE, INPUT_TITLE, infoButtonLabel } from '@/lib/confirmDialog';
import { translations } from '@/lib/translations';

// Section E du relevé (fix/confirm-dialogs) : les 60 alert() deviennent la boîte
// d'information (D8). Pour chacune : catégorie (erreur → « Fermer », sinon « OK »),
// titre, et texte d'origine repris tel quel en corps. Référence : relevé de main.
const lire = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\r\n/g, '\n');
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

const ATTENDU: { file: string; kind: 'error' | 'info'; title: string; body: string }[] = [
  {
    "file": "app/(dashboard)/prospects/page.tsx",
    "kind": "error",
    "title": "ERROR_TITLE",
    "body": "`Impossible de mettre à jour ce prospect : ${fail}`"
  },
  {
    "file": "app/(dashboard)/prospects/page.tsx",
    "kind": "error",
    "title": "ERROR_TITLE",
    "body": "`Impossible de mettre à jour ce prospect : ${fail}`"
  },
  {
    "file": "app/(dashboard)/prospects/page.tsx",
    "kind": "error",
    "title": "ERROR_TITLE",
    "body": "`Suppression du créneau impossible : ${fail}`"
  },
  {
    "file": "app/(dashboard)/schedules/page.tsx",
    "kind": "info",
    "title": "'Aucun créneau type actif'",
    "body": "'Aucun modèle actif. Crée des créneaux types dans \"Modèle semaine\" d\\'abord.'"
  },
  {
    "file": "app/(dashboard)/schedules/page.tsx",
    "kind": "error",
    "title": "ERROR_TITLE",
    "body": "'Erreur : ' + error.message"
  },
  {
    "file": "app/(dashboard)/schedules/page.tsx",
    "kind": "info",
    "title": "'Créneaux déjà générés'",
    "body": "'Tous les créneaux des 8 prochaines semaines sont déjà générés.'"
  },
  {
    "file": "app/(dashboard)/schedules/page.tsx",
    "kind": "info",
    "title": "'Créneaux générés'",
    "body": "`${inserted} créneaux générés sur 8 semaines.\\nLa génération se prolongera automatiquement chaque jour.`"
  },
  {
    "file": "app/(dashboard)/schedules/page.tsx",
    "kind": "error",
    "title": "ERROR_TITLE",
    "body": "'Erreur : ' + fail"
  },
  {
    "file": "app/(dashboard)/schedules/page.tsx",
    "kind": "error",
    "title": "ERROR_TITLE",
    "body": "'Statut du prospect non mis à jour : ' + error.message"
  },
  {
    "file": "app/(dashboard)/schedules/page.tsx",
    "kind": "info",
    "title": "'Déjà inscrit'",
    "body": "'Ce membre est déjà inscrit à ce créneau.'"
  },
  {
    "file": "app/(dashboard)/schedules/page.tsx",
    "kind": "error",
    "title": "ERROR_TITLE",
    "body": "'Erreur : ' + error.message"
  },
  {
    "file": "app/(dashboard)/schedules/page.tsx",
    "kind": "info",
    "title": "'Placé en liste d’attente'",
    "body": "`Créneau complet (${detailItem.max_capacity} places) : ${username} est placé en liste d'attente.`"
  },
  {
    "file": "app/(dashboard)/schedules/page.tsx",
    "kind": "error",
    "title": "ERROR_TITLE",
    "body": "`Impossible de retirer ce membre : ${fail}`"
  },
  {
    "file": "app/(dashboard)/schedules/page.tsx",
    "kind": "error",
    "title": "ERROR_TITLE",
    "body": "`Suppression impossible : ${fail}`"
  },
  {
    "file": "app/(dashboard)/settings/page.tsx",
    "kind": "info",
    "title": "INPUT_TITLE",
    "body": "'Veuillez sélectionner une image (PNG, JPG, WEBP).'"
  },
  {
    "file": "app/(dashboard)/settings/page.tsx",
    "kind": "info",
    "title": "INPUT_TITLE",
    "body": "'L\\'image ne doit pas dépasser 2 Mo.'"
  },
  {
    "file": "app/(dashboard)/settings/page.tsx",
    "kind": "error",
    "title": "ERROR_TITLE",
    "body": "`Erreur upload: ${uploadError.message}`"
  },
  {
    "file": "app/(dashboard)/settings/page.tsx",
    "kind": "error",
    "title": "ERROR_TITLE",
    "body": "`Erreur mise à jour: ${updateFail}`"
  },
  {
    "file": "app/(dashboard)/settings/page.tsx",
    "kind": "error",
    "title": "ERROR_TITLE",
    "body": "`Suppression du logo impossible : ${fail}`"
  },
  {
    "file": "app/(dashboard)/settings/page.tsx",
    "kind": "info",
    "title": "INPUT_TITLE",
    "body": "'Veuillez sélectionner une image (PNG, JPG, WEBP).'"
  },
  {
    "file": "app/(dashboard)/settings/page.tsx",
    "kind": "info",
    "title": "INPUT_TITLE",
    "body": "'L\\'image ne doit pas dépasser 4 Mo.'"
  },
  {
    "file": "app/(dashboard)/settings/page.tsx",
    "kind": "error",
    "title": "ERROR_TITLE",
    "body": "`Erreur upload: ${uploadError.message}`"
  },
  {
    "file": "app/(dashboard)/settings/page.tsx",
    "kind": "error",
    "title": "ERROR_TITLE",
    "body": "`Erreur mise à jour: ${updateFail}`"
  },
  {
    "file": "app/(dashboard)/settings/page.tsx",
    "kind": "error",
    "title": "ERROR_TITLE",
    "body": "`Suppression de la bannière impossible : ${fail}`"
  },
  {
    "file": "app/(dashboard)/settings/page.tsx",
    "kind": "info",
    "title": "INPUT_TITLE",
    "body": "'Veuillez sélectionner un fichier PDF.'"
  },
  {
    "file": "app/(dashboard)/settings/page.tsx",
    "kind": "info",
    "title": "INPUT_TITLE",
    "body": "'Le PDF ne doit pas dépasser 10 Mo.'"
  },
  {
    "file": "app/(dashboard)/settings/page.tsx",
    "kind": "error",
    "title": "ERROR_TITLE",
    "body": "`Erreur upload: ${uploadError.message}`"
  },
  {
    "file": "app/(dashboard)/settings/page.tsx",
    "kind": "error",
    "title": "ERROR_TITLE",
    "body": "`Erreur mise à jour: ${updateFail}`"
  },
  {
    "file": "app/(dashboard)/settings/page.tsx",
    "kind": "error",
    "title": "ERROR_TITLE",
    "body": "`Suppression du PDF impossible : ${fail}`"
  },
  {
    "file": "app/(dashboard)/settings/page.tsx",
    "kind": "info",
    "title": "INPUT_TITLE",
    "body": "'Le nom de la box est requis.'"
  },
  {
    "file": "app/(dashboard)/settings/page.tsx",
    "kind": "info",
    "title": "INPUT_TITLE",
    "body": "'Le site web doit commencer par http:// ou https://'"
  },
  {
    "file": "app/(dashboard)/settings/page.tsx",
    "kind": "info",
    "title": "INPUT_TITLE",
    "body": "'Vérifie le format de l\\'email.'"
  },
  {
    "file": "app/(dashboard)/settings/page.tsx",
    "kind": "info",
    "title": "INPUT_TITLE",
    "body": "'Le lien Google Maps doit commencer par http:// ou https://'"
  },
  {
    "file": "app/(dashboard)/settings/page.tsx",
    "kind": "info",
    "title": "INPUT_TITLE",
    "body": "'Le délai avant suspension doit être un nombre de jours entre 0 et 90.'"
  },
  {
    "file": "app/(dashboard)/settings/page.tsx",
    "kind": "info",
    "title": "'Adresse introuvable'",
    "body": "\"Adresse introuvable : impossible de la situer précisément. Vérifie l'adresse (rue, code postal, ville) ou colle le lien Google Maps du lieu.\""
  },
  {
    "file": "app/(dashboard)/settings/page.tsx",
    "kind": "error",
    "title": "ERROR_TITLE",
    "body": "`Erreur: ${json.error ?? 'délai avant suspension non enregistré'}`"
  },
  {
    "file": "app/(dashboard)/settings/page.tsx",
    "kind": "error",
    "title": "ERROR_TITLE",
    "body": "`Erreur: ${error?.message ?? 'aucune ligne modifiée (droits insuffisants)'}`"
  },
  {
    "file": "app/(dashboard)/tournaments/[id]/participants/KickButton.tsx",
    "kind": "error",
    "title": "ERROR_TITLE",
    "body": "`Erreur : ${error.message}`"
  },
  {
    "file": "app/(dashboard)/tournaments/[id]/scores/ScoresClient.tsx",
    "kind": "info",
    "title": "'Preuve vidéo requise'",
    "body": "\"Preuve vidéo requise : ce tournoi exige une preuve vidéo. Impossible de valider un score sans lien vidéo — demande à l'athlète de soumettre sa vidéo, ou rejette le score.\""
  },
  {
    "file": "app/(dashboard)/tournaments/[id]/scores/ScoresClient.tsx",
    "kind": "info",
    "title": "INPUT_TITLE",
    "body": "`Score illisible : « ${typed} ». Saisis un temps en mm:ss ou un nombre.`"
  },
  {
    "file": "app/admin/boxes/page.tsx",
    "kind": "error",
    "title": "ERROR_TITLE",
    "body": "`Erreur: ${json.error ?? 'géocodage échoué'}`"
  },
  {
    "file": "app/admin/boxes/page.tsx",
    "kind": "info",
    "title": "'Géocodage terminé'",
    "body": "`Géocodage terminé : ${json.updated}/${json.total} boxs mises à jour` + (json.failed ? `, ${json.failed} adresse(s) introuvable(s)` : '')"
  },
  {
    "file": "app/admin/boxes/page.tsx",
    "kind": "error",
    "title": "ERROR_TITLE",
    "body": "`Erreur: ${e?.message ?? e}`"
  },
  {
    "file": "app/pricing/page.tsx",
    "kind": "error",
    "title": "t.funnel.common.errorTitle",
    "body": "data.error ?? p.checkoutError"
  },
  {
    "file": "app/pricing/page.tsx",
    "kind": "error",
    "title": "t.funnel.common.errorTitle",
    "body": "err instanceof Error ? err.message : t.funnel.common.networkError"
  },
  {
    "file": "app/suivi/page.tsx",
    "kind": "error",
    "title": "'Réservation impossible'",
    "body": "error.message === 'SLOT_FULL' ? 'Ce créneau est complet.' : 'Réservation impossible.'"
  },
  {
    "file": "components/dashboard/LogoUploadWidget.tsx",
    "kind": "info",
    "title": "INPUT_TITLE",
    "body": "'Veuillez sélectionner une image (PNG, JPG, WEBP).'"
  },
  {
    "file": "components/dashboard/LogoUploadWidget.tsx",
    "kind": "info",
    "title": "INPUT_TITLE",
    "body": "\"L'image ne doit pas dépasser 2 Mo.\""
  },
  {
    "file": "components/dashboard/LogoUploadWidget.tsx",
    "kind": "error",
    "title": "ERROR_TITLE",
    "body": "`Erreur upload: ${uploadError.message}`"
  },
  {
    "file": "components/dashboard/LogoUploadWidget.tsx",
    "kind": "error",
    "title": "ERROR_TITLE",
    "body": "`Erreur mise à jour: ${updateFail}`"
  },
  {
    "file": "components/dashboard/LogoUploadWidget.tsx",
    "kind": "error",
    "title": "ERROR_TITLE",
    "body": "`Suppression du logo impossible : ${fail}`"
  },
  // S4 : l'erreur de suppression vient de la route, via lib/deleteWithSubscriptions.ts.
  {
    "file": "components/plans/MembershipPlansSection.tsx",
    "kind": "error",
    "title": "ERROR_TITLE",
    "body": "`Impossible de changer l'état de la formule : ${fail}`"
  },
  {
    "file": "components/programs/AthleteProgramsWorkspace.tsx",
    "kind": "error",
    "title": "ERROR_TITLE",
    "body": "`Impossible d'enregistrer le programme : ${fail}`"
  },
  // S4 : l'erreur de suppression vient de la route, via lib/deleteWithSubscriptions.ts.
  {
    "file": "components/programs/AthleteProgramsWorkspace.tsx",
    "kind": "error",
    "title": "ERROR_TITLE",
    "body": "`Impossible de changer l'état du programme : ${fail}`"
  },
  {
    "file": "components/settings/PublicPageSection.tsx",
    "kind": "error",
    "title": "ERROR_TITLE",
    "body": "`Impossible d'enregistrer l'adresse publique : ${fail}`"
  },
  {
    "file": "components/tournaments/TournamentForm.tsx",
    "kind": "info",
    "title": "INPUT_TITLE",
    "body": "'Veuillez sélectionner une image (PNG, JPG, WEBP).'"
  },
  {
    "file": "components/tournaments/TournamentForm.tsx",
    "kind": "info",
    "title": "INPUT_TITLE",
    "body": "\"L'image ne doit pas dépasser 2 Mo.\""
  },
  {
    "file": "components/tournaments/TournamentForm.tsx",
    "kind": "error",
    "title": "ERROR_TITLE",
    "body": "`Erreur upload: ${uploadError.message}`"
  }
];

/** Appels inform({ … }) d'un fichier, dans l'ordre, découpés en kind / title / body. */
function informs(src: string) {
  const out: { kind: string; title: string; body: string }[] = [];
  const re = /(?<![\w.])inform\(\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let i = m.index + m[0].length, d = 1;
    while (d) { const c = src[i]; if (c === '{' || c === '(') d++; else if (c === '}' || c === ')') d--; i++; }
    const inner = src.slice(m.index + m[0].length, i - 1);
    const kind = /kind: '(\w+)'/.exec(inner)?.[1] ?? '';
    const title = /title: ([^,]+),/.exec(inner)?.[1].trim() ?? '';
    const body = inner.slice(inner.indexOf('body: ') + 6).trim();
    out.push({ kind, title, body });
  }
  return out;
}

const FICHIERS = [...new Set(ATTENDU.map(a => a.file))];

describe('Section E : chaque alerte devient la boîte d’information, texte d’origine inchangé', () => {
  it.each(FICHIERS.map(f => [f] as const))('%s', (file) => {
    const vus = informs(lire(file)).filter(x => !/^(\{|confirm)/.test(x.body));
    const attendus = ATTENDU.filter(a => a.file === file);
    expect(vus.map(v => v.kind)).toEqual(attendus.map(a => a.kind));
    expect(vus.map(v => v.title)).toEqual(attendus.map(a => a.title));
    expect(vus.map(v => norm(v.body))).toEqual(attendus.map(a => norm(a.body)));
  });

  it('aucun alert() ne reste dans ces fichiers', () => {
    for (const file of FICHIERS) expect(lire(file)).not.toMatch(/(^|[^\w.])(window\.)?alert\(/m);
  });

  it('chaque composant qui informe affiche la boîte', () => {
    for (const file of FICHIERS) {
      const src = lire(file);
      expect((src.match(/useConfirmDialog\(\)/g) ?? []).length).toBe((src.match(/\{dialog\}/g) ?? []).length);
      expect(src).toMatch(/\{dialog\}/);
    }
  });

  it('bouton : « Fermer » pour une erreur, « OK » sinon, libellé traduit s’il est fourni', () => {
    expect(infoButtonLabel({ kind: 'error', title: ERROR_TITLE, body: 'x' })).toBe('Fermer');
    expect(infoButtonLabel({ kind: 'info', title: INPUT_TITLE, body: 'x' })).toBe('OK');
    expect(infoButtonLabel({ kind: 'error', title: 'Something went wrong', body: 'x', closeLabel: 'Close' })).toBe('Close');
  });

  it('page Tarifs (bilingue) : titre et bouton traduits', () => {
    expect(translations.fr.funnel.common.errorTitle).toBe('L’action n’a pas abouti');
    expect(translations.fr.funnel.common.close).toBe('Fermer');
    expect(translations.en.funnel.common.errorTitle).toBe('Something went wrong');
    expect(translations.en.funnel.common.close).toBe('Close');
    expect(lire('app/pricing/page.tsx').split('closeLabel: t.funnel.common.close').length - 1).toBe(2);
  });
});
