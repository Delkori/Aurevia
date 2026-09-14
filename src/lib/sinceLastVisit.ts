// Import relatif et non `@/lib/dates` : les modules de `lib/` qui sont des
// fonctions pures doivent rester exécutables par `node --test`, qui ne résout
// pas l'alias `@/` de Next.
import { nextOccurrenceDate } from "./dates.ts";

/**
 * Résumé « depuis ta dernière visite ».
 *
 * Une app de patrimoine n'a aucune raison d'être rouverte : entre deux visites,
 * rien ne bouge sauf les cours, et personne ne s'en aperçoit. Cet écran est la
 * réponse à cette question — il donne, en une carte, ce qui a changé et ce qui
 * arrive.
 *
 * Règle de construction : ne rien inventer. On ne stocke pas d'historique par
 * actif, donc on ne prétend pas dire « ton PEA a pris 2 % » ; on s'en tient au
 * patrimoine net (dont on a l'historique), aux paliers d'objectifs franchis,
 * et aux échéances à venir (qui se déduisent des flux et du calendrier de
 * dividendes).
 */

const DAY_MS = 86_400_000;

/** Ce qu'on mémorise d'une visite à l'autre, côté navigateur. */
export type VisitMemory = {
  /** Date ISO (AAAA-MM-JJ) de la dernière visite. */
  date: string;
  netWorth: number;
  /** Progression de chaque objectif à la dernière visite, de 0 à 1. */
  goalProgress: Record<string, number>;
};

export type Highlight = {
  id: string;
  kind: "networth" | "goal" | "payment" | "dividend" | "stale";
  text: string;
  tone: "positive" | "negative" | "neutral";
};

export type SummaryInput = {
  memory: VisitMemory | null;
  netWorth: number;
  goals: { id: number; name: string; progress: number }[];
  flows: { id: number; name: string | null; amount: number; frequency: string; createdAt: string; targetLabel: string }[];
  dividends: { ticker: string; assetName: string; date: string; amount: number }[];
  staleCount: number;
  formatMoney: (v: number) => string;
  now?: Date;
};

/** Paliers dont le franchissement mérite d'être signalé. */
const GOAL_MILESTONES = [0.25, 0.5, 0.75, 1];

function crossedMilestone(before: number, after: number): number | null {
  for (let i = GOAL_MILESTONES.length - 1; i >= 0; i--) {
    const m = GOAL_MILESTONES[i];
    if (before < m && after >= m) return m;
  }
  return null;
}

