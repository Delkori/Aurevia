/**
 * Les quêtes : le « voilà ce que tu pourrais faire » du jeu.
 *
 * Trois à la fois, toujours d'un de ces trois types — une échéance à tenir,
 * un geste d'organisation, ou l'arithmétique d'un plan que la personne a
 * elle-même déclaré. Jamais « ouvre un PEA », jamais « achète de l'or » :
 * une quête ne recommande aucun placement. Diviser ce qui manque par ce
 * qu'on verse déjà n'est pas un conseil, c'est une division.
 *
 * Module pur, exécuté par `node --test` : pas d'alias `@/`.
 */

export type ActionQuete =
  | { type: "pointer" }
  | { type: "planete"; id: number }
  | { type: "projet"; id: number };

export type Quete = {
  id: string;
  type: "echeance" | "organisation" | "plan";
  titre: string;
  detail: string;
  /** Ce que ça change dans le jeu — pas une récompense inventée, une conséquence. */
  gain: string;
  action: ActionQuete | null;
};

export type EntreesQuetes = {
  /** Échéances en retard, et le nom du mois à pointer. */
  enRetard: number;
  mois: string;
  planetes: { id: number; nom: string; valeur: number; plafond: number | null }[];
  projets: { id: number; nom: string; acquis: number; cible: number; apportMensuel: number }[];
  depensesDeclarees: boolean;
  versementProgramme: boolean;
};

export const MAX_QUETES = 3;

export function quetesDuFoyer(e: EntreesQuetes, fmt: (v: number) => string): Quete[] {
  const quetes: Quete[] = [];

  // 1. L'échéance : le tour ne se termine pas tant que le mois n'est pas pointé.
  if (e.enRetard > 0) {
    quetes.push({
      id: "pointer", type: "echeance",
      titre: `Pointer ${e.mois}`,
      detail: e.enRetard === 1
        ? "Une échéance attend. Le tour ne se termine pas tant qu'elle n'est pas pointée."
        : `${e.enRetard} échéances attendent. Le tour ne se termine pas tant qu'elles ne sont pas pointées.`,
      gain: "Termine le tour et ouvre son bilan.",
      action: { type: "pointer" },
    });
  }

  // 2. L'organisation : le premier geste qui manque, un seul à la fois.
  if (!e.depensesDeclarees) {
    quetes.push({
      id: "depenses", type: "organisation",
      titre: "Déclarer tes dépenses",
      detail: "Sans elles, ni le matelas de sécurité ni les ères ne se mesurent.",
      gain: "Situe le foyer sur l'échelle des ères.",
      action: null,
    });
  } else if (!e.versementProgramme) {
    quetes.push({
      id: "versement", type: "organisation",
      titre: "Programmer un versement mensuel",
      detail: "Aucune planète n'est alimentée automatiquement : rien n'avance entre deux visites.",
      gain: "Condition de la Cité, et un segment hachuré sur la planète alimentée.",
      action: null,
    });
  } else {
    const sansPlafond = e.planetes.filter(p => p.plafond == null || !(p.plafond > 0)).sort((a, b) => b.valeur - a.valeur)[0];
    if (sansPlafond) {
      const seule = e.planetes.filter(p => p.plafond == null || !(p.plafond > 0)).length === 1;
      quetes.push({
        id: `plafond-${sansPlafond.id}`, type: "organisation",
        titre: `Donner un plafond à ${sansPlafond.nom}`,
        detail: seule
          ? "C'est la seule planète sans barre de vie. Sans plafond, le jeu ne peut pas dire si elle avance ou recule."
          : `${sansPlafond.nom} n'a pas de barre de vie. Sans plafond, le jeu ne peut pas dire si elle avance ou recule.`,
        gain: "Une barre de vie de plus dans la galaxie.",
        action: { type: "planete", id: sansPlafond.id },
      });
    }
  }

  // 3. Le plan : le projet le plus avancé qui n'est pas fini, et sa division.
  const enCours = e.projets
    .filter(p => p.cible > 0 && p.acquis < p.cible)
    .sort((a, b) => b.acquis / b.cible - a.acquis / a.cible)[0];
  if (enCours) {
    const manque = enCours.cible - enCours.acquis;
    const pct = Math.floor((enCours.acquis / enCours.cible) * 100);
    const detail = enCours.apportMensuel > 0
      ? `Il manque ${fmt(manque)}. Au rythme actuel de ${fmt(enCours.apportMensuel)}/mois : ${Math.ceil(manque / enCours.apportMensuel)} mois.`
      : `Il manque ${fmt(manque)}, et rien ne l'alimente : relie-lui une planète ou un versement.`;
    quetes.push({
      id: `projet-${enCours.id}`, type: "plan",
      titre: `${enCours.nom} : ${pct} → 100 %`,
      detail,
      gain: "Une merveille à l'arrivée.",
      action: { type: "projet", id: enCours.id },
    });
  }

  return quetes.slice(0, MAX_QUETES);
}
