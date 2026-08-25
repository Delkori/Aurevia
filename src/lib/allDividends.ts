import { apiFetch } from "@/lib/api";

export type DividendEvent = { date: string; amount: number };
export type DividendInfo = { ticker: string; currency: string; received: DividendEvent[]; projected: DividendEvent[] };

type AssetLike = { type: string; ticker: string | null };

// Seuls les actions et ETF versent des dividendes suivis par Yahoo Finance —
// inutile d'interroger l'API pour les cryptos ou métaux précieux.
const DIVIDEND_TYPES = new Set(["stock", "etf"]);

/**
 * Récupère le calendrier de dividendes (reçus 12 derniers mois + estimés 12
 * prochains mois) pour tous les actifs concernés. Échecs silencieux, comme
 * fetchAllQuotes : un calendrier manquant ne doit jamais bloquer l'affichage.
 */
export async function fetchAllDividends(assets: AssetLike[]): Promise<Record<string, DividendInfo | null>> {
  const tickers = [...new Set(
    assets.filter((a) => DIVIDEND_TYPES.has(a.type) && a.ticker).map((a) => a.ticker as string)
  )];
  if (tickers.length === 0) return {};

  try {
    const res = await apiFetch(`/api/dividends?tickers=${tickers.join(",")}`);
    return res as Record<string, DividendInfo | null>;
  } catch {
    return {};
  }
}
