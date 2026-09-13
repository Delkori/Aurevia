-- Mutualisation des dépenses entre les personnes du foyer.
--
-- `flows.member_id` ne pouvait désigner qu'un seul porteur : un loyer commun
-- était donc à 100 % sur l'un ou à 100 % sur l'autre, sans milieu. Le taux
-- d'épargne de celui qui portait tout s'effondrait, celui de l'autre était
-- flatté, et aucun des deux chiffres n'était juste.
--
-- Le mécanisme existait déjà pour les biens (`portfolio_ownerships`, d'où un
-- appartement détenu moitié-moitié) ; il n'avait jamais été appliqué aux flux.
ALTER TABLE "flows" ADD COLUMN IF NOT EXISTS "shared" boolean NOT NULL DEFAULT false;

-- `flow_id` à NULL décrit la règle du foyer — celle qu'on règle une fois pour
-- toutes ; les lignes rattachées à un flux en sont les exceptions.
CREATE TABLE IF NOT EXISTS "expense_shares" (
  "id" serial PRIMARY KEY NOT NULL,
  "flow_id" integer REFERENCES "flows"("id") ON DELETE CASCADE,
  "member_id" integer REFERENCES "members"("id") ON DELETE CASCADE,
  "share_percent" numeric NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "expense_shares_flow_id_idx" ON "expense_shares" ("flow_id");
