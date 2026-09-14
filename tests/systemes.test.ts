import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  construireSystemes, contexteUtile, goalIdDeProjet, projetId, systemeDuNoeud,
  SYSTEME_DEPENSES, SYSTEME_INVESTISSEMENTS, SYSTEME_REVENUS,
  type EntreesSystemes,
} from "../src/lib/systemes.ts";

const foyer = (over: Partial<EntreesSystemes> = {}): EntreesSystemes => ({
  revenus: 3200, depenses: 2500, patrimoine: 297837, versements: 1300,
  planetes: 6, lignesDepense: 5, projets: [], ...over,
});
const ids = (e: EntreesSystemes) => construireSystemes(e).systemes.map(s => s.id);

describe("rattachement des nœuds", () => {
  test("chaque genre de nœud trouve son système", () => {
    assert.equal(systemeDuNoeud("salary"), SYSTEME_REVENUS);
    assert.equal(systemeDuNoeud("member-salary"), SYSTEME_REVENUS);
    assert.equal(systemeDuNoeud("expenses"), SYSTEME_DEPENSES);
    assert.equal(systemeDuNoeud("expense-item"), SYSTEME_DEPENSES);
    assert.equal(systemeDuNoeud("portfolio"), SYSTEME_INVESTISSEMENTS);
    assert.equal(systemeDuNoeud("asset"), SYSTEME_INVESTISSEMENTS);
  });

  test("le foyer et les personnes restent visibles partout", () => {
    // Les retirer donnerait des vues flottantes, sans point d'attache.
    assert.equal(systemeDuNoeud("center"), "contexte");
    assert.equal(systemeDuNoeud("member"), "contexte");
  });

  test("un identifiant de projet fait l'aller-retour", () => {
    assert.equal(goalIdDeProjet(projetId(42)), 42);
    assert.equal(goalIdDeProjet("investissements"), null);
    assert.equal(goalIdDeProjet("projet-"), null);
  });
});

describe("vue d'ensemble", () => {
  test("un foyer complet donne trois systèmes", () => {
    assert.deepEqual(ids(foyer()), [SYSTEME_REVENUS, SYSTEME_DEPENSES, SYSTEME_INVESTISSEMENTS]);
  });

  test("l'argent circule des revenus vers les dépenses et les placements", () => {
    const { flux } = construireSystemes(foyer());
    assert.deepEqual(flux, [
      { source: SYSTEME_REVENUS, cible: SYSTEME_DEPENSES, montant: 2500 },
      { source: SYSTEME_REVENUS, cible: SYSTEME_INVESTISSEMENTS, montant: 1300 },
    ]);
  });

  test("chaque projet devient un système, alimenté par les placements", () => {
    const e = foyer({ projets: [
      { goalId: 1, nom: "Japon", couleur: "#f0abfc", acquis: 32628, apport: 100, planetes: 1 },
      { goalId: 2, nom: "Apport", couleur: "#7c6af5", acquis: 97797, apport: 900, planetes: 2 },
    ]});
    const { systemes, flux } = construireSystemes(e);
    assert.deepEqual(systemes.map(s => s.label).slice(3), ["Japon", "Apport"]);
    assert.deepEqual(flux.slice(2), [
      { source: SYSTEME_INVESTISSEMENTS, cible: "projet-1", montant: 100 },
      { source: SYSTEME_INVESTISSEMENTS, cible: "projet-2", montant: 900 },
    ]);
  });

  test("sans placement, un projet est alimenté directement par les revenus", () => {
    const e = foyer({ patrimoine: 0, planetes: 0, versements: 0, projets: [
      { goalId: 1, nom: "Japon", couleur: "#f0abfc", acquis: 0, apport: 100, planetes: 0 },
    ]});
    const { flux } = construireSystemes(e);
    assert.deepEqual(flux.find(f => f.cible === "projet-1"),
      { source: SYSTEME_REVENUS, cible: "projet-1", montant: 100 });
  });
});

describe("systèmes vides", () => {
  // Montrer « Dépenses 0 € » à qui n'en a saisi aucune ajoute du vide, pas de
  // l'information — et c'est exactement ce que la refonte cherche à éviter.
  test("un foyer sans dépense n'affiche pas le système des dépenses", () => {
    assert.ok(!ids(foyer({ depenses: 0, lignesDepense: 0 })).includes(SYSTEME_DEPENSES));
  });

  test("un foyer sans patrimoine n'affiche pas les investissements", () => {
    assert.ok(!ids(foyer({ patrimoine: 0, planetes: 0 })).includes(SYSTEME_INVESTISSEMENTS));
  });

  test("un foyer tout neuf n'affiche rien du tout", () => {
    const vide = foyer({ revenus: 0, depenses: 0, patrimoine: 0, versements: 0, planetes: 0, lignesDepense: 0 });
    assert.deepEqual(construireSystemes(vide), { systemes: [], flux: [] });
  });

  test("des dépenses saisies mais à zéro restent visibles", () => {
    // Le système existe dès qu'on y a mis quelque chose, même à montant nul :
    // le faire disparaître donnerait l'impression d'avoir perdu la saisie.
    assert.ok(ids(foyer({ depenses: 0, lignesDepense: 3 })).includes(SYSTEME_DEPENSES));
  });

  test("un patrimoine négatif reste affiché", () => {
    // Plus de crédits que d'actifs, c'est une information, pas un vide.
    assert.ok(ids(foyer({ patrimoine: -12000, planetes: 0 })).includes(SYSTEME_INVESTISSEMENTS));
  });
});

describe("nature des montants", () => {
  test("les flux sont mensuels, les stocks ne le sont pas", () => {
    const { systemes } = construireSystemes(foyer());
    const par = Object.fromEntries(systemes.map(s => [s.id, s.parMois]));
    assert.equal(par[SYSTEME_REVENUS], true);
    assert.equal(par[SYSTEME_DEPENSES], true);
    assert.equal(par[SYSTEME_INVESTISSEMENTS], false);
  });

  test("un projet porte ce qui est réuni, pas un rythme", () => {
    const { systemes } = construireSystemes(foyer({ projets: [
      { goalId: 1, nom: "Japon", couleur: "#f0abfc", acquis: 32628, apport: 100, planetes: 1 },
    ]}));
    const japon = systemes.find(s => s.id === "projet-1")!;
    assert.equal(japon.parMois, false);
    assert.equal(japon.montant, 32628);
  });
});

describe("contexteUtile", () => {
  test("le patrimoine n'a de sens que là où il est la somme : les investissements", () => {
    assert.equal(contexteUtile("center", SYSTEME_INVESTISSEMENTS), true);
    assert.equal(contexteUtile("center", SYSTEME_REVENUS), false);
    assert.equal(contexteUtile("center", SYSTEME_DEPENSES), false);
    assert.equal(contexteUtile("center", projetId(7)), false);
  });

  test("les personnes disparaissent des dépenses : chaque planète porte déjà leur nom", () => {
    assert.equal(contexteUtile("member", SYSTEME_DEPENSES), false);
    assert.equal(contexteUtile("member", SYSTEME_REVENUS), true);
    assert.equal(contexteUtile("member", SYSTEME_INVESTISSEMENTS), true);
    assert.equal(contexteUtile("member", projetId(7)), true);
  });
});
