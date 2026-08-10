export type AssetLike = {
  type: string;
  ticker: string | null;
  quantity: string | null;
  avgBuyPrice: string | null;
  manualValue: string | null;
};

export type Quote = { price: number; currency: string } | null | undefined;

const YAHOO_PRICE_TYPES = new Set(["stock", "etf", "precious_metal"]);
const CRYPTO_PRICE_TYPES = new Set(["crypto"]);
const HAS_LIVE_PRICE = new Set([...YAHOO_PRICE_TYPES, ...CRYPTO_PRICE_TYPES]);

export { YAHOO_PRICE_TYPES, CRYPTO_PRICE_TYPES };

/** Valeur actuelle d'un actif, en tenant compte du cours en direct si dispo. */
export function currentValue(asset: AssetLike, quote: Quote): number {
  if (HAS_LIVE_PRICE.has(asset.type) && asset.ticker) {
    const qty = Number(asset.quantity ?? 0);
    if (quote?.price) return qty * quote.price;
    // pas de cours dispo -> on retombe sur le prix de revient comme estimation
    const avg = Number(asset.avgBuyPrice ?? 0);
    return qty * avg;
  }
  return Number(asset.manualValue ?? 0);
}

/** Montant investi (coût d'achat), pour calculer la plus-value latente. */
export function costBasis(asset: AssetLike): number {
  if (HAS_LIVE_PRICE.has(asset.type) && asset.ticker) {
    const qty = Number(asset.quantity ?? 0);
    const avg = Number(asset.avgBuyPrice ?? 0);
    return qty * avg;
  }
  return Number(asset.manualValue ?? 0);
}

export function gain(asset: AssetLike, quote: Quote): number {
  return currentValue(asset, quote) - costBasis(asset);
}

export function gainPercent(asset: AssetLike, quote: Quote): number {
  const cost = costBasis(asset);
  if (cost === 0) return 0;
  return (gain(asset, quote) / cost) * 100;
}

export type PortfolioOwnershipLike = {
  portfolioId: number;
  memberId: number | null;
  sharePercent: string;
};

/**
 * Part (0 à 1) d'un portefeuille possédée par un membre donné (memberId === null
 * représente le propriétaire principal du foyer, cf. "ownerName").
 *
 * Si aucune quote-part n'est définie pour ce portefeuille, on retombe sur
 * l'ancien modèle "un seul propriétaire" : 100% pour portfolio.memberId, 0%
 * pour les autres — ce qui garde les portefeuilles existants inchangés tant
 * que personne n'a explicitement configuré de partage.
 */
export function memberShareOfPortfolio(
  portfolioId: number,
  memberId: number | null,
  ownerships: PortfolioOwnershipLike[],
  portfolioOwnerMemberId: number | null
): number {
  const rows = ownerships.filter((o) => o.portfolioId === portfolioId);
  if (rows.length === 0) {
    return portfolioOwnerMemberId === memberId ? 1 : 0;
  }
  const row = rows.find((o) => o.memberId === memberId);
  return row ? Number(row.sharePercent) / 100 : 0;
}

/** Somme des quotes-parts définies pour un portefeuille (idéalement 100). */
export function totalSharePercent(
  portfolioId: number,
  ownerships: PortfolioOwnershipLike[]
): number {
  return ownerships
    .filter((o) => o.portfolioId === portfolioId)
    .reduce((s, o) => s + Number(o.sharePercent), 0);
}

export type LoanLike = {
  remainingBalance: string;
};

export function totalDebt(loans: LoanLike[]): number {
  return loans.reduce((sum, l) => sum + Number(l.remainingBalance || 0), 0);
}

export const ASSET_TYPE_LABELS: Record<string, string> = {
  stock: "Action",
  etf: "ETF",
  crypto: "Crypto",
  precious_metal: "Métal précieux",
  real_estate: "Immobilier",
  scpi: "SCPI",
  private_equity: "Private equity / Crowdfunding",
  art: "Œuvre d'art / Collection",
  life_insurance: "Assurance-vie",
  cash: "Cash / Livret",
  other: "Autre",
};
