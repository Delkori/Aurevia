// Positions des nœuds dans la galaxie, persistées en localStorage.
// Quand un nœud est glissé, sa position est sauvegardée.
// Le bouton "rangement auto" efface tout et laisse d3-force recalculer.

const KEY = "aurevia:nodePositions";

type PosMap = Record<string, { x: number; y: number }>;

function load(): PosMap {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

function save(map: PosMap) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(map));
}

export function getNodePosition(nodeId: string): { x: number; y: number } | null {
  return load()[nodeId] ?? null;
}

export function setNodePosition(nodeId: string, pos: { x: number; y: number }) {
  const map = load();
  map[nodeId] = pos;
  save(map);
}

export function clearAllPositions() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}
