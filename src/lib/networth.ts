export type AssetLike = {
  type: string;
  ticker: string | null;
  quantity: string | null;
  avgBuyPrice: string | null;
  manualValue: string | null;
};

export type Quote = { price: number; currency: string } | null | undefined;

const HAS_LIVE_PRICE = new Set(["stock", "etf", "crypto"]);

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
  real_estate: "Immobilier",
  cash: "Cash / Livret",
  other: "Autre",
};
