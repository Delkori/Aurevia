import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { deNom } from "../src/lib/format.ts";

describe("deNom", () => {
  test("élide devant une voyelle", () => {
    assert.equal(deNom("Alex"), "d'Alex");
    assert.equal(deNom("Inès"), "d'Inès");
    assert.equal(deNom("Yann"), "d'Yann");
  });

  test("élide devant un h, muet dans les prénoms courants", () => {
    assert.equal(deNom("Hugo"), "d'Hugo");
  });

  test("garde « de » devant une consonne", () => {
    assert.equal(deNom("Camille"), "de Camille");
    assert.equal(deNom("Jonas"), "de Jonas");
  });

  test("la voyelle accentuée est reconnue comme une voyelle", () => {
    assert.equal(deNom("Élodie"), "d'Élodie");
    assert.equal(deNom("Ève"), "d'Ève");
  });

  test("les espaces autour du nom ne changent rien au choix", () => {
    assert.equal(deNom("  Alex  "), "d'Alex");
    assert.equal(deNom(" Camille "), "de Camille");
  });

  test("un nom vide ne casse pas", () => {
    assert.equal(deNom(""), "de ");
  });
});
