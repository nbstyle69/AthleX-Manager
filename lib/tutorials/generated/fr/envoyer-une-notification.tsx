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
  }, {GoTo} = _components;
  if (!GoTo) _missingMdxReference("GoTo", true);
  return <><_components.h2>{"Avant de commencer"}</_components.h2>{"\n"}<_components.p><_components.strong>{"Notifications"}</_components.strong>{" (Animation → Notifications) envoie une notification sur le téléphone des membres actifs de la box. La page est réservée au gérant et aux co-gérants : un coach ne la voit pas dans le menu. Un membre ne la reçoit que s'il a activé les notifications dans l'app et qu'il y est connecté sur un téléphone."}</_components.p>{"\n"}<_components.h2>{"Étapes"}</_components.h2>{"\n"}<_components.ol>{"\n"}<_components.li>{"Choisis le "}<_components.strong>{"Destinataire"}</_components.strong>{" : "}<_components.strong>{"Tous les membres"}</_components.strong>{" (par défaut, avec le nombre de membres actifs) ou "}<_components.strong>{"Un membre"}</_components.strong>{"."}</_components.li>{"\n"}<_components.li>{"Avec "}<_components.strong>{"Un membre"}</_components.strong>{", tape dans "}<_components.strong>{"Rechercher ou choisir dans la liste"}</_components.strong>{" : la liste est rangée de A à Z, sans tenir compte des accents ni des majuscules. Les flèches parcourent la liste, "}<_components.strong>{"Entrée"}</_components.strong>{" choisit, "}<_components.strong>{"Échap"}</_components.strong>{" la ferme. Le membre choisi s'affiche avec "}<_components.strong>{"Changer"}</_components.strong>{"."}</_components.li>{"\n"}<_components.li>{"Écris le "}<_components.strong>{"Titre"}</_components.strong>{" (80 caractères au plus) et, si tu veux, un "}<_components.strong>{"Message"}</_components.strong>{" (300 caractères au plus), puis clique "}<_components.strong>{"Envoyer"}</_components.strong>{"."}</_components.li>{"\n"}<_components.li>{"Le résultat s'affiche sous le bouton : « Envoyée à … appareils » en vert, ou « Non reçue » en orange si personne ne pouvait la recevoir."}</_components.li>{"\n"}<_components.li>{"L'"}<_components.strong>{"Historique"}</_components.strong>{" montre tes 20 dernières notifications : date, titre, destinataire et résultat."}</_components.li>{"\n"}<_components.li>{"Depuis "}<_components.strong>{"Membres"}</_components.strong>{", la "}<_components.strong>{"Fiche"}</_components.strong>{" d'un membre actif propose "}<_components.strong>{"Envoyer une notification"}</_components.strong>{" : la page s'ouvre avec ce membre déjà choisi."}</_components.li>{"\n"}</_components.ol>{"\n"}<_components.h2>{"Erreurs fréquentes"}</_components.h2>{"\n"}<_components.ul>{"\n"}<_components.li><_components.strong>{"« Non reçue »."}</_components.strong>{" Le membre n'a pas activé les notifications ou n'est connecté sur aucun téléphone → demande-lui de les activer dans l'app."}</_components.li>{"\n"}<_components.li><_components.strong>{"Le bouton Envoyer reste grisé."}</_components.strong>{" Le "}<_components.strong>{"Titre"}</_components.strong>{" est vide, ou "}<_components.strong>{"Un membre"}</_components.strong>{" est coché sans membre choisi."}</_components.li>{"\n"}<_components.li><_components.strong>{"« L’action n’a pas abouti »."}</_components.strong>{" La notification n'a pas été enregistrée, ou l'envoi a échoué après l'enregistrement → réessaie plus tard."}</_components.li>{"\n"}<_components.li><_components.strong>{"« Membre retiré » dans l'historique."}</_components.strong>{" Le destinataire n'est plus membre actif de la box."}</_components.li>{"\n"}</_components.ul>{"\n"}<_components.h2>{"Y aller"}</_components.h2>{"\n"}<GoTo page="notifications" /></>;
}
export default function MDXContent(props = {}) {
  const {wrapper: MDXLayout} = props.components || ({});
  return MDXLayout ? <MDXLayout {...props}><_createMdxContent {...props} /></MDXLayout> : _createMdxContent(props);
}
function _missingMdxReference(id, component) {
  throw new Error("Expected " + (component ? "component" : "object") + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}
