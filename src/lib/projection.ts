export function monthlyRateFromAnnual(annualPercent: number) {
  return Math.pow(1 + annualPercent / 100, 1 / 12) - 1;
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
