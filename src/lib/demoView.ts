/**
 * Le foyer fictif servi aux sessions de démonstration.
 *
 * Le rôle « demo » était en lecture seule, mais il lisait la *vraie* base :
 * envoyer le lien à quelqu'un lui montrait le patrimoine réel du propriétaire.
 * Une démonstration doit pouvoir se partager sans y réfléchir, donc elle ne
 * touche plus du tout aux tables du foyer — elle est construite ici, en
 * mémoire, à partir du même jeu d'exemple que le bouton « charger un
 * patrimoine d'exemple ».
 *
 * Les tickers sont réels : les cours affichés sont les vrais cours du jour.
 * C'est ce qui distingue une démonstration d'une maquette.
 */

import {
  DEMO_ASSETS, DEMO_FLOWS, DEMO_GOALS, DEMO_LOANS, DEMO_MEMBERS,
  DEMO_OWNERSHIPS, DEMO_PORTFOLIOS, DEMO_SETTINGS,
} from "./demoData.ts";
// Chemins relatifs avec extension : ce module est couvert par `node --test`,
// qui ne résout pas l'alias `@/`.
import { upcomingByMonth, type FlowLike } from "./calendar.ts";

/**
 * Les identifiants sont l'indice dans la liste, donc stables d'un appel à
 * l'autre : l'interface relie les actifs aux planètes par ces nombres, et deux
 * requêtes successives doivent parler des mêmes objets.
 */
const idDe = <T,>(liste: readonly T[], predicat: (x: T) => boolean): number | null => {
  const i = liste.findIndex(predicat);
  return i === -1 ? null : i + 1;
};

const memberId = (cle: string | null | undefined) =>
  cle == null ? null : idDe(DEMO_MEMBERS, (m) => m.key === cle);
const portfolioId = (cle: string) => idDe(DEMO_PORTFOLIOS, (p) => p.key === cle);
const assetId = (cle: string) => idDe(DEMO_ASSETS, (a) => a.key === cle);
const goalId = (cle: string) => idDe(DEMO_GOALS, (g) => g.key === cle);

/**
 * Origine des données : un foyer qui tourne depuis un moment. Sans recul, la
 * frise, l'historique et les échéances passées seraient vides — le prospect
 * verrait une app neuve plutôt qu'une app qui sert.
 */
const MOIS_HISTOIRE = 14;

function origine(maintenant: Date): Date {
  return new Date(maintenant.getFullYear(), maintenant.getMonth() - MOIS_HISTOIRE, 1);
}

/**
 * Jour d'échéance de chaque flux. Étalés à la main, parce que tout regrouper au
 * même jour donnerait une liste de pointage irréaliste — et que l'intérêt du
 * suivi, c'est justement « le prélèvement du 6 est-il passé ».
 */
const JOURS = [2, 3, 5, 6, 8, 5, 12, 14, 17, 8, 28];

export function demoMembers(maintenant = new Date()) {
  const t = origine(maintenant);
  return DEMO_MEMBERS.map((m, i) => ({
    id: i + 1, name: m.name, role: m.role, color: m.color,
    salary: m.salary, accessory: m.accessory, createdAt: t,
  }));
}

export function demoPortfolios(maintenant = new Date()) {
  const t = origine(maintenant);
  return DEMO_PORTFOLIOS.map((p, i) => ({
    id: i + 1, name: p.name, color: p.color, skin: p.skin,
    memberId: memberId(p.member), targetAmount: p.target, createdAt: t,
  }));
}

export function demoAssets(maintenant = new Date()) {
  const t = origine(maintenant);
  return DEMO_ASSETS.map((a, i) => ({
    id: i + 1, name: a.name, type: a.type, ticker: a.ticker ?? null,
    quantity: a.quantity ?? null, avgBuyPrice: a.avgBuyPrice ?? null,
    manualValue: a.manualValue ?? null, yieldRate: a.yieldRate ?? null,
    currency: a.currency ?? "EUR", portfolioId: portfolioId(a.portfolio),
    createdAt: t, updatedAt: t,
  }));
}

export function demoLoans(maintenant = new Date()) {
  const t = origine(maintenant);
  return DEMO_LOANS.map((l, i) => ({
    id: i + 1, name: l.name, assetId: assetId(l.asset),
    principal: l.principal, remainingBalance: l.remainingBalance,
    interestRate: l.interestRate, monthlyPayment: l.monthlyPayment,
    startDate: null, endDate: null, currency: l.currency,
    createdAt: t, updatedAt: t,
  }));
}

export function demoGoals(maintenant = new Date()) {
  const t = origine(maintenant);
  return DEMO_GOALS.map((g, i) => ({
    id: i + 1, name: g.name, targetAmount: g.targetAmount, targetDate: null,
    color: g.color, memberId: memberId(g.member), createdAt: t,
  }));
}

export function demoGoalLinks(maintenant = new Date()) {
  const t = origine(maintenant);
  const out: { id: number; goalId: number; portfolioId: number; createdAt: Date }[] = [];
  let id = 1;
  DEMO_GOALS.forEach((g, gi) => {
    for (const cle of g.portfolios) {
      const pid = portfolioId(cle);
      if (pid != null) out.push({ id: id++, goalId: gi + 1, portfolioId: pid, createdAt: t });
    }
  });
  return out;
}

export function demoOwnerships(maintenant = new Date()) {
  const t = origine(maintenant);
  return DEMO_OWNERSHIPS.map((o, i) => ({
    id: i + 1, portfolioId: portfolioId(o.portfolio)!,
    memberId: memberId(o.member), sharePercent: o.sharePercent, createdAt: t,
  }));
}

