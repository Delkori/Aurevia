/**
 * Qui possède quoi, et en quelle proportion — pour teinter la galaxie.
 *
 * Une planète porte un anneau à la couleur de sa ou de ses personnes ; un
 * flux prend la couleur de la personne dont l'argent part. Les quotes-parts
 * sont la même source de vérité que pour les totaux (`ownedShare`) : sans
 * ligne, le propriétaire déclaré possède tout ; avec, elles font foi.
 */

export type Proprietaire = {
  memberId: number | null;
  nom: string;
  couleur: string;
  /** Quote-part, de 0 à 1. La somme sur une planète vaut 1. */
  part: number;
};

export type QuotePartLike = { portfolioId: number; memberId: number | null; sharePercent: string | number };

/**
 * Les personnes qui détiennent un portefeuille, par quote-part décroissante.
 *
 * `personne` traduit un identifiant en nom + couleur (null = le propriétaire
 * du compte). Les lignes à 0 % sont ignorées ; si les lignes ne totalisent
 * pas 100 %, elles sont ramenées à 1 pour que l'anneau soit toujours complet.
 */
export function proprietairesDe(
  portfolioId: number | "unassigned",
  portfolioMemberId: number | null,
  ownerships: QuotePartLike[],
  personne: (memberId: number | null) => { nom: string; couleur: string }
): Proprietaire[] {
  const lignes = portfolioId === "unassigned" ? [] : ownerships.filter(o => o.portfolioId === portfolioId);
  if (lignes.length === 0) return [{ memberId: portfolioMemberId, ...personne(portfolioMemberId), part: 1 }];

  const parPersonne = new Map<number | null, number>();
  for (const o of lignes) parPersonne.set(o.memberId, (parPersonne.get(o.memberId) ?? 0) + Number(o.sharePercent || 0));
  const total = [...parPersonne.values()].reduce((s, v) => s + v, 0);
  if (total <= 0) return [{ memberId: portfolioMemberId, ...personne(portfolioMemberId), part: 1 }];

  return [...parPersonne.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1] || (a[0] ?? -1) - (b[0] ?? -1))
    .map(([memberId, v]) => ({ memberId, ...personne(memberId), part: v / total }));
}

export type ArcAnneau = { couleur: string; longueur: number; decalage: number };

/**
 * Découpe un cercle de rayon `rayon` en arcs proportionnels aux quotes-parts,
 * exprimés en `stroke-dasharray` / `stroke-dashoffset` — pas de trigonométrie,
 * le navigateur trace les arcs. Le premier arc part du point de départ du
 * cercle ; à l'appelant de le tourner pour partir du haut.
 *
 * Avec plusieurs personnes, un écart de `ecart` px sépare les arcs pour qu'on
 * les compte ; seul, un propriétaire garde l'anneau plein.
 */
export function arcsAnneau(proprietaires: { couleur: string; part: number }[], rayon: number, ecart = 4): ArcAnneau[] {
  const C = 2 * Math.PI * rayon;
  const e = proprietaires.length > 1 ? ecart : 0;
  let debut = 0;
  return proprietaires.map(p => {
    const arc = { couleur: p.couleur, longueur: Math.max(0, p.part * C - e), decalage: debut + e / 2 };
    debut += p.part * C;
    return arc;
  });
}
