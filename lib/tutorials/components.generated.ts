// Fichier généré par scripts/generate-tutorials-content.mjs — ne pas éditer à la main.
// Source : content/tutorials/{fr,en}/*.mdx ; régénérer avec `npm run gen:tutorials`.
import type { MDXComponents } from 'mdx/types';
import type { Locale } from './i18n';

import Mdx_fr_abonnement_en_ligne_et_compte_athlete from './generated/fr/abonnement-en-ligne-et-compte-athlete';
import Mdx_fr_abonnes_et_facturation from './generated/fr/abonnes-et-facturation';
import Mdx_fr_actualites_et_messages from './generated/fr/actualites-et-messages';
import Mdx_fr_blocs_force_musculation_cardio from './generated/fr/blocs-force-musculation-cardio';
import Mdx_fr_ce_que_voient_les_membres_dans_l_app from './generated/fr/ce-que-voient-les-membres-dans-l-app';
import Mdx_fr_creer_un_wod from './generated/fr/creer-un-wod';
import Mdx_fr_creneaux_et_reservations from './generated/fr/creneaux-et-reservations';
import Mdx_fr_essai_gratuit_et_reservation from './generated/fr/essai-gratuit-et-reservation';
import Mdx_fr_formules_d_acces_a_la_salle from './generated/fr/formules-d-acces-a-la-salle';
import Mdx_fr_groupes_de_membres from './generated/fr/groupes-de-membres';
import Mdx_fr_importer_un_pdf_de_programmation from './generated/fr/importer-un-pdf-de-programmation';
import Mdx_fr_inviter_un_membre from './generated/fr/inviter-un-membre';
import Mdx_fr_marketplace_appliquer_au_whiteboard from './generated/fr/marketplace-appliquer-au-whiteboard';
import Mdx_fr_marketplace_publier_une_offre from './generated/fr/marketplace-publier-une-offre';
import Mdx_fr_marketplace_s_abonner_a_une_programmation from './generated/fr/marketplace-s-abonner-a-une-programmation';
import Mdx_fr_membres_et_formules from './generated/fr/membres-et-formules';
import Mdx_fr_mouvements_et_badges from './generated/fr/mouvements-et-badges';
import Mdx_fr_page_publique_de_la_box from './generated/fr/page-publique-de-la-box';
import Mdx_fr_parcours_d_un_nouveau_membre from './generated/fr/parcours-d-un-nouveau-membre';
import Mdx_fr_premiers_pas from './generated/fr/premiers-pas';
import Mdx_fr_programmes_athletes_seances from './generated/fr/programmes-athletes-seances';
import Mdx_fr_programmes_athletes_vente from './generated/fr/programmes-athletes-vente';
import Mdx_fr_prospects_et_conversion from './generated/fr/prospects-et-conversion';
import Mdx_fr_reglages_de_la_box from './generated/fr/reglages-de-la-box';
import Mdx_fr_semaines_types from './generated/fr/semaines-types';
import Mdx_fr_statistiques from './generated/fr/statistiques';
import Mdx_fr_tournois from './generated/fr/tournois';
import Mdx_fr_visibilite_d_un_wod from './generated/fr/visibilite-d-un-wod';
import Mdx_en_abonnement_en_ligne_et_compte_athlete from './generated/en/abonnement-en-ligne-et-compte-athlete';
import Mdx_en_abonnes_et_facturation from './generated/en/abonnes-et-facturation';
import Mdx_en_actualites_et_messages from './generated/en/actualites-et-messages';
import Mdx_en_blocs_force_musculation_cardio from './generated/en/blocs-force-musculation-cardio';
import Mdx_en_ce_que_voient_les_membres_dans_l_app from './generated/en/ce-que-voient-les-membres-dans-l-app';
import Mdx_en_creer_un_wod from './generated/en/creer-un-wod';
import Mdx_en_creneaux_et_reservations from './generated/en/creneaux-et-reservations';
import Mdx_en_essai_gratuit_et_reservation from './generated/en/essai-gratuit-et-reservation';
import Mdx_en_formules_d_acces_a_la_salle from './generated/en/formules-d-acces-a-la-salle';
import Mdx_en_groupes_de_membres from './generated/en/groupes-de-membres';
import Mdx_en_importer_un_pdf_de_programmation from './generated/en/importer-un-pdf-de-programmation';
import Mdx_en_inviter_un_membre from './generated/en/inviter-un-membre';
import Mdx_en_marketplace_appliquer_au_whiteboard from './generated/en/marketplace-appliquer-au-whiteboard';
import Mdx_en_marketplace_publier_une_offre from './generated/en/marketplace-publier-une-offre';
import Mdx_en_marketplace_s_abonner_a_une_programmation from './generated/en/marketplace-s-abonner-a-une-programmation';
import Mdx_en_membres_et_formules from './generated/en/membres-et-formules';
import Mdx_en_mouvements_et_badges from './generated/en/mouvements-et-badges';
import Mdx_en_page_publique_de_la_box from './generated/en/page-publique-de-la-box';
import Mdx_en_parcours_d_un_nouveau_membre from './generated/en/parcours-d-un-nouveau-membre';
import Mdx_en_premiers_pas from './generated/en/premiers-pas';
import Mdx_en_programmes_athletes_seances from './generated/en/programmes-athletes-seances';
import Mdx_en_programmes_athletes_vente from './generated/en/programmes-athletes-vente';
import Mdx_en_prospects_et_conversion from './generated/en/prospects-et-conversion';
import Mdx_en_reglages_de_la_box from './generated/en/reglages-de-la-box';
import Mdx_en_semaines_types from './generated/en/semaines-types';
import Mdx_en_statistiques from './generated/en/statistiques';
import Mdx_en_tournois from './generated/en/tournois';
import Mdx_en_visibilite_d_un_wod from './generated/en/visibilite-d-un-wod';

