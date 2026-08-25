import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

export type DividendEvent = { date: string; amount: number }; // amount = par action, dans `currency`

export type DividendInfo = {
  ticker: string;
  currency: string;
  /** Versements réels des 12 derniers mois (source : historique Yahoo Finance). */
  received: DividendEvent[];
  /**
   * Versements estimés des 12 prochains mois, extrapolés à partir de la cadence
   * observée dans l'historique (mensuel/trimestriel/semestriel/annuel) et du
   * dernier montant connu. Ce n'est PAS une date officiellement annoncée par
   * l'entreprise (Yahoo Finance public ne l'expose pas de façon fiable) — donc
   * on ne prétend pas à un 3ᵉ palier "confirmé" comme Finary, seulement
   * "reçu" vs "estimé", pour ne jamais afficher une fausse certitude.
   */
  projected: DividendEvent[];
};

type CacheEntry = { data: DividendInfo; at: number };
const cache = new Map<string, CacheEntry>();
// Les dividendes changent rarement dans la journée — cache plus long que les cours.
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12h

/**
 * Projette les prochains versements en reproduisant l'intervalle moyen observé
 * entre les versements réels, au même montant que le dernier versement connu.
 * Volontairement simple : c'est une estimation affichée comme telle, pas une
 * prévision financière.
 */
function projectForward(received: DividendEvent[], now: Date): DividendEvent[] {
  if (received.length === 0) return [];
  const sorted = [...received].sort((a, b) => a.date.localeCompare(b.date));
  const dates = sorted.map((d) => new Date(d.date).getTime());
  const gaps: number[] = [];
  for (let i = 1; i < dates.length; i++) gaps.push(dates[i] - dates[i - 1]);
  const DAY_MS = 86_400_000;
  const avgGapDays = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length / DAY_MS : 365;
  const lastAmount = sorted[sorted.length - 1].amount;
  const horizon = new Date(now);
  horizon.setFullYear(horizon.getFullYear() + 1);

  const projected: DividendEvent[] = [];
  let cursor = new Date(dates[dates.length - 1]);
  // Garde-fou : jamais plus de 24 versements projetés (évite une boucle infinie
  // si avgGapDays finissait à ~0 pour une raison quelconque).
  for (let i = 0; i < 24; i++) {
    cursor = new Date(cursor.getTime() + avgGapDays * DAY_MS);
    if (cursor > horizon) break;
    if (cursor.getTime() > now.getTime()) {
      projected.push({ date: cursor.toISOString().slice(0, 10), amount: lastAmount });
    }
  }
  return projected;
}

export async function getDividendInfo(ticker: string): Promise<DividendInfo | null> {
  const cached = cache.get(ticker);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;

  try {
    const now = new Date();
    const period1 = new Date(now);
    period1.setFullYear(period1.getFullYear() - 1);

    const result = await yahooFinance.chart(ticker, { period1, period2: now, events: "div" });
    const currency = result.meta?.currency ?? "USD";

    const received: DividendEvent[] = (result.events?.dividends ?? [])
      .map((d) => ({ date: new Date(d.date).toISOString().slice(0, 10), amount: d.amount }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const projected = projectForward(received, now);

    const info: DividendInfo = { ticker, currency, received, projected };
    cache.set(ticker, { data: info, at: Date.now() });
    return info;
  } catch (err) {
    console.error(`Erreur récupération dividendes pour ${ticker}:`, err);
    return cached ? cached.data : null;
  }
}

export async function getDividendsForTickers(
  tickers: string[]
): Promise<Record<string, DividendInfo | null>> {
  const uniqueTickers = [...new Set(tickers.filter(Boolean))];
  const results = await Promise.all(
    uniqueTickers.map(async (t) => [t, await getDividendInfo(t)] as const)
  );
  return Object.fromEntries(results);
}
