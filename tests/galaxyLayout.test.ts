import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { flowLayout, layerOf, type LayoutNode } from "../src/lib/galaxyLayout.ts";

const W = 1200, H = 800;
const n = (id: string, kind: string, r = 30): LayoutNode => ({ id, kind, r });

const jeu: LayoutNode[] = [
  n("salary", "salary", 32),
  n("ms-1", "member-salary", 22),
  n("center", "center", 32),
  n("self", "member", 40),
  n("m-1", "member", 30),
  n("expenses", "expenses", 26),
  n("p-1", "portfolio", 50),
  n("p-2", "portfolio", 35),
  n("g-1", "goal", 28),
];

describe("rangées", () => {
  test("les revenus précèdent le foyer, qui précède les destinations", () => {
    assert.equal(layerOf("salary"), 0);
    assert.equal(layerOf("member-salary"), 0);
    assert.equal(layerOf("center"), 1);
    assert.equal(layerOf("member"), 1);
    assert.equal(layerOf("expenses"), 1);
    assert.equal(layerOf("portfolio"), 2);
    assert.equal(layerOf("goal"), 2);
  });

  test("les satellites ne sont pas rangés : ils orbitent autour de leur parent", () => {
    assert.equal(layerOf("asset"), null);
    assert.equal(layerOf("expense-item"), null);
    assert.equal(layerOf("income-item"), null);
    assert.equal(layerOf("inconnu"), null);
  });
});

describe("lecture de gauche à droite", () => {
  const pos = flowLayout(jeu, "horizontal", { width: W, height: H });

  test("place chaque nœud rangeable", () => {
    assert.equal(pos.size, jeu.length);
  });

  test("l'argent progresse toujours vers la droite", () => {
    const x = (id: string) => pos.get(id)!.x;
    assert.ok(x("salary") < x("center"), "revenus avant foyer");
    assert.ok(x("center") < x("p-1"), "foyer avant planètes");
    assert.ok(x("self") < x("p-1"), "personnes avant planètes");
  });

  test("une rangée partage la même abscisse", () => {
    assert.equal(pos.get("center")!.x, pos.get("self")!.x);
    assert.equal(pos.get("self")!.x, pos.get("expenses")!.x);
    assert.equal(pos.get("p-1")!.x, pos.get("g-1")!.x);
  });

  test("tout tient dans le cadre, rayon compris", () => {
    for (const node of jeu) {
      const p = pos.get(node.id)!;
      assert.ok(p.x >= 0 && p.x <= W, `${node.id} x=${p.x}`);
      assert.ok(p.y - node.r >= 0 && p.y + node.r <= H, `${node.id} y=${p.y} r=${node.r}`);
    }
  });

  test("deux nœuds d'une même rangée ne se chevauchent pas", () => {
    const foyer = ["center", "self", "m-1", "expenses"].map(id => ({ id, y: pos.get(id)!.y, r: jeu.find(x => x.id === id)!.r }));
    foyer.sort((a, b) => a.y - b.y);
    for (let i = 1; i < foyer.length; i++) {
      const ecart = foyer[i].y - foyer[i - 1].y;
      assert.ok(ecart >= foyer[i].r + foyer[i - 1].r, `${foyer[i-1].id}/${foyer[i].id} écart ${ecart.toFixed(0)}`);
    }
  });

  test("les dépenses sont rejetées en bout de rangée — c'est une fuite, pas une destination", () => {
    assert.ok(pos.get("expenses")!.y > pos.get("center")!.y);
    assert.ok(pos.get("expenses")!.y > pos.get("self")!.y);
  });
});

describe("lecture de haut en bas", () => {
  const pos = flowLayout(jeu, "vertical", { width: W, height: H });

  test("l'argent descend", () => {
    const y = (id: string) => pos.get(id)!.y;
    assert.ok(y("salary") < y("center"));
    assert.ok(y("center") < y("p-1"));
  });

  test("une rangée partage la même ordonnée", () => {
    assert.equal(pos.get("center")!.y, pos.get("self")!.y);
  });

  test("tout tient dans le cadre", () => {
    for (const node of jeu) {
      const p = pos.get(node.id)!;
      assert.ok(p.x - node.r >= 0 && p.x + node.r <= W, `${node.id} x=${p.x}`);
      assert.ok(p.y >= 0 && p.y <= H, `${node.id} y=${p.y}`);
    }
  });
});

describe("cas limites", () => {
  test("aucun nœud rangeable", () => {
    assert.equal(flowLayout([n("a-1", "asset")], "horizontal", { width: W, height: H }).size, 0);
    assert.equal(flowLayout([], "horizontal", { width: W, height: H }).size, 0);
  });

  test("une seule rangée est centrée sur l'axe principal", () => {
    const pos = flowLayout([n("p-1", "portfolio"), n("p-2", "portfolio")], "horizontal", { width: W, height: H });
    assert.equal(pos.get("p-1")!.x, W / 2);
    assert.equal(pos.get("p-2")!.x, W / 2);
  });

  test("une rangée surchargée se resserre au lieu de déborder", () => {
    const foule = Array.from({ length: 14 }, (_, i) => n(`p-${i}`, "portfolio", 40));
    const pos = flowLayout(foule, "horizontal", { width: W, height: H });
    for (const node of foule) {
      const p = pos.get(node.id)!;
      assert.ok(p.y >= 0 && p.y <= H, `${node.id} y=${p.y}`);
    }
  });
});
