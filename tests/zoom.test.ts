import { test } from "node:test";
import assert from "node:assert/strict";
import { vueDOuverture, transformeDe, ECHELLE_LISIBLE } from "../src/lib/zoom.ts";

/** Le repère de la galaxie détaillée. */
const REPERE = { largeur: 1200, hauteur: 800 };

/** Pixels par unité du repère, une fois la vue d'ouverture appliquée. */
const echelleRendue = (largeurPx: number, hauteurPx: number, r = REPERE) => {
  const v = vueDOuverture({ largeurPx, hauteurPx, ...r });
  return Math.min(largeurPx / r.largeur, hauteurPx / r.hauteur) * v.k;
};

test("un écran de bureau garde la vue neutre", () => {
  // Le repère y tient déjà : dézoomer ou rezoomer ce qui se lisait très bien
  // ne ferait que déplacer un problème qui n'existe pas.
  assert.deepEqual(vueDOuverture({ largeurPx: 1400, hauteurPx: 900, ...REPERE }), { k: 1, x: 0, y: 0 });
  assert.deepEqual(vueDOuverture({ largeurPx: 1024, hauteurPx: 768, ...REPERE }), { k: 1, x: 0, y: 0 });
});

test("un téléphone s'ouvre à l'échelle où le texte se lit", () => {
  // 342 px de large pour un repère de 1200 : sans rien, tout est rendu à 0,28
  // et une étiquette de 11 unités tombe à 3 px.
  const brut = 342 / 1200;
  assert.ok(brut < 0.3, "l'échelle brute doit bien être le problème qu'on corrige");

  const rendue = echelleRendue(342, 1250);
  assert.ok(Math.abs(rendue - ECHELLE_LISIBLE) < 1e-9, `échelle rendue : ${rendue}`);
  // Une étiquette de 11 unités passe donc de 3 px à plus de 9.
  assert.ok(11 * rendue > 9);
});

test("la vue d'ouverture est centrée sur le repère", () => {
  const v = vueDOuverture({ largeurPx: 342, hauteurPx: 1250, ...REPERE });
  // Le milieu du repère doit retomber au milieu du cadre, qui est aussi le
  // milieu du `viewBox` puisque celui-ci y est centré.
  const milieuX = v.x + v.k * (REPERE.largeur / 2);
  const milieuY = v.y + v.k * (REPERE.hauteur / 2);
  assert.ok(Math.abs(milieuX - REPERE.largeur / 2) < 1e-9);
  assert.ok(Math.abs(milieuY - REPERE.hauteur / 2) < 1e-9);
});

test("un centre donné est celui qu'on amène au milieu du cadre", () => {
  const centre = { x: 300, y: 650 };
  const v = vueDOuverture({ largeurPx: 342, hauteurPx: 1250, ...REPERE, centre });
  assert.ok(Math.abs(v.x + v.k * centre.x - REPERE.largeur / 2) < 1e-9);
  assert.ok(Math.abs(v.y + v.k * centre.y - REPERE.hauteur / 2) < 1e-9);
});

test("l'ouverture ne dépasse jamais le zoom maximal", () => {
  // Un écran minuscule demanderait un facteur énorme ; le plafond est celui du
  // geste, sinon la molette repartirait d'au-delà de sa propre butée.
  const v = vueDOuverture({ largeurPx: 80, hauteurPx: 400, ...REPERE, max: 6 });
  assert.equal(v.k, 6);
});

test("un cadre non mesuré laisse la vue neutre", () => {
  // Au premier rendu, `getBoundingClientRect` peut rendre zéro : mieux vaut ne
  // rien faire qu'appliquer une échelle infinie.
  assert.deepEqual(vueDOuverture({ largeurPx: 0, hauteurPx: 0, ...REPERE }), { k: 1, x: 0, y: 0 });
  assert.deepEqual(vueDOuverture({ largeurPx: 342, hauteurPx: 0, ...REPERE }), { k: 1, x: 0, y: 0 });
});

test("la transformation se lit telle quelle", () => {
  assert.equal(transformeDe({ k: 2, x: -10, y: 5 }), "translate(-10,5) scale(2)");
});
