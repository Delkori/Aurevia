import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  convert,
  costBasis,
  currentValue,
  gain,
  gainPercent,
  goalProgress,
  isStale,
  normalizeQuoteCurrency,
  ownedShare,
  totalDebt,
  type ValuationContext,
} from "../src/lib/networth.ts";

// Convention BCE : « 1 EUR = X devises ».
const RATES = { EUR: 1, USD: 1.08, GBP: 0.86, CHF: 0.97 };
const inEur: ValuationContext = { rates: RATES, displayCurrency: "EUR" };
const inUsd: ValuationContext = { rates: RATES, displayCurrency: "USD" };

const stock = (over: Record<string, unknown> = {}) => ({
  type: "stock",
  ticker: "AAPL",
  quantity: "10",
  avgBuyPrice: "100",
  manualValue: null,
  currency: "USD",
  ...over,
});

describe("convert", () => {
  test("laisse le montant intact quand les devises sont identiques", () => {
    assert.equal(convert(100, "EUR", "EUR", RATES), 100);
  });

  test("passe par l'euro dans les deux sens", () => {
    assert.equal(convert(108, "USD", "EUR", RATES), 100);
    assert.equal(convert(100, "EUR", "USD", RATES), 108);
  });

  test("croise deux devises non-euro", () => {
    // 108 USD = 100 EUR = 86 GBP
    assert.equal(Math.round(convert(108, "USD", "GBP", RATES)), 86);
  });

  test("laisse le montant intact plutôt que de l'effacer si un taux manque", () => {
    assert.equal(convert(100, "JPY", "EUR", RATES), 100);
    assert.equal(convert(100, "EUR", "XYZ", RATES), 100);
  });
});

describe("normalizeQuoteCurrency", () => {
  test("ramène les pence de Londres en livres", () => {
    assert.deepEqual(normalizeQuoteCurrency(250, "GBp"), { price: 2.5, currency: "GBP" });
    assert.deepEqual(normalizeQuoteCurrency(250, "GBX"), { price: 2.5, currency: "GBP" });
  });

  test("laisse une devise normale telle quelle", () => {
    assert.deepEqual(normalizeQuoteCurrency(250, "USD"), { price: 250, currency: "USD" });
  });
});

describe("currentValue", () => {
  test("convertit la devise du cours, pas celle saisie sur la ligne", () => {
    // 10 titres à 200 USD = 2000 USD = 1851,85 EUR
    const v = currentValue(stock(), { price: 200, currency: "USD" }, inEur);
    assert.equal(Math.round(v), 1852);
  });

  test("une action cotée en USD n'est plus comptée comme des euros", () => {
    const sansConversion = currentValue(stock(), { price: 200, currency: "USD" });
    const avecConversion = currentValue(stock(), { price: 200, currency: "USD" }, inEur);
    assert.equal(sansConversion, 2000);
    assert.notEqual(Math.round(avecConversion), 2000);
  });

  test("redresse une cotation en pence", () => {
    const lse = stock({ ticker: "SHEL.L", quantity: "100", currency: "GBP" });
    // 100 titres à 2500 pence = 2500 GBP = 2906,98 EUR
    const v = currentValue(lse, { price: 2500, currency: "GBp" }, inEur);
    assert.equal(Math.round(v), 2907);
  });

  test("retombe sur le prix de revient quand le cours manque", () => {
    const v = currentValue(stock(), null, inEur);
    // 10 × 100 USD = 1000 USD = 925,93 EUR
    assert.equal(Math.round(v), 926);
  });

  test("valorise un actif manuel dans sa propre devise", () => {
    const bien = {
      type: "real_estate",
      ticker: null,
      quantity: null,
      avgBuyPrice: null,
      manualValue: "300000",
      currency: "CHF",
    };
    assert.equal(Math.round(currentValue(bien, null, inEur)), 309278);
  });

  test("respecte la devise d'affichage choisie", () => {
    const v = currentValue(stock(), { price: 200, currency: "USD" }, inUsd);
    assert.equal(v, 2000);
  });
});

describe("isStale", () => {
  test("signale un actif coté dont le cours a échoué", () => {
    assert.equal(isStale(stock(), null), true);
    assert.equal(isStale(stock(), { price: 200, currency: "USD" }), false);
  });

  test("un actif manuel n'est jamais périmé", () => {
    const cash = {
      type: "cash",
      ticker: null,
      quantity: null,
      avgBuyPrice: null,
      manualValue: "5000",
      currency: "EUR",
    };
    assert.equal(isStale(cash, null), false);
  });
});

