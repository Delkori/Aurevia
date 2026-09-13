-- Suppression des tables du budget, jamais utilisées.
--
-- `budget_categories` et `budget_entries` étaient marquées « réservé v2 » et
-- portées depuis par toutes les migrations sans qu'aucune ligne de code ne les
-- lise ni ne les écrive — vérifié : zéro référence dans `src/`, et zéro ligne
-- en base. Le suivi mensuel qu'elles devaient servir a finalement été construit
-- sur `flow_occurrences`, qui matérialise les échéances des flux existants
-- plutôt que de demander une seconde saisie.
--
-- Garder un schéma mort coûte : il apparaît dans les outils, dans les
-- sauvegardes, et laisse croire qu'une fonctionnalité existe.

DROP TABLE IF EXISTS "budget_entries";
DROP TABLE IF EXISTS "budget_categories";
