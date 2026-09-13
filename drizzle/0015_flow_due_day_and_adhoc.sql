-- Jour d'échéance, et mouvements exceptionnels.
--
-- `flows.due_day` : sans lui, la date d'une échéance venait du jour où le flux
-- avait été saisi. Un foyer qui enregistre ses dix prélèvements le même
-- après-midi obtenait dix échéances au même jour — une liste de pointage qui ne
-- ressemble à aucun vrai mois, et aucun moyen de dire « l'abonnement tombe
-- le 6 ».
ALTER TABLE "flows" ADD COLUMN IF NOT EXISTS "due_day" integer;

-- `flow_occurrences.flow_id` devient facultatif : une dépense exceptionnelle
-- saisie depuis le pointage n'a aucune règle derrière elle, et ne doit pas en
-- créer une. Elle porte alors son libellé et son sens.
--
-- La contrainte d'unicité sur (flow_id, due_date) reste : Postgres considère
-- deux NULL comme distincts, donc plusieurs mouvements exceptionnels peuvent
-- coexister le même jour, tandis qu'une règle garde une échéance par date.
ALTER TABLE "flow_occurrences" ALTER COLUMN "flow_id" DROP NOT NULL;
ALTER TABLE "flow_occurrences" ADD COLUMN IF NOT EXISTS "label" text;
ALTER TABLE "flow_occurrences" ADD COLUMN IF NOT EXISTS "direction" text;
