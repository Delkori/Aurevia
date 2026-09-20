/**
 * L'arbre des découvertes.
 *
 * L'arbre technologique de Civilization, appliqué à l'organisation d'un
 * patrimoine : cinq branches, quinze découvertes, chacune avec une condition
 * vérifiable dans les données. On ne coche rien soi-même — le jeu constate.
 * Les découvertes qui manquent sont la moitié « propositions » de l'arbre :
 * chacune dit ce qu'il reste à faire, et aucune ne dit quoi acheter.
 *
 * Module pur, exécuté par `node --test` : pas d'alias `@/`.
 */

export type Branche = "fondations" | "discipline" | "marches" | "pierre" | "transmission";

export const BRANCHES: { id: Branche; nom: string }[] = [
  { id: "fondations", nom: "Fondations" },
  { id: "discipline", nom: "Discipline" },
  { id: "marches", nom: "Marchés" },
  { id: "pierre", nom: "Pierre" },
  { id: "transmission", nom: "Transmission" },
];

export type Decouverte = {
  id: string;
  branche: Branche;
  nom: string;
  /** La condition, en clair — c'est aussi la proposition quand elle manque. */
  condition: string;
  decouverte: boolean;
};

export type EntreesDecouvertes = {
  planetes: {
    id: number;
    valeur: number;
    plafond: number | null;
    /** AAAA-MM-JJ, ou `null` si la personne ne l'a pas renseignée. */
    ouverteLe: string | null;
    nature: "marches" | "immobilier" | "epargne" | "autre";
    /** Rôle du propriétaire déclaré ; `null` pour le titulaire du compte. */
    roleProprietaire: string | null;
    /** Identifiant du propriétaire déclaré, `null` pour le titulaire. */
    proprietaire: number | null;
  }[];
  membres: number;
  versementProgramme: boolean;
  /** Mois entièrement pointés, du plus ancien au plus récent, sous la forme AAAA-MM. */
  moisPointes: string[];
  revenusMensuels: number;
  depensesMensuelles: number;
  quotesParts: number;
  creditsAdosses: number;
  dividendesRecus: number;
  /** Chaque projet avec les propriétaires distincts de ses planètes liées. */
  projets: { proprietaires: (number | null)[] }[];
  maintenant: Date;
};

const MOIS_MS = 30.44 * 86_400_000;

/** Combien de mois d'affilée, en remontant depuis le plus récent. */
export function moisDAffilee(mois: readonly string[]): number {
  if (mois.length === 0) return 0;
  const tries = [...new Set(mois)].sort();
  let serie = 1;
  for (let i = tries.length - 1; i > 0; i--) {
    const [a1, m1] = tries[i].split("-").map(Number);
    const [a0, m0] = tries[i - 1].split("-").map(Number);
    if (a1 * 12 + m1 - (a0 * 12 + m0) === 1) serie++;
    else break;
  }
  return serie;
}

export function decouvertesDuFoyer(e: EntreesDecouvertes): Decouverte[] {
  const p = e.planetes;
  const natures = new Set(p.filter((x) => x.valeur > 0).map((x) => x.nature));
  natures.delete("autre");
  const ancienne = p.some((x) => x.ouverteLe != null && e.maintenant.getTime() - new Date(x.ouverteLe).getTime() > 12 * MOIS_MS);

  return [
    // ── Fondations ──────────────────────────────────────────────────────
    { id: "campement", branche: "fondations", nom: "Premier campement", condition: "une planète", decouverte: p.length >= 1 },
    { id: "inventaire", branche: "fondations", nom: "Inventaire", condition: "toutes les planètes plafonnées",
      decouverte: p.length >= 1 && p.every((x) => x.plafond != null && x.plafond > 0) },
    { id: "foyer", branche: "fondations", nom: "Foyer", condition: "une personne ajoutée", decouverte: e.membres >= 1 },
    // ── Discipline ──────────────────────────────────────────────────────
    { id: "auto", branche: "discipline", nom: "Épargne automatique", condition: "un versement mensuel programmé", decouverte: e.versementProgramme },
    { id: "tour", branche: "discipline", nom: "Tour pointé", condition: "un mois entièrement pointé", decouverte: e.moisPointes.length >= 1 },
    { id: "regularite", branche: "discipline", nom: "Régularité", condition: "trois mois pointés d'affilée", decouverte: moisDAffilee(e.moisPointes) >= 3 },
    { id: "budget", branche: "discipline", nom: "Budget tenu", condition: "dépenses sous 80 % des revenus",
      decouverte: e.revenusMensuels > 0 && e.depensesMensuelles <= 0.8 * e.revenusMensuels },
    // ── Marchés ─────────────────────────────────────────────────────────
    { id: "diversification", branche: "marches", nom: "Diversification", condition: "trois natures de placement", decouverte: natures.size >= 3 },
    { id: "longue-vue", branche: "marches", nom: "Longue vue", condition: "une planète tenue depuis plus d'un an", decouverte: ancienne },
    { id: "dividendes", branche: "marches", nom: "Dividendes", condition: "un dividende reçu", decouverte: e.dividendesRecus >= 1 },
    // ── Pierre ──────────────────────────────────────────────────────────
    { id: "terre", branche: "pierre", nom: "Terre", condition: "un bien immobilier", decouverte: p.some((x) => x.nature === "immobilier" && x.valeur > 0) },
    { id: "copropriete", branche: "pierre", nom: "Copropriété", condition: "une quote-part déclarée", decouverte: e.quotesParts >= 1 },
    { id: "levier", branche: "pierre", nom: "Levier", condition: "un crédit adossé à un bien", decouverte: e.creditsAdosses >= 1 },
    // ── Transmission ────────────────────────────────────────────────────
    { id: "heritier", branche: "transmission", nom: "Héritier", condition: "une planète au nom d'un enfant", decouverte: p.some((x) => x.roleProprietaire === "child") },
    { id: "commun", branche: "transmission", nom: "Projet commun", condition: "un projet porté par deux personnes",
      decouverte: e.projets.some((pr) => new Set(pr.proprietaires).size >= 2) },
  ];
}

/** Les mois entièrement pointés, d'après les échéances : aucune en attente, au moins une. */
export function moisEntierementPointes(
  echeances: readonly { dueDate: string; status: string }[],
  maintenant: Date
): string[] {
  const parMois = new Map<string, { total: number; attente: number }>();
  const courant = `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, "0")}`;
  for (const o of echeances) {
    const m = o.dueDate.slice(0, 7);
    // Le mois en cours n'est pas fini : on ne le compte que s'il est déjà tout pointé.
    if (m > courant) continue;
    const c = parMois.get(m) ?? { total: 0, attente: 0 };
    c.total++;
    if (o.status === "pending") c.attente++;
    parMois.set(m, c);
  }
  return [...parMois.entries()].filter(([, c]) => c.total > 0 && c.attente === 0).map(([m]) => m).sort();
}