export type TutorialComponent = (props: { components?: MDXComponents }) => JSX.Element;

/** MDX compilé au build : aucun compilateur ni lecture disque à la requête. */
export const TUTORIAL_COMPONENTS: Record<Locale, Record<string, TutorialComponent>> = {
  fr: {
    "abonnement-en-ligne-et-compte-athlete": Mdx_fr_abonnement_en_ligne_et_compte_athlete,
    "abonnes-et-facturation": Mdx_fr_abonnes_et_facturation,
    "actualites-et-messages": Mdx_fr_actualites_et_messages,
    "blocs-force-musculation-cardio": Mdx_fr_blocs_force_musculation_cardio,
    "ce-que-voient-les-membres-dans-l-app": Mdx_fr_ce_que_voient_les_membres_dans_l_app,
    "creer-un-wod": Mdx_fr_creer_un_wod,
    "creneaux-et-reservations": Mdx_fr_creneaux_et_reservations,
    "essai-gratuit-et-reservation": Mdx_fr_essai_gratuit_et_reservation,
    "formules-d-acces-a-la-salle": Mdx_fr_formules_d_acces_a_la_salle,
    "groupes-de-membres": Mdx_fr_groupes_de_membres,
    "importer-un-pdf-de-programmation": Mdx_fr_importer_un_pdf_de_programmation,
    "inviter-un-membre": Mdx_fr_inviter_un_membre,
    "marketplace-appliquer-au-whiteboard": Mdx_fr_marketplace_appliquer_au_whiteboard,
    "marketplace-publier-une-offre": Mdx_fr_marketplace_publier_une_offre,
    "marketplace-s-abonner-a-une-programmation": Mdx_fr_marketplace_s_abonner_a_une_programmation,
    "membres-et-formules": Mdx_fr_membres_et_formules,
    "mouvements-et-badges": Mdx_fr_mouvements_et_badges,
    "page-publique-de-la-box": Mdx_fr_page_publique_de_la_box,
    "parcours-d-un-nouveau-membre": Mdx_fr_parcours_d_un_nouveau_membre,
    "premiers-pas": Mdx_fr_premiers_pas,
    "programmes-athletes-seances": Mdx_fr_programmes_athletes_seances,
    "programmes-athletes-vente": Mdx_fr_programmes_athletes_vente,
    "prospects-et-conversion": Mdx_fr_prospects_et_conversion,
    "reglages-de-la-box": Mdx_fr_reglages_de_la_box,
    "semaines-types": Mdx_fr_semaines_types,
    "statistiques": Mdx_fr_statistiques,
    "tournois": Mdx_fr_tournois,
    "visibilite-d-un-wod": Mdx_fr_visibilite_d_un_wod,
  },
  en: {
    "abonnement-en-ligne-et-compte-athlete": Mdx_en_abonnement_en_ligne_et_compte_athlete,
    "abonnes-et-facturation": Mdx_en_abonnes_et_facturation,
    "actualites-et-messages": Mdx_en_actualites_et_messages,
    "blocs-force-musculation-cardio": Mdx_en_blocs_force_musculation_cardio,
    "ce-que-voient-les-membres-dans-l-app": Mdx_en_ce_que_voient_les_membres_dans_l_app,
    "creer-un-wod": Mdx_en_creer_un_wod,
    "creneaux-et-reservations": Mdx_en_creneaux_et_reservations,
    "essai-gratuit-et-reservation": Mdx_en_essai_gratuit_et_reservation,
    "formules-d-acces-a-la-salle": Mdx_en_formules_d_acces_a_la_salle,
    "groupes-de-membres": Mdx_en_groupes_de_membres,
    "importer-un-pdf-de-programmation": Mdx_en_importer_un_pdf_de_programmation,
    "inviter-un-membre": Mdx_en_inviter_un_membre,
    "marketplace-appliquer-au-whiteboard": Mdx_en_marketplace_appliquer_au_whiteboard,
    "marketplace-publier-une-offre": Mdx_en_marketplace_publier_une_offre,
    "marketplace-s-abonner-a-une-programmation": Mdx_en_marketplace_s_abonner_a_une_programmation,
    "membres-et-formules": Mdx_en_membres_et_formules,
    "mouvements-et-badges": Mdx_en_mouvements_et_badges,
    "page-publique-de-la-box": Mdx_en_page_publique_de_la_box,
    "parcours-d-un-nouveau-membre": Mdx_en_parcours_d_un_nouveau_membre,
    "premiers-pas": Mdx_en_premiers_pas,
    "programmes-athletes-seances": Mdx_en_programmes_athletes_seances,
    "programmes-athletes-vente": Mdx_en_programmes_athletes_vente,
    "prospects-et-conversion": Mdx_en_prospects_et_conversion,
    "reglages-de-la-box": Mdx_en_reglages_de_la_box,
    "semaines-types": Mdx_en_semaines_types,
    "statistiques": Mdx_en_statistiques,
    "tournois": Mdx_en_tournois,
    "visibilite-d-un-wod": Mdx_en_visibilite_d_un_wod,
  },
};
