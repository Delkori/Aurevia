/**
 * Quelle image porte une planète.
 *
 * Le catalogue était enfermé dans `GalaxyView`, seule à dessiner des planètes.
 * La vue d'ensemble en dessine aussi : sans habillage, ses corps n'étaient que
 * des ronds dégradés à côté de planètes texturées.
 *
 * Deux façons de choisir : par le nom (« PEA », « Crypto »…), ou par ce que
 * contient la planète. Certains habillages ont trois paliers qui suivent le
 * montant — même cadrage, même angle, seule la densité change.
 */

export type PlanetSkin = "tech" | "crypto" | "terrain" | "ocean" | "chalet" | "vacances" | "generic" | "empty";
const SKIN_IMAGE_TIERS: Partial<Record<PlanetSkin, string[]>> = {
  tech: ["/planet-skins/tech-1.webp", "/planet-skins/tech-2.webp", "/planet-skins/tech-3.webp"],
  terrain: ["/planet-skins/terrain-1.webp", "/planet-skins/terrain-2.webp", "/planet-skins/terrain-3.webp"],
  ocean: ["/planet-skins/ocean.webp"],
  crypto: ["/planet-skins/crypto.webp"],
  chalet: ["/planet-skins/chalet.webp"],
  vacances: ["/planet-skins/vacances.webp"],
};
function tierIndex(value: number, max: number, tiers: number) {
  if (max <= 0) return 0;
  const p = Math.max(0, Math.min(1, value / max));
  return Math.min(tiers - 1, Math.floor(p * tiers));
}
export function skinImageForValue(skin: PlanetSkin, value: number, max: number): string | undefined {
  const tiers = SKIN_IMAGE_TIERS[skin];
  if (!tiers || tiers.length === 0) return undefined;
  return tiers[tierIndex(value, max, tiers.length)];
}
const SALARY_IMAGES = ["/planet-skins/salary-1.webp", "/planet-skins/salary-2.webp", "/planet-skins/salary-3.webp"];
const SALARY_TIER_THRESHOLDS = [2500, 6000];
export function salaryImage(amount: number) {
  const idx = amount < SALARY_TIER_THRESHOLDS[0] ? 0 : amount < SALARY_TIER_THRESHOLDS[1] ? 1 : 2;
  return SALARY_IMAGES[idx];
}
export const VACANCES_IMAGE = "/planet-skins/vacances.webp";
export const EXPENSES_IMAGES = {
  warning: "/planet-skins/expenses-warning.webp",
  eruption: "/planet-skins/expenses-eruption.webp",
  critical: "/planet-skins/expenses-critical.webp",
};
export function isVacationGoal(name: string) {
  const n = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return /vacance|voyage|plage|maldives|croisiere/.test(n);
}
const SKIN_BY_TYPE: Record<string, PlanetSkin> = {
  stock: "tech", etf: "tech",
  crypto: "crypto",
  precious_metal: "terrain", real_estate: "terrain", scpi: "terrain",
  cash: "ocean", life_insurance: "ocean",
  private_equity: "generic", art: "generic", other: "generic",
};
export function dominantAssetSkin(valued: { asset: { type: string }; value: number }[]): PlanetSkin {
  if (valued.length === 0) return "empty";
  const byType = new Map<string, number>();
  for (const v of valued) byType.set(v.asset.type, (byType.get(v.asset.type) ?? 0) + Math.max(0, v.value));
  let best: string | null = null, bestVal = -1;
  byType.forEach((val, type) => { if (val > bestVal) { bestVal = val; best = type; } });
  return best ? (SKIN_BY_TYPE[best] ?? "generic") : "generic";
}

const NAME_SKIN_KEYWORDS: [RegExp, PlanetSkin][] = [
  [/\bcto\b/, "tech"],
  [/\bpea\b/, "ocean"],
  [/crypto|bitcoin|btc|eth/, "crypto"],
  [/immobilier|scpi|pierre|foncier|appartement|maison|residence|studio|locatif/, "terrain"],
  [/assurance.?vie|livret|epargne|cash/, "ocean"],
  [/or\b|metal|argent(?!\s)/, "terrain"],
];
function normalizeName(name: string) {
  return name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}
export function skinFromName(name: string): PlanetSkin | null {
  const n = normalizeName(name);
  for (const [re, skin] of NAME_SKIN_KEYWORDS) if (re.test(n)) return skin;
  return null;
}
const EXPLICIT_SKINS = new Set<PlanetSkin>(["tech", "ocean", "terrain", "crypto", "chalet", "vacances", "generic"]);
export function planetSkin(name: string, valued: { asset: { type: string }; value: number }[], explicitSkin?: string | null): PlanetSkin {
  if (explicitSkin && EXPLICIT_SKINS.has(explicitSkin as PlanetSkin)) return explicitSkin as PlanetSkin;
  return skinFromName(name) ?? dominantAssetSkin(valued);
}


