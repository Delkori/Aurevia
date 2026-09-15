// Import relatif et non `@/lib/…` : ce module doit rester exécutable par
// `node --test`, qui ne résout pas l'alias `@/` de Next.

/**
 * Noms de planètes, quand ils se ressemblent.
 *
 * Rien n'empêche deux planètes de porter le même nom — un PEA par conjoint,
 * c'est même le cas courant. Mais dans une liste déroulante « PEA » et « PEA »
 * ne se distinguent plus : on range un actif chez la mauvaise personne sans
 * s'en apercevoir, et rien ne le signale ensuite.
 *
 * Règle : ne compléter le nom que là où il le faut. Un PEA seul reste « PEA » ;
 * deux PEA deviennent « PEA · Alex » et « PEA · Camille ». Suffixer toujours
 * remplirait l'écran d'un rappel que personne n'a demandé.
 */

export type Planete = { id: number; name: string; memberId: number | null };
export type Membre = { id: number; name: string };

/** Le nom du propriétaire déclaré. `null` désigne le titulaire du compte. */
export function nomProprietaire(
  memberId: number | null,
  membres: readonly Membre[],
  ownerName: string
): string {
  if (memberId == null) return ownerName;
  return membres.find((m) => m.id === memberId)?.name ?? "?";
}

/**
 * Clé de comparaison des noms : casse, espaces et accents ne doivent pas
 * décider si deux planètes sont homonymes. « PEA » et « pea  » le sont.
 */
export function cleNom(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Les identifiants des planètes dont au moins une autre porte le même nom. */
export function planetesHomonymes(planetes: readonly Planete[]): Set<number> {
  const compte = new Map<string, number>();
  for (const p of planetes) {
    const k = cleNom(p.name);
    compte.set(k, (compte.get(k) ?? 0) + 1);
  }
  return new Set(planetes.filter((p) => (compte.get(cleNom(p.name)) ?? 0) > 1).map((p) => p.id));
}

/**
 * Le nom à afficher pour chaque planète, complété du propriétaire seulement
 * quand il lève une ambiguïté.
 *
 * Deux planètes homonymes du même propriétaire restent identiques : le suffixe
 * n'apprendrait rien. C'est un problème de nommage, pas d'affichage — mieux
 * vaut le laisser visible que le maquiller avec un « (2) ».
 */
export function etiquettesPlanetes(
  planetes: readonly Planete[],
  membres: readonly Membre[],
  ownerName: string
): Map<number, string> {
  const ambigus = planetesHomonymes(planetes);
  return new Map(
    planetes.map((p) => [
      p.id,
      ambigus.has(p.id) ? `${p.name} · ${nomProprietaire(p.memberId, membres, ownerName)}` : p.name,
    ])
  );
}

/**
 * Les planètes déjà nommées ainsi, avec leur propriétaire — de quoi prévenir
 * au moment de la création qu'on s'apprête à fabriquer un homonyme.
 * `exclure` écarte la planète qu'on est en train de renommer.
 *
 * Le nom rendu est celui de la planète existante, pas celui qu'on est en train
 * de taper : « une planète "PEA" existe déjà » est plus parlant que « une
 * planète "pea" existe déjà » quand on vient d'écrire en minuscules.
 */
export function homonymesDe(
  nom: string,
  planetes: readonly Planete[],
  membres: readonly Membre[],
  ownerName: string,
  exclure?: number
): { nom: string; proprietaire: string }[] {
  const k = cleNom(nom);
  if (k === "") return [];
  return planetes
    .filter((p) => p.id !== exclure && cleNom(p.name) === k)
    .map((p) => ({ nom: p.name, proprietaire: nomProprietaire(p.memberId, membres, ownerName) }));
}
