/**
 * Les systèmes : le niveau au-dessus des planètes.
 *
 * Un seul canevas mélangeait deux natures : des *stocks* (planètes, actifs, en
 * euros) et des *flux* (revenus, dépenses, en euros par mois). Il créait en
 * plus un pôle de dépenses par personne. Le nombre de nœuds croissait en
 * `2×membres + dépenses + actifs + planètes + objectifs` — trente-six pour un
 * foyer d'exemple, et rien ne pouvait l'empêcher d'empirer.
 *
 * Ranger mieux un grand canevas ne règle pas ça. Deux niveaux, si : une vue
 * d'ensemble de cinq à six corps qui ne dit qu'une chose — où va l'argent —
 * puis on entre dans un système pour en voir le détail.
 *
 * Le quatrième type de système (voyage, voiture, maison) n'est pas un concept
 * nouveau : ce sont les objectifs, promus au rang de système. En inventer un
 * parallèle aurait fait doublon avec ce qui existe déjà.
 */

export type SystemeId = string;

export const SYSTEME_REVENUS = "revenus";
export const SYSTEME_DEPENSES = "depenses";
export const SYSTEME_INVESTISSEMENTS = "investissements";

export const projetId = (goalId: number): SystemeId => `projet-${goalId}`;
export const goalIdDeProjet = (id: SystemeId): number | null => {
  const m = /^projet-(\d+)$/.exec(id);
  return m ? Number(m[1]) : null;
};

/**
 * À quel système appartient un nœud de la galaxie détaillée.
 *
 * `"contexte"` : le total du foyer et les personnes. Ils ne valent pas pour
 * tous les systèmes — voir `contexteUtile`.
 */
export function systemeDuNoeud(kind: string): SystemeId | null | "contexte" {
  switch (kind) {
    case "salary":
    case "member-salary":
    case "income-item":
      return SYSTEME_REVENUS;
    case "expenses":
    case "expense-item":
    case "reste":
      return SYSTEME_DEPENSES;
    case "portfolio":
    case "asset":
      return SYSTEME_INVESTISSEMENTS;
    case "goal":
      return null; // rattaché à son propre projet, résolu par l'appelant
    default:
      return "contexte"; // center, member
  }
}

/**
 * Un nœud de contexte mérite-t-il sa place dans ce système ?
 *
 * Le patrimoine n'a de sens que dans « Investissements » : c'est sa somme.
 * Posé au milieu de dépenses mensuelles, « Patrimoine 297 837 € » ne répond à
 * aucune question de la vue.
 *
 * Les personnes servent de relais là où elles portent quelque chose : elles
 * reçoivent les revenus, elles détiennent les planètes, elles poursuivent les
 * projets. Dans « Dépenses », chaque planète porte déjà le nom de la sienne et
 * la couleur de son anneau : les montrer en plus ajoutait des sphères
 * dimensionnées au patrimoine au beau milieu d'une vue sur des montants
 * mensuels — on croyait voir des dépenses.
 */
export function contexteUtile(kind: string, systeme: SystemeId): boolean {
  if (kind === "center") return systeme === SYSTEME_INVESTISSEMENTS;
  return systeme !== SYSTEME_DEPENSES;
}

/** Un élément contenu dans un système, dessiné en orbite autour de lui. */
export type Satellite = { nom: string; montant: number };

/**
 * Au-delà, l'anneau de satellites devient une couronne illisible : on garde
 * les plus gros, et le compte exact reste écrit sous le montant.
 */
export const MAX_SATELLITES = 6;

export type SystemeVue = {
  id: SystemeId;
  label: string;
  /** Montant représentatif : un stock en euros, ou un flux mensuel. */
  montant: number;
  /** `true` si `montant` est un rythme mensuel et non un capital. */
  parMois: boolean;
  couleur: string;
  /** Nombre de planètes ou de lignes contenues, pour situer la densité. */
  contenu: number;
  /**
   * Avancement d'un projet, de 0 à 1, plafonné comme partout ailleurs
   * (`goalProgress`) : un objectif à 8 000 € couvert par une planète à 32 628 €
   * est atteint, pas « à 408 % ». Pour les trois systèmes fixes, c'est leur
   * conquête (`lib/conquete.ts`) ; `undefined` quand rien n'est mesuré.
   */
  progression?: number;
  /** Montant visé par un projet. */
  cible?: number;
  /**
   * Ce qu'on voit tourner autour du corps. Échantillon destiné à l'œil — les
   * plus gros d'abord, six au plus ; `contenu` reste le compte qui fait foi.
   */
  satellites: Satellite[];
};

export type FluxSysteme = {
  source: SystemeId;
  cible: SystemeId;
  /** Montant mensuel qui circule. */
  montant: number;
};

