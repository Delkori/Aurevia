import { db } from "@/db";
import {
  assets,
  flows,
  goalLinks,
  goals,
  loans,
  members,
  portfolioOwnerships,
  portfolios,
  settings,
} from "@/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import {
  DEMO_ASSETS,
  DEMO_FLOWS,
  DEMO_GOALS,
  DEMO_LOANS,
  DEMO_MEMBERS,
  DEMO_OWNERSHIPS,
  DEMO_PORTFOLIOS,
  DEMO_SETTINGS,
} from "@/lib/demoData";

/**
 * Clé de la ligne `settings` qui mémorise ce que le jeu d'exemple a créé.
 *
 * On enregistre les identifiants exacts plutôt que de reconnaître les données
 * d'exemple à leur nom : « Retirer l'exemple » ne doit jamais pouvoir emporter
 * une ligne saisie par l'utilisateur, même s'il l'a appelée « PEA » lui aussi.
 */
const SEED_KEY = "demo_seed";

type Seed = {
  createdAt: string;
  members: number[];
  portfolios: number[];
  assets: number[];
  loans: number[];
  goals: number[];
  goalLinks: number[];
  flows: number[];
  ownerships: number[];
  /** Réglages écrasés par l'exemple, pour les remettre en place au retrait. */
  previousSettings: Record<string, string | null>;
};

async function readSeed(): Promise<Seed | null> {
  const [row] = await db.select().from(settings).where(eq(settings.key, SEED_KEY));
  if (!row) return null;
  try {
    return JSON.parse(row.value) as Seed;
  } catch {
    return null;
  }
}

export async function isDemoLoaded(): Promise<boolean> {
  try {
    return (await readSeed()) !== null;
  } catch {
    return false;
  }
}

/** Le patrimoine d'exemple n'a de sens que sur une galaxie vide. */
export async function isDatabaseEmpty(): Promise<boolean> {
  const [a, p, g, m] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(assets),
    db.select({ n: sql<number>`count(*)::int` }).from(portfolios),
    db.select({ n: sql<number>`count(*)::int` }).from(goals),
    db.select({ n: sql<number>`count(*)::int` }).from(members),
  ]);
  return (a[0].n ?? 0) + (p[0].n ?? 0) + (g[0].n ?? 0) + (m[0].n ?? 0) === 0;
}

