import {
  ASSET_TYPES,
  CURRENCIES,
  FLOW_FREQUENCIES,
  FLOW_SOURCE_TYPES,
  FLOW_TARGET_TYPES,
  MEMBER_ROLES,
  jsonBody,
  oneOf,
  optColor,
  optDueDay,
  optDate,
  optId,
  optNumeric,
  optString,
  reqId,
  reqNumeric,
  reqString,
} from "@/lib/validate";

/**
 * Un schéma par entité, partagé entre la création et la mise à jour.
 *
 * Ils vivent ici et non dans les fichiers `route.ts` parce qu'un module de
 * route Next ne doit exporter que ses verbes HTTP et sa configuration.
 */

export async function assetValues(req: Request) {
  const body = await jsonBody(req);
  return {
    name: reqString(body.name, "Nom"),
    type: oneOf(body.type, "Type", ASSET_TYPES),
    ticker: optString(body.ticker, "Ticker", 40),
    quantity: optNumeric(body.quantity, "Quantité", { min: 0 }),
    avgBuyPrice: optNumeric(body.avgBuyPrice, "Prix de revient", { min: 0 }),
    manualValue: optNumeric(body.manualValue, "Valeur"),
    yieldRate: optNumeric(body.yieldRate, "Rendement", { min: -100, max: 1000 }),
    currency: oneOf(body.currency, "Devise", CURRENCIES, "EUR"),
    portfolioId: optId(body.portfolioId, "Portefeuille"),
  };
}

export async function portfolioValues(req: Request) {
  const body = await jsonBody(req);
  return {
    name: reqString(body.name, "Nom", 80),
    color: optColor(body.color, "Couleur", "#8a5cf5"),
    skin: optString(body.skin, "Skin", 30),
    memberId: optId(body.memberId, "Membre"),
    targetAmount: optNumeric(body.targetAmount, "Plafond", { min: 0 }),
  };
}

export async function goalValues(req: Request) {
  const body = await jsonBody(req);
  return {
    name: reqString(body.name, "Nom", 80),
    targetAmount: reqNumeric(body.targetAmount, "Montant visé", { min: 0 }),
    targetDate: optDate(body.targetDate, "Date cible"),
    color: optColor(body.color, "Couleur", "#8a5cf5"),
    memberId: optId(body.memberId, "Membre"),
  };
}

export async function memberValues(req: Request) {
  const body = await jsonBody(req);
  return {
    name: reqString(body.name, "Nom", 60),
    role: oneOf(body.role, "Rôle", MEMBER_ROLES, "owner"),
    color: optColor(body.color, "Couleur", "#7c6af5"),
    salary: optNumeric(body.salary, "Salaire", { min: 0 }),
    accessory: optString(body.accessory, "Accessoire", 20),
  };
}

export async function loanValues(req: Request) {
  const body = await jsonBody(req);
  const remainingBalance = reqNumeric(body.remainingBalance, "Capital restant dû", { min: 0 });
  return {
    name: reqString(body.name, "Nom", 80),
    assetId: optId(body.assetId, "Bien financé"),
    principal: optNumeric(body.principal, "Montant emprunté", { min: 0 }) ?? remainingBalance,
    remainingBalance,
    interestRate: optNumeric(body.interestRate, "Taux", { min: 0, max: 100 }),
    monthlyPayment: optNumeric(body.monthlyPayment, "Mensualité", { min: 0 }),
    startDate: optDate(body.startDate, "Date de début"),
    endDate: optDate(body.endDate, "Date de fin"),
    currency: oneOf(body.currency, "Devise", CURRENCIES, "EUR"),
  };
}

export async function flowValues(req: Request) {
  const body = await jsonBody(req);
  const sourceType = oneOf(body.sourceType, "Source", FLOW_SOURCE_TYPES);
  const targetType = oneOf(body.targetType, "Destination", FLOW_TARGET_TYPES);
  return {
    name: optString(body.name, "Libellé", 80),
    sourceType,
    // Un flux depuis le salaire principal n'a pas de source identifiée ; tout
    // autre type en exige une, sans quoi le graphe ne sait pas où l'accrocher.
    sourceId: sourceType === "salary" ? null : optId(body.sourceId, "Source"),
    targetType,
    targetId:
      targetType === "portfolio" || targetType === "goal"
        ? reqId(body.targetId, "Destination")
        : optId(body.targetId, "Destination"),
    amount: reqNumeric(body.amount, "Montant", { min: 0 }),
    frequency: oneOf(body.frequency, "Fréquence", FLOW_FREQUENCIES, "monthly"),
    dueDay: optDueDay(body.dueDay),
    // Dépense portée par le foyer plutôt que par une seule personne.
    shared: body.shared === true || body.shared === "true",
    memberId: optId(body.memberId, "Membre"),
    ...(body.createdAt ? { createdAt: new Date(String(body.createdAt)) } : {}),
  };
}

export async function ownershipValues(req: Request) {
  const body = await jsonBody(req);
  return {
    portfolioId: reqId(body.portfolioId, "Portefeuille"),
    memberId: optId(body.memberId, "Membre"),
    sharePercent: reqNumeric(body.sharePercent, "Part", { min: 0, max: 100 }),
  };
}

export async function goalLinkValues(req: Request) {
  const body = await jsonBody(req);
  return {
    goalId: reqId(body.goalId, "Objectif"),
    portfolioId: reqId(body.portfolioId, "Portefeuille"),
  };
}
