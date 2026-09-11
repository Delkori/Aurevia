/**
 * Patrimoine d'exemple.
 *
 * Une app visuelle qui s'ouvre sur un écran vide est la pire première
 * impression possible : la galaxie n'est belle qu'avec des données, et c'est
 * exactement ce que le nouvel arrivant n'a pas. Ce jeu de données donne une
 * galaxie complète en un clic — et sert aussi de support à la version de
 * démonstration.
 *
 * Les tickers sont réels, pour que les cours en direct fonctionnent et que la
 * démonstration montre le produit et pas une maquette. Les montants sont
 * inventés et volontairement ronds.
 */

export type DemoAsset = {
  key: string;
  name: string;
  type: string;
  ticker?: string;
  quantity?: string;
  avgBuyPrice?: string;
  manualValue?: string;
  yieldRate?: string;
  currency?: string;
  portfolio: string;
};

export const DEMO_MEMBERS = [
  { key: "camille", name: "Camille", role: "spouse", color: "#34d399", salary: "2450", accessory: "star" },
  { key: "jonas", name: "Jonas", role: "child", color: "#60a5fa", salary: null, accessory: "rocket" },
] as const;

export const DEMO_PORTFOLIOS = [
  { key: "pea", name: "PEA", color: "#7c6af5", skin: "ocean", member: null },
  { key: "cto", name: "CTO", color: "#60a5fa", skin: "tech", member: null },
  { key: "crypto", name: "Crypto", color: "#fb923c", skin: "crypto", member: null },
  { key: "appart", name: "Appartement Lyon", color: "#4ade80", skin: "terrain", member: null },
  { key: "av", name: "Assurance-vie", color: "#f0abfc", skin: "ocean", member: "camille" },
  { key: "livret", name: "Livret A de Jonas", color: "#fbbf24", skin: "ocean", member: "jonas" },
] as const;

export const DEMO_ASSETS: DemoAsset[] = [
  // PEA — ETF et grandes capitalisations européennes
  { key: "cw8", name: "Amundi MSCI World", type: "etf", ticker: "CW8.PA", quantity: "42", avgBuyPrice: "398.50", currency: "EUR", portfolio: "pea" },
  { key: "mc", name: "LVMH", type: "stock", ticker: "MC.PA", quantity: "12", avgBuyPrice: "641.00", currency: "EUR", portfolio: "pea" },
  { key: "air", name: "Airbus", type: "stock", ticker: "AIR.PA", quantity: "30", avgBuyPrice: "128.90", currency: "EUR", portfolio: "pea" },
  { key: "tte", name: "TotalEnergies", type: "stock", ticker: "TTE.PA", quantity: "55", avgBuyPrice: "58.20", currency: "EUR", portfolio: "pea" },

  // CTO — valeurs américaines, cotées en dollars : elles exercent la conversion
  { key: "aapl", name: "Apple", type: "stock", ticker: "AAPL", quantity: "25", avgBuyPrice: "172.40", currency: "USD", portfolio: "cto" },
  { key: "msft", name: "Microsoft", type: "stock", ticker: "MSFT", quantity: "14", avgBuyPrice: "358.10", currency: "USD", portfolio: "cto" },
  { key: "nvda", name: "NVIDIA", type: "stock", ticker: "NVDA", quantity: "18", avgBuyPrice: "112.75", currency: "USD", portfolio: "cto" },

  // Crypto — identifiants CoinGecko, pas des tickers boursiers
  { key: "btc", name: "Bitcoin", type: "crypto", ticker: "bitcoin", quantity: "0.35", avgBuyPrice: "48200", currency: "EUR", portfolio: "crypto" },
  { key: "eth", name: "Ethereum", type: "crypto", ticker: "ethereum", quantity: "4.2", avgBuyPrice: "2310", currency: "EUR", portfolio: "crypto" },

  // Immobilier et épargne — saisie manuelle, ce que l'agrégation ne voit pas
  { key: "t3", name: "T3 Croix-Rousse", type: "real_estate", manualValue: "312000", currency: "EUR", portfolio: "appart" },
  { key: "scpi", name: "SCPI Épargne Pierre", type: "scpi", manualValue: "28000", yieldRate: "5.2", currency: "EUR", portfolio: "appart" },
  { key: "fondseuro", name: "Fonds euros", type: "life_insurance", manualValue: "46500", currency: "EUR", portfolio: "av" },
  { key: "uc", name: "Unités de compte", type: "life_insurance", manualValue: "19800", currency: "EUR", portfolio: "av" },
  { key: "livreta", name: "Livret A", type: "cash", manualValue: "4300", currency: "EUR", portfolio: "livret" },
  { key: "or", name: "Or physique", type: "precious_metal", ticker: "GC=F", quantity: "3", avgBuyPrice: "2180", currency: "USD", portfolio: "crypto" },
];

export const DEMO_LOANS = [
  {
    key: "credit",
    name: "Crédit immobilier",
    asset: "t3",
    principal: "240000",
    remainingBalance: "187400",
    interestRate: "1.85",
    monthlyPayment: "980",
    currency: "EUR",
  },
] as const;

export const DEMO_GOALS = [
  { key: "apport", name: "Apport résidence principale", targetAmount: "120000", color: "#7c6af5", member: null, portfolios: ["pea", "av"] },
  { key: "etudes", name: "Études de Jonas", targetAmount: "40000", color: "#fbbf24", member: "jonas", portfolios: ["livret"] },
  { key: "vacances", name: "Vacances au Japon", targetAmount: "8000", color: "#f0abfc", member: null, portfolios: ["crypto"] },
] as const;

/** `source` : "salary" (revenu principal) ou "member:<clé>" pour le salaire d'un membre. */
export const DEMO_FLOWS = [
  { name: null, source: "salary", target: "portfolio:pea", amount: "600", frequency: "monthly", member: null },
  { name: null, source: "salary", target: "portfolio:cto", amount: "250", frequency: "monthly", member: null },
  { name: null, source: "member:camille", target: "portfolio:av", amount: "300", frequency: "monthly", member: null },
  { name: null, source: "salary", target: "portfolio:crypto", amount: "100", frequency: "monthly", member: null },
  { name: null, source: "salary", target: "portfolio:livret", amount: "50", frequency: "monthly", member: null },
  { name: "Loyer", source: "salary", target: "expense", amount: "1150", frequency: "monthly", member: null },
  { name: "Courses", source: "salary", target: "expense", amount: "620", frequency: "monthly", member: null },
  { name: "Énergie & télécom", source: "salary", target: "expense", amount: "210", frequency: "monthly", member: null },
  { name: "Transports", source: "salary", target: "expense", amount: "140", frequency: "monthly", member: null },
  { name: "Crèche", source: "salary", target: "expense", amount: "380", frequency: "monthly", member: "camille" },
  { name: "Loyer SCPI", source: "salary", target: "income", amount: "120", frequency: "monthly", member: null },
] as const;

/**
 * Quotes-parts : l'appartement est détenu à moitié par chacun. C'est le cas
 * d'usage que les agrégateurs ne couvrent pas, donc celui que la démonstration
 * doit montrer.
 */
export const DEMO_OWNERSHIPS = [
  { portfolio: "appart", member: null, sharePercent: "50" },
  { portfolio: "appart", member: "camille", sharePercent: "50" },
] as const;

export const DEMO_SETTINGS: Record<string, string> = {
  monthly_salary: "3200",
  owner_name: "Alex",
  center_color: "#ffcc55",
  display_currency: "EUR",
  show_payment_countdown: "true",
};
