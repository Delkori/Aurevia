// Résolution des logos pour les actifs (actions, ETF, crypto, etc.)
// Utilise les favicons Google pour les entreprises et CoinGecko CDN pour les cryptos
// (Clearbit Logo API, utilisé avant, a été fermé après le rachat par HubSpot).

const TICKER_TO_DOMAIN: Record<string, string> = {
  // US Tech
  AAPL: "apple.com", MSFT: "microsoft.com", GOOG: "google.com", GOOGL: "google.com",
  AMZN: "amazon.com", META: "meta.com", NVDA: "nvidia.com", TSLA: "tesla.com",
  NFLX: "netflix.com", ADBE: "adobe.com", CRM: "salesforce.com", INTC: "intel.com",
  AMD: "amd.com", PYPL: "paypal.com", UBER: "uber.com", ABNB: "airbnb.com",
  COIN: "coinbase.com", SQ: "squareup.com", SHOP: "shopify.com", SNOW: "snowflake.com",
  PLTR: "palantir.com", RBLX: "roblox.com", SPOT: "spotify.com", ZM: "zoom.us",
  // US Finance
  JPM: "jpmorganchase.com", GS: "goldmansachs.com", MS: "morganstanley.com",
  V: "visa.com", MA: "mastercard.com", AXP: "americanexpress.com",
  // US Other
  DIS: "disney.com", KO: "coca-cola.com", PEP: "pepsico.com", MCD: "mcdonalds.com",
  NKE: "nike.com", WMT: "walmart.com", PG: "pg.com", JNJ: "jnj.com",
  XOM: "exxonmobil.com", CVX: "chevron.com",
  // Europe (Euronext)
  "MC.PA": "lvmh.com", "OR.PA": "loreal.com", "SAN.PA": "sanofi.com",
  "AI.PA": "airliquide.com", "BN.PA": "danone.com", "SU.PA": "se.com",
  "DG.PA": "vinci-group.com", "CS.PA": "axa.com", "BNP.PA": "bnpparibas.com",
  "GLE.PA": "societegenerale.com", "CA.PA": "credit-agricole.com",
  "TTE.PA": "totalenergies.com", "RMS.PA": "hermes.com", "KER.PA": "kering.com",
  "CDI.PA": "christian-dior.com", "AIR.PA": "airbus.com", "SAF.PA": "safran-group.com",
  "STM.PA": "st.com", "DSY.PA": "3ds.com", "CAP.PA": "capgemini.com",
  "ORA.PA": "orange.com", "VIV.PA": "vivendi.com", "EN.PA": "bouygues.com",
  "RI.PA": "pernod-ricard.com", "ML.PA": "michelin.com",
  // ETFs
  "CW8.PA": "amundietf.com", "EWLD.PA": "amundietf.com", "LQQ.PA": "amundietf.com",
  "PANX.PA": "amundietf.com", "ESE.PA": "bnpparibas-am.com",
  // Germany
  "SAP.DE": "sap.com", "SIE.DE": "siemens.com", "ALV.DE": "allianz.com",
  "BAS.DE": "basf.com", "BMW.DE": "bmw.com", "MBG.DE": "mercedes-benz.com",
  "VOW3.DE": "volkswagen.com", "ADS.DE": "adidas.com", "DTE.DE": "telekom.com",
  // UK
  "SHEL.L": "shell.com", "AZN.L": "astrazeneca.com", "ULVR.L": "unilever.com",
  "HSBA.L": "hsbc.com", "BP.L": "bp.com", "GSK.L": "gsk.com",
};

const CRYPTO_IMAGES: Record<string, string> = {
  bitcoin: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png",
  ethereum: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  solana: "https://assets.coingecko.com/coins/images/4128/small/solana.png",
  cardano: "https://assets.coingecko.com/coins/images/975/small/cardano.png",
  polkadot: "https://assets.coingecko.com/coins/images/12171/small/polkadot.png",
  avalanche: "https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png",
  chainlink: "https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png",
  polygon: "https://assets.coingecko.com/coins/images/4713/small/polygon.png",
  litecoin: "https://assets.coingecko.com/coins/images/2/small/litecoin.png",
  uniswap: "https://assets.coingecko.com/coins/images/12504/small/uniswap.png",
  ripple: "https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png",
  dogecoin: "https://assets.coingecko.com/coins/images/5/small/dogecoin.png",
  "shiba-inu": "https://assets.coingecko.com/coins/images/11939/small/shiba.png",
  cosmos: "https://assets.coingecko.com/coins/images/1481/small/cosmos_hub.png",
  toncoin: "https://assets.coingecko.com/coins/images/17980/small/ton_symbol.png",
  arbitrum: "https://assets.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg",
  optimism: "https://assets.coingecko.com/coins/images/25244/small/Optimism.png",
  near: "https://assets.coingecko.com/coins/images/10365/small/near.jpg",
  aptos: "https://assets.coingecko.com/coins/images/26455/small/aptos_round.png",
  sui: "https://assets.coingecko.com/coins/images/26375/small/sui_asset.jpeg",
  pepe: "https://assets.coingecko.com/coins/images/29850/small/pepe-token.jpeg",
  "binancecoin": "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png",
};

/**
 * Returns the logo URL for a given asset, or null if unknown.
 */
export function getLogoUrl(type: string, ticker: string | null): string | null {
  if (!ticker) return null;

  if (type === "crypto") {
    const url = CRYPTO_IMAGES[ticker.toLowerCase()];
    return url ? `/api/logo?url=${encodeURIComponent(url)}` : null;
  }

  const domain = TICKER_TO_DOMAIN[ticker] ?? TICKER_TO_DOMAIN[ticker.toUpperCase()];
  if (domain) {
    return `/api/logo?url=${encodeURIComponent(`https://www.google.com/s2/favicons?domain=${domain}&sz=128`)}`;
  }

  return null;
}