export function demoFlows(maintenant = new Date()) {
  const debut = origine(maintenant);
  return DEMO_FLOWS.map((f, i) => {
    const [type, cle] = f.target.split(":");
    const targetId =
      type === "portfolio" ? portfolioId(cle) : type === "goal" ? goalId(cle) : null;
    const sourceMembre = f.source.startsWith("member:") ? f.source.slice(7) : null;
    // Chaque flux tombe son propre jour du mois, comme dans un vrai foyer.
    const jour = JOURS[i % JOURS.length];
    const dernier = new Date(debut.getFullYear(), debut.getMonth() + 1, 0).getDate();
    return {
      id: i + 1,
      name: f.name,
      sourceType: sourceMembre ? "member_salary" : f.source === "salary" ? "salary" : "external",
      sourceId: sourceMembre ? memberId(sourceMembre) : null,
      targetType: type,
      targetId,
      amount: f.amount,
      frequency: f.frequency,
      dueDay: jour,
      // Le foyer d'exemple partage ses dépenses : c'est le cas d'usage à montrer.
      shared: type === "expense",
      memberId: memberId(f.member),
      createdAt: new Date(debut.getFullYear(), debut.getMonth(), Math.min(jour, dernier)),
    };
  });
}

/**
 * La disposition n'est pas imposée : sans valeur, l'interface choisit selon la
 * largeur de l'écran — de gauche à droite sur un poste, de haut en bas sur un
 * téléphone, où une lecture en colonnes ne tient pas. Forcer « horizontal »
 * ici enfermait la démonstration dans la lecture large sur tous les écrans.
 */
export function demoSettings(): Record<string, string> {
  return { ...DEMO_SETTINGS };
}

/**
 * Historique du patrimoine : une courbe calculée, pas tirée au sort — elle doit
 * être identique d'un rechargement à l'autre, sinon le graphe sautille sous les
 * yeux du prospect. La progression mêle une tendance et une ondulation, pour
 * ressembler à des marchés plutôt qu'à une droite.
 */
export function demoSnapshots(maintenant = new Date()) {
  const out: { id: number; date: string; totalValue: string; totalDebt: string; netWorth: string; createdAt: Date }[] = [];
  for (let i = MOIS_HISTOIRE; i >= 0; i--) {
    const d = new Date(maintenant.getFullYear(), maintenant.getMonth() - i, 1);
    const t = (MOIS_HISTOIRE - i) / MOIS_HISTOIRE;
    // On arrondit avant de soustraire : sinon le net calculé en pleine
    // précision diffère d'un centime de la différence des deux montants
    // affichés, et l'écran donne deux totaux qui ne se recoupent pas.
    const brut = Math.round((402_000 + 83_000 * t + 11_000 * Math.sin(t * 7)) * 100) / 100;
    const dette = Math.round((196_000 - 8_600 * t) * 100) / 100;
    out.push({
      id: MOIS_HISTOIRE - i + 1,
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`,
      totalValue: brut.toFixed(2),
      totalDebt: dette.toFixed(2),
      netWorth: (brut - dette).toFixed(2),
      createdAt: d,
    });
  }
  return out;
}

/**
 * Échéances de la démonstration, avec leur pointage.
 *
 * Tout ce qui précède le mois courant est déjà vérifié : c'est un foyer qui
 * tient ses comptes. Le mois courant est laissé en partie à faire, pour que le
 * prospect voie le travail qui l'attend — et la pastille sur la planète.
 */
export function demoOccurrences(maintenant = new Date()) {
  const flows = demoFlows(maintenant) as unknown as FlowLike[];
  const debut = new Date(maintenant.getFullYear(), maintenant.getMonth() - 3, 1);
  const groupes = upcomingByMonth(flows, 7, debut);
  const moisCourant = `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, "0")}`;

  const out: {
    id: number; flowId: number; dueDate: string; expectedAmount: string;
    actualAmount: string | null; status: string; note: string | null; confirmedAt: Date | null;
  }[] = [];
  let id = 1;
  for (const g of groupes) {
    for (const o of g.occurrences) {
      const jour = `${o.date.getFullYear()}-${String(o.date.getMonth() + 1).padStart(2, "0")}-${String(o.date.getDate()).padStart(2, "0")}`;
      const passe = jour < moisCourant;
      const echu = o.date <= maintenant;
      // Un écart de temps en temps, pour que la colonne « écart » ait un sens.
      const decale = passe && id % 7 === 0;
      const confirme = passe || (echu && id % 3 !== 0);
      out.push({
        id: id++,
        flowId: o.flowId,
        dueDate: jour,
        expectedAmount: String(o.amount),
        actualAmount: confirme ? (decale ? (o.amount * 1.08).toFixed(2) : String(o.amount)) : null,
        status: confirme ? "confirmed" : "pending",
        note: null,
        confirmedAt: confirme ? o.date : null,
      });
    }
  }
  return out;
}

export function demoOverdue(maintenant = new Date()): number {
  const jour = `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, "0")}-${String(maintenant.getDate()).padStart(2, "0")}`;
  return demoOccurrences(maintenant).filter((o) => o.status === "pending" && o.dueDate <= jour).length;
}

/**
 * Règle du foyer de la démonstration : moitié-moitié entre Alex et Camille.
 * C'est le cas d'usage que la démonstration doit montrer — l'appartement est
 * déjà détenu 50/50, les dépenses le sont aussi.
 */
export function demoExpenseShares() {
  return [
    { id: 1, flowId: null, memberId: null, sharePercent: "50", createdAt: origine(new Date()) },
    { id: 2, flowId: null, memberId: memberId("camille"), sharePercent: "50", createdAt: origine(new Date()) },
  ];
}
