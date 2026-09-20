import {
  boolean,
  pgTable,
  serial,
  text,
  numeric,
  timestamp,
  date,
  integer,
  index,
  unique,
} from "drizzle-orm/pg-core";

// ── Membres du foyer ─────────────────────────────────────────────────────────
export const members = pgTable("members", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull().default("owner"), // owner | spouse | child | other
  color: text("color").notNull().default("#7c6af5"),
  salary: numeric("salary"), // salaire mensuel net propre à ce membre (optionnel)
  accessory: text("accessory"), // accessoire cosmétique du petit astronaute (star | heart | flag | crown | bolt | rocket), null = aucun
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Portefeuilles ────────────────────────────────────────────────────────────
export const portfolios = pgTable("portfolios", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#8a5cf5"),
  skin: text("skin"),
  memberId: integer("member_id").references(() => members.id, { onDelete: "set null" }),
  // Le plafond que la personne se fixe pour cette planète — la barre de vie
  // au-dessus de la sphère en découle. Nul, pas de barre : l'app ne devine
  // jamais un objectif que personne n'a voulu.
  targetAmount: numeric("target_amount"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("portfolios_member_id_idx").on(t.memberId)]);

// ── Quotes-parts (répartition d'un portefeuille entre plusieurs propriétaires) ──
// Absence de ligne pour un portefeuille = comportement historique (100% au
// memberId du portefeuille, ou à "Moi" si memberId est null).
export const portfolioOwnerships = pgTable("portfolio_ownerships", {
  id: serial("id").primaryKey(),
  portfolioId: integer("portfolio_id").notNull().references(() => portfolios.id, { onDelete: "cascade" }),
  memberId: integer("member_id").references(() => members.id, { onDelete: "cascade" }), // null = "Moi"
  sharePercent: numeric("share_percent").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("portfolio_ownerships_portfolio_id_idx").on(t.portfolioId)]);

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
}, (t) => [index("assets_portfolio_id_idx").on(t.portfolioId)]);

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

// ── Liens objectif ↔ portefeuille ────────────────────────────────────────────
// Relie un objectif aux portefeuilles dont la valeur compte dans sa progression
// (indépendant des flux mensuels, qui suivent les versements récurrents)
export const goalLinks = pgTable("goal_links", {
  id: serial("id").primaryKey(),
  goalId: integer("goal_id").notNull().references(() => goals.id, { onDelete: "cascade" }),
  portfolioId: integer("portfolio_id").notNull().references(() => portfolios.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("goal_links_goal_id_idx").on(t.goalId), index("goal_links_portfolio_id_idx").on(t.portfolioId)]);

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
  /**
   * Dépense portée par le foyer et non par une seule personne. Voir
   * `expense_shares` et `lib/expenseShares.ts` : `member_id` ne pouvait
   * désigner qu'un seul porteur, ce qui rendait un loyer commun impossible à
   * exprimer autrement qu'à 100 % sur l'un des deux.
   */
  shared: boolean("shared").notNull().default(false),
  /**
   * Jour du mois de l'échéance (1-31), ramené au dernier jour quand il n'existe
   * pas. `null` = on prend le jour de `createdAt`, comme avant.
   *
   * Sans ce champ, toutes les échéances d'un foyer tombaient le jour où les
   * flux avaient été saisis : une liste de pointage où dix prélèvements sont
   * datés du même jour ne ressemble à aucun vrai mois.
   */
  dueDay: integer("due_day"),
  memberId: integer("member_id").references(() => members.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Répartition des dépenses entre les personnes du foyer ───────────────────
// Même principe que `portfolio_ownerships` pour les biens : un loyer peut être
// porté moitié-moitié. `flow_id` à NULL décrit la règle du foyer — celle qu'on
// règle une fois — et les lignes rattachées à un flux en sont les exceptions.
export const expenseShares = pgTable("expense_shares", {
  id: serial("id").primaryKey(),
  /** `null` : règle du foyer, applicable à toute dépense déclarée commune. */
  flowId: integer("flow_id").references(() => flows.id, { onDelete: "cascade" }),
  /** `null` = le propriétaire du foyer (« Moi »). */
  memberId: integer("member_id").references(() => members.id, { onDelete: "cascade" }),
  sharePercent: numeric("share_percent").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("expense_shares_flow_id_idx").on(t.flowId)]);

// ── Paramètres (clé-valeur) ──────────────────────────────────────────────────
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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
}, (t) => [index("loans_asset_id_idx").on(t.assetId)]);

// ── Historique patrimoine net ─────────────────────────────────────────────────
// `date` est unique : l'instantané du jour est mis à jour, jamais dupliqué —
// deux onglets ouverts en même temps ne peuvent plus créer deux lignes.
export const netWorthSnapshots = pgTable("net_worth_snapshots", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  totalValue: numeric("total_value").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [unique("net_worth_snapshots_date_unique").on(t.date)]);

// ── Échéances à valider ──────────────────────────────────────────────────────
// Un `flow` est une *règle* (« 380 € de crèche, tous les mois »). Cette table
// en matérialise chaque échéance pour qu'on puisse la confronter au réel :
// montant attendu d'un côté, montant constaté de l'autre. C'est cet écart que
// ni un tableur ni un agrégateur ne donne.
//
// `(flow_id, due_date)` est unique : la génération des échéances peut être
// relancée autant de fois qu'on veut sans jamais créer de doublon.
export const flowOccurrences = pgTable("flow_occurrences", {
  id: serial("id").primaryKey(),
  /**
   * `null` pour un mouvement exceptionnel, saisi à la main depuis le pointage :
   * une réparation de voiture n'est pas une règle et ne doit pas en devenir
   * une. Il porte alors son propre libellé et son propre sens.
   */
  flowId: integer("flow_id").references(() => flows.id, { onDelete: "cascade" }),
  /** Renseigné uniquement pour un mouvement sans règle. */
  label: text("label"),
  /** « in » ou « out ». Ne sert qu'aux mouvements sans règle ; sinon le flux décide. */
  direction: text("direction"),
  dueDate: date("due_date").notNull(),
  expectedAmount: numeric("expected_amount").notNull(),
  /** Renseigné à la validation. `null` tant que l'échéance n'a pas été vérifiée. */
  actualAmount: numeric("actual_amount"),
  // pending | confirmed | skipped
  status: text("status").notNull().default("pending"),
  note: text("note"),
  confirmedAt: timestamp("confirmed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  unique("flow_occurrences_flow_due_unique").on(t.flowId, t.dueDate),
  index("flow_occurrences_due_date_idx").on(t.dueDate),
  index("flow_occurrences_status_idx").on(t.status),
]);

// ── Dernier cours connu ──────────────────────────────────────────────────────
// Les caches mémoire de lib/prices.ts et lib/cryptoPrices.ts meurent avec
// l'instance serverless : après chaque démarrage à froid, l'app re-tape Yahoo et
// CoinGecko pour chaque ticker. Cette table leur sert de second niveau — et
// surtout de dernier prix connu quand l'API ne répond pas, ce qui vaut mieux que
// de retomber sur le prix de revient.
export const priceCache = pgTable("price_cache", {
  ticker: text("ticker").primaryKey(),
  price: numeric("price").notNull(),
  currency: text("currency").notNull(),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
});

// ── Limitation des tentatives de connexion ───────────────────────────────────
// Une ligne par IP. Sans ça, le mot de passe unique de l'app est exposé à un
// nombre illimité d'essais.
export const authThrottle = pgTable("auth_throttle", {
  ip: text("ip").primaryKey(),
  failures: integer("failures").notNull().default(0),
  lockedUntil: timestamp("locked_until"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
