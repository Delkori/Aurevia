import { db } from "@/db";
import { flows, goals, members, portfolios } from "@/db/schema";
import { and, eq, or } from "drizzle-orm";
import { ValidationError } from "@/lib/validate";

/**
 * Vérifie qu'un flux pointe bien sur quelque chose qui existe.
 *
 * `source_id` et `target_id` sont polymorphes — selon le type, ils désignent
 * une planète, un objectif ou rien — donc aucune clé étrangère ne peut les
 * garder. Sans ce contrôle, créer un versement vers une planète supprimée
 * partait en base sans un mot : le flux apparaissait ensuite dans les listes
 * avec une destination vide, et la galaxie traçait un lien vers un nœud absent.
 */
export async function assertFlowRefs(values: {
  sourceType: string;
  sourceId: number | null;
  targetType: string;
  targetId: number | null;
}): Promise<void> {
  const verifs: Promise<void>[] = [];

  const existe = async (
    table: typeof portfolios | typeof goals | typeof members,
    colonne: typeof portfolios.id | typeof goals.id | typeof members.id,
    id: number,
    libelle: string
  ) => {
    const [row] = await db.select({ id: colonne }).from(table).where(eq(colonne, id)).limit(1);
    if (!row) throw new ValidationError(`${libelle} introuvable. La cible a peut-être été supprimée entre-temps.`);
  };

  if (values.targetType === "portfolio" && values.targetId != null) {
    verifs.push(existe(portfolios, portfolios.id, values.targetId, "Planète de destination"));
  }
  if (values.targetType === "goal" && values.targetId != null) {
    verifs.push(existe(goals, goals.id, values.targetId, "Objectif de destination"));
  }
  if (values.sourceType === "portfolio" && values.sourceId != null) {
    verifs.push(existe(portfolios, portfolios.id, values.sourceId, "Planète source"));
  }
  // Le salaire d'une personne est une source comme une autre : il manquait au
  // contrôle, si bien qu'un versement pouvait partir du salaire de quelqu'un
  // qui n'est plus du foyer.
  if (values.sourceType === "member_salary" && values.sourceId != null) {
    verifs.push(existe(members, members.id, values.sourceId, "Personne source"));
  }

  await Promise.all(verifs);
}

/**
 * Supprime les flux qui désignaient une planète ou un objectif qu'on vient de
 * supprimer.
 *
 * Là encore, faute de clé étrangère sur une colonne polymorphe, rien ne le fait
 * pour nous : supprimer une planète laissait derrière elle ses versements, qui
 * restaient dans les listes en pointant vers un nœud absent. Les échéances de
 * ces flux disparaissent d'elles-mêmes — `flow_occurrences.flow_id`, lui, a bien
 * une clé étrangère en cascade.
 *
 * On supprime plutôt que d'interdire la suppression : c'est le comportement que
 * le reste du schéma a déjà choisi partout où une clé étrangère existe, et
 * refuser de supprimer une planète parce qu'un versement la vise serait une
 * impasse pour l'utilisateur.
 */
export async function deleteFlowsReferencing(
  type: "portfolio" | "goal",
  id: number
): Promise<void> {
  await db.delete(flows).where(
    or(
      and(eq(flows.targetType, type), eq(flows.targetId, id)),
      and(eq(flows.sourceType, type), eq(flows.sourceId, id))
    )
  );
}

/**
 * Supprime les versements qui partaient du salaire d'une personne qu'on vient
 * de retirer du foyer.
 *
 * `flows.member_id` a bien une clé étrangère — une dépense portée par cette
 * personne revient au propriétaire du compte, ce qui est le bon comportement.
 * Mais `source_id` est polymorphe, donc sans clé : un versement « salaire de
 * Camille → PEA » survivait à Camille. La galaxie ne le traçait plus, faute de
 * nœud de départ, mais il continuait de compter dans les versements mensuels,
 * donc dans la projection, et de produire des échéances à pointer que plus rien
 * ne rattachait à personne.
 *
 * On supprime plutôt que d'interdire le retrait de la personne : c'est déjà le
 * choix fait pour les planètes et les objectifs.
 */
export async function deleteFlowsFromMember(memberId: number): Promise<void> {
  await db.delete(flows).where(
    and(eq(flows.sourceType, "member_salary"), eq(flows.sourceId, memberId))
  );
}
