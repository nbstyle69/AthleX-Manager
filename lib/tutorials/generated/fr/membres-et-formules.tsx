/* eslint-disable */
// @ts-nocheck
// Fichier généré par scripts/generate-tutorials-content.mjs — ne pas éditer à la main.
/*@jsxRuntime automatic*/
/*@jsxImportSource react*/
function _createMdxContent(props) {
  const _components = {
    h2: "h2",
    li: "li",
    ol: "ol",
    p: "p",
    strong: "strong",
    ul: "ul",
    ...props.components
  }, {GoTo, Screenshot} = _components;
  if (!GoTo) _missingMdxReference("GoTo", true);
  if (!Screenshot) _missingMdxReference("Screenshot", true);
  return <><_components.h2>{"Avant de commencer"}</_components.h2>{"\n"}<_components.p>{"Les membres arrivent par quatre chemins — essai public, invitation nominative, abonnement en ligne, code de la box — comparés dans « Les quatre façons d'entrer dans ta box ». La page "}<_components.strong>{"Membres"}</_components.strong>{" (Communauté → Membres) liste ensuite tout le monde, avec la recherche, les filtres et l'accès aux contrats."}</_components.p>{"\n"}<_components.h2>{"Étapes"}</_components.h2>{"\n"}<_components.ol>{"\n"}<_components.li>{"Ouvre "}<_components.strong>{"Membres"}</_components.strong>{" : le compteur du haut indique le nombre de fiches affichées sur le total, et la recherche accepte un nom ou un e-mail. "}<Screenshot src="/tutorials/membres-et-formules/1.png" alt="Liste des membres avec la recherche et les filtres" /></_components.li>{"\n"}<_components.li>{"Affine avec les filtres : par groupe, ou par état de contrat, pour retrouver par exemple les membres sans abonnement."}</_components.li>{"\n"}<_components.li>{"Clique "}<_components.strong>{"Contrats"}</_components.strong>{" pour afficher la colonne "}<_components.strong>{"Contrats / Abonnements"}</_components.strong>{" : tu vois d'un coup d'œil quelle formule chaque membre détient et jusqu'à quand."}</_components.li>{"\n"}<_components.li>{"Ouvre une fiche membre pour son détail : groupes, ELO, historique. C'est aussi d'ici que tu vérifies qu'un membre est bien actif."}</_components.li>{"\n"}<_components.li>{"Les formules elles-mêmes (prix, durée, engagement) se créent dans "}<_components.strong>{"Formules"}</_components.strong>{" (Communauté → Formules) : la page Membres les consomme, elle ne les définit pas. Voir « Formules d'accès à la salle »."}</_components.li>{"\n"}<_components.li>{"Pour inscrire quelqu'un avec sa formule déjà attribuée, passe par "}<_components.strong>{"Invitations"}</_components.strong>{" : le lien personnel porte la formule et le mode de paiement. Voir « Inviter un membre nominativement »."}</_components.li>{"\n"}</_components.ol>{"\n"}<_components.h2>{"Erreurs fréquentes"}</_components.h2>{"\n"}<_components.ul>{"\n"}<_components.li><_components.strong>{"Un adhérent n'apparaît pas dans la liste."}</_components.strong>{" Il n'a pas terminé son parcours d'entrée : une invitation reste dans "}<_components.strong>{"Invitations"}</_components.strong>{" jusqu'à son acceptation, et un prospect d'essai reste dans "}<_components.strong>{"Prospects"}</_components.strong>{" tant qu'il n'a pas de compte."}</_components.li>{"\n"}<_components.li><_components.strong>{"Un membre dit payer mais n'a aucun contrat."}</_components.strong>{" Le paiement a été fait hors AthleX, ou la souscription n'a pas abouti → vérifie la colonne Contrats, puis "}<_components.strong>{"Abonnés"}</_components.strong>{" pour les paiements en ligne."}</_components.li>{"\n"}<_components.li><_components.strong>{"Impossible de créer une formule depuis Membres."}</_components.strong>{" C'est normal : la création et l'édition des formules vivent dans "}<_components.strong>{"Formules"}</_components.strong>{" → ouvre cette page."}</_components.li>{"\n"}<_components.li><_components.strong>{"Un coach ne voit pas la page Membres."}</_components.strong>{" Elle est réservée au gérant → connecte-toi avec le compte owner."}</_components.li>{"\n"}</_components.ul>{"\n"}<_components.h2>{"Y aller"}</_components.h2>{"\n"}<GoTo page="members" /></>;
}
export default function MDXContent(props = {}) {
  const {wrapper: MDXLayout} = props.components || ({});
  return MDXLayout ? <MDXLayout {...props}><_createMdxContent {...props} /></MDXLayout> : _createMdxContent(props);
}
function _missingMdxReference(id, component) {
  throw new Error("Expected " + (component ? "component" : "object") + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}
