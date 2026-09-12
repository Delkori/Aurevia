import { db } from "@/db";
import { flows, goals, portfolios } from "@/db/schema";
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
    table: typeof portfolios | typeof goals,
    colonne: typeof portfolios.id | typeof goals.id,
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
