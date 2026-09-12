/**
 * Nature d'une planète, et la couleur qui l'encode.
 *
 * Jusqu'ici les flux étaient tous du même violet : impossible de voir d'un coup
 * d'œil où part l'argent. La couleur porte désormais une information — la
 * nature de ce que la planète contient.
 *
 * Trois natures, pas davantage. Ce n'est pas un choix esthétique : dans une
 * galaxie, n'importe quelles deux planètes peuvent se retrouver côte à côte, ce
 * qui impose de valider *toutes* les paires de couleurs et non seulement les
 * voisines d'une légende. Au-delà de trois teintes, aucun jeu ne tient à la
 * fois le seuil de vision normale (ΔE ≥ 15) et celui des dichromatismes — les
 * couleurs restent distinctes pour l'auteur du graphique et se confondent pour
 * une partie des lecteurs.
 *
 * Trio retenu (fond sombre), validé sur toutes les paires :
 *   pire écart en deutéranopie ΔE 9,4 · pire écart en vision normale ΔE 20,9.
 *
 * Le vert et le rouge restent réservés aux revenus et aux dépenses : ce sont
 * des états, pas des catégories, et ils s'accompagnent toujours d'un libellé
 * (« Revenus », « Dépenses », « DÉFICIT ») pour ne jamais reposer sur la seule
 * couleur.
 */

export type Nature = "marches" | "immobilier" | "epargne" | "autre";

export const NATURE_COLORS: Record<Nature, string> = {
  marches: "#3987e5",
  immobilier: "#d95926",
  epargne: "#199e70",
  // Neutre assumé : « autre » n'est pas une catégorie de plus, c'est l'absence
  // de catégorie. Lui donner une teinte reviendrait à prétendre l'inverse.
  autre: "#8a8a99",
};

export const NATURE_LABELS: Record<Nature, string> = {
  marches: "Marchés",
  immobilier: "Immobilier",
  epargne: "Épargne",
  autre: "Autre",
};

/** Ordre d'affichage de la légende. */
export const NATURE_ORDER: Nature[] = ["marches", "immobilier", "epargne", "autre"];

const NATURE_BY_ASSET_TYPE: Record<string, Nature> = {
  stock: "marches",
  etf: "marches",
  crypto: "marches",
  precious_metal: "marches",
  real_estate: "immobilier",
  scpi: "immobilier",
  cash: "epargne",
  life_insurance: "epargne",
  private_equity: "autre",
  art: "autre",
  other: "autre",
};

export function natureOfAssetType(type: string): Nature {
  return NATURE_BY_ASSET_TYPE[type] ?? "autre";
}

/**
 * Nature d'un portefeuille : celle qui pèse le plus en valeur, et non la plus
 * fréquente. Une planète qui contient dix livrets à 100 € et un appartement à
 * 300 000 € est une planète immobilière.
 *
 * Les valeurs négatives sont ignorées plutôt que soustraites : elles
 * fausseraient l'arbitrage sans rien dire de la nature du contenu.
 */
export function natureOfPortfolio(
  valued: { asset: { type: string }; value: number }[]
): Nature {
  if (valued.length === 0) return "autre";

  const weights = new Map<Nature, number>();
  for (const { asset, value } of valued) {
    const nature = natureOfAssetType(asset.type);
    weights.set(nature, (weights.get(nature) ?? 0) + Math.max(0, value));
  }

  let best: Nature = "autre";
  let bestWeight = -1;
  for (const nature of NATURE_ORDER) {
    const w = weights.get(nature) ?? 0;
    if (w > bestWeight) {
      bestWeight = w;
      best = nature;
    }
  }
  // Que des valeurs nulles : on ne devine pas une nature à partir de rien.
  return bestWeight > 0 ? best : "autre";
}

export function colorOfPortfolio(
  valued: { asset: { type: string }; value: number }[]
): string {
  return NATURE_COLORS[natureOfPortfolio(valued)];
}
