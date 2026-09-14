import { test } from "node:test";
import assert from "node:assert/strict";
import { proprietairesDe, arcsAnneau } from "../src/lib/proprietaires.ts";

const personne = (id: number | null) => id === null ? { nom: "Moi", couleur: "#aaa" } : { nom: `M${id}`, couleur: `#c${id}` };

test("sans quote-part, le propriétaire déclaré possède tout", () => {
  assert.deepEqual(proprietairesDe(1, 2, [], personne), [{ memberId: 2, nom: "M2", couleur: "#c2", part: 1 }]);
  assert.deepEqual(proprietairesDe(1, null, [], personne), [{ memberId: null, nom: "Moi", couleur: "#aaa", part: 1 }]);
});

test("« sans portefeuille » ignore les quotes-parts et revient au propriétaire", () => {
  const lignes = [{ portfolioId: 1, memberId: 2, sharePercent: "100" }];
  assert.deepEqual(proprietairesDe("unassigned", null, lignes, personne), [{ memberId: null, nom: "Moi", couleur: "#aaa", part: 1 }]);
});

test("les quotes-parts font foi, triées par part décroissante, ramenées à 1", () => {
  const lignes = [
    { portfolioId: 1, memberId: null, sharePercent: "30" },
    { portfolioId: 1, memberId: 2, sharePercent: "60" },
    { portfolioId: 2, memberId: 3, sharePercent: "100" },
  ];
  const r = proprietairesDe(1, null, lignes, personne);
  assert.deepEqual(r.map(p => [p.memberId, p.nom]), [[2, "M2"], [null, "Moi"]]);
  assert.ok(Math.abs(r[0].part - 2 / 3) < 1e-9);
  assert.ok(Math.abs(r[1].part - 1 / 3) < 1e-9);
});

test("une ligne à 0 % disparaît ; des lignes toutes à 0 % rendent au propriétaire déclaré", () => {
  assert.deepEqual(
    proprietairesDe(1, 2, [{ portfolioId: 1, memberId: 2, sharePercent: "100" }, { portfolioId: 1, memberId: 3, sharePercent: "0" }], personne),
    [{ memberId: 2, nom: "M2", couleur: "#c2", part: 1 }]
  );
  assert.deepEqual(proprietairesDe(1, 2, [{ portfolioId: 1, memberId: 3, sharePercent: "0" }], personne),
    [{ memberId: 2, nom: "M2", couleur: "#c2", part: 1 }]);
});

test("à parts égales, l'ordre ne bouge pas d'un appel à l'autre", () => {
  // La galaxie tire un fil par propriétaire mais n'accroche la planète qu'au
  // premier de la liste. Sur un bien détenu moitié-moitié, si l'ordre dépendait
  // de celui des lignes en base, la planète changerait de colonne à chaque
  // rechargement.
  const a = [
    { portfolioId: 1, memberId: null, sharePercent: "50" },
    { portfolioId: 1, memberId: 2, sharePercent: "50" },
  ];
  const b = [a[1], a[0]];
  const ordre = (lignes: typeof a) => proprietairesDe(1, 2, lignes, personne).map(p => p.memberId);
  assert.deepEqual(ordre(a), [null, 2]);
  assert.deepEqual(ordre(b), [null, 2]);
});

test("les lignes d'une même personne s'additionnent", () => {
  const r = proprietairesDe(1, null, [
    { portfolioId: 1, memberId: 2, sharePercent: "25" },
    { portfolioId: 1, memberId: 2, sharePercent: "25" },
    { portfolioId: 1, memberId: null, sharePercent: "50" },
  ], personne);
  assert.equal(r.length, 2);
  assert.ok(r.every(p => Math.abs(p.part - 0.5) < 1e-9));
});

test("un seul propriétaire : anneau plein, sans écart", () => {
  const [arc] = arcsAnneau([{ couleur: "#aaa", part: 1 }], 10);
  assert.ok(Math.abs(arc.longueur - 2 * Math.PI * 10) < 1e-9);
  assert.equal(arc.decalage, 0);
});

test("deux propriétaires 50/50 : deux arcs égaux, séparés par l'écart, bout à bout", () => {
  const arcs = arcsAnneau([{ couleur: "#a", part: 0.5 }, { couleur: "#b", part: 0.5 }], 10, 4);
  const C = 2 * Math.PI * 10;
  assert.equal(arcs.length, 2);
  assert.ok(Math.abs(arcs[0].longueur - (C / 2 - 4)) < 1e-9);
  assert.ok(Math.abs(arcs[1].longueur - (C / 2 - 4)) < 1e-9);
  assert.equal(arcs[0].decalage, 2);
  assert.ok(Math.abs(arcs[1].decalage - (C / 2 + 2)) < 1e-9);
  // Les arcs et leurs écarts couvrent exactement le tour.
  const couvert = arcs.reduce((s, a) => s + a.longueur, 0) + 4 * arcs.length;
  assert.ok(Math.abs(couvert - C) < 1e-9);
});

test("une part minuscule ne donne jamais une longueur négative", () => {
  const arcs = arcsAnneau([{ couleur: "#a", part: 0.99 }, { couleur: "#b", part: 0.01 }], 5, 4);
  assert.ok(arcs.every(a => a.longueur >= 0));
});
