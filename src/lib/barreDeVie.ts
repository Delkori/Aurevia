/**
 * La barre de vie d'une planète.
 *
 * Dix segments au-dessus de la sphère : valeur actuelle rapportée au plafond
 * que la personne s'est fixé pour cette planète. Le plafond est le sien —
 * jamais deviné par l'app — et sans plafond il n'y a pas de barre : on ne
 * mesure pas la progression vers un chiffre que personne n'a voulu.
 *
 * C'est une barre de *vie*, pas un compteur : quand les cours reculent, elle
 * recule aussi, et le segment perdu clignote une fois. Le segment hachuré est
 * celui que le versement du mois va remplir — on voit ce qu'on est en train de
 * gagner avant de l'avoir gagné.
 *
 * Module pur, exécuté par `node --test` : pas d'alias `@/`.
 */

export const SEGMENTS = 10;

export type Segment = "plein" | "a-venir" | "perdu" | "vide";

export type BarreDeVie = {
  segments: Segment[];
  /** Segments réellement acquis. */
  pleins: number;
  /** Progression brute, de 0 à 1 — non plafonnée à l'affichage du pourcentage. */
  part: number;
  /** Le plafond est atteint : la planète est une merveille. */
  pleine: boolean;
};

/** Nombre de segments que couvre une valeur, sans jamais dépasser la barre. */
function segmentsDe(valeur: number, plafond: number): number {
  if (!(valeur > 0)) return 0;
  // L'epsilon absorbe le flottant : 0,7 × 10 vaut 6,999… et non 7.
  return Math.min(SEGMENTS, Math.floor((valeur / plafond) * SEGMENTS + 1e-9));
}

export function barreDeVie({
  valeur,
  plafond,
  versementMensuel = 0,
  valeurPrecedente,
}: {
  valeur: number;
  plafond: number | null | undefined;
  /** Ce qui arrive sur la planète chaque mois : dessine le segment à venir. */
  versementMensuel?: number;
  /** Valeur à la dernière visite : dessine les segments perdus depuis. */
  valeurPrecedente?: number | null;
}): BarreDeVie | null {
  if (plafond == null || !(plafond > 0) || !Number.isFinite(plafond)) return null;

  const pleins = segmentsDe(valeur, plafond);
  const aVenir = segmentsDe(valeur + Math.max(0, versementMensuel), plafond);
  const avant = valeurPrecedente != null && Number.isFinite(valeurPrecedente)
    ? segmentsDe(valeurPrecedente, plafond)
    : pleins;

  const segments: Segment[] = [];
  for (let i = 0; i < SEGMENTS; i++) {
    if (i < pleins) segments.push("plein");
    // Un segment perdu qu'un versement va reprendre reste « perdu » : c'est
    // la perte qu'on veut voir, pas le versement qui la masque.
    else if (i < avant) segments.push("perdu");
    else if (i < aVenir) segments.push("a-venir");
    else segments.push("vide");
  }

  return { segments, pleins, part: valeur / plafond, pleine: valeur >= plafond };
}

/**
 * « 62 % » — le pourcentage qu'on écrit à côté de la barre.
 *
 * Arrondi vers le bas, comme les segments : à 69,99 % on n'a que six segments
 * pleins, et « 70 % » à côté ferait croire à un septième qui manque.
 */
export function pourcentageDe(barre: BarreDeVie): string {
  return `${Math.floor(Math.min(barre.part, 9.99) * 100 + 1e-9)} %`;
}
