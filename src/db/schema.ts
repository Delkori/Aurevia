import {
  pgTable,
  serial,
  text,
  numeric,
  timestamp,
  date,
  integer,
} from "drizzle-orm/pg-core";

// Portefeuille (PEA, CTO, Assurance-vie, Crypto...) qui regroupe des actifs
export const portfolios = pgTable("portfolios", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#C9A227"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Un actif détenu : action/ETF (avec ticker => cours en direct),
// ou un actif "manuel" (immobilier, cash, autre) dont on saisit la valeur à la main.
export const assets = pgTable("assets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // "stock" | "etf" | "crypto" | "real_estate" | "cash" | "other"
  ticker: text("ticker"), // symbole Yahoo Finance, ex: "AAPL", "BTC-USD", "CW8.PA"
  quantity: numeric("quantity"), // pour actions/etf/crypto
  avgBuyPrice: numeric("avg_buy_price"), // prix de revient moyen, pour calculer la plus-value
  manualValue: numeric("manual_value"), // pour immobilier / cash / autre
  currency: text("currency").notNull().default("EUR"),
  portfolioId: integer("portfolio_id").references(() => portfolios.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Objectifs de patrimoine (ex: "Atteindre 100 000 € d'ici 2027")
export const goals = pgTable("goals", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  targetAmount: numeric("target_amount").notNull(),
  targetDate: date("target_date"),
  color: text("color").notNull().default("#C9A227"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Catégories de budget (revenus / dépenses)
export const budgetCategories = pgTable("budget_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(), // "income" | "expense"
  monthlyTarget: numeric("monthly_target"), // objectif mensuel (budget)
  color: text("color").notNull().default("#8892A6"),
});

// Lignes de dépenses/revenus
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

// Historique du patrimoine net, pour tracer la courbe dans le temps
export const netWorthSnapshots = pgTable("net_worth_snapshots", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  totalValue: numeric("total_value").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