export function summarizeSinceLastVisit(input: SummaryInput): {
  daysSince: number | null;
  highlights: Highlight[];
} {
  const now = input.now ?? new Date();
  const { memory, formatMoney } = input;

  const daysSince = memory
    ? Math.floor((now.getTime() - new Date(`${memory.date}T00:00:00`).getTime()) / DAY_MS)
    : null;

  const highlights: Highlight[] = [];

  // 1. Patrimoine net — seul chiffre dont on possède réellement l'historique.
  if (memory && Number.isFinite(memory.netWorth) && memory.netWorth !== 0) {
    const delta = input.netWorth - memory.netWorth;
    const pct = (delta / Math.abs(memory.netWorth)) * 100;
    // En dessous de 0,1 %, c'est du bruit de cotation : ne pas en faire un événement.
    if (Math.abs(pct) >= 0.1) {
      highlights.push({
        id: "networth",
        kind: "networth",
        tone: delta >= 0 ? "positive" : "negative",
        text: `Patrimoine net ${delta >= 0 ? "en hausse de" : "en baisse de"} ${formatMoney(
          Math.abs(delta)
        )} (${delta >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(1)} %).`,
      });
    }
  }

  // 2. Paliers d'objectifs franchis.
  if (memory) {
    for (const goal of input.goals) {
      const before = memory.goalProgress?.[String(goal.id)];
      if (before == null) continue;
      const milestone = crossedMilestone(before, goal.progress);
      if (milestone != null) {
        highlights.push({
          id: `goal-${goal.id}`,
          kind: "goal",
          tone: "positive",
          text:
            milestone === 1
              ? `Objectif « ${goal.name} » atteint.`
              : `Objectif « ${goal.name} » : ${Math.round(milestone * 100)} % franchis.`,
        });
      }
    }
  }

  // 3. Versements programmés dans les 7 jours.
  const upcoming = input.flows
    .map((f) => ({ flow: f, date: nextOccurrenceDate(f.createdAt, f.frequency, now) }))
    .filter((x): x is { flow: (typeof input.flows)[number]; date: Date } => x.date !== null)
    .filter((x) => x.date.getTime() - now.getTime() <= 7 * DAY_MS)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (upcoming.length > 0) {
    const total = upcoming.reduce((s, x) => s + x.flow.amount, 0);
    const first = upcoming[0];
    const days = Math.max(0, Math.ceil((first.date.getTime() - now.getTime()) / DAY_MS));
    highlights.push({
      id: "payments",
      kind: "payment",
      tone: "neutral",
      text:
        upcoming.length === 1
          ? `Versement de ${formatMoney(first.flow.amount)} vers ${first.flow.targetLabel} ${
              days === 0 ? "aujourd'hui" : `dans ${days} j`
            }.`
          : `${upcoming.length} versements cette semaine, ${formatMoney(total)} au total.`,
    });
  }

  // 4. Dividendes attendus dans les 30 jours.
  const nextDividends = input.dividends
    .filter((d) => {
      const t = new Date(d.date).getTime();
      return t >= now.getTime() && t - now.getTime() <= 30 * DAY_MS;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  if (nextDividends.length > 0) {
    const total = nextDividends.reduce((s, d) => s + d.amount, 0);
    highlights.push({
      id: "dividends",
      kind: "dividend",
      tone: "positive",
      text:
        nextDividends.length === 1
          ? `Dividende estimé de ${formatMoney(total)} sur ${nextDividends[0].assetName} le ${nextDividends[0].date}.`
          : `${nextDividends.length} dividendes estimés ce mois-ci, ${formatMoney(total)} au total.`,
    });
  }

  // 5. Cours manquants — l'honnêteté vaut mieux qu'un chiffre faussement à jour.
  if (input.staleCount > 0) {
    highlights.push({
      id: "stale",
      kind: "stale",
      tone: "neutral",
      text:
        input.staleCount === 1
          ? "1 ligne est valorisée à son prix de revient : son cours n'a pas pu être récupéré."
          : `${input.staleCount} lignes sont valorisées à leur prix de revient : leurs cours n'ont pas pu être récupérés.`,
    });
  }

  return { daysSince, highlights };
}

// ── Mémoire de visite (localStorage) ─────────────────────────────────────────

const MEMORY_KEY = "aurevia:lastVisit";

function readRaw(): VisitMemory | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VisitMemory;
    return parsed && typeof parsed.date === "string" ? parsed : null;
  } catch {
    return null;
  }
}

// La mémoire est exposée comme une source externe (`useSyncExternalStore`)
// plutôt que lue dans un effet : c'est ce que React attend pour une valeur qui
// vit hors de lui et n'existe pas au rendu serveur. L'instantané doit être
// stable d'un appel à l'autre, sinon React boucle — d'où le cache.
let cache: VisitMemory | null | undefined;
const listeners = new Set<() => void>();

export function subscribeVisitMemory(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function getVisitMemory(): VisitMemory | null {
  if (cache === undefined) cache = readRaw();
  return cache;
}

/** Côté serveur, il n'y a jamais de mémoire : rien n'est affiché au premier rendu. */
export function getVisitMemoryServer(): null {
  return null;
}

export function writeVisitMemory(memory: VisitMemory) {
  cache = memory;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(MEMORY_KEY, JSON.stringify(memory));
    } catch {
      // Navigation privée ou stockage plein : le résumé sera simplement absent
      // à la prochaine visite, ce n'est pas une raison de casser la page.
    }
  }
  listeners.forEach((l) => l());
}
