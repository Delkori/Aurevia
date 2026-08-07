// Positions des étoiles (objectifs) dans la galaxie, en glisser-déposer libre.
// Stocké côté client uniquement : c'est une préférence d'affichage, pas une
// donnée financière, donc pas besoin de toucher au schéma Postgres.

type Pos = { x: number; y: number };

function key(goalId: number) {
  return `aurevia:goalPos:${goalId}`;
}

export function getGoalPosition(goalId: number): Pos | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key(goalId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setGoalPosition(goalId: number, pos: Pos) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key(goalId), JSON.stringify(pos));
}

export function clearGoalPosition(goalId: number) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key(goalId));
}
