// Préférences de notification côté client uniquement (localStorage).
// Volontairement pas de table en base : on ne touche pas au schéma existant.

const NOTIFIED_GOALS_KEY = "aurevia:notifiedGoals";
const THRESHOLD_KEY = "aurevia:alertThreshold";
const LAST_THRESHOLD_ALERT_KEY = "aurevia:lastThresholdAlertDate";

export function getNotifiedGoalIds(): number[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(NOTIFIED_GOALS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function markGoalNotified(id: number) {
  if (typeof window === "undefined") return;
  const ids = getNotifiedGoalIds();
  if (!ids.includes(id)) {
    localStorage.setItem(NOTIFIED_GOALS_KEY, JSON.stringify([...ids, id]));
  }
}

export function getAlertThreshold(): number | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(THRESHOLD_KEY);
  return v ? Number(v) : null;
}

export function setAlertThreshold(value: number | null) {
  if (typeof window === "undefined") return;
  if (value === null || Number.isNaN(value)) {
    localStorage.removeItem(THRESHOLD_KEY);
  } else {
    localStorage.setItem(THRESHOLD_KEY, String(value));
  }
}

export function shouldAlertThresholdToday(): boolean {
  if (typeof window === "undefined") return false;
  const today = new Date().toISOString().slice(0, 10);
  return localStorage.getItem(LAST_THRESHOLD_ALERT_KEY) !== today;
}

export function markThresholdAlertedToday() {
  if (typeof window === "undefined") return;
  localStorage.setItem(LAST_THRESHOLD_ALERT_KEY, new Date().toISOString().slice(0, 10));
}
