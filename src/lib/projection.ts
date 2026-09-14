export function monthlyRateFromAnnual(annualPercent: number) {
  return Math.pow(1 + annualPercent / 100, 1 / 12) - 1;
}

/**
 * Valeur d'un capital après `months` mois, versements mensuels et rendement
 * composé compris.
 *
 * La même formule vivait en double, à l'octet près, dans `GalaxyView` et dans
 * la page de frise — et `projectNetWorth` en était une troisième écriture. Une
 * correction sur l'une aurait laissé les autres mentir, sans que rien ne le
 * signale : deux écrans auraient affiché deux projections différentes pour la
 * même hypothèse.
 */
export function futureValue(
  capital: number,
  versementMensuel: number,
  tauxAnnuelPct: number,
  mois: number
): number {
  if (mois <= 0) return capital;
  const r = monthlyRateFromAnnual(tauxAnnuelPct);
  if (r === 0) return capital + versementMensuel * mois;
  const croissance = Math.pow(1 + r, mois);
  return capital * croissance + versementMensuel * ((croissance - 1) / r);
}

/** Projette le patrimoine mois par mois avec versements mensuels et rendement composé. */
export function projectNetWorth(
  current: number,
  monthlyContribution: number,
  annualRatePercent: number,
  months: number
): { month: number; value: number; contributed: number }[] {
  const r = monthlyRateFromAnnual(annualRatePercent);
  const points: { month: number; value: number; contributed: number }[] = [
    { month: 0, value: current, contributed: 0 },
  ];
  let value = current;
  let contributed = 0;
  for (let m = 1; m <= months; m++) {
    value = value * (1 + r) + monthlyContribution;
    contributed += monthlyContribution;
    points.push({ month: m, value, contributed });
  }
  return points;
}

/** Nombre de mois nécessaires pour atteindre `target`, ou null si jamais atteint (plafond 600 mois). */
export function monthsToReach(
  current: number,
  monthlyContribution: number,
  annualRatePercent: number,
  target: number,
  cap = 600
): number | null {
  if (current >= target) return 0;
  const r = monthlyRateFromAnnual(annualRatePercent);
  let value = current;
  for (let m = 1; m <= cap; m++) {
    value = value * (1 + r) + monthlyContribution;
    if (value >= target) return m;
  }
  return null;
}