// ── Habillage des corps de la vue d'ensemble ─────────────────────────────────

export type PalierDepenses = "calm" | "warning" | "eruption" | "critical";

/**
 * L'état d'une planète de dépenses : ce qu'elles pèsent dans les revenus.
 *
 * Paliers resserrés pour que le stade visuel bouge avant le déficit, pas
 * seulement après. Sans revenu connu, on ne prétend pas au déficit : le
 * rapport est inconnu, pas infini.
 */
export function palierDepenses(depenses: number, revenus: number): PalierDepenses {
  if (depenses <= 0) return "calm";
  const part = revenus > 0 ? depenses / revenus : 0;
  return part > 1 ? "critical" : part > 0.6 ? "eruption" : "warning";
}

/**
 * L'image d'un corps de la vue d'ensemble.
 *
 * Les trois systèmes n'ont pas d'illustration propre — elles restent à
 * produire. En attendant, chacun emprunte un visage qui dit quelque chose de
 * vrai : les revenus prennent la campagne dorée du salaire, les dépenses leur
 * planète volcanique, et un patrimoine comme un projet prennent le visage du
 * plus gros de ce qu'ils contiennent. Un projet de voyage passe avant : c'est
 * son intitulé qui le décrit, pas ce qui le finance.
 */
export type GenreSysteme = "revenus" | "depenses" | "investissements" | "projet";

export function imageSysteme(corps: {
  genre: GenreSysteme;
  label: string;
  montant: number;
  /** Revenus du foyer — n'a de sens que pour les dépenses. */
  revenus?: number;
  /** Noms de ce qu'il contient, du plus gros au plus petit. */
  contenus?: string[];
  /** Plus gros montant de la même famille, pour situer le palier. */
  max: number;
}): string | undefined {
  if (corps.genre === "revenus") return salaryImage(corps.montant);

  if (corps.genre === "depenses") {
    const palier = palierDepenses(corps.montant, corps.revenus ?? 0);
    return palier === "calm" ? undefined : EXPENSES_IMAGES[palier];
  }

  if (corps.genre === "projet" && isVacationGoal(corps.label)) return VACANCES_IMAGE;

  // Patrimoine, et projet sans thème : le visage de ce qu'il contient. On
  // descend la liste jusqu'à un nom qui dise quelque chose — s'arrêter au plus
  // gros laissait sans habillage le plus gros corps de la vue dès que sa
  // première planète s'appelait « Appartement Lyon ».
  for (const nom of corps.contenus ?? []) {
    const skin = skinFromName(nom);
    if (skin) return skinImageForValue(skin, Math.abs(corps.montant), corps.max);
  }
  return undefined;
}

// ── Les vaisseaux qui parcourent les flux ────────────────────────────────────

export type PalierVaisseau = "small" | "medium" | "large";

export const SHIP_IMAGES: Record<PalierVaisseau, string> = {
  small: "/ship-skins/transport-small.webp",
  medium: "/ship-skins/transport-medium.webp",
  large: "/ship-skins/transport-large.webp",
};
export const SHIP_DIMS: Record<PalierVaisseau, { w: number; h: number }> = {
  small: { w: 16, h: 10 },
  medium: { w: 22, h: 15.6 },
  large: { w: 30, h: 21.5 },
};

/** La taille du vaisseau dit le poids du versement, rapporté au plus gros. */
export function palierVaisseau(part: number): PalierVaisseau {
  return part < 0.08 ? "small" : part < 0.25 ? "medium" : "large";
}

/**
 * L'image d'un satellite de la vue d'ensemble.
 *
 * Un satellite emprunte la famille de son système : une ligne de dépense est
 * un caillou volcanique comme sa planète, une source de revenu un bout de la
 * même campagne. Ailleurs, c'est le nom qui décide — et un nom qui n'évoque
 * rien reste une pastille unie plutôt qu'une vignette prise au hasard.
 *
 * Pas de palier pour les planètes : à une douzaine de pixels la densité ne se
 * voit pas, et l'image la plus fournie est celle qui garde le plus de couleur
 * une fois réduite. Une dépense prend le palier le plus calme : une ligne
 * seule ne fait pas un déficit, c'est leur somme qui le dit.
 */
export function imageSatellite(satellite: { nom: string; montant: number }, genre: GenreSysteme): string | undefined {
  if (genre === "revenus") return salaryImage(satellite.montant);
  if (genre === "depenses") return EXPENSES_IMAGES.warning;
  const skin = skinFromName(satellite.nom);
  return skin ? skinImageForValue(skin, 1, 1) : undefined;
}
