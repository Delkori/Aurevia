-- Le journal des tours : un tour par mois pointé, avec ce que son bilan a
-- montré — patrimoine, score, ère, découvertes constatées, quêtes proposées.
-- Un tour fini s'évaporait dès « Tour suivant » ; il s'écrit désormais, et la
-- mémoire des découvertes déjà fêtées devient la même sur tous les appareils.
CREATE TABLE IF NOT EXISTS "tours" (
  "id" serial PRIMARY KEY NOT NULL,
  "mois" date NOT NULL,
  "pointes" integer NOT NULL DEFAULT 0,
  "patrimoine_net" numeric NOT NULL,
  "score" integer,
  "ere" integer NOT NULL DEFAULT 1,
  "decouvertes" text NOT NULL DEFAULT '[]',
  "quetes" text NOT NULL DEFAULT '[]',
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "tours_mois_unique" UNIQUE ("mois")
);
