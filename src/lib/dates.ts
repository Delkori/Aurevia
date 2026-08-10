export function daysUntilNextOccurrence(createdAt: string, frequency: string): number {
  const now = new Date();
  const next = new Date(createdAt);
  if (Number.isNaN(next.getTime())) return NaN;
  let guard = 0;
  while (next.getTime() <= now.getTime() && guard < 1000) {
    if (frequency === "daily") next.setDate(next.getDate() + 1);
    else if (frequency === "weekly") next.setDate(next.getDate() + 7);
    else if (frequency === "yearly") next.setFullYear(next.getFullYear() + 1);
    else next.setMonth(next.getMonth() + 1);
    guard++;
  }
  return Math.max(0, Math.ceil((next.getTime() - now.getTime()) / 86400000));
}

export function nextOccurrenceDate(createdAt: string, frequency: string): Date | null {
  const now = new Date();
  const next = new Date(createdAt);
  if (Number.isNaN(next.getTime())) return null;
  let guard = 0;
  while (next.getTime() <= now.getTime() && guard < 1000) {
    if (frequency === "daily") next.setDate(next.getDate() + 1);
    else if (frequency === "weekly") next.setDate(next.getDate() + 7);
    else if (frequency === "yearly") next.setFullYear(next.getFullYear() + 1);
    else next.setMonth(next.getMonth() + 1);
    guard++;
  }
  return next;
}
