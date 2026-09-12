/**
 * Positions des nœuds de la galaxie, persistées en localStorage.
 *
 * Deux règles qui ne vont pas de soi :
 *
 * · **Une position appartient à une disposition.** Un nœud glissé en orbite a
 *   des coordonnées qui n'ont aucun sens en lecture par colonnes — et comme une
 *   position enregistrée désactive l'aimant de la mise en page, elle épinglait
 *   la planète n'importe où au lieu de la laisser rejoindre sa colonne. Chaque
 *   disposition garde donc son propre rangement.
 *
 * · **La lecture est en mémoire.** Ces accesseurs sont appelés par les forces
 *   d3, soit deux fois par nœud et par image. Relire et reparser localStorage à
 *   chaque appel faisait quelques milliers de `JSON.parse` par seconde.
 */

const KEY = "aurevia:nodePositions";

export type Point = { x: number; y: number };
type PosMap = Record<string, Point>;
type Store = Record<string, PosMap>;

let cache: Store | null = null;

function estPoint(v: unknown): v is Point {
  return typeof v === "object" && v !== null
    && typeof (v as Point).x === "number" && typeof (v as Point).y === "number";
}

function load(): Store {
  if (cache) return cache;
  if (typeof window === "undefined") return {};
  let brut: unknown = {};
  try {
    brut = JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    brut = {};
  }
  const store: Store = {};
  if (typeof brut === "object" && brut !== null) {
    for (const [cle, valeur] of Object.entries(brut as Record<string, unknown>)) {
      // Ancien format : une carte plate d'identifiants. Elle date d'avant les
      // dispositions en colonnes, donc elle décrit forcément l'orbite.
      if (estPoint(valeur)) {
        (store.radial ??= {})[cle] = valeur;
      } else if (typeof valeur === "object" && valeur !== null) {
        const mode: PosMap = {};
        for (const [id, p] of Object.entries(valeur as Record<string, unknown>)) {
          if (estPoint(p)) mode[id] = p;
        }
        store[cle] = mode;
      }
    }
  }
  cache = store;
  return store;
}

function save(store: Store) {
  cache = store;
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // Quota plein ou stockage refusé : le rangement ne survivra pas au
    // rechargement, mais la galaxie reste utilisable. Rien à signaler.
  }
}

export function getNodePosition(mode: string, nodeId: string): Point | null {
  return load()[mode]?.[nodeId] ?? null;
}

export function setNodePosition(mode: string, nodeId: string, pos: Point) {
  const store = load();
  save({ ...store, [mode]: { ...(store[mode] ?? {}), [nodeId]: pos } });
}

/** « Rangement auto » : on ne défait que la disposition affichée. */
export function clearAllPositions(mode: string) {
  const store = load();
  if (!store[mode]) return;
  const suivant = { ...store };
  delete suivant[mode];
  save(suivant);
}
