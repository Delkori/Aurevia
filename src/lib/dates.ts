const DAY_MS = 86_400_000;

/**
 * Date de la prochaine échéance d'un flux récurrent, à partir de sa date de
 * création et de sa fréquence.
 *
 * Le calcul était fait par une boucle qui avançait d'une période à la fois,
 * plafonnée à 1000 tours : un flux quotidien créé il y a plus de trois ans
 * épuisait le plafond et renvoyait une date encore dans le passé, affichée
 * « aujourd'hui ». On saute donc directement au bon multiple.
 */
export function nextOccurrenceDate(createdAt: string, frequency: string): Date | null {
  const start = new Date(createdAt);
  if (Number.isNaN(start.getTime())) return null;

  const now = new Date();
  if (start > now) return start;

  const next = new Date(start);

  if (frequency === "daily" || frequency === "weekly") {
    const step = frequency === "daily" ? 1 : 7;
    const elapsedDays = (now.getTime() - start.getTime()) / DAY_MS;
    const periods = Math.floor(elapsedDays / step) + 1;
    next.setDate(next.getDate() + periods * step);
  } else if (frequency === "yearly") {
    // On vise l'anniversaire de l'année en cours, et on n'ajoute une année que
    // s'il est déjà passé. Ajouter systématiquement une période renvoyait
    // l'année d'après : un prélèvement du 20 novembre consulté en septembre
    // annonçait novembre de l'année suivante.
    next.setFullYear(start.getFullYear() + (now.getFullYear() - start.getFullYear()));
  } else {
    // Même raisonnement au mois : on vise le jour du mois en cours.
    const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    next.setMonth(next.getMonth() + months);
  }

  // `setMonth`/`setFullYear` peuvent retomber avant `now` d'un cran (un flux du
  // 31 ramené au 28 février, par exemple) : on rattrape période par période,
  // ce qui ne coûte ici qu'une itération ou deux.
  let guard = 0;
  while (next <= now && guard < 64) {
    if (frequency === "daily") next.setDate(next.getDate() + 1);
    else if (frequency === "weekly") next.setDate(next.getDate() + 7);
    else if (frequency === "yearly") next.setFullYear(next.getFullYear() + 1);
    else next.setMonth(next.getMonth() + 1);
    guard++;
  }

  return next;
}

export function daysUntilNextOccurrence(createdAt: string, frequency: string): number {
  const next = nextOccurrenceDate(createdAt, frequency);
  if (!next) return NaN;
  return Math.max(0, Math.ceil((next.getTime() - Date.now()) / DAY_MS));
}
