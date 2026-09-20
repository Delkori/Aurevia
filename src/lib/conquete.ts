/**
 * La conquête des systèmes.
 *
 * La vue d'ensemble montre quatre systèmes — Revenus, Dépenses,
 * Investissements, Projets. Chacun a une condition de conquête, simple et
 * lisible, tirée des quatre parts du score : plusieurs sources de revenus,
 * des dépenses contenues, des placements répartis, des projets menés au
 * bout. Un système conquis porte un anneau plein ; un système en cours
 * montre où il en est.
 *
 * Module pur, exécuté par `node --test` : pas d'alias `@/`.
 */

export const SEUILS_CONQUETE = {
  sourcesRevenus: 2,
  partDepenses: 0.7,      // dépenses / revenus
  naturesInvest: 3,
  concentrationMax: 0.5,  // la plus grosse planète / brut
} as const;

export type Conquete = {
  revenus: number;
  depenses: number;
  investissements: number;
  projets: number;
};

const borne = (v: number) => Math.max(0, Math.min(1, v));

export function conqueteDesSystemes(e: {
  sourcesRevenus: number;
  revenusMensuels: number;
  depensesMensuelles: number;
  natures: number;
  /** Part de la plus grosse planète dans le brut, de 0 à 1. */
  concentration: number;
  projetsAtteints: number;
  projets: number;
}): Conquete {
  const ratio = e.revenusMensuels > 0 ? e.depensesMensuelles / e.revenusMensuels : Infinity;
  return {
    revenus: borne(e.sourcesRevenus / SEUILS_CONQUETE.sourcesRevenus),
    // Sous le seuil, conquis ; au-dessus, d'autant plus loin que les dépenses mordent.
    depenses: e.revenusMensuels > 0 ? borne(SEUILS_CONQUETE.partDepenses / ratio) : 0,
    investissements: borne(
      0.5 * borne(e.natures / SEUILS_CONQUETE.naturesInvest)
      + 0.5 * (e.concentration > 0 ? borne(SEUILS_CONQUETE.concentrationMax / e.concentration) : 0)
    ),
    projets: e.projets > 0 ? borne(e.projetsAtteints / e.projets) : 0,
  };
}
