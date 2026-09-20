import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { bilanDuTour, instantaneDeReference, nomDuMois } from "../src/lib/finDeTour.ts";

const SEPT = new Date(2026, 8, 1);

describe("instantané de référence", () => {
  const inst = [
    { date: "2026-07-01", totalValue: "290000" },
    { date: "2026-08-30", totalValue: "297000" },
    { date: "2026-09-02", totalValue: "298000" },
    { date: "2026-09-16", totalValue: "306085" },
  ];

  test("le dernier d'avant le mois pointé, jamais un du mois lui-même", () => {
    assert.equal(instantaneDeReference(inst, SEPT)?.date, "2026-08-30");
  });

  test("sans instantané antérieur, il n'y a pas de point de départ", () => {
    assert.equal(instantaneDeReference(inst.slice(2), SEPT), null);
    assert.equal(instantaneDeReference([], SEPT), null);
  });

  test("l'ordre du tableau ne compte pas", () => {
    assert.equal(instantaneDeReference([...inst].reverse(), SEPT)?.date, "2026-08-30");
  });
});

describe("bilan du tour", () => {
  const base = {
    mois: SEPT,
    pointes: 9,
    patrimoineNet: 306085,
    instantanes: [{ date: "2026-08-30", totalValue: "297000" }],
    projets: [{ id: 1, nom: "Apport résidence principale", progression: 0.82 }],
    planetes: [
      { id: 1, nom: "PEA · Alex", valeur: 31497, plafond: 45000 },
      { id: 3, nom: "Crypto", valeur: 32628, plafond: null },
    ],
    memoire: { goalProgress: { "1": 0.81 }, portfolioValues: { "1": 36000 } },
    score: { total: 66, parts: { epargne: 15.4, diversification: 18, dette: 15.5, concentration: 17.2 } },
  };

  test("nomme le mois en français", () => {
    assert.equal(nomDuMois(SEPT), "septembre 2026");
    assert.equal(nomDuMois(new Date(2027, 0, 15)), "janvier 2027");
  });

  test("réunit ce qui a bougé pendant le tour", () => {
    const b = bilanDuTour(base);
    assert.equal(b.mois, "septembre 2026");
    assert.equal(b.pointes, 9);
    assert.deepEqual(b.patrimoine, { apres: 306085, avant: 297000, depuis: "2026-08-30" });
    assert.deepEqual(b.projets, [{ id: 1, nom: "Apport résidence principale", avant: 0.81, apres: 0.82 }]);
    assert.equal(b.score?.total, 66);
  });

  test("une planète sans plafond n'a pas de ligne, une planète en baisse montre ses segments perdus", () => {
    const b = bilanDuTour(base);
    assert.equal(b.planetes.length, 1);
    // 36 000 / 45 000 = 8 segments avant ; 31 497 / 45 000 = 6 aujourd'hui.
    assert.deepEqual(b.planetes[0], { id: 1, nom: "PEA · Alex", pleinsAvant: 8, pleins: 6, pleine: false, pourcentage: "69 %" });
  });

  test("sans mémoire ni instantané, le bilan ne compare à rien plutôt qu'à zéro", () => {
    const b = bilanDuTour({ ...base, instantanes: [], memoire: null });
    assert.equal(b.patrimoine.avant, null);
    assert.equal(b.projets[0].avant, null);
    assert.equal(b.planetes[0].pleinsAvant, null);
  });
});
