/**
 * Ce qu'un flux représente sur un mois.
 *
 * Ce calcul était recopié dans quatre fichiers — la galaxie, le panneau de
 * détail, la frise et la page de prévision — avec les mêmes constantes écrites
 * à la main à chaque fois. Quatre endroits à corriger le jour où l'on change
 * d'avis, et rien pour signaler qu'on en a oublié un.
 */

export type FrequencyLike = { amount: string | number; frequency: string };

/** Jours par mois en moyenne sur une année (365,25 / 12). */
const JOURS_PAR_MOIS = 30.44;
/** Semaines par mois en moyenne (365,25 / 7 / 12). */
const SEMAINES_PAR_MOIS = 4.345;

/**
 * Montant mensuel équivalent, pour pouvoir additionner des rythmes différents.
 *
 * Un flux ponctuel vaut zéro : il ne se répète pas, donc il ne pèse sur aucun
 * mois en particulier — le compter reviendrait à l'étaler sur toute la vie du
 * foyer.
 */
export function monthlyEquivalent(flow: FrequencyLike): number {
  const montant = Number(flow.amount);
  if (!Number.isFinite(montant)) return 0;
  switch (flow.frequency) {
    case "daily": return montant * JOURS_PAR_MOIS;
    case "weekly": return montant * SEMAINES_PAR_MOIS;
    case "yearly": return montant / 12;
    case "once": return 0;
    default: return montant; // mensuel
  }
}

/** Somme des équivalents mensuels d'un ensemble de flux. */
export function monthlyTotal(flows: FrequencyLike[]): number {
  return flows.reduce((s, f) => s + monthlyEquivalent(f), 0);
}
