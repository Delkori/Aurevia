export type AssetLike = {
  type: string;
  ticker: string | null;
  quantity: string | null;
  avgBuyPrice: string | null;
  manualValue: string | null;
  currency?: string;
};

export type Quote = { price: number; currency: string } | null | undefined;

export type Rates = Record<string, number>;

/**
 * Contexte de valorisation : taux de change (convention BCE, « 1 EUR = X ») et
 * devise dans laquelle tout doit être exprimé. Passer `undefined` revient à ne
 * pas convertir — utile pour les tests, jamais pour l'affichage.
 */
export type ValuationContext = { rates: Rates; displayCurrency: string } | undefined;

const YAHOO_PRICE_TYPES = new Set(["stock", "etf", "precious_metal"]);
const CRYPTO_PRICE_TYPES = new Set(["crypto"]);
const HAS_LIVE_PRICE = new Set([...YAHOO_PRICE_TYPES, ...CRYPTO_PRICE_TYPES]);

export { YAHOO_PRICE_TYPES, CRYPTO_PRICE_TYPES, HAS_LIVE_PRICE };

/**
 * Certaines places cotent en sous-unité : Londres renvoie « GBp » (pence, soit
 * 1/100 de livre) et Tel-Aviv « ILA ». Sans ce redressement, une action du LSE
 * est comptée 100 fois sa valeur.
 */
export function normalizeQuoteCurrency(price: number, currency: string): { price: number; currency: string } {
  const c = currency?.trim();
  if (c === "GBp" || c === "GBX") return { price: price / 100, currency: "GBP" };
  if (c === "ILA") return { price: price / 100, currency: "ILS" };
  if (c === "ZAc") return { price: price / 100, currency: "ZAR" };
  return { price, currency: c || "EUR" };
}

/**
 * Convertit un montant entre deux devises. Les taux sont exprimés en
 * « 1 EUR = X devises » (convention BCE), donc on passe par l'euro.
 * Une devise absente de la table est laissée telle quelle plutôt que remise à
 * zéro : mieux vaut un montant non converti qu'un montant effacé.
 */
export function convert(amount: number, from: string, to: string, rates: Rates): number {
  if (!from || !to || from === to) return amount;
  const fromRate = rates[from];
  const toRate = rates[to];
  if (!fromRate || !toRate) return amount;
  return (amount / fromRate) * toRate;
}

function toDisplay(amount: number, currency: string, ctx: ValuationContext): number {
  if (!ctx) return amount;
  return convert(amount, currency, ctx.displayCurrency, ctx.rates);
}

/** Devise dans laquelle le prix de revient et la valeur manuelle sont saisis. */
function assetCurrency(asset: AssetLike): string {
  return asset.currency || "EUR";
}

/**
 * Valeur actuelle d'un actif, exprimée dans la devise d'affichage de `ctx`.
 *
 * Pour un actif coté, la devise qui compte est celle du *cours* (une action
 * américaine cote en USD même si l'utilisateur a saisi EUR), pas celle saisie
 * sur la ligne. Pour tout le reste, c'est la devise de la ligne.
 */
export function currentValue(asset: AssetLike, quote: Quote, ctx?: ValuationContext): number {
  if (HAS_LIVE_PRICE.has(asset.type) && asset.ticker) {
    const qty = Number(asset.quantity ?? 0);
    if (quote?.price) {
      const { price, currency } = normalizeQuoteCurrency(quote.price, quote.currency);
      return toDisplay(qty * price, currency, ctx);
    }
    // Pas de cours disponible : on retombe sur le prix de revient comme
    // estimation. `isStale()` permet à l'interface de le signaler.
    return toDisplay(qty * Number(asset.avgBuyPrice ?? 0), assetCurrency(asset), ctx);
  }
  return toDisplay(Number(asset.manualValue ?? 0), assetCurrency(asset), ctx);
}

/**
 * `true` quand la valeur affichée est un repli sur le prix de revient parce que
 * le cours n'a pas pu être récupéré — l'interface doit le dire plutôt que de
 * laisser croire à une valorisation à jour.
 */
export function isStale(asset: AssetLike, quote: Quote): boolean {
  return Boolean(HAS_LIVE_PRICE.has(asset.type) && asset.ticker && !quote?.price);
}

/** Montant investi (coût d'achat), pour calculer la plus-value latente. */
export function costBasis(asset: AssetLike, ctx?: ValuationContext): number {
  if (HAS_LIVE_PRICE.has(asset.type) && asset.ticker) {
    const qty = Number(asset.quantity ?? 0);
    return toDisplay(qty * Number(asset.avgBuyPrice ?? 0), assetCurrency(asset), ctx);
  }
  return toDisplay(Number(asset.manualValue ?? 0), assetCurrency(asset), ctx);
}

export function gain(asset: AssetLike, quote: Quote, ctx?: ValuationContext): number {
  return currentValue(asset, quote, ctx) - costBasis(asset, ctx);
}

export function gainPercent(asset: AssetLike, quote: Quote, ctx?: ValuationContext): number {
  const cost = costBasis(asset, ctx);
  if (cost === 0) return 0;
  return (gain(asset, quote, ctx) / cost) * 100;
}

export type LoanLike = {
  remainingBalance: string;
  currency?: string;
};

export function totalDebt(loans: LoanLike[], ctx?: ValuationContext): number {
  return loans.reduce(
    (sum, l) => sum + toDisplay(Number(l.remainingBalance || 0), l.currency || "EUR", ctx),
    0
  );
}

// ── Quotes-parts ─────────────────────────────────────────────────────────────

export type OwnershipLike = {
  portfolioId: number;
  memberId: number | null; // null = "Moi"
  sharePercent: string;
};

/**
 * Part (0..1) d'un portefeuille détenue par `memberId` (null = « Moi »).
 *
 * Sans ligne de quote-part, le portefeuille appartient à 100 % à son
 * propriétaire déclaré — c'est le comportement historique. Dès qu'au moins une
 * ligne existe, elles font foi : c'est ce qui rend l'éditeur « Quotes-parts »
 * réellement effectif sur les totaux, et pas seulement déclaratif.
 */
export function ownedShare(
  portfolioId: number | "unassigned",
  portfolioMemberId: number | null,
  memberId: number | null,
  ownerships: OwnershipLike[]
): number {
  if (portfolioId === "unassigned") return memberId === null ? 1 : 0;

  const rows = ownerships.filter((o) => o.portfolioId === portfolioId);
  if (rows.length === 0) return portfolioMemberId === memberId ? 1 : 0;

  const share = rows
    .filter((o) => o.memberId === memberId)
    .reduce((s, o) => s + Number(o.sharePercent || 0), 0);
  return share / 100;
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
