import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { decouvertesDuFoyer, moisDAffilee, moisEntierementPointes } from "../src/lib/decouvertes.ts";

const NOW = new Date(2026, 8, 20);
const planete = (o: Partial<Parameters<typeof decouvertesDuFoyer>[0]["planetes"][number]> = {}) => ({
  id: 1, valeur: 10000, plafond: 20000, ouverteLe: "2019-03-12", nature: "marches" as const, roleProprietaire: null, proprietaire: null, ...o,
});
const EXEMPLE = {
  planetes: [
    planete({ id: 1 }),
    planete({ id: 2, nature: "immobilier", valeur: 340000, plafond: 340000, ouverteLe: "2020-09-30" }),
    planete({ id: 3, nature: "epargne", valeur: 4300, plafond: 10000, roleProprietaire: "child", proprietaire: 2, ouverteLe: "2023-01-09" }),
    planete({ id: 4, nature: "marches", valeur: 32628, plafond: null, ouverteLe: "2022-01-18" }),
  ],
  membres: 2, versementProgramme: true, moisPointes: ["2026-06", "2026-07", "2026-08"],
  revenusMensuels: 5770, depensesMensuelles: 2500, quotesParts: 2, creditsAdosses: 1, dividendesRecus: 0,
  projets: [{ proprietaires: [null, 1] }, { proprietaires: [2] }],
  maintenant: NOW,
};
const ids = (d: ReturnType<typeof decouvertesDuFoyer>, on: boolean) => d.filter(x => x.decouverte === on).map(x => x.id);

describe("l'arbre du foyer d'exemple", () => {
  test("quinze découvertes, cinq branches", () => {
    const d = decouvertesDuFoyer(EXEMPLE);
    assert.equal(d.length, 15);
    assert.equal(new Set(d.map(x => x.branche)).size, 5);
  });

  test("ce qui est découvert l'est d'après les données, pas d'après une case cochée", () => {
    const d = decouvertesDuFoyer(EXEMPLE);
    assert.deepEqual(ids(d, true), [
      "campement", "foyer", "auto", "tour", "regularite", "budget",
      "diversification", "longue-vue", "terre", "copropriete", "levier", "heritier", "commun",
    ]);
    // Il reste : plafonner Crypto, et recevoir un dividende.
    assert.deepEqual(ids(d, false), ["inventaire", "dividendes"]);
  });

  test("« Inventaire » tombe dès qu'une planète perd son plafond, et n'existe pas sans planète", () => {
    const toutes = { ...EXEMPLE, planetes: EXEMPLE.planetes.map(p => ({ ...p, plafond: 1 })) };
    assert.ok(decouvertesDuFoyer(toutes).find(x => x.id === "inventaire")!.decouverte);
    assert.equal(decouvertesDuFoyer({ ...EXEMPLE, planetes: [] }).find(x => x.id === "inventaire")!.decouverte, false);
  });

  test("« Longue vue » demande une date d'ouverture — sans elle, rien n'est ancien", () => {
    const sans = { ...EXEMPLE, planetes: EXEMPLE.planetes.map(p => ({ ...p, ouverteLe: null })) };
    assert.equal(decouvertesDuFoyer(sans).find(x => x.id === "longue-vue")!.decouverte, false);
    const jeune = { ...EXEMPLE, planetes: EXEMPLE.planetes.map(p => ({ ...p, ouverteLe: "2026-01-01" })) };
    assert.equal(decouvertesDuFoyer(jeune).find(x => x.id === "longue-vue")!.decouverte, false);
  });

  test("« Projet commun » exige deux propriétaires distincts, pas deux planètes", () => {
    const seul = { ...EXEMPLE, projets: [{ proprietaires: [1, 1] }] };
    assert.equal(decouvertesDuFoyer(seul).find(x => x.id === "commun")!.decouverte, false);
  });
});

describe("les mois pointés", () => {
  test("d'affilée : on remonte depuis le plus récent et on s'arrête au premier trou", () => {
    assert.equal(moisDAffilee(["2026-06", "2026-07", "2026-08"]), 3);
    assert.equal(moisDAffilee(["2026-04", "2026-07", "2026-08"]), 2);
    assert.equal(moisDAffilee(["2025-12", "2026-01"]), 2);
    assert.equal(moisDAffilee([]), 0);
  });

  test("un mois est pointé quand plus rien n'y attend ; le futur ne compte pas", () => {
    const e = [
      { dueDate: "2026-07-05", status: "confirmed" }, { dueDate: "2026-07-12", status: "skipped" },
      { dueDate: "2026-08-05", status: "confirmed" }, { dueDate: "2026-08-12", status: "pending" },
      { dueDate: "2026-09-05", status: "confirmed" },
      { dueDate: "2026-10-05", status: "confirmed" },
    ];
    assert.deepEqual(moisEntierementPointes(e, NOW), ["2026-07", "2026-09"]);
  });
});
