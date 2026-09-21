// Import relatif : module pur, exécuté par `node --test`.
import type { BilanTour } from "./finDeTour.ts";

/**
 * Le journal des tours.
 *
 * Un tour fini s'évaporait dès « Tour suivant » : le bilan n'existait que le
 * temps de l'écran, et la mémoire des découvertes vivait dans le navigateur —
 * téléphone et ordinateur ne racontaient pas la même partie. Chaque tour
 * s'écrit désormais, un par mois : patrimoine, score, ère, découvertes,
 * quêtes proposées. C'est l'historique de la partie — et c'est là qu'on
 * lit ce qu'un tour a accompli par rapport au précédent.
 */

export type QueteDuTour = { id: string; titre: string };

export type Tour = {
  /** Premier jour du mois pointé, AAAA-MM-JJ. */
  mois: string;
  pointes: number;
  patrimoineNet: number;
  score: number | null;
  ere: number;
  /** Identifiants des découvertes constatées à ce tour. */
  decouvertes: string[];
  /** Les quêtes qui étaient proposées à la fin de ce tour. */
  quetes: QueteDuTour[];
};

export const cleMois = (mois: Date): string =>
  `${mois.getFullYear()}-${String(mois.getMonth() + 1).padStart(2, "0")}-01`;

export function tourDepuisBilan(
  bilan: BilanTour,
  mois: Date,
  decouvertesIds: readonly string[],
  quetes: readonly QueteDuTour[]
): Tour {
  return {
    mois: cleMois(mois),
    pointes: bilan.pointes,
    patrimoineNet: bilan.patrimoine.apres,
    score: bilan.score?.total ?? null,
    ere: bilan.situation?.ere.numero ?? 1,
    decouvertes: [...decouvertesIds],
    quetes: quetes.map((q) => ({ id: q.id, titre: q.titre })),
  };
}

/** Le tour le plus récent, ou `null`. L'ordre du tableau ne compte pas. */
export function dernierTour(tours: readonly Tour[]): Tour | null {
  let d: Tour | null = null;
  for (const t of tours) if (d === null || t.mois > d.mois) d = t;
  return d;
}

/**
 * Les quêtes accomplies depuis le dernier tour : celles qu'on proposait et
 * qui ne sont plus à proposer. Une quête disparaît quand sa condition est
 * remplie — pointer le mois, plafonner la planète, finir le projet — c'est
 * donc bien un accomplissement, pas un oubli.
 */
export function quetesAccomplies(precedent: Tour | null, quetesCourantes: readonly string[]): string[] {
  if (!precedent) return [];
  const courantes = new Set(quetesCourantes);
  return precedent.quetes.filter((q) => !courantes.has(q.id)).map((q) => q.titre);
}

/** Tout ce qui a déjà été fêté, sur l'ensemble des tours. */
export function decouvertesDejaFetees(tours: readonly Tour[]): Set<string> {
  return new Set(tours.flatMap((t) => t.decouvertes));
}
