import {
  pgTable,
  serial,
  text,
  numeric,
  timestamp,
  date,
  integer,
} from "drizzle-orm/pg-core";

// ── Membres du foyer ─────────────────────────────────────────────────────────
export const members = pgTable("members", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull().default("owner"), // owner | spouse | child | other
  color: text("color").notNull().default("#7c6af5"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Portefeuilles ────────────────────────────────────────────────────────────
export const portfolios = pgTable("portfolios", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#8a5cf5"),
  memberId: integer("member_id").references(() => members.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Actifs ────────────────────────────────────────────────────────────────────
export const assets = pgTable("assets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  ticker: text("ticker"),
  quantity: numeric("quantity"),
  avgBuyPrice: numeric("avg_buy_price"),
  manualValue: numeric("manual_value"),
  yieldRate: numeric("yield_rate"),
  currency: text("currency").notNull().default("EUR"),
  portfolioId: integer("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Objectifs ─────────────────────────────────────────────────────────────────
export const goals = pgTable("goals", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  targetAmount: numeric("target_amount").notNull(),
  targetDate: date("target_date"),
  color: text("color").notNull().default("#8a5cf5"),
  memberId: integer("member_id").references(() => members.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Flux financiers ──────────────────────────────────────────────────────────
// Un flux représente un transfert récurrent entre deux entités
// sourceType/targetType : "salary" | "portfolio" | "goal" | "expense" | "external"
export const flows = pgTable("flows", {
  id: serial("id").primaryKey(),
  name: text("name"),
  sourceType: text("source_type").notNull(),
  sourceId: integer("source_id"), // null si salary
  targetType: text("target_type").notNull(),
  targetId: integer("target_id"),
  amount: numeric("amount").notNull(),
  frequency: text("frequency").notNull().default("monthly"), // monthly | weekly | yearly | once
  memberId: integer("member_id").references(() => members.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Paramètres (clé-valeur) ──────────────────────────────────────────────────
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Budget ────────────────────────────────────────────────────────────────────
export const budgetCategories = pgTable("budget_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  monthlyTarget: numeric("monthly_target"),
  color: text("color").notNull().default("#999999"),
});

export const budgetEntries = pgTable("budget_entries", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id")
    .notNull()
    .references(() => budgetCategories.id, { onDelete: "cascade" }),
  amount: numeric("amount").notNull(),
  note: text("note"),
  date: date("date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Crédits / Prêts ──────────────────────────────────────────────────────────
export const loans = pgTable("loans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  assetId: integer("asset_id").references(() => assets.id, { onDelete: "set null" }),
  principal: numeric("principal").notNull(),
  remainingBalance: numeric("remaining_balance").notNull(),
  interestRate: numeric("interest_rate"),
  monthlyPayment: numeric("monthly_payment"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  currency: text("currency").notNull().default("EUR"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Historique patrimoine net ─────────────────────────────────────────────────
export const netWorthSnapshots = pgTable("net_worth_snapshots", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  totalValue: numeric("total_value").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
