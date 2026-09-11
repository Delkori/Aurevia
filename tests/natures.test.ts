import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  NATURE_COLORS,
  NATURE_ORDER,
  natureOfAssetType,
  natureOfPortfolio,
} from "../src/lib/natures.ts";

const a = (type: string, value: number) => ({ asset: { type }, value });

describe("nature d'un type d'actif", () => {
  test("regroupe ce qui est coté sous « marchés »", () => {
    for (const t of ["stock", "etf", "crypto", "precious_metal"]) {
      assert.equal(natureOfAssetType(t), "marches", t);
    }
  });

  test("sépare l'immobilier de l'épargne", () => {
    assert.equal(natureOfAssetType("real_estate"), "immobilier");
    assert.equal(natureOfAssetType("scpi"), "immobilier");
    assert.equal(natureOfAssetType("cash"), "epargne");
    assert.equal(natureOfAssetType("life_insurance"), "epargne");
  });

  test("un type inconnu retombe sur « autre » plutôt que de planter", () => {
    assert.equal(natureOfAssetType("licorne"), "autre");
    assert.equal(natureOfAssetType(""), "autre");
  });
});

describe("nature d'un portefeuille", () => {
  test("arbitre par la valeur, pas par le nombre de lignes", () => {
    // Dix livrets à 100 € contre un appartement à 300 000 €.
    const items = [...Array(10)].map(() => a("cash", 100));
    items.push(a("real_estate", 300000));
    assert.equal(natureOfPortfolio(items), "immobilier");
  });

  test("une planète vide n'a pas de nature devinée", () => {
    assert.equal(natureOfPortfolio([]), "autre");
  });

  test("des valeurs toutes nulles ne produisent pas de fausse nature", () => {
    assert.equal(natureOfPortfolio([a("stock", 0), a("cash", 0)]), "autre");
  });

  test("les valeurs négatives ne faussent pas l'arbitrage", () => {
    assert.equal(natureOfPortfolio([a("stock", -5000), a("cash", 200)]), "epargne");
  });

  test("mélange dominé par les marchés", () => {
    assert.equal(
      natureOfPortfolio([a("etf", 50000), a("cash", 3000), a("scpi", 8000)]),
      "marches"
    );
  });
});

describe("palette", () => {
  test("chaque nature a une couleur, et elles sont toutes distinctes", () => {
    const couleurs = NATURE_ORDER.map((n) => NATURE_COLORS[n]);
    assert.equal(couleurs.length, 4);
    assert.equal(new Set(couleurs).size, 4);
    for (const c of couleurs) assert.match(c, /^#[0-9a-f]{6}$/);
  });

  test("le vert et le rouge restent réservés aux revenus et aux dépenses", () => {
    // Une couleur de statut réutilisée comme catégorie rendrait « une planète
    // d'épargne » et « un revenu » indiscernables.
    const couleurs = Object.values(NATURE_COLORS);
    assert.ok(!couleurs.includes("#34d399"));
    assert.ok(!couleurs.includes("#f87171"));
  });
});
