import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { quetesDuFoyer, MAX_QUETES } from "../src/lib/quetes.ts";

const fmt = (v: number) => `${Math.round(v)} €`;

const EXEMPLE = {
  enRetard: 3, mois: "septembre",
  planetes: [
    { id: 1, nom: "PEA · Alex", valeur: 31497, plafond: 45000 },
    { id: 3, nom: "Crypto", valeur: 32628, plafond: null },
  ],
  projets: [
    { id: 1, nom: "Apport résidence principale", acquis: 97200, cible: 120000, apportMensuel: 900 },
    { id: 2, nom: "Études de Jonas", acquis: 4300, cible: 40000, apportMensuel: 50 },
    { id: 3, nom: "Vacances au Japon", acquis: 8000, cible: 8000, apportMensuel: 100 },
  ],
  depensesDeclarees: true, versementProgramme: true,
};

describe("quêtes du foyer d'exemple", () => {
  test("trois quêtes, une de chaque type, dans cet ordre", () => {
    const q = quetesDuFoyer(EXEMPLE, fmt);
    assert.equal(q.length, MAX_QUETES);
    assert.deepEqual(q.map(x => x.type), ["echeance", "organisation", "plan"]);
    assert.equal(q[0].titre, "Pointer septembre");
    assert.match(q[0].detail, /^3 échéances attendent/);
    assert.deepEqual(q[0].action, { type: "pointer" });
  });

  test("la planète sans plafond est proposée, et on sait qu'elle est la seule", () => {
    const q = quetesDuFoyer(EXEMPLE, fmt)[1];
    assert.equal(q.titre, "Donner un plafond à Crypto");
    assert.match(q.detail, /la seule planète sans barre de vie/);
    assert.deepEqual(q.action, { type: "planete", id: 3 });
  });

  test("le plan divise ce qui manque par ce qu'on verse — le projet le plus avancé, pas le fini", () => {
    const q = quetesDuFoyer(EXEMPLE, fmt)[2];
    assert.equal(q.titre, "Apport résidence principale : 81 → 100 %");
    // 120 000 − 97 200 = 22 800 ; à 900 €/mois → 25,3 → 26 mois.
    assert.equal(q.detail, "Il manque 22800 €. Au rythme actuel de 900 €/mois : 26 mois.");
    assert.deepEqual(q.action, { type: "projet", id: 1 });
  });
});

describe("quand il manque des choses", () => {
  test("rien en retard : pas de quête d'échéance, et on ne remplit pas pour faire trois", () => {
    const q = quetesDuFoyer({ ...EXEMPLE, enRetard: 0, planetes: [EXEMPLE.planetes[0]] }, fmt);
    assert.deepEqual(q.map(x => x.type), ["plan"]);
  });

  test("les dépenses passent avant tout autre geste d'organisation", () => {
    const q = quetesDuFoyer({ ...EXEMPLE, depensesDeclarees: false, versementProgramme: false }, fmt);
    assert.equal(q[1].titre, "Déclarer tes dépenses");
  });

  test("un projet que rien n'alimente le dit, au lieu de diviser par zéro", () => {
    const q = quetesDuFoyer({ ...EXEMPLE, projets: [{ id: 9, nom: "Voiture", acquis: 1000, cible: 10000, apportMensuel: 0 }] }, fmt);
    assert.match(q[2].detail, /rien ne l'alimente/);
  });

  test("une échéance seule se conjugue au singulier", () => {
    assert.match(quetesDuFoyer({ ...EXEMPLE, enRetard: 1 }, fmt)[0].detail, /^Une échéance attend\./);
  });
});
