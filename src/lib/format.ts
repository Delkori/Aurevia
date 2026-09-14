export function formatMoney(value: number, currency = "EUR") {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}



/**
 * « de Camille », mais « d'Alex » — l'élision devant une voyelle ou un h.
 *
 * Écrire « Dépenses de Alex » à côté de « Dépenses de Camille » se remarque
 * tout de suite, et une liste de prénoms en contient toujours un.
 *
 * Le h est traité comme muet : c'est le cas de la quasi-totalité des prénoms
 * (« d'Hugo », « d'Hélène »). Un h aspiré sortirait fautif, mais il n'y en a
 * pratiquement pas en prénom français.
 */
export function deNom(nom: string): string {
  const sansAccent = nom.trim().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const premier = sansAccent[0]?.toLowerCase() ?? "";
  return /[aeiouyh]/.test(premier) ? `d'${nom.trim()}` : `de ${nom.trim()}`;
}
