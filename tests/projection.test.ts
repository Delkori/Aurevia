import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  monthlyRateFromAnnual,
  monthsToReach,
  projectNetWorth,
} from "../src/lib/projection.ts";
import { daysUntilNextOccurrence, nextOccurrenceDate } from "../src/lib/dates.ts";

describe("monthlyRateFromAnnual", () => {
  test("12 mois de taux mensuel composé redonnent le taux annuel", () => {
    const r = monthlyRateFromAnnual(7);
    assert.ok(Math.abs((1 + r) ** 12 - 1.07) < 1e-12);
  });

  test("un rendement nul reste nul", () => {
    assert.equal(monthlyRateFromAnnual(0), 0);
  });
});

describe("projectNetWorth", () => {
  test("part de la valeur actuelle au mois 0", () => {
    const pts = projectNetWorth(10000, 500, 5, 12);
    assert.equal(pts[0].value, 10000);
    assert.equal(pts[0].contributed, 0);
    assert.equal(pts.length, 13);
  });

  test("sans rendement, la croissance est exactement la somme des versements", () => {
    const pts = projectNetWorth(1000, 100, 0, 10);
    assert.equal(pts[10].value, 2000);
    assert.equal(pts[10].contributed, 1000);
  });

  test("le rendement fait dépasser la somme des versements", () => {
    const pts = projectNetWorth(1000, 100, 8, 120);
    assert.ok(pts[120].value > 1000 + pts[120].contributed);
  });
});

describe("monthsToReach", () => {
  test("renvoie 0 si l'objectif est déjà atteint", () => {
    assert.equal(monthsToReach(5000, 100, 5, 5000), 0);
    assert.equal(monthsToReach(6000, 100, 5, 5000), 0);
  });

  test("compte les mois sans rendement", () => {
    assert.equal(monthsToReach(0, 100, 0, 1000), 10);
  });

  test("renvoie null si l'objectif est hors de portée", () => {
    assert.equal(monthsToReach(0, 0, 0, 1000), null);
  });

  test("un rendement plus élevé ne peut pas rallonger le délai", () => {
    const lent = monthsToReach(1000, 200, 2, 50000)!;
    const rapide = monthsToReach(1000, 200, 9, 50000)!;
    assert.ok(rapide <= lent);
  });
});

describe("daysUntilNextOccurrence", () => {
  test("une échéance mensuelle tombe dans moins de 32 jours", () => {
    const old = new Date(Date.now() - 400 * 86400000).toISOString();
    const d = daysUntilNextOccurrence(old, "monthly");
    assert.ok(d >= 0 && d <= 32, `attendu 0..32, reçu ${d}`);
  });

  test("une échéance hebdomadaire tombe dans moins de 8 jours", () => {
    const old = new Date(Date.now() - 400 * 86400000).toISOString();
    const d = daysUntilNextOccurrence(old, "weekly");
    assert.ok(d >= 0 && d <= 8, `attendu 0..8, reçu ${d}`);
  });

  test("une date invalide ne fait pas planter l'affichage", () => {
    assert.ok(Number.isNaN(daysUntilNextOccurrence("pas une date", "monthly")));
    assert.equal(nextOccurrenceDate("pas une date", "monthly"), null);
  });

  test("la prochaine occurrence est toujours dans le futur", () => {
    const old = new Date(Date.now() - 900 * 86400000).toISOString();
    for (const freq of ["daily", "weekly", "monthly", "yearly"]) {
      const next = nextOccurrenceDate(old, freq)!;
      assert.ok(next.getTime() > Date.now(), `${freq} : ${next.toISOString()}`);
    }
  });
});
