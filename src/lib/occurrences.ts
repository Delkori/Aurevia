import { db } from "@/db";
import { flowOccurrences, flows } from "@/db/schema";
import { and, gte, lte, sql } from "drizzle-orm";
import { upcomingByMonth, type FlowLike } from "@/lib/calendar";

/**
 * Matérialisation des échéances à valider.
 *
 * Les flux décrivent des règles ; cette couche les déroule en échéances datées
 * et les enregistre, pour qu'on puisse cocher « oui, les 380 € de crèche sont
 * bien passés » — ou corriger à 395 €. L'écart entre prévu et constaté est la
 * seule chose que ni un tableur ni un agrégateur ne donne.
 *
 * La génération est idempotente : la contrainte d'unicité sur
 * `(flow_id, due_date)` fait que la relancer ne crée jamais de doublon, et
 * n'écrase jamais une échéance déjà validée.
 */

export type OccurrenceStatus = "pending" | "confirmed" | "skipped";

function jour(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Crée les échéances manquantes sur la fenêtre demandée.
 *
 * `moisPasses` remonte volontairement en arrière : une échéance qu'on n'a
 * jamais ouverte l'app pour valider doit exister quand on revient, sinon le
 * suivi a des trous invisibles.
 */
export async function generateOccurrences(
  moisPasses = 3,
  moisFuturs = 3,
  maintenant = new Date()
): Promise<number> {
  const regles = await db.select().from(flows);
  if (regles.length === 0) return 0;

  const debut = new Date(maintenant.getFullYear(), maintenant.getMonth() - moisPasses, 1);
  const groupes = upcomingByMonth(
    regles as unknown as FlowLike[],
    moisPasses + moisFuturs,
    debut
  );

  const lignes = groupes.flatMap((g) =>
    g.occurrences.map((o) => ({
      flowId: o.flowId,
      dueDate: jour(o.date),
      expectedAmount: String(o.amount),
    }))
  );
  if (lignes.length === 0) return 0;

  // `DO NOTHING` et non `DO UPDATE` : une échéance déjà présente peut avoir été
  // validée avec un montant corrigé, la regénérer ne doit pas l'écraser.
  await db.insert(flowOccurrences).values(lignes).onConflictDoNothing();
  return lignes.length;
}

export type OccurrenceRow = {
  id: number;
  flowId: number;
  dueDate: string;
  expectedAmount: string;
  actualAmount: string | null;
  status: string;
  note: string | null;
  confirmedAt: Date | null;
};

export async function listOccurrences(from: string, to: string): Promise<OccurrenceRow[]> {
  return db
    .select()
    .from(flowOccurrences)
    .where(and(gte(flowOccurrences.dueDate, from), lte(flowOccurrences.dueDate, to)))
    .orderBy(flowOccurrences.dueDate, flowOccurrences.id);
}

/**
 * Nombre d'échéances dont la date est passée et qui n'ont toujours pas été
 * vérifiées. C'est ce compteur qui allume la pastille sur la planète.
 */
export async function countOverdue(maintenant = new Date()): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(flowOccurrences)
    .where(and(
      lte(flowOccurrences.dueDate, jour(maintenant)),
      sql`${flowOccurrences.status} = 'pending'`
    ));
  return row?.n ?? 0;
}
