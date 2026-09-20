import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { situationDuFoyer, ERES } from "../src/lib/eres.ts";

const fmt = (v: number) => `${Math.round(v)} €`;

/** Le foyer d'exemple : Royaume, en route vers l'Empire. */
const EXEMPLE = {
  epargneDisponible: 68000, depensesMensuelles: 2500, versementProgramme: true,
  patrimoineNet: 306085, revenusMensuels: 5770, natures: 3, revenusPassifs: 220,
};

describe("les ères se constatent", () => {
  test("sans dépenses déclarées, rien ne se mesure", () => {
    const s = situationDuFoyer({ ...EXEMPLE, depensesMensuelles: 0 }, fmt);
    assert.equal(s.ere.numero, 1);
    assert.match(s.manque[0], /Déclare tes dépenses/);
  });

  test("le foyer d'exemple est au Royaume, et il lui manque des revenus passifs pour l'Empire", () => {
    const s = situationDuFoyer(EXEMPLE, fmt);
    assert.equal(s.ere.nom, "Royaume");
    assert.equal(s.prochaine?.nom, "Empire");
    // Un quart de 2 500 € = 625 € ; 220 € de passifs → il manque 405 €.
    assert.deepEqual(s.manque, ["≈ 405 €/mois de revenus passifs — un quart des dépenses"]);
  });

  test("un campement : moins d'un mois de côté", () => {
    const s = situationDuFoyer({ ...EXEMPLE, epargneDisponible: 1200 }, fmt);
    assert.equal(s.ere.numero, 1);
    assert.equal(s.prochaine?.nom, "Village");
    assert.deepEqual(s.manque, ["1300 € d'épargne disponible en plus — un mois de dépenses"]);
  });

  test("un village qui n'a pas encore programmé d'épargne reste un village", () => {
    const s = situationDuFoyer({ ...EXEMPLE, epargneDisponible: 9000, versementProgramme: false }, fmt);
    assert.equal(s.ere.nom, "Village");
    // Deux manques à la fois : on les dit tous les deux.
    assert.equal(s.manque.length, 1);
    assert.match(s.manque[0], /versement mensuel programmé/);
  });

  test("on peut redescendre : le matelas fond, l'ère aussi", () => {
    assert.equal(situationDuFoyer(EXEMPLE, fmt).ere.numero, 4);
    assert.equal(situationDuFoyer({ ...EXEMPLE, epargneDisponible: 6000 }, fmt).ere.numero, 2);
  });

  test("une seule nature bloque le Royaume, même riche", () => {
    const s = situationDuFoyer({ ...EXEMPLE, natures: 1 }, fmt);
    assert.equal(s.ere.nom, "Cité");
    assert.deepEqual(s.manque, ["une deuxième nature de placement — épargne, marchés ou immobilier"]);
  });

  test("l'Indépendance est la dernière ère : plus rien ne manque", () => {
    const s = situationDuFoyer({ ...EXEMPLE, revenusPassifs: 2600 }, fmt);
    assert.equal(s.ere.nom, "Indépendance");
    assert.equal(s.prochaine, null);
    assert.deepEqual(s.manque, []);
  });

  test("l'Empire dit ce qui sépare de l'Indépendance", () => {
    const s = situationDuFoyer({ ...EXEMPLE, revenusPassifs: 700 }, fmt);
    assert.equal(s.ere.nom, "Empire");
    assert.deepEqual(s.manque, ["≈ 1800 €/mois de revenus passifs — la totalité des dépenses"]);
  });

  test("six ères, numérotées dans l'ordre", () => {
    assert.deepEqual(ERES.map(e => e.numero), [1, 2, 3, 4, 5, 6]);
  });
});
