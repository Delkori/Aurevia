import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  partDe, repartition, reglePartEgales, totalPour,
  type PartLike,
} from "../src/lib/expenseShares.ts";

const flux = (over: Partial<{ id: number; shared: boolean; memberId: number | null }> = {}) => ({
  id: 1, shared: false, memberId: null, ...over,
});
/** Règle du foyer : moitié-moitié entre « Moi » et Camille (membre 1). */
const REGLE: PartLike[] = [
  { flowId: null, memberId: null, sharePercent: 50 },
  { flowId: null, memberId: 1, sharePercent: 50 },
];
const somme = (m: Map<number | null, number>) => [...m.values()].reduce((a, b) => a + b, 0);

describe("dépense personnelle", () => {
  test("revient entière à son porteur", () => {
    assert.deepEqual([...repartition(flux({ memberId: 1 }), REGLE)], [[1, 1]]);
  });

  test("la règle du foyer ne s'y applique pas", () => {
    // C'est tout l'intérêt de la case : un abonnement à soi reste à soi.
    assert.equal(partDe(flux({ memberId: 1 }), REGLE, null), 0);
  });

  test("sans membre, elle revient au propriétaire", () => {
    assert.deepEqual([...repartition(flux({ memberId: null }), REGLE)], [[null, 1]]);
  });
});

describe("dépense commune", () => {
  test("suit la règle du foyer", () => {
    const r = repartition(flux({ shared: true, memberId: null }), REGLE);
    assert.equal(r.get(null), 0.5);
    assert.equal(r.get(1), 0.5);
  });

  test("une part propre à la dépense l'emporte sur la règle", () => {
    const parts: PartLike[] = [
      ...REGLE,
      { flowId: 1, memberId: null, sharePercent: 70 },
      { flowId: 1, memberId: 1, sharePercent: 30 },
    ];
    const r = repartition(flux({ shared: true }), parts);
    assert.equal(r.get(null), 0.7);
    assert.equal(r.get(1), 0.3);
  });

  test("l'exception d'une dépense ne déteint pas sur les autres", () => {
    const parts: PartLike[] = [
      ...REGLE,
      { flowId: 2, memberId: null, sharePercent: 90 },
      { flowId: 2, memberId: 1, sharePercent: 10 },
    ];
    assert.equal(partDe(flux({ id: 1, shared: true }), parts, null), 0.5);
    assert.equal(partDe(flux({ id: 2, shared: true }), parts, null), 0.9);
  });

  test("déclarée commune sans aucune règle posée, rien ne se perd", () => {
    // Le montant doit rester quelque part : le faire disparaître du budget
    // serait pire que de le laisser sur son porteur d'origine.
    const r = repartition(flux({ shared: true, memberId: 1 }), []);
    assert.deepEqual([...r], [[1, 1]]);
    assert.equal(somme(r), 1);
  });
});

describe("robustesse des pourcentages", () => {
  test("des parts qui ne font pas 100 sont ramenées au prorata", () => {
    const parts: PartLike[] = [
      { flowId: 1, memberId: null, sharePercent: 1 },
      { flowId: 1, memberId: 1, sharePercent: 2 },
    ];
    const r = repartition(flux({ shared: true }), parts);
    assert.ok(Math.abs(r.get(null)! - 1 / 3) < 1e-9);
    assert.ok(Math.abs(r.get(1)! - 2 / 3) < 1e-9);
  });

  test("la somme des fractions vaut toujours 1", () => {
    for (const parts of [REGLE,
      [{ flowId: null, memberId: null, sharePercent: "33" }, { flowId: null, memberId: 1, sharePercent: "67" }],
      [{ flowId: null, memberId: null, sharePercent: 99 }, { flowId: null, memberId: 1, sharePercent: 1 }],
    ] as PartLike[][]) {
      assert.ok(Math.abs(somme(repartition(flux({ shared: true }), parts)) - 1) < 1e-9);
    }
  });

  test("parts nulles, négatives ou illisibles : on retombe sur le porteur", () => {
    for (const mauvais of [0, -50, "abc", null]) {
      const parts = [{ flowId: null, memberId: null, sharePercent: mauvais as never }];
      const r = repartition(flux({ shared: true, memberId: 1 }), parts);
      assert.deepEqual([...r], [[1, 1]], `sharePercent=${JSON.stringify(mauvais)}`);
    }
  });

  test("deux parts pour la même personne s'additionnent", () => {
    const parts: PartLike[] = [
      { flowId: 1, memberId: 1, sharePercent: 25 },
      { flowId: 1, memberId: 1, sharePercent: 25 },
      { flowId: 1, memberId: null, sharePercent: 50 },
    ];
    const r = repartition(flux({ shared: true }), parts);
    assert.equal(r.get(1), 0.5);
    assert.equal(somme(r), 1);
  });
});

describe("totaux par personne", () => {
  const mensuel = (f: { amount: string | number }) => Number(f.amount);

  test("un loyer commun se partage, une dépense perso ne bouge pas", () => {
    const flows = [
      { id: 1, shared: true, memberId: null, amount: "1150" },   // loyer commun
      { id: 2, shared: false, memberId: 1, amount: "380" },      // crèche, à Camille
    ];
    assert.equal(totalPour(flows, REGLE, null, mensuel), 575);
    assert.equal(totalPour(flows, REGLE, 1, mensuel), 575 + 380);
  });

  test("rien ne se perd ni ne se crée : la somme des parts fait le total", () => {
    const flows = [
      { id: 1, shared: true, memberId: null, amount: "1150" },
      { id: 2, shared: true, memberId: null, amount: "620" },
      { id: 3, shared: false, memberId: 1, amount: "380" },
    ];
    const total = flows.reduce((s, f) => s + Number(f.amount), 0);
    const reparti = totalPour(flows, REGLE, null, mensuel) + totalPour(flows, REGLE, 1, mensuel);
    assert.ok(Math.abs(reparti - total) < 1e-9, `${reparti} ≠ ${total}`);
  });
});

describe("règle par défaut", () => {
  test("parts égales entre le propriétaire et les membres qui gagnent leur vie", () => {
    const r = reglePartEgales([
      { id: 1, salary: "2450" },
      { id: 2, salary: null },     // un enfant ne porte pas le loyer
    ]);
    assert.deepEqual(r, [{ memberId: null, sharePercent: 50 }, { memberId: 1, sharePercent: 50 }]);
  });

  test("seul, on porte tout", () => {
    assert.deepEqual(reglePartEgales([]), [{ memberId: null, sharePercent: 100 }]);
  });

  test("à trois adultes, les parts restent égales et somment à 100", () => {
    const r = reglePartEgales([{ id: 1, salary: "2000" }, { id: 2, salary: "1800" }]);
    assert.equal(r.length, 3);
    assert.ok(Math.abs(r.reduce((s, p) => s + p.sharePercent, 0) - 100) < 0.05);
  });
});
