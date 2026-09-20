import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { conqueteDesSystemes } from "../src/lib/conquete.ts";

const EXEMPLE = {
  sourcesRevenus: 3, revenusMensuels: 5770, depensesMensuelles: 2500,
  natures: 3, concentration: 0.69, projetsAtteints: 1, projets: 3,
};
const arrondi = (v: number) => Math.round(v * 100) / 100;

describe("conquête des systèmes", () => {
  test("le foyer d'exemple : revenus et dépenses conquis, investissements en cours, un projet sur trois", () => {
    const c = conqueteDesSystemes(EXEMPLE);
    assert.equal(c.revenus, 1);
    assert.equal(c.depenses, 1);
    // Trois natures font la moitié ; 69 % sur un seul bien contre 50 % admis font 0,36 de l'autre moitié.
    assert.equal(arrondi(c.investissements), 0.86);
    assert.equal(arrondi(c.projets), 0.33);
  });

  test("une seule source de revenus, c'est la moitié du chemin", () => {
    assert.equal(conqueteDesSystemes({ ...EXEMPLE, sourcesRevenus: 1 }).revenus, 0.5);
  });

  test("des dépenses qui mordent au-delà de 70 % font reculer la conquête", () => {
    assert.equal(arrondi(conqueteDesSystemes({ ...EXEMPLE, depensesMensuelles: 5193 }).depenses), 0.78);
    assert.equal(conqueteDesSystemes({ ...EXEMPLE, revenusMensuels: 0 }).depenses, 0);
  });

  test("sans projet, rien à conquérir : zéro plutôt qu'une division par zéro", () => {
    assert.equal(conqueteDesSystemes({ ...EXEMPLE, projets: 0, projetsAtteints: 0 }).projets, 0);
  });

  test("tout est borné entre zéro et un", () => {
    const c = conqueteDesSystemes({ sourcesRevenus: 9, revenusMensuels: 10000, depensesMensuelles: 100, natures: 9, concentration: 0.1, projetsAtteints: 5, projets: 2 });
    assert.deepEqual(c, { revenus: 1, depenses: 1, investissements: 1, projets: 1 });
  });
});
