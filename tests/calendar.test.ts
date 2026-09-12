import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { directionOf, upcomingByMonth, type FlowLike } from "../src/lib/calendar.ts";

const NOW = new Date(2026, 8, 12); // 12 septembre 2026

const flux = (over: Partial<FlowLike> = {}): FlowLike => ({
  id: 1,
  name: "Versement PEA",
  amount: "600",
  frequency: "monthly",
  createdAt: new Date(2026, 0, 5).toISOString(),
  sourceType: "salary",
  targetType: "portfolio",
  targetId: 1,
  ...over,
});

describe("direction", () => {
  test("distingue entrée, épargne et sortie", () => {
    assert.equal(directionOf(flux({ targetType: "income" })), "entree");
    assert.equal(directionOf(flux({ targetType: "expense" })), "sortie");
    assert.equal(directionOf(flux({ targetType: "portfolio" })), "epargne");
    assert.equal(directionOf(flux({ targetType: "goal" })), "epargne");
  });
});

describe("groupement par mois", () => {
  test("un flux mensuel donne une occurrence par mois", () => {
    const g = upcomingByMonth([flux()], 4, NOW);
    assert.ok(g.length >= 3 && g.length <= 4, `${g.length} mois`);
    for (const mois of g) assert.equal(mois.occurrences.length, 1);
  });

  test("les mois sont dans l'ordre chronologique et nommés en français", () => {
    const g = upcomingByMonth([flux()], 4, NOW);
    const cles = g.map(m => m.cle);
    assert.deepEqual([...cles].sort(), cles);
    assert.match(g[0].label, /(septembre|octobre) 2026/);
  });

  test("un flux annuel n'apparaît que dans son mois", () => {
    const annuel = flux({ frequency: "yearly", createdAt: new Date(2025, 10, 20).toISOString(), name: "Prime" });
    const g = upcomingByMonth([annuel], 6, NOW);
    const avec = g.filter(m => m.occurrences.length > 0);
    assert.equal(avec.length, 1, "une seule échéance sur 6 mois");
    assert.match(avec[0].label, /novembre 2026/);
  });

  test("un flux quotidien est cumulé par mois, pas énuméré jour par jour", () => {
    const quotidien = flux({ frequency: "daily", amount: "10", name: "Café" });
    const g = upcomingByMonth([quotidien], 3, NOW);
    for (const mois of g) {
      assert.equal(mois.occurrences.length, 1, `${mois.label} : une ligne cumulée`);
      assert.match(mois.occurrences[0].label, /quotidien/);
      // 28 à 31 jours × 10 €
      assert.ok(mois.occurrences[0].amount >= 280 && mois.occurrences[0].amount <= 310);
    }
  });

  test("un flux hebdomadaire donne quatre ou cinq occurrences par mois", () => {
    const hebdo = flux({ frequency: "weekly", amount: "25" });
    const g = upcomingByMonth([hebdo], 3, NOW);
    const plein = g[1];
    assert.ok(plein.occurrences.length >= 4 && plein.occurrences.length <= 5, `${plein.occurrences.length}`);
  });
});

describe("totaux par mois", () => {
  test("séparent entrées, épargne et sorties", () => {
    const g = upcomingByMonth([
      flux({ id: 1, amount: "600", targetType: "portfolio" }),
      flux({ id: 2, amount: "1150", targetType: "expense", name: "Loyer" }),
      flux({ id: 3, amount: "120", targetType: "income", name: "Loyer SCPI" }),
    ], 3, NOW);
    const mois = g.find(m => m.occurrences.length === 3)!;
    assert.equal(mois.epargne, 600);
    assert.equal(mois.sorties, 1150);
    assert.equal(mois.entrees, 120);
  });
});

describe("robustesse", () => {
  test("un montant illisible est ignoré plutôt que de propager un NaN", () => {
    const g = upcomingByMonth([flux({ amount: "beaucoup" })], 3, NOW);
    assert.equal(g.length, 0);
  });

  test("une date de création invalide n'arrête pas le calendrier", () => {
    const g = upcomingByMonth([flux({ createdAt: "pas une date" }), flux({ id: 2 })], 3, NOW);
    for (const mois of g) assert.equal(mois.occurrences.length, 1);
  });

  test("aucun flux, aucun mois", () => {
    assert.deepEqual(upcomingByMonth([], 6, NOW), []);
  });

  test("chaque occurrence a une clé unique", () => {
    const g = upcomingByMonth([flux({ id: 1 }), flux({ id: 2, name: "CTO" })], 6, NOW);
    const cles = g.flatMap(m => m.occurrences.map(o => o.key));
    assert.equal(new Set(cles).size, cles.length);
  });
});

describe("échéances passées", () => {
  // Le pointage porte d'abord sur ce qui a DÉJÀ eu lieu : le prélèvement du 6
  // qu'on veut vérifier. La première version partait de `nextOccurrenceDate`,
  // qui ne renvoie que du futur — aucune échéance passée n'existait.
  test("une fenêtre qui commence dans le passé contient les échéances passées", () => {
    const debut = new Date(2026, 5, 1); // juin 2026
    const g = upcomingByMonth([flux({ createdAt: new Date(2026, 0, 6).toISOString() })], 4, debut);
    assert.ok(g.length >= 3, `${g.length} mois`);
    assert.match(g[0].label, /juin 2026/);
    assert.equal(g[0].occurrences[0].date.getDate(), 6, "le jour du mois est conservé");
  });

  test("un flux créé après la fenêtre ne produit rien", () => {
    const g = upcomingByMonth([flux({ createdAt: new Date(2027, 5, 1).toISOString() })], 3, NOW);
    assert.deepEqual(g, []);
  });

  test("un flux ponctuel n'apparaît qu'une fois, à sa date", () => {
    const ponctuel = flux({ frequency: "once", createdAt: new Date(2026, 8, 20).toISOString(), name: "Prime" });
    const g = upcomingByMonth([ponctuel], 6, NOW);
    const total = g.reduce((n, m) => n + m.occurrences.length, 0);
    assert.equal(total, 1);
    assert.match(g[0].label, /septembre 2026/);
  });

  test("un flux hebdomadaire ancien ne fait pas boucler le calcul", () => {
    const vieux = flux({ frequency: "weekly", createdAt: new Date(2015, 0, 1).toISOString() });
    const g = upcomingByMonth([vieux], 2, NOW);
    const total = g.reduce((n, m) => n + m.occurrences.length, 0);
    assert.ok(total >= 8 && total <= 10, `${total} occurrences`);
  });
});
