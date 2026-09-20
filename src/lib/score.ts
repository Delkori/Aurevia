/**
 * Le score de structure, sur cent.
 *
 * Quatre parts de vingt-cinq : épargne, diversification, dette, concentration.
 * Il ne juge aucun placement — il dit si le patrimoine est *organisé* : on
 * met de côté, on ne dépend pas d'une seule planète, on n'est pas trop
 * endetté, aucun bien n'écrase les autres. C'est le score de la barre
 * latérale ; la fin de tour le détaille, part par part.
 *
 * Module pur, exécuté par `node --test` : pas d'alias `@/`.
 */

export type PartsScore = {
  epargne: number;
  diversification: number;
  dette: number;
  concentration: number;
};

export type Score = { total: number; parts: PartsScore };

export const PART_MAX = 25;

export function scoreDeStructure({
  brut,
  dette,
  revenus,
  depenses,
  planetes,
}: {
  /** Actifs bruts, avant crédits. */
  brut: number;
  dette: number;
  /** Revenus mensuels, au sens de la galaxie : salaire principal et revenus déclarés. */
  revenus: number;
  /** Dépenses mensuelles. */
  depenses: number;
  /** Chaque planète avec sa valeur et son habillage — la diversification compte les habillages distincts. */
  planetes: { total: number; skin: string }[];
}): Score | null {
  if (brut <= 0) return null;

  // Épargne : 40 % de taux d'épargne vaut la part entière. Sans revenus
  // déclarés, on ne peut rien dire — on donne la moitié plutôt que zéro.
  const tauxEpargne = revenus > 0 ? Math.round(((revenus - depenses) / revenus) * 100) : 0;
  const epargne = revenus > 0 ? Math.min(PART_MAX, Math.max(0, (tauxEpargne / 40) * PART_MAX)) : PART_MAX / 2;

  // Diversification : six points par habillage distinct parmi les planètes
  // qui valent quelque chose — cinq habillages font la part entière.
  const habillages = new Set(planetes.filter((p) => p.total > 0).map((p) => p.skin));
  const diversification = Math.min(PART_MAX, habillages.size * 6);

  // Dette : chaque 4 % de dette rapportée au brut coûte un point.
  const ratioDette = dette / brut;
  const detteP = Math.max(0, PART_MAX - (ratioDette * 100) / 4);

  // Concentration : la plus grosse planète sous 30 % du brut vaut la part
  // entière ; au-delà, on perd linéairement jusqu'à tout avoir sur une seule.
  const plusGrosse = Math.max(0, ...planetes.map((p) => p.total)) / brut;
  const concentration = plusGrosse <= 0.3 ? PART_MAX : Math.max(0, PART_MAX - ((plusGrosse - 0.3) / 0.7) * PART_MAX);

  return {
    total: Math.round(epargne + diversification + detteP + concentration),
    parts: { epargne, diversification, dette: detteP, concentration },
  };
}
