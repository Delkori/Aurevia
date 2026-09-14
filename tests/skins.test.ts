import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  FILTRE_ETEINT, imageDepenses, imageSatellite, imageSysteme, palierDepenses, skinFromName,
} from "../src/lib/skins.ts";

describe("palierDepenses", () => {
  test("sans dépense, la planète est au calme", () => {
    assert.equal(palierDepenses(0, 3000), "calm");
  });

  test("les paliers suivent la part des revenus, pas le montant", () => {
    assert.equal(palierDepenses(1000, 3000), "warning");   // 33 %
    assert.equal(palierDepenses(2000, 3000), "eruption");  // 67 %
    assert.equal(palierDepenses(3500, 3000), "critical");  // 117 %
  });

  test("sans revenu connu, on ne crie pas au déficit", () => {
    assert.equal(palierDepenses(2000, 0), "warning");
  });
});

describe("imageSysteme", () => {
  const base = { label: "", montant: 0, max: 1 };

  test("les revenus prennent la campagne, d'autant plus riche qu'ils sont gros", () => {
    const petit = imageSysteme({ ...base, genre: "revenus", montant: 1200 });
    const gros = imageSysteme({ ...base, genre: "revenus", montant: 9000 });
    assert.match(petit!, /salary-1/);
    assert.match(gros!, /salary-3/);
  });

  test("les dépenses prennent leur palier", () => {
    assert.match(imageSysteme({ ...base, genre: "depenses", montant: 2500, revenus: 3000 })!, /expenses-eruption/);
  });

  test("à zéro, la planète du premier palier — c'est le filtre qui l'éteint", () => {
    // Une sphère nue au milieu de planètes texturées se lisait comme un défaut
    // d'affichage ; le volcan éteint se lit comme un budget vide.
    assert.match(imageSysteme({ ...base, genre: "depenses", montant: 0, revenus: 3000 })!, /expenses-warning/);
    assert.equal(imageDepenses("calm"), imageDepenses("warning"));
    assert.match(FILTRE_ETEINT, /grayscale/);
  });

  test("le patrimoine prend le visage de sa plus grosse planète", () => {
    assert.equal(skinFromName("Appartement Lyon"), "terrain");
    const img = imageSysteme({ genre: "investissements", label: "Investissements", montant: 300000, max: 300000, contenus: ["Appartement Lyon", "PEA"] });
    assert.match(img!, /terrain-3/, "au plafond de l'échelle, le palier le plus dense");
  });

  test("on descend la liste jusqu'à un nom qui dise quelque chose", () => {
    const img = imageSysteme({ genre: "investissements", label: "Investissements", montant: 300000, max: 300000, contenus: ["Compte courant", "Divers", "PEA"] });
    assert.match(img!, /ocean/, "le PEA sauve un habillage que les deux premiers ne donnaient pas");
  });

  test("un projet de voyage passe avant ce qui le finance", () => {
    const img = imageSysteme({ genre: "projet", label: "Vacances au Japon", montant: 32628, max: 300000, contenus: ["Crypto"] });
    assert.match(img!, /vacances/);
  });

  test("un projet sans thème se lit comme un patrimoine : par son contenu", () => {
    const img = imageSysteme({ genre: "projet", label: "Apport résidence principale", montant: 97797, max: 300000, contenus: ["Assurance-vie", "PEA"] });
    assert.match(img!, /ocean/);
  });

  test("un corps vide ne réclame aucune image", () => {
    assert.equal(imageSysteme({ ...base, genre: "investissements" }), undefined);
    assert.equal(imageSysteme({ ...base, genre: "projet", label: "Voiture" }), undefined);
  });
});

describe("imageSatellite", () => {
  test("une source de revenu est un bout de la même campagne, à sa mesure", () => {
    assert.match(imageSatellite({ nom: "Salaire principal", montant: 3200 }, "revenus")!, /salary-2/);
    assert.match(imageSatellite({ nom: "Loyer SCPI", montant: 120 }, "revenus")!, /salary-1/);
  });

  test("une ligne de dépense prend le palier le plus calme : seule, elle ne fait pas un déficit", () => {
    assert.match(imageSatellite({ nom: "Loyer", montant: 1150 }, "depenses")!, /expenses-warning/);
    assert.match(imageSatellite({ nom: "Transports", montant: 140 }, "depenses")!, /expenses-warning/);
  });

  test("ailleurs c'est le nom qui décide, et un nom muet reste une pastille", () => {
    assert.match(imageSatellite({ nom: "PEA", montant: 31497 }, "investissements")!, /ocean/);
    assert.match(imageSatellite({ nom: "Appartement Lyon", montant: 340000 }, "projet")!, /terrain/);
    assert.equal(imageSatellite({ nom: "Divers", montant: 10 }, "investissements"), undefined);
  });
});
