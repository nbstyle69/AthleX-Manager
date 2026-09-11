/* eslint-disable */
// @ts-nocheck
// Fichier généré par scripts/generate-tutorials-content.mjs — ne pas éditer à la main.
/*@jsxRuntime automatic*/
/*@jsxImportSource react*/
function _createMdxContent(props) {
  const _components = {
    code: "code",
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
  return <><_components.h2>{"Avant de commencer"}</_components.h2>{"\n"}<_components.p>{"Les badges de mouvement des athlètes se calculent sur les reps effectuées, mouvement par mouvement. Le rattachement se fait par le "}<_components.strong>{"catalogue officiel"}</_components.strong>{" proposé dans l'éditeur de WOD, pas par le texte saisi."}</_components.p>{"\n"}<_components.h2>{"Étapes"}</_components.h2>{"\n"}<_components.ol>{"\n"}<_components.li>{"Dans un WOD, place-toi sur une ligne de "}<_components.strong>{"Programme / Mouvements"}</_components.strong>{" et commence à taper dans le champ d'exercice : la liste se filtre à la frappe. "}<Screenshot src="/tutorials/mouvements-et-badges/1.png" alt="Recherche d'un mouvement dans la liste officielle" /></_components.li>{"\n"}<_components.li>{"Sélectionne l'entrée proposée par la liste, même si son nom diffère un peu de ton habitude — c'est ce choix qui relie la ligne au mouvement suivi par l'app."}</_components.li>{"\n"}<_components.li>{"Renseigne les reps et les charges hommes / femmes : le badge se calcule sur les reps, les charges servent à l'athlète et au classement."}</_components.li>{"\n"}<_components.li>{"Répète pour chaque ligne du metcon, puis publie. Après la séance, les reps validées par les athlètes alimentent leurs badges sans action de ta part."}</_components.li>{"\n"}</_components.ol>{"\n"}<_components.h2>{"Erreurs fréquentes"}</_components.h2>{"\n"}<_components.ul>{"\n"}<_components.li><_components.strong>{"Un mouvement écrit à la main ne donne aucun badge."}</_components.strong>{" Hors catalogue, il est enregistré avec son nom brut et ne crédite rien → réédite la ligne et prends l'entrée de la liste."}</_components.li>{"\n"}<_components.li><_components.strong>{"Les reps du bloc Musculation ne comptent pas."}</_components.strong>{" Les séries de force ne sont pas du metcon : elles ne créditent pas de badge, contrairement au bloc Cardio qui est crédité en "}<_components.code>{"séries × quantité"}</_components.code>{"."}</_components.li>{"\n"}<_components.li><_components.strong>{"Un mouvement manque dans la liste."}</_components.strong>{" Le catalogue est commun à la plateforme et n'est pas modifiable depuis la box → écris-le en clair pour la séance et signale-le à AthleX pour qu'il soit ajouté."}</_components.li>{"\n"}<_components.li><_components.strong>{"Deux variantes du même mouvement donnent des compteurs différents."}</_components.strong>{" Ce sont deux entrées distinctes du catalogue → garde la même entrée d'une séance à l'autre."}</_components.li>{"\n"}</_components.ul>{"\n"}<_components.h2>{"Y aller"}</_components.h2>{"\n"}<GoTo page="whiteboard" /></>;
}
export default function MDXContent(props = {}) {
  const {wrapper: MDXLayout} = props.components || ({});
  return MDXLayout ? <MDXLayout {...props}><_createMdxContent {...props} /></MDXLayout> : _createMdxContent(props);
}
function _missingMdxReference(id, component) {
  throw new Error("Expected " + (component ? "component" : "object") + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}