describe("gain", () => {
  test("compare valeur et coût dans la même devise", () => {
    const a = stock(); // 10 × 100 USD de coût
    const g = gain(a, { price: 150, currency: "USD" }, inEur);
    // (1500 - 1000) USD = 500 USD = 462,96 EUR
    assert.equal(Math.round(g), 463);
    assert.equal(Math.round(gainPercent(a, { price: 150, currency: "USD" }, inEur)), 50);
  });

  test("un pourcentage de plus-value ne dépend pas de la devise d'affichage", () => {
    const a = stock();
    const q = { price: 150, currency: "USD" };
    assert.equal(
      Math.round(gainPercent(a, q, inEur)),
      Math.round(gainPercent(a, q, inUsd))
    );
  });

  test("coût nul ne produit pas une division par zéro", () => {
    const a = stock({ avgBuyPrice: "0" });
    assert.equal(gainPercent(a, { price: 150, currency: "USD" }, inEur), 0);
    assert.equal(costBasis(a, inEur), 0);
  });
});

describe("totalDebt", () => {
  test("additionne des crédits libellés dans des devises différentes", () => {
    const total = totalDebt(
      [
        { remainingBalance: "100000", currency: "EUR" },
        { remainingBalance: "108000", currency: "USD" }, // = 100 000 EUR
      ],
      inEur
    );
    assert.equal(Math.round(total), 200000);
  });
});

describe("ownedShare", () => {
  const P = 1;

  test("sans quote-part, tout revient au propriétaire déclaré", () => {
    assert.equal(ownedShare(P, 7, 7, []), 1);
    assert.equal(ownedShare(P, 7, null, []), 0);
    assert.equal(ownedShare(P, null, null, []), 1);
  });

  test("les quotes-parts font foi dès qu'il en existe une", () => {
    const rows = [
      { portfolioId: P, memberId: null, sharePercent: "50" },
      { portfolioId: P, memberId: 7, sharePercent: "50" },
    ];
    assert.equal(ownedShare(P, null, null, rows), 0.5);
    assert.equal(ownedShare(P, null, 7, rows), 0.5);
  });

  test("un membre absent de la répartition ne détient rien, même s'il est propriétaire déclaré", () => {
    const rows = [{ portfolioId: P, memberId: 7, sharePercent: "100" }];
    assert.equal(ownedShare(P, null, null, rows), 0);
    assert.equal(ownedShare(P, null, 7, rows), 1);
  });

  test("ignore les quotes-parts d'un autre portefeuille", () => {
    const rows = [{ portfolioId: 2, memberId: 7, sharePercent: "100" }];
    assert.equal(ownedShare(P, 7, 7, rows), 1);
  });

  test("les actifs sans planète reviennent à « Moi »", () => {
    assert.equal(ownedShare("unassigned", null, null, []), 1);
    assert.equal(ownedShare("unassigned", null, 7, []), 0);
  });

  test("une répartition partielle reste partielle — aucun rattrapage implicite", () => {
    const rows = [{ portfolioId: P, memberId: null, sharePercent: "30" }];
    assert.equal(ownedShare(P, null, null, rows), 0.3);
  });
});

describe("goalProgress", () => {
  const goal = { id: 1, targetAmount: "100000" };
  const totals: Record<number, number> = { 10: 30000, 11: 25000, 12: 900000 };
  const totalOf = (id: number) => totals[id] ?? 0;

  test("somme uniquement les planètes reliées à cet objectif", () => {
    const links = [
      { goalId: 1, portfolioId: 10 },
      { goalId: 1, portfolioId: 11 },
      { goalId: 2, portfolioId: 12 }, // un autre objectif : ne doit pas compter
    ];
    assert.equal(goalProgress(goal, links, totalOf), 0.55);
  });

  test("régression : un objectif n'est pas mesuré contre le patrimoine entier", () => {
    // Le panneau « Vue d'ensemble » comparait chaque objectif au patrimoine net,
    // donc affichait 100 % partout dès que le patrimoine dépassait la cible.
    const links = [{ goalId: 1, portfolioId: 10 }];
    assert.equal(goalProgress(goal, links, totalOf), 0.3);
  });

  test("sans planète reliée, la progression est nulle", () => {
    assert.equal(goalProgress(goal, [], totalOf), 0);
    assert.equal(goalProgress(goal, [{ goalId: 2, portfolioId: 10 }], totalOf), 0);
  });

  test("plafonne à 100 %", () => {
    const links = [{ goalId: 1, portfolioId: 12 }];
    assert.equal(goalProgress(goal, links, totalOf), 1);
  });

  test("une cible nulle ou absurde ne donne pas 100 %", () => {
    const links = [{ goalId: 1, portfolioId: 10 }];
    assert.equal(goalProgress({ id: 1, targetAmount: "0" }, links, totalOf), 0);
    assert.equal(goalProgress({ id: 1, targetAmount: "" }, links, totalOf), 0);
    assert.equal(goalProgress({ id: 1, targetAmount: "-5" }, links, totalOf), 0);
  });
});
