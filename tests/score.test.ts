import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { scoreDeStructure, PART_MAX } from "../src/lib/score.ts";

const foyer = {
  brut: 493485, dette: 187400, revenus: 3320, depenses: 2500,
  planetes: [
    { total: 340000, skin: "terrain" }, { total: 66300, skin: "ocean" }, { total: 32628, skin: "crypto" },
    { total: 31497, skin: "ocean" }, { total: 10512, skin: "tech" }, { total: 8248, skin: "ocean" }, { total: 4300, skin: "ocean" },
  ],
};

describe("score de structure", () => {
  test("sans actifs, pas de score", () => {
    assert.equal(scoreDeStructure({ ...foyer, brut: 0 }), null);
  });

  test("le foyer d'exemple fait 66 — le chiffre de la barre latérale", () => {
    const s = scoreDeStructure(foyer)!;
    assert.equal(s.total, 66);
    // Le total est l'arrondi de la somme des parts, pas la somme des arrondis.
    const somme = s.parts.epargne + s.parts.diversification + s.parts.dette + s.parts.concentration;
    assert.equal(Math.round(somme), s.total);
  });

  test("chaque part est bornée à vingt-cinq", () => {
    const s = scoreDeStructure({
      brut: 100000, dette: 0, revenus: 5000, depenses: 1000,
      planetes: [
        { total: 20000, skin: "a" }, { total: 20000, skin: "b" }, { total: 20000, skin: "c" },
        { total: 20000, skin: "d" }, { total: 20000, skin: "e" }, { total: 0, skin: "f" },
      ],
    })!;
    assert.deepEqual(s.parts, { epargne: PART_MAX, diversification: PART_MAX, dette: PART_MAX, concentration: PART_MAX });
    assert.equal(s.total, 100);
  });

  test("une planète vide ne compte pas dans la diversification", () => {
    const avec = scoreDeStructure({ ...foyer, planetes: [{ total: 1000, skin: "ocean" }, { total: 0, skin: "tech" }] })!;
    assert.equal(avec.parts.diversification, 6);
  });

  test("sans revenus déclarés, l'épargne vaut la moitié plutôt que zéro", () => {
    assert.equal(scoreDeStructure({ ...foyer, revenus: 0 })!.parts.epargne, PART_MAX / 2);
  });

  test("tout sur une seule planète met la concentration à zéro", () => {
    const s = scoreDeStructure({ ...foyer, planetes: [{ total: foyer.brut, skin: "terrain" }] })!;
    assert.equal(s.parts.concentration, 0);
  });
});