export type EntreesSystemes = {
  /** Revenus mensuels du foyer, toutes sources confondues. */
  revenus: number;
  /** Dépenses mensuelles, toutes personnes confondues. */
  depenses: number;
  /** Patrimoine net. */
  patrimoine: number;
  /** Versements mensuels vers les planètes. */
  versements: number;
  planetes: number;
  lignesDepense: number;
  /**
   * Ce que contient chaque système, pour dessiner ses satellites. Facultatif :
   * sans lui la vue reste juste, les corps tournent simplement à vide.
   */
  contenus?: {
    revenus?: Satellite[];
    depenses?: Satellite[];
    planetes?: Satellite[];
  };
  /** Conquête des trois systèmes fixes, de 0 à 1 — voir `lib/conquete.ts`. */
  conquete?: { revenus: number; depenses: number; investissements: number };
  projets: {
    goalId: number;
    nom: string;
    couleur: string;
    /** Ce qui est déjà réuni pour ce projet. */
    acquis: number;
    /** Ce qu'il vise. */
    cible: number;
    /** Versement mensuel qui l'alimente. */
    apport: number;
    planetes: number;
    /** Les planètes reliées au projet, pour ses satellites. */
    contenus?: Satellite[];
  }[];
};

/** Les plus gros d'abord, coupés à `MAX_SATELLITES`. */
function satellitesDe(liste: Satellite[] | undefined): Satellite[] {
  return [...(liste ?? [])]
    .sort((a, b) => Math.abs(b.montant) - Math.abs(a.montant) || a.nom.localeCompare(b.nom))
    .slice(0, MAX_SATELLITES);
}

/** Couleurs des trois systèmes fixes — reprises de la palette déjà validée. */
export const COULEURS_SYSTEMES: Record<string, string> = {
  [SYSTEME_REVENUS]: "#199e70",
  [SYSTEME_DEPENSES]: "#d95926",
  [SYSTEME_INVESTISSEMENTS]: "#3987e5",
};

/**
 * Les corps de la vue d'ensemble, et ce qui circule entre eux.
 *
 * Un système sans contenu ni mouvement n'est pas rendu : montrer « Dépenses
 * 0 € » à qui n'en a saisi aucune ajoute du vide plutôt que de l'information.
 */
export function construireSystemes(e: EntreesSystemes): {
  systemes: SystemeVue[];
  flux: FluxSysteme[];
} {
  const systemes: SystemeVue[] = [];
  const flux: FluxSysteme[] = [];

  if (e.revenus > 0) {
    systemes.push({
      id: SYSTEME_REVENUS, label: "Revenus", montant: e.revenus, parMois: true,
      couleur: COULEURS_SYSTEMES[SYSTEME_REVENUS], contenu: 0,
      satellites: satellitesDe(e.contenus?.revenus),
      progression: e.conquete?.revenus,
    });
  }
  if (e.depenses > 0 || e.lignesDepense > 0) {
    systemes.push({
      id: SYSTEME_DEPENSES, label: "Dépenses", montant: e.depenses, parMois: true,
      couleur: COULEURS_SYSTEMES[SYSTEME_DEPENSES], contenu: e.lignesDepense,
      satellites: satellitesDe(e.contenus?.depenses),
      progression: e.conquete?.depenses,
    });
    if (e.revenus > 0) flux.push({ source: SYSTEME_REVENUS, cible: SYSTEME_DEPENSES, montant: e.depenses });
  }
  if (e.patrimoine !== 0 || e.planetes > 0) {
    systemes.push({
      id: SYSTEME_INVESTISSEMENTS, label: "Investissements", montant: e.patrimoine, parMois: false,
      couleur: COULEURS_SYSTEMES[SYSTEME_INVESTISSEMENTS], contenu: e.planetes,
      satellites: satellitesDe(e.contenus?.planetes),
      progression: e.conquete?.investissements,
    });
    if (e.revenus > 0 && e.versements > 0) {
      flux.push({ source: SYSTEME_REVENUS, cible: SYSTEME_INVESTISSEMENTS, montant: e.versements });
    }
  }

  for (const p of e.projets) {
    const id = projetId(p.goalId);
    systemes.push({
      id, label: p.nom, montant: p.acquis, parMois: false,
      couleur: p.couleur, contenu: p.planetes,
      satellites: satellitesDe(p.contenus),
      cible: p.cible > 0 ? p.cible : undefined,
      progression: p.cible > 0 ? Math.min(1, p.acquis / p.cible) : undefined,
    });
    if (p.apport > 0) {
      // Un projet est alimenté par ce qu'on met de côté, donc par les
      // investissements quand ils existent, sinon directement par les revenus.
      const source = e.patrimoine !== 0 || e.planetes > 0 ? SYSTEME_INVESTISSEMENTS : SYSTEME_REVENUS;
      flux.push({ source, cible: id, montant: p.apport });
    }
  }

  return { systemes, flux };
}
