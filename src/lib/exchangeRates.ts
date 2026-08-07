// Taux de change via l'API publique ECB (Banque Centrale Européenne).
// Gratuit, sans clé, mis à jour chaque jour ouvré. Cache 24h.

type Rates = Record<string, number>;

let cachedRates: Rates | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

const ECB_URL =
  "https://data-api.ecb.europa.eu/service/data/EXR/D..EUR.SP00.A?lastNObservations=1&format=csvdata";

async function fetchEcbRates(): Promise<Rates> {
  const rates: Rates = { EUR: 1 };

  try {
    const res = await fetch(ECB_URL, {
      headers: { Accept: "text/csv" },
      signal: AbortSignal.timeout(8000),
    });
    const text = await res.text();
    const lines = text.split("\n").slice(1); // skip header
    for (const line of lines) {
      const cols = line.split(",");
      // CSV format: KEY,FREQ,CURRENCY,CURRENCY_DENOM,...,OBS_VALUE,...
      const currency = cols[2];
      const value = parseFloat(cols[cols.length - 2] || "");
      if (currency && !isNaN(value) && value > 0) {
        rates[currency] = value;
      }
    }
  } catch (err) {
    console.error("ECB rates fetch failed:", err);
  }

  // Fallback minimaux si l'API ne répond pas
  if (!rates.USD) rates.USD = 1.08;
  if (!rates.GBP) rates.GBP = 0.86;
  if (!rates.CHF) rates.CHF = 0.97;

  return rates;
}

export async function getExchangeRates(): Promise<Rates> {
  if (cachedRates && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedRates;
  }
  cachedRates = await fetchEcbRates();
  cacheTimestamp = Date.now();
  return cachedRates;
}

/**
 * Convertit un montant d'une devise vers une autre.
 * Les taux sont exprimés en "1 EUR = X devises" (convention ECB).
 */
export function convert(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Rates
): number {
  if (fromCurrency === toCurrency) return amount;
  const fromRate = rates[fromCurrency] ?? 1;
  const toRate = rates[toCurrency] ?? 1;
  // amount en FROM → EUR → TO
  return (amount / fromRate) * toRate;
}
