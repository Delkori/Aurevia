import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { cleMois, decouvertesDejaFetees, dernierTour, quetesAccomplies, tourDepuisBilan } from "../src/lib/tours.ts";

const bilan = {
  mois: "septembre 2026", pointes: 9,
  patrimoine: { apres: 306085, avant: 297000, depuis: "2026-08-01" },
  projets: [], planetes: [],
  score: { total: 66, parts: { epargne: 15.6, diversification: 24, dette: 15.5, concentration: 11.1 } },
  situation: { ere: { numero: 4 as const, nom: "Royaume", sens: "" }, prochaine: null, manque: [] },
  decouvertes: [],
  quetesAccomplies: [],
};

describe("écrire un tour", () => {
  test("un tour tient en une ligne, daté du premier du mois pointé", () => {
    const t = tourDepuisBilan(bilan, new Date(2026, 8, 20), ["campement", "foyer"], [{ id: "pointer", titre: "Pointer septembre" }]);
    assert.equal(t.mois, "2026-09-01");
    assert.equal(cleMois(new Date(2026, 0, 31)), "2026-01-01");
    assert.deepEqual(t, {
      mois: "2026-09-01", pointes: 9, patrimoineNet: 306085, score: 66, ere: 4,
      decouvertes: ["campement", "foyer"], quetes: [{ id: "pointer", titre: "Pointer septembre" }],
    });
  });

  test("sans score ni ère, le tour s'écrit quand même", () => {
    const t = tourDepuisBilan({ ...bilan, score: null, situation: null }, new Date(2026, 8, 1), [], []);
    assert.equal(t.score, null);
    assert.equal(t.ere, 1);
  });
});

describe("lire les tours", () => {
  const tours = [
    { mois: "2026-07-01", pointes: 8, patrimoineNet: 300000, score: 64, ere: 4, decouvertes: ["campement", "foyer"], quetes: [{ id: "plafond-3", titre: "Donner un plafond à Crypto" }] },
    { mois: "2026-08-01", pointes: 9, patrimoineNet: 302000, score: 65, ere: 4, decouvertes: ["auto"], quetes: [{ id: "plafond-3", titre: "Donner un plafond à Crypto" }, { id: "projet-1", titre: "Apport résidence principale : 81 → 100 %" }] },
  ];

  test("le dernier tour est le plus récent, quel que soit l'ordre", () => {
    assert.equal(dernierTour([...tours].reverse())?.mois, "2026-08-01");
    assert.equal(dernierTour([]), null);
  });

  test("une quête accomplie est une quête qui n'est plus à proposer", () => {
    // Crypto a reçu son plafond ; le projet reste en cours.
    assert.deepEqual(quetesAccomplies(dernierTour(tours), ["projet-1", "pointer"]), ["Donner un plafond à Crypto"]);
    assert.deepEqual(quetesAccomplies(null, ["pointer"]), []);
  });

  test("ce qui a déjà été fêté se cumule sur tous les tours", () => {
    assert.deepEqual([...decouvertesDejaFetees(tours)].sort(), ["auto", "campement", "foyer"]);
  });
});
