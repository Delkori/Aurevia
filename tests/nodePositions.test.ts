import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

/**
 * Le module met sa lecture en cache au niveau module — c'est le but : les
 * forces d3 l'interrogent deux fois par nœud et par image. Chaque cas repart
 * donc d'un import frais, avec son propre localStorage.
 */
const KEY = "aurevia:nodePositions";

function installerStockage(contenu?: string) {
  const data = new Map<string, string>();
  if (contenu !== undefined) data.set(KEY, contenu);
  (globalThis as Record<string, unknown>).window = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
  };
  return data;
}

let graine = 0;
async function chargerModule(contenu?: string) {
  const data = installerStockage(contenu);
  // Le suffixe force un module neuf, donc un cache neuf.
  const mod = await import(`../src/lib/nodePositions.ts?t=${graine++}`);
  return { mod, data };
}

describe("nodePositions", () => {
  beforeEach(() => {
    delete (globalThis as Record<string, unknown>).window;
    delete (globalThis as Record<string, unknown>).localStorage;
  });

  test("une position enregistrée se relit dans la même disposition", async () => {
    const { mod } = await chargerModule();
    mod.setNodePosition("horizontal", "p-1", { x: 12, y: 34 });
    assert.deepEqual(mod.getNodePosition("horizontal", "p-1"), { x: 12, y: 34 });
  });

  // Régression : une seule carte plate servait aux trois dispositions. Comme une
  // position enregistrée désactive l'aimant de la mise en page, un nœud glissé
  // en orbite restait épinglé en travers des colonnes.
  test("les dispositions ne partagent pas leurs positions", async () => {
    const { mod } = await chargerModule();
    mod.setNodePosition("radial", "p-1", { x: 12, y: 34 });
    assert.equal(mod.getNodePosition("horizontal", "p-1"), null);
    assert.equal(mod.getNodePosition("vertical", "p-1"), null);
  });

  test("l'ancien format plat est rattaché à l'orbite", async () => {
    const ancien = JSON.stringify({ "p-1": { x: 5, y: 6 }, center: { x: 1, y: 2 } });
    const { mod } = await chargerModule(ancien);
    assert.deepEqual(mod.getNodePosition("radial", "p-1"), { x: 5, y: 6 });
    assert.deepEqual(mod.getNodePosition("radial", "center"), { x: 1, y: 2 });
    assert.equal(mod.getNodePosition("horizontal", "p-1"), null);
  });

  test("« rangement auto » ne défait que la disposition affichée", async () => {
    const { mod } = await chargerModule();
    mod.setNodePosition("radial", "p-1", { x: 1, y: 1 });
    mod.setNodePosition("horizontal", "p-1", { x: 2, y: 2 });
    mod.clearAllPositions("horizontal");
    assert.equal(mod.getNodePosition("horizontal", "p-1"), null);
    assert.deepEqual(mod.getNodePosition("radial", "p-1"), { x: 1, y: 1 });
  });

  test("l'écriture survit au rechargement", async () => {
    const { mod, data } = await chargerModule();
    mod.setNodePosition("vertical", "g-2", { x: 7, y: 8 });
    const relu = JSON.parse(data.get(KEY)!);
    assert.deepEqual(relu.vertical["g-2"], { x: 7, y: 8 });
  });

  test("un stockage illisible ne fait pas planter la galaxie", async () => {
    const { mod } = await chargerModule("{pas du json");
    assert.equal(mod.getNodePosition("radial", "p-1"), null);
    assert.doesNotThrow(() => mod.setNodePosition("radial", "p-1", { x: 1, y: 2 }));
  });

  test("une entrée mal formée est ignorée, les bonnes sont gardées", async () => {
    const { mod } = await chargerModule(JSON.stringify({
      horizontal: { bon: { x: 1, y: 2 }, mauvais: { x: "non" }, nul: null },
    }));
    assert.deepEqual(mod.getNodePosition("horizontal", "bon"), { x: 1, y: 2 });
    assert.equal(mod.getNodePosition("horizontal", "mauvais"), null);
    assert.equal(mod.getNodePosition("horizontal", "nul"), null);
  });
});
