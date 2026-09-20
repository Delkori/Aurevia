/**
 * Les ères du foyer.
 *
 * L'ère n'est pas gagnée, elle est constatée : le foyer y est ou n'y est pas,
 * d'après ses propres chiffres, et il peut en redescendre. Chaque seuil est
 * un jalon financier réel — un matelas de sécurité, l'épargne qui tourne
 * toute seule, un an de revenus de côté, le patrimoine qui paie une part
 * des dépenses, puis toutes. Rien n'y est un point inventé.
 *
 * Ce que le module dit du chemin restant, c'est un chiffre — jamais comment
 * l'obtenir. « Il manque 405 €/mois de revenus passifs » est un constat ;
 * « achète des SCPI » serait un conseil, et ce n'est pas le rôle de l'app.
 *
 * Module pur, exécuté par `node --test` : pas d'alias `@/`.
 */

export type Ere = {
  numero: 1 | 2 | 3 | 4 | 5 | 6;
  nom: string;
  /** Ce que l'ère veut dire, en une phrase. */
  sens: string;
};

export const ERES: readonly Ere[] = [
  { numero: 1, nom: "Campement", sens: "Rien de côté encore." },
  { numero: 2, nom: "Village", sens: "Un premier matelas : au moins un mois de dépenses." },
  { numero: 3, nom: "Cité", sens: "Trois mois devant soi, et l'épargne qui tourne toute seule." },
  { numero: 4, nom: "Royaume", sens: "Un an de revenus de patrimoine, sur plusieurs natures." },
  { numero: 5, nom: "Empire", sens: "Le patrimoine paie un quart des dépenses." },
  { numero: 6, nom: "Indépendance", sens: "Le patrimoine paie tout." },
];

export type EntreesEre = {
  /** Ce qui est disponible sans vendre : les planètes de nature « épargne ». */
  epargneDisponible: number;
  depensesMensuelles: number;
  /** Au moins un versement mensuel programmé vers une planète ou un projet. */
  versementProgramme: boolean;
  patrimoineNet: number;
  /** Du foyer entier — salaires de chacun et revenus déclarés. */
  revenusMensuels: number;
  /** Natures de placement distinctes qui valent quelque chose. */
  natures: number;
  /** €/mois qui tombent sans travailler : loyers, intérêts, dividendes estimés. */
  revenusPassifs: number;
};

export type Situation = {
  ere: Ere;
  prochaine: Ere | null;
  /** Ce qui sépare de l'ère suivante, chiffré — vide quand il n'y en a pas. */
  manque: string[];
};

/** Les seuils, en clair et en un seul endroit. */
export const SEUILS = {
  matelasVillage: 1,      // mois de dépenses
  matelasCite: 3,         // mois de dépenses
  patrimoineRoyaume: 12,  // mois de revenus
  naturesRoyaume: 2,
  passifsEmpire: 0.25,    // part des dépenses
  passifsIndependance: 1,
} as const;

export function situationDuFoyer(e: EntreesEre, fmt: (v: number) => string): Situation {
  const dep = e.depensesMensuelles;

  // Sans dépenses déclarées, aucun seuil ne se mesure : on ne devine pas.
  if (!(dep > 0)) {
    return { ere: ERES[0], prochaine: ERES[1], manque: ["Déclare tes dépenses mensuelles : sans elles, rien ne se mesure."] };
  }

  const mois = e.epargneDisponible / dep;
  const parMois = (v: number) => `≈ ${fmt(v)}/mois`;

  // Chaque ère exige toutes les précédentes : on s'arrête à la première
  // condition manquante, et c'est elle qu'on énonce.
  const conditions: { ere: Ere; manque: string[] }[] = [
    { ere: ERES[1], manque: mois >= SEUILS.matelasVillage ? [] : [`${fmt(SEUILS.matelasVillage * dep - e.epargneDisponible)} d'épargne disponible en plus — un mois de dépenses`] },
    { ere: ERES[2], manque: [
      ...(mois >= SEUILS.matelasCite ? [] : [`${fmt(SEUILS.matelasCite * dep - e.epargneDisponible)} d'épargne disponible en plus — trois mois de dépenses`]),
      ...(e.versementProgramme ? [] : ["un versement mensuel programmé vers une planète ou un projet"]),
    ] },
    { ere: ERES[3], manque: [
      ...(e.revenusMensuels > 0 && e.patrimoineNet >= SEUILS.patrimoineRoyaume * e.revenusMensuels ? []
        : e.revenusMensuels > 0
          ? [`${fmt(SEUILS.patrimoineRoyaume * e.revenusMensuels - e.patrimoineNet)} de patrimoine net en plus — un an de revenus`]
          : ["des revenus déclarés, pour mesurer un an de revenus"]),
      ...(e.natures >= SEUILS.naturesRoyaume ? [] : ["une deuxième nature de placement — épargne, marchés ou immobilier"]),
    ] },
    { ere: ERES[4], manque: e.revenusPassifs >= SEUILS.passifsEmpire * dep ? [] : [`${parMois(SEUILS.passifsEmpire * dep - e.revenusPassifs)} de revenus passifs — un quart des dépenses`] },
    { ere: ERES[5], manque: e.revenusPassifs >= SEUILS.passifsIndependance * dep ? [] : [`${parMois(dep - e.revenusPassifs)} de revenus passifs — la totalité des dépenses`] },
  ];

  let ere = ERES[0];
  for (const c of conditions) {
    if (c.manque.length > 0) return { ere, prochaine: c.ere, manque: c.manque };
    ere = c.ere;
  }
  return { ere, prochaine: null, manque: [] };
}
