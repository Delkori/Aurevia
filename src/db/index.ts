import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __db_client__: ReturnType<typeof postgres> | undefined;
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL manquant. Ajoute-le dans .env.local (voir .env.example)."
  );
}

// En dev, on réutilise la même connexion entre les rechargements (hot reload)
const client =
  global.__db_client__ ??
  postgres(connectionString, { prepare: false, max: 5 });

if (process.env.NODE_ENV !== "production") {
  global.__db_client__ = client;
}

export const db = drizzle(client, { schema });