export async function seedDemo(): Promise<Seed> {
  const existing = await readSeed();
  if (existing) return existing;

  const memberIds: Record<string, number> = {};
  for (const m of DEMO_MEMBERS) {
    const [row] = await db
      .insert(members)
      .values({ name: m.name, role: m.role, color: m.color, salary: m.salary, accessory: m.accessory })
      .returning();
    memberIds[m.key] = row.id;
  }

  const portfolioIds: Record<string, number> = {};
  for (const p of DEMO_PORTFOLIOS) {
    const [row] = await db
      .insert(portfolios)
      .values({
        name: p.name,
        color: p.color,
        skin: p.skin,
        memberId: p.member ? memberIds[p.member] : null,
        targetAmount: p.target,
        openedAt: p.opened,
      })
      .returning();
    portfolioIds[p.key] = row.id;
  }

  const assetIds: Record<string, number> = {};
  for (const a of DEMO_ASSETS) {
    const [row] = await db
      .insert(assets)
      .values({
        name: a.name,
        type: a.type,
        ticker: a.ticker ?? null,
        quantity: a.quantity ?? null,
        avgBuyPrice: a.avgBuyPrice ?? null,
        manualValue: a.manualValue ?? null,
        yieldRate: a.yieldRate ?? null,
        currency: a.currency ?? "EUR",
        portfolioId: portfolioIds[a.portfolio],
      })
      .returning();
    assetIds[a.key] = row.id;
  }

  const loanIds: number[] = [];
  for (const l of DEMO_LOANS) {
    const [row] = await db
      .insert(loans)
      .values({
        name: l.name,
        assetId: assetIds[l.asset],
        principal: l.principal,
        remainingBalance: l.remainingBalance,
        interestRate: l.interestRate,
        monthlyPayment: l.monthlyPayment,
        currency: l.currency,
      })
      .returning();
    loanIds.push(row.id);
  }

  const goalIds: Record<string, number> = {};
  const goalLinkIds: number[] = [];
  for (const g of DEMO_GOALS) {
    const [row] = await db
      .insert(goals)
      .values({
        name: g.name,
        targetAmount: g.targetAmount,
        color: g.color,
        memberId: g.member ? memberIds[g.member] : null,
      })
      .returning();
    goalIds[g.key] = row.id;
    for (const pKey of g.portfolios) {
      const [link] = await db
        .insert(goalLinks)
        .values({ goalId: row.id, portfolioId: portfolioIds[pKey] })
        .returning();
      goalLinkIds.push(link.id);
    }
  }

  const flowIds: number[] = [];
  for (const f of DEMO_FLOWS) {
    const [sourceType, sourceKey] = f.source.split(":");
    const [targetType, targetKey] = f.target.split(":");
    const [row] = await db
      .insert(flows)
      .values({
        name: f.name,
        sourceType: sourceType === "member" ? "member_salary" : "salary",
        sourceId: sourceType === "member" ? memberIds[sourceKey] : null,
        targetType,
        targetId: targetType === "portfolio" ? portfolioIds[targetKey] : null,
        amount: f.amount,
        frequency: f.frequency,
        memberId: f.member ? memberIds[f.member] : null,
      })
      .returning();
    flowIds.push(row.id);
  }

  const ownershipIds: number[] = [];
  for (const o of DEMO_OWNERSHIPS) {
    const [row] = await db
      .insert(portfolioOwnerships)
      .values({
        portfolioId: portfolioIds[o.portfolio],
        memberId: o.member ? memberIds[o.member] : null,
        sharePercent: o.sharePercent,
      })
      .returning();
    ownershipIds.push(row.id);
  }

  // Réglages : on note la valeur précédente de chaque clé touchée pour pouvoir
  // la restaurer exactement — y compris « la clé n'existait pas » (null).
  const previousSettings: Record<string, string | null> = {};
  const touchedKeys = Object.keys(DEMO_SETTINGS);
  const before = await db
    .select()
    .from(settings)
    .where(inArray(settings.key, touchedKeys));
  for (const key of touchedKeys) {
    previousSettings[key] = before.find((r) => r.key === key)?.value ?? null;
  }
  await db
    .insert(settings)
    .values(Object.entries(DEMO_SETTINGS).map(([key, value]) => ({ key, value })))
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: sql`excluded.value`, updatedAt: new Date() },
    });

  const seed: Seed = {
    createdAt: new Date().toISOString(),
    members: Object.values(memberIds),
    portfolios: Object.values(portfolioIds),
    assets: Object.values(assetIds),
    loans: loanIds,
    goals: Object.values(goalIds),
    goalLinks: goalLinkIds,
    flows: flowIds,
    ownerships: ownershipIds,
    previousSettings,
  };

  await db
    .insert(settings)
    .values({ key: SEED_KEY, value: JSON.stringify(seed) })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: sql`excluded.value`, updatedAt: new Date() },
    });

  return seed;
}

export async function removeDemo(): Promise<boolean> {
  const seed = await readSeed();
  if (!seed) return false;

  // Ordre inverse de la création, pour ne jamais heurter une clé étrangère.
  if (seed.ownerships.length) await db.delete(portfolioOwnerships).where(inArray(portfolioOwnerships.id, seed.ownerships));
  if (seed.flows.length) await db.delete(flows).where(inArray(flows.id, seed.flows));
  if (seed.goalLinks.length) await db.delete(goalLinks).where(inArray(goalLinks.id, seed.goalLinks));
  if (seed.goals.length) await db.delete(goals).where(inArray(goals.id, seed.goals));
  if (seed.loans.length) await db.delete(loans).where(inArray(loans.id, seed.loans));
  if (seed.assets.length) await db.delete(assets).where(inArray(assets.id, seed.assets));
  if (seed.portfolios.length) await db.delete(portfolios).where(inArray(portfolios.id, seed.portfolios));
  if (seed.members.length) await db.delete(members).where(inArray(members.id, seed.members));

  for (const [key, previous] of Object.entries(seed.previousSettings ?? {})) {
    if (previous === null) {
      await db.delete(settings).where(eq(settings.key, key));
    } else {
      await db.update(settings).set({ value: previous, updatedAt: new Date() }).where(eq(settings.key, key));
    }
  }

  await db.delete(settings).where(eq(settings.key, SEED_KEY));
  return true;
}
