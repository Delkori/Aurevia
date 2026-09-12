import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  var __db_client__: ReturnType<typeof postgres> | undefined;
}

/**
 * Connexion créée à la première requête, pas au chargement du module.
 *
 * Avec une initialisation immédiate, `next build` importe chaque route handler
 * pendant l'étape « Collecting page data » et la compilation échoue dès que
 * DATABASE_NEON_URL est absent — donc dans toute CI et tout build local sans
 * base. Le message d'erreur reste le même, il n'apparaît simplement qu'au
 * moment où quelqu'un essaie réellement d'interroger la base.
 */
function createClient() {
  const connectionString = process.env.DATABASE_NEON_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_NEON_URL manquant. Ajoute-le dans .env.local (voir .env.example)."
    );
  }
  const client = postgres(connectionString, { prepare: false, max: 5 });
  // En dev, on réutilise la même connexion entre les rechargements (hot reload).
  if (process.env.NODE_ENV !== "production") global.__db_client__ = client;
  return client;
}

let instance: ReturnType<typeof drizzle<typeof schema>> | null = null;

function getDb() {
  if (!instance) {
    instance = drizzle(global.__db_client__ ?? createClient(), { schema });
  }
  return instance;
}

/**
 * Se comporte exactement comme l'objet Drizzle d'avant (`db.select()…`), mais
 * la connexion n'est ouverte qu'au premier accès à une propriété.
 */
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});
