/**
 * Disposition des nœuds de la galaxie.
 *
 * Trois lectures possibles du même patrimoine :
 *
 *  · `radial` — le système solaire d'origine : Patrimoine au centre, les
 *    personnes en orbite, leurs planètes en éventail. Joli, mais il ne dit rien
 *    du *sens* dans lequel l'argent circule.
 *
 *  · `horizontal` / `vertical` — une lecture en colonnes (ou en rangées) où
 *    l'argent va toujours dans le même sens : les revenus à la source, les
 *    personnes qu'ils alimentent, puis les planètes vers lesquelles tout part.
 *    C'est la disposition à choisir pour expliquer un patrimoine à quelqu'un.
 *
 * Le module ne connaît ni React ni d3 : il prend des nœuds, rend des positions
 * cibles. La simulation s'en sert comme d'un aimant, ce qui laisse le
 * glisser-déposer reprendre la main à tout moment.
 */

export type LayoutMode = "radial" | "horizontal" | "vertical";

/**
 * `icone` nomme le pictogramme, il ne l'importe pas : ce module ne connaît ni
 * React ni la bibliothèque d'icônes, et n'a pas à commencer maintenant.
 */
export const LAYOUT_MODES: { mode: LayoutMode; label: string; hint: string; icone: "fleche-droite" | "fleche-bas" | "orbite" }[] = [
  { mode: "horizontal", label: "De gauche à droite", hint: "Revenus → personnes → planètes", icone: "fleche-droite" },
  { mode: "vertical", label: "De haut en bas", hint: "Revenus en haut, planètes en bas", icone: "fleche-bas" },
  { mode: "radial", label: "En orbite", hint: "Patrimoine au centre, tout autour", icone: "orbite" },
];

export type LayoutNode = {
  id: string;
  kind: string;
  r: number;
  /** Poids d'ordonnancement dans sa rangée : les plus gros au milieu. */
  weight?: number;
  /**
   * Rang imposé dans la rangée, avant le poids. L'appelant s'en sert pour
   * mettre chaque destination en face de son propriétaire : trié par la seule
   * taille, l'anneau des planètes ne suivait pas celui des personnes et les
   * fils de propriété traversaient la vue en tous sens.
   */
  ordre?: number;
};

export type Point = { x: number; y: number };

/**
 * Rangée d'un nœud dans la lecture « flux ».
 *
 *   0 — ce qui produit l'argent
 *   1 — le foyer : le total et les personnes
 *   2 — ce vers quoi l'argent part, planètes de dépenses comprises
 *
 * Les satellites (actifs, lignes de dépense ou de revenu) ne sont pas rangés
 * ici : ils orbitent autour de leur parent, c'est la simulation qui les place.
 */
export function layerOf(kind: string): number | null {
  switch (kind) {
    case "salary":
    case "member-salary":
      return 0;
    case "center":
    case "member":
      return 1;
    // Une dépense est une destination comme une autre : l'argent y part. Rangée
    // avec le foyer, elle partageait sa colonne — et dans le système
    // « Dépenses », où il n'y a ni planète ni objectif, il ne restait que deux
    // colonnes : les personnes et leurs dépenses se retrouvaient empilées au
    // même endroit, anneaux de satellites confondus.
    case "expenses":
    case "reste":
    case "portfolio":
    case "goal":
      return 2;
    default:
      return null;
  }
}

/** Ordre à l'intérieur d'une rangée, pour que la lecture reste stable. */
function rankOf(node: LayoutNode): number {
  switch (node.kind) {
    case "center": return 0;
    case "member": return 1;
    case "salary": return 0;
    case "member-salary": return 1;
    case "reste": return 8;
    case "expenses": return 9;
    case "portfolio": return 0;
    case "goal": return 1;
    default: return 5;
  }
}

/**
 * Répartit une rangée le long de l'axe transverse, proportionnellement à la
 * taille de chaque nœud : une grosse planète reçoit plus de place qu'une
 * petite, au lieu d'un pas régulier qui laisse les unes à l'étroit et les
 * autres au large.
 */
function spread(nodes: LayoutNode[], extent: number, gap: number): number[] {
  if (nodes.length === 0) return [];
  if (nodes.length === 1) return [extent / 2];

  const tailles = nodes.map((n) => n.r * 2);
  const cumul = tailles.reduce((a, b) => a + b, 0);

  // Rangée si chargée que même bord à bord elle déborde : on répartit alors
  // régulièrement sur toute la hauteur et on laisse la force de collision
  // démêler le reste. Mieux vaut un chevauchement que des planètes hors cadre.
  if (cumul > extent) {
    return nodes.map((_, i) => ((i + 0.5) / nodes.length) * extent);
  }

  // Sinon on resserre l'écart juste ce qu'il faut pour tenir.
  const besoin = cumul + gap * (nodes.length - 1);
  const gapReel = besoin > extent ? (extent - cumul) / (nodes.length - 1) : gap;

  const total = cumul + gapReel * (nodes.length - 1);
  let curseur = Math.max(0, (extent - total) / 2);
  return nodes.map((n, i) => {
    const centre = curseur + n.r;
    curseur += tailles[i] + gapReel;
    return centre;
  });
}

/** Écart maximal entre deux rangées, sur l'axe où l'argent progresse. */
const PAS_MAX = 430;

export type LayoutOptions = {
  width: number;
  height: number;
  /** Marge intérieure, pour que rien ne colle au bord. */
  padding?: number;
};

/**
 * Positions cibles en lecture « flux ». `horizontal` range les rangées en
 * colonnes de gauche à droite ; `vertical` les empile de haut en bas.
 */
export function flowLayout(
  nodes: LayoutNode[],
  mode: "horizontal" | "vertical",
  { width, height, padding = 70 }: LayoutOptions
): Map<string, Point> {
  const out = new Map<string, Point>();

  const parRangee = new Map<number, LayoutNode[]>();
  for (const n of nodes) {
    const l = layerOf(n.kind);
    if (l === null) continue;
    if (!parRangee.has(l)) parRangee.set(l, []);
    parRangee.get(l)!.push(n);
  }
  if (parRangee.size === 0) return out;

  const rangees = [...parRangee.keys()].sort((a, b) => a - b);
  const horizontal = mode === "horizontal";

  // Axe principal : celui dans lequel l'argent progresse.
  const longueur = horizontal ? width : height;
  const traverse = horizontal ? height : width;
  // Le pas est plafonné, et le bloc centré. Sans plafond, deux rangées se
  // retrouvaient collées aux deux bords opposés avec tout le vide au milieu :
  // un système qui n'a pas de troisième rangée n'a pas à être étiré.
  const pas = Math.min(PAS_MAX, (longueur - padding * 2) / Math.max(1, rangees.length - 1));
  const debut = (longueur - pas * (rangees.length - 1)) / 2;

  for (const [i, rangee] of rangees.entries()) {
    const cle = (n: LayoutNode) => n.ordre ?? rankOf(n);
    const membres = [...parRangee.get(rangee)!].sort(
      (a, b) => cle(a) - cle(b) || (b.weight ?? 0) - (a.weight ?? 0) || a.id.localeCompare(b.id)
    );
    const principal = rangees.length === 1 ? longueur / 2 : debut + i * pas;
    const positions = spread(membres, traverse - padding * 2, 46);

    membres.forEach((n, j) => {
      const t = padding + positions[j];
      out.set(n.id, horizontal ? { x: principal, y: t } : { x: t, y: principal });
    });
  }

  return out;
}
