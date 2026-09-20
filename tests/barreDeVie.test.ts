import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { barreDeVie, pourcentageDe, SEGMENTS } from "../src/lib/barreDeVie.ts";

const dessin = (b: ReturnType<typeof barreDeVie>) =>
  b!.segments.map((s) => ({ plein: "█", "a-venir": "▒", perdu: "✕", vide: "·" }[s])).join("");

describe("sans plafond", () => {
  test("pas de plafond, pas de barre", () => {
    assert.equal(barreDeVie({ valeur: 31497, plafond: null }), null);
    assert.equal(barreDeVie({ valeur: 31497, plafond: 0 }), null);
    assert.equal(barreDeVie({ valeur: 31497, plafond: -5 }), null);
  });
});

describe("segments acquis", () => {
  test("dix segments, arrondis vers le bas", () => {
    // 31 497 / 50 000 = 63 % : six segments pleins, pas sept.
    const b = barreDeVie({ valeur: 31497, plafond: 50000 })!;
    assert.equal(b.segments.length, SEGMENTS);
    assert.equal(dessin(b), "██████····");
    assert.equal(b.pleins, 6);
    assert.equal(pourcentageDe(b), "62 %");
    assert.equal(b.pleine, false);
  });

  test("le flottant ne vole pas un segment", () => {
    // 0,7 × 10 vaut 6,999… en machine ; la barre doit bien montrer 7.
    assert.equal(barreDeVie({ valeur: 35000, plafond: 50000 })!.pleins, 7);
    assert.equal(pourcentageDe(barreDeVie({ valeur: 35000, plafond: 50000 })!), "70 %");
  });

  test("le pourcentage s'arrondit vers le bas, comme les segments", () => {
    // 31 497 / 45 000 = 69,99 % : six segments, et « 69 % » — pas « 70 % »
    // à côté de six segments pleins.
    const b = barreDeVie({ valeur: 31497, plafond: 45000 })!;
    assert.equal(b.pleins, 6);
    assert.equal(pourcentageDe(b), "69 %");
  });

  test("une planète pleine est une merveille, et la barre ne déborde pas", () => {
    const b = barreDeVie({ valeur: 62000, plafond: 50000 })!;
    assert.equal(dessin(b), "██████████");
    assert.equal(b.pleine, true);
    assert.equal(pourcentageDe(b), "124 %");
  });

  test("une planète vide reste à zéro", () => {
    assert.equal(dessin(barreDeVie({ valeur: 0, plafond: 50000 })), "··········");
  });
});

describe("segment à venir", () => {
  test("le versement du mois hachure ce qu'il va remplir", () => {
    // 31 497 + 600 = 32 097 → toujours 6 segments : rien ne change ce mois.
    assert.equal(dessin(barreDeVie({ valeur: 31497, plafond: 50000, versementMensuel: 600 })), "██████····");
    // 34 800 + 600 = 35 400 → le 7e segment tombe ce mois-ci.
    assert.equal(dessin(barreDeVie({ valeur: 34800, plafond: 50000, versementMensuel: 600 })), "██████▒···");
  });

  test("un gros versement peut hachurer plusieurs segments", () => {
    assert.equal(dessin(barreDeVie({ valeur: 10000, plafond: 50000, versementMensuel: 12000 })), "██▒▒······");
  });

  test("un versement négatif n'enlève rien", () => {
    assert.equal(dessin(barreDeVie({ valeur: 30000, plafond: 50000, versementMensuel: -4000 })), "██████····");
  });
});

describe("segment perdu", () => {
  test("une baisse de cours marque les segments perdus depuis la dernière visite", () => {
    const b = barreDeVie({ valeur: 32628, plafond: 50000, valeurPrecedente: 36000 });
    assert.equal(dessin(b), "██████✕···");
  });

  test("une hausse ne marque rien", () => {
    assert.equal(dessin(barreDeVie({ valeur: 36000, plafond: 50000, valeurPrecedente: 32000 })), "███████···");
  });

  test("la perte prime sur le versement qui la reprendrait", () => {
    // On a perdu le 7e segment ; le versement du mois le reprend. On montre
    // la perte : c'est elle, l'information.
    const b = barreDeVie({ valeur: 34800, plafond: 50000, versementMensuel: 600, valeurPrecedente: 35500 });
    assert.equal(dessin(b), "██████✕···");
  });

  test("sans mémoire de la dernière visite, rien n'est perdu", () => {
    assert.equal(dessin(barreDeVie({ valeur: 30000, plafond: 50000, valeurPrecedente: null })), "██████····");
  });
});
