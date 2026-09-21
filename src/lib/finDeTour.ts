// Import relatif : module pur, exécuté par `node --test`.
import { barreDeVie, pourcentageDe } from "./barreDeVie.ts";
import type { Score } from "./score.ts";
import type { Situation } from "./eres.ts";

/**
 * La fin d'un tour.
 *
 * Une app de patrimoine n'a aucune raison d'être rouverte : rien n'y bouge
 * sauf les cours. Le pointage du mois est le seul geste qui revient chaque
 * mois — on en fait la fin d'un tour. On pointe, on enregistre, et le jeu
 * fait le bilan : ce qui a bougé, ce qui s'est rempli, ce qui s'est perdu,
 * où en est le score. Chaque ligne est un chiffre que l'app calcule déjà ; la
 * seule nouveauté, c'est de les réunir à un moment qui a un début et une fin.
 */

export type Instantane = { date: string; totalValue: string };

export type BilanTour = {
  /** « septembre 2026 » */
  mois: string;
  pointes: number;
  patrimoine: {
    apres: number;
    /** Patrimoine net au dernier instantané d'avant le mois pointé — `null` s'il n'y en a pas. */
    avant: number | null;
    /** Date de cet instantané, AAAA-MM-JJ. */
    depuis: string | null;
  };
  projets: { id: number; nom: string; avant: number | null; apres: number }[];
  planetes: {
    id: number;
    nom: string;
    pleinsAvant: number | null;
    pleins: number;
    pleine: boolean;
    pourcentage: string;
  }[];
  score: Score | null;
  /** L'ère du foyer, et ce qui le sépare de la suivante. */
  situation: Situation | null;
  /** Découvertes constatées depuis le dernier tour, par leur nom. */
  decouvertes: string[];
  /** Quêtes proposées au tour précédent et qui ne le sont plus : accomplies. */
  quetesAccomplies: string[];
};

const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

export function nomDuMois(mois: Date): string {
  return `${MOIS[mois.getMonth()]} ${mois.getFullYear()}`;
}

/**
 * L'instantané qui sert de point de départ au tour : le dernier d'avant le
 * premier jour du mois pointé. Un instantané pris dans le mois compte les
 * mouvements du mois — il ne dirait plus ce qui a changé *pendant* le tour.
 */
export function instantaneDeReference(instantanes: readonly Instantane[], mois: Date): Instantane | null {
  const debut = `${mois.getFullYear()}-${String(mois.getMonth() + 1).padStart(2, "0")}-01`;
  let ref: Instantane | null = null;
  for (const i of instantanes) {
    if (i.date < debut && (ref === null || i.date > ref.date)) ref = i;
  }
  return ref;
}

export function bilanDuTour(e: {
  mois: Date;
  pointes: number;
  patrimoineNet: number;
  instantanes: readonly Instantane[];
  projets: { id: number; nom: string; progression: number }[];
  planetes: { id: number; nom: string; valeur: number; plafond: number | null }[];
  memoire: { goalProgress?: Record<string, number>; portfolioValues?: Record<string, number> } | null;
  score: Score | null;
  situation?: Situation | null;
  decouvertes?: string[];
  quetesAccomplies?: string[];
}): BilanTour {
  const ref = instantaneDeReference(e.instantanes, e.mois);
  return {
    mois: nomDuMois(e.mois),
    pointes: e.pointes,
    patrimoine: {
      apres: e.patrimoineNet,
      avant: ref ? Number(ref.totalValue) : null,
      depuis: ref?.date ?? null,
    },
    projets: e.projets.map((p) => ({
      id: p.id, nom: p.nom, apres: p.progression,
      avant: e.memoire?.goalProgress?.[String(p.id)] ?? null,
    })),
    // Seules les planètes plafonnées ont une barre, donc une ligne ici.
    planetes: e.planetes.flatMap((p) => {
      const barre = barreDeVie({ valeur: p.valeur, plafond: p.plafond });
      if (!barre) return [];
      const precedente = e.memoire?.portfolioValues?.[String(p.id)];
      const avant = precedente != null ? barreDeVie({ valeur: precedente, plafond: p.plafond }) : null;
      return [{
        id: p.id, nom: p.nom, pleins: barre.pleins, pleine: barre.pleine,
        pleinsAvant: avant ? avant.pleins : null, pourcentage: pourcentageDe(barre),
      }];
    }),
    score: e.score,
    situation: e.situation ?? null,
    decouvertes: e.decouvertes ?? [],
    quetesAccomplies: e.quetesAccomplies ?? [],
  };
}
