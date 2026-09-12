-- Réparation de données : supprime les flux qui désignent une planète ou un
-- objectif qui n'existe plus.
--
-- `flows.source_id` et `flows.target_id` sont polymorphes — selon le type, ils
-- désignent une planète, un objectif, ou rien — donc aucune clé étrangère ne
-- pouvait les garder. Supprimer une planète laissait derrière elle ses
-- versements : invisibles dans la galaxie, puisqu'ils pointaient vers un nœud
-- absent, mais toujours comptés dans le total mensuel épargné et donc dans le
-- taux d'épargne affiché.
--
-- Le code ne peut plus en créer (`assertFlowRefs` au lieu de la clé étrangère
-- manquante) ni en laisser derrière lui (`deleteFlowsReferencing` à la
-- suppression) ; reste à nettoyer ceux d'avant.

DELETE FROM "flows" f
WHERE (f."target_type" = 'portfolio' AND f."target_id" IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM "portfolios" p WHERE p."id" = f."target_id"))
   OR (f."target_type" = 'goal' AND f."target_id" IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM "goals" g WHERE g."id" = f."target_id"))
   OR (f."source_type" = 'portfolio' AND f."source_id" IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM "portfolios" p WHERE p."id" = f."source_id"));
