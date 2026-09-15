import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  cleNom,
  nomProprietaire,
  planetesHomonymes,
  etiquettesPlanetes,
  homonymesDe,
} from "../src/lib/nomsPlanetes.ts";

const MEMBRES = [
  { id: 1, name: "Alex" },
  { id: 2, name: "Camille" },
];

describe("nom du propriétaire", () => {
  test("sans membre, c'est le titulaire du compte", () => {
    assert.equal(nomProprietaire(null, MEMBRES, "Jonas"), "Jonas");
  });

  test("un membre supprimé ne fait pas planter la liste", () => {
    assert.equal(nomProprietaire(9, MEMBRES, "Jonas"), "?");
  });
});

describe("homonymie", () => {
  test("la casse, les espaces et les accents ne comptent pas", () => {
    assert.equal(cleNom("  Épargne   retraite "), cleNom("epargne retraite"));
  });

  test("deux PEA sont homonymes, le CTO ne l'est pas", () => {
    const planetes = [
      { id: 1, name: "PEA", memberId: 1 },
      { id: 2, name: "pea", memberId: 2 },
      { id: 3, name: "CTO", memberId: 1 },
    ];
    assert.deepEqual([...planetesHomonymes(planetes)].sort(), [1, 2]);
  });
});

describe("étiquettes", () => {
  test("un nom unique reste tel quel", () => {
    const e = etiquettesPlanetes([{ id: 1, name: "PEA", memberId: 1 }], MEMBRES, "Jonas");
    assert.equal(e.get(1), "PEA");
  });

  test("deux PEA se distinguent par leur propriétaire", () => {
    const e = etiquettesPlanetes(
      [
        { id: 1, name: "PEA", memberId: 1 },
        { id: 2, name: "PEA", memberId: 2 },
        { id: 3, name: "Livret A", memberId: null },
      ],
      MEMBRES,
      "Jonas"
    );
    assert.equal(e.get(1), "PEA · Alex");
    assert.equal(e.get(2), "PEA · Camille");
    // Le troisième n'a pas d'homonyme : rien à ajouter.
    assert.equal(e.get(3), "Livret A");
  });

  test("le titulaire du compte est nommé comme les autres", () => {
    const e = etiquettesPlanetes(
      [
        { id: 1, name: "PEA", memberId: null },
        { id: 2, name: "PEA", memberId: 1 },
      ],
      MEMBRES,
      "Jonas"
    );
    assert.equal(e.get(1), "PEA · Jonas");
    assert.equal(e.get(2), "PEA · Alex");
  });

  test("deux homonymes du même propriétaire ne sont pas maquillés", () => {
    // Le suffixe n'apprendrait rien : la liste doit montrer le doublon tel
    // qu'il est plutôt que d'inventer un « (2) » qui n'existe nulle part.
    const e = etiquettesPlanetes(
      [
        { id: 1, name: "PEA", memberId: 1 },
        { id: 2, name: "PEA", memberId: 1 },
      ],
      MEMBRES,
      "Jonas"
    );
    assert.equal(e.get(1), "PEA · Alex");
    assert.equal(e.get(2), "PEA · Alex");
  });
});

describe("avertissement à la création", () => {
  const planetes = [
    { id: 1, name: "PEA", memberId: 1 },
    { id: 2, name: "CTO", memberId: null },
  ];

  test("annonce à qui appartient l'homonyme existant", () => {
    // Le nom rendu est celui de la planète existante — « PEA » — et non la
    // casse qu'on vient de taper.
    assert.deepEqual(homonymesDe("pea", planetes, MEMBRES, "Jonas"), [
      { nom: "PEA", proprietaire: "Alex" },
    ]);
  });

  test("un nom libre ne déclenche rien", () => {
    assert.deepEqual(homonymesDe("Livret A", planetes, MEMBRES, "Jonas"), []);
  });

  test("un nom vide ne déclenche rien", () => {
    assert.deepEqual(homonymesDe("   ", planetes, MEMBRES, "Jonas"), []);
  });

  test("renommer une planète ne la compte pas comme son propre homonyme", () => {
    assert.deepEqual(homonymesDe("PEA", planetes, MEMBRES, "Jonas", 1), []);
  });
});
