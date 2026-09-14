/**
 * Répartition d'une dépense entre les personnes du foyer.
 *
 * `flows.member_id` ne désignait qu'une seule personne : un loyer commun était
 * donc à 100 % sur l'un ou à 100 % sur l'autre, sans milieu. Le taux d'épargne
 * de celui qui portait tout s'effondrait, celui de l'autre était flatté, et
 * aucun des deux chiffres n'était vrai.
 *
 * Le mécanisme existait pourtant déjà dans l'app pour les biens
 * (`portfolio_ownerships`) : un appartement peut être détenu moitié-moitié.
 * On applique la même idée aux flux.
 *
 * Trois états possibles pour une dépense :
 *
 *  · **personnelle** — `shared` faux : elle revient entière à `memberId`.
 *  · **commune** — `shared` vrai, sans part explicite : elle suit la règle du
 *    foyer, celle qu'on règle une fois pour toutes.
 *  · **commune avec exception** — `shared` vrai et des parts propres à cette
 *    dépense : elles l'emportent sur la règle du foyer.
 */

export type PartLike = {
  /** `null` : il s'agit de la règle du foyer, pas d'une exception. */
  flowId: number | null;
  /** `null` = le propriétaire du foyer (« Moi »). */
  memberId: number | null;
  sharePercent: string | number;
};

export type FlowPartageable = {
  id: number;
  shared?: boolean | null;
  memberId: number | null;
};

/**
 * Normalise un jeu de parts en fractions qui somment à 1.
 *
 * Les pourcentages saisis ne font pas forcément 100 : on répartit au prorata
 * plutôt que de refuser. Saisir « 1 et 2 » doit donner un tiers / deux tiers,
 * ce qui est la lecture naturelle, et évite qu'une somme à 99 % fasse
 * disparaître un centime du budget.
 */
function enFractions(parts: PartLike[]): Map<number | null, number> | null {
  const valides = parts
    .map((p) => ({ memberId: p.memberId, poids: Number(p.sharePercent) }))
    .filter((p) => Number.isFinite(p.poids) && p.poids > 0);
  if (valides.length === 0) return null;

  const total = valides.reduce((s, p) => s + p.poids, 0);
  if (total <= 0) return null;

  const out = new Map<number | null, number>();
  for (const p of valides) out.set(p.memberId, (out.get(p.memberId) ?? 0) + p.poids / total);
  return out;
}

/**
 * Qui porte quelle fraction de cette dépense. Les fractions somment à 1.
 */
export function repartition(
  flow: FlowPartageable,
  parts: PartLike[]
): Map<number | null, number> {
  const personnelle = new Map<number | null, number>([[flow.memberId ?? null, 1]]);
  if (!flow.shared) return personnelle;

  const exception = enFractions(parts.filter((p) => p.flowId === flow.id));
  if (exception) return exception;

  const reglelFoyer = enFractions(parts.filter((p) => p.flowId === null));
  if (reglelFoyer) return reglelFoyer;

  // Déclarée commune, mais aucune règle n'a encore été posée : on ne perd pas
  // le montant en route, il reste sur son porteur d'origine.
  return personnelle;
}

/** Fraction portée par une personne — `null` pour le propriétaire du foyer. */
export function partDe(
  flow: FlowPartageable,
  parts: PartLike[],
  memberId: number | null
): number {
  return repartition(flow, parts).get(memberId ?? null) ?? 0;
}

/**
 * Somme des montants qui reviennent à une personne, sur un ensemble de flux.
 * C'est ce qui alimente son « reste à vivre » et son taux d'épargne.
 */
export function totalPour(
  flows: (FlowPartageable & { amount: string | number })[],
  parts: PartLike[],
  memberId: number | null,
  mensuel: (f: { amount: string | number; frequency?: string }) => number
): number {
  return flows.reduce((s, f) => s + mensuel(f) * partDe(f, parts, memberId), 0);
}

/**
 * Règle du foyer par défaut : parts égales entre le propriétaire et les membres
 * qui gagnent leur vie. Les enfants ne portent pas le loyer.
 */
export function reglePartEgales(
  membres: { id: number; salary: string | null }[]
): { memberId: number | null; sharePercent: number }[] {
  const adultes = membres.filter((m) => m.salary != null && Number(m.salary) > 0);
  const part = Math.round((100 / (adultes.length + 1)) * 100) / 100;
  return [
    { memberId: null, sharePercent: part },
    ...adultes.map((m) => ({ memberId: m.id, sharePercent: part })),
  ];
}
