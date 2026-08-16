/**
 * Lecture d'un fichier d'adhérents exporté depuis un autre logiciel.
 *
 * On ne promet pas d'avaler n'importe quoi — le modèle téléchargeable est le
 * moule — mais un export Excel français reste lisible tel quel : séparateur
 * `;`, accents en Latin-1, colonnes nommées « Prénom » ou « Courriel ».
 *
 * Rien n'est créé ici : le parseur produit une prévisualisation, et le serveur
 * garde le dernier mot sur chaque ligne (déjà membre, exclu, formule d'une
 * autre box…).
 */

export const INVITATION_CSV_TEMPLATE = 'prenom;nom;email;formule\nÉlodie;Durand;elodie.durand@exemple.fr;Illimité\nJean;Bon;jean.bon@exemple.fr;\n';

export const IMPORT_MAX_ROWS = 500;

export interface ParsedInvitationRow {
  line: number;
  firstName: string;
  lastName: string;
  email: string;
  planLabel: string;
  planId: string | null;
  error: string | null;
}

export interface ParsedInvitationFile {
  rows: ParsedInvitationRow[];
  ready: number;
  invalid: number;
  fatal: string | null;
}

const ALIASES: Record<keyof typeof FIELDS, string[]> = {
  firstName: ['prenom', 'prénom', 'firstname', 'first name', 'first_name', 'given name'],
  lastName: ['nom', 'nom de famille', 'lastname', 'last name', 'last_name', 'surname', 'family name'],
  email: ['email', 'e-mail', 'mail', 'courriel', 'adresse email', 'adresse e-mail', 'e mail'],
  plan: ['formule', 'abonnement', 'plan', 'forfait', 'membership', 'offre'],
};

const FIELDS = { firstName: 0, lastName: 0, email: 0, plan: 0 };

/** `Nom` et `nom de famille` doivent tomber sur la même colonne. */
function normalizeHeader(raw: string): string {
  return raw.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Un fichier peut arriver en UTF-8 (avec ou sans BOM) ou en Latin-1 : Excel
 * français produit encore le second. Le décodage UTF-8 strict échoue sur du
 * Latin-1, ce qui donne un test fiable — plutôt que de deviner sur les octets.
 */
export function decodeCsv(buffer: ArrayBuffer): string {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return text.replace(/^\uFEFF/, '');
  } catch {
    return new TextDecoder('iso-8859-1').decode(buffer).replace(/^\uFEFF/, '');
  }
}

/** Le séparateur est celui qui structure l'en-tête, pas le plus fréquent du fichier. */
function detectSeparator(headerLine: string): ';' | ',' | '\t' {
  const counts: Array<[';' | ',' | '\t', number]> = [
    [';', (headerLine.match(/;/g) ?? []).length],
    [',', (headerLine.match(/,/g) ?? []).length],
    ['\t', (headerLine.match(/\t/g) ?? []).length],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ';';
}

function splitLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') {
      quoted = true;
    } else if (c === sep) {
      out.push(field); field = '';
    } else {
      field += c;
    }
  }
  out.push(field);
  return out.map(f => f.trim());
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseInvitationsCsv(
  text: string,
  plans: Array<{ id: string; name: string }>,
): ParsedInvitationFile {
  const lines = text.split(/\r\n|\n|\r/);
  const headerIndex = lines.findIndex(l => l.trim() !== '');
  if (headerIndex === -1) {
    return { rows: [], ready: 0, invalid: 0, fatal: 'Fichier vide.' };
  }

  const sep = detectSeparator(lines[headerIndex]);
  const header = splitLine(lines[headerIndex], sep).map(normalizeHeader);

  const columnOf = (field: keyof typeof FIELDS) =>
    header.findIndex(h => ALIASES[field].includes(h));

  const cols = {
    firstName: columnOf('firstName'),
    lastName: columnOf('lastName'),
    email: columnOf('email'),
    plan: columnOf('plan'),
  };

  if (cols.email === -1) {
    return {
      rows: [], ready: 0, invalid: 0,
      fatal: 'Aucune colonne e-mail trouvée. Télécharge le modèle pour voir les colonnes attendues.',
    };
  }

  const planByName = new Map(plans.map(p => [p.name.trim().toLowerCase(), p.id]));
  const seen = new Set<string>();
  const rows: ParsedInvitationRow[] = [];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const raw = lines[i];
    if (raw.trim() === '') continue;

    const cells = splitLine(raw, sep);
    const at = (idx: number) => (idx >= 0 ? (cells[idx] ?? '') : '');
    const email = at(cols.email).toLowerCase();
    const planLabel = at(cols.plan);

    let planId: string | null = null;
    let error: string | null = null;

    if (email === '') error = 'E-mail manquant';
    else if (!EMAIL_RE.test(email)) error = 'E-mail invalide';
    else if (seen.has(email)) error = 'Doublon dans le fichier';

    if (!error && planLabel !== '') {
      planId = planByName.get(planLabel.toLowerCase()) ?? null;
      if (planId === null) error = `Formule inconnue : « ${planLabel} »`;
    }

    if (!error) seen.add(email);

    rows.push({
      line: i + 1,
      firstName: at(cols.firstName),
      lastName: at(cols.lastName),
      email,
      planLabel,
      planId,
      error,
    });
  }

  if (rows.length === 0) {
    return { rows: [], ready: 0, invalid: 0, fatal: 'Aucune ligne de données dans le fichier.' };
  }
  if (rows.length > IMPORT_MAX_ROWS) {
    return {
      rows: [], ready: 0, invalid: 0,
      fatal: `${rows.length} lignes lues : ${IMPORT_MAX_ROWS} au maximum par import. Découpe ton fichier.`,
    };
  }

  return {
    rows,
    ready: rows.filter(r => r.error === null).length,
    invalid: rows.filter(r => r.error !== null).length,
    fatal: null,
  };
}

const VERDICT_LABELS: Record<string, string> = {
  creee: 'Invitation créée',
  ignoree: 'Ignorée',
  refusee: 'Refusée',
};

const REASON_LABELS: Record<string, string> = {
  deja_membre: 'déjà membre de ta box',
  invitation_en_attente: 'une invitation est déjà en attente',
  doublon_fichier: 'doublon dans le fichier',
  membre_exclu: 'personne exclue de la box',
  email_invalide: 'e-mail invalide',
  formule_inconnue: 'formule inconnue',
};

export function verdictLabel(verdict: string, reason: string | null): string {
  const head = VERDICT_LABELS[verdict] ?? verdict;
  const tail = reason ? REASON_LABELS[reason] ?? reason : null;
  return tail ? `${head} — ${tail}` : head;
}
