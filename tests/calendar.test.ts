import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { directionOf, upcomingByMonth, type FlowLike } from "../src/lib/calendar.ts";

const NOW = new Date(2026, 8, 12); // 12 septembre 2026

const flux = (over: Partial<FlowLike> = {}): FlowLike => ({
  id: 1,
  name: "Versement PEA",
  amount: "600",
  frequency: "monthly",
  createdAt: new Date(2026, 0, 5).toISOString(),
  sourceType: "salary",
  targetType: "portfolio",
  targetId: 1,
  ...over,
});

describe("direction", () => {
  test("distingue entrée, épargne et sortie", () => {
    assert.equal(directionOf(flux({ targetType: "income" })), "entree");
    assert.equal(directionOf(flux({ targetType: "expense" })), "sortie");
    assert.equal(directionOf(flux({ targetType: "portfolio" })), "epargne");
    assert.equal(directionOf(flux({ targetType: "goal" })), "epargne");
  });
});

describe("groupement par mois", () => {
  test("un flux mensuel donne une occurrence par mois", () => {
    const g = upcomingByMonth([flux()], 4, NOW);
    assert.ok(g.length >= 3 && g.length <= 4, `${g.length} mois`);
    for (const mois of g) assert.equal(mois.occurrences.length, 1);
  });

  test("les mois sont dans l'ordre chronologique et nommés en français", () => {
    const g = upcomingByMonth([flux()], 4, NOW);
    const cles = g.map(m => m.cle);
    assert.deepEqual([...cles].sort(), cles);
    assert.match(g[0].label, /(septembre|octobre) 2026/);
  });

  test("un flux annuel n'apparaît que dans son mois", () => {
    const annuel = flux({ frequency: "yearly", createdAt: new Date(2025, 10, 20).toISOString(), name: "Prime" });
    const g = upcomingByMonth([annuel], 6, NOW);
    const avec = g.filter(m => m.occurrences.length > 0);
    assert.equal(avec.length, 1, "une seule échéance sur 6 mois");
    assert.match(avec[0].label, /novembre 2026/);
  });

  test("un flux quotidien est cumulé par mois, pas énuméré jour par jour", () => {
    const quotidien = flux({ frequency: "daily", amount: "10", name: "Café" });
    const g = upcomingByMonth([quotidien], 3, NOW);
    for (const mois of g) {
      assert.equal(mois.occurrences.length, 1, `${mois.label} : une ligne cumulée`);
      assert.match(mois.occurrences[0].label, /quotidien/);
      // 28 à 31 jours × 10 €
      assert.ok(mois.occurrences[0].amount >= 280 && mois.occurrences[0].amount <= 310);
    }
  });

  test("un flux hebdomadaire donne quatre ou cinq occurrences par mois", () => {
    const hebdo = flux({ frequency: "weekly", amount: "25" });
    const g = upcomingByMonth([hebdo], 3, NOW);
    const plein = g[1];
    assert.ok(plein.occurrences.length >= 4 && plein.occurrences.length <= 5, `${plein.occurrences.length}`);
  });
});

describe("totaux par mois", () => {
  test("séparent entrées, épargne et sorties", () => {
    const g = upcomingByMonth([
      flux({ id: 1, amount: "600", targetType: "portfolio" }),
      flux({ id: 2, amount: "1150", targetType: "expense", name: "Loyer" }),
      flux({ id: 3, amount: "120", targetType: "income", name: "Loyer SCPI" }),
    ], 3, NOW);
    const mois = g.find(m => m.occurrences.length === 3)!;
    assert.equal(mois.epargne, 600);
    assert.equal(mois.sorties, 1150);
    assert.equal(mois.entrees, 120);
  });
});

describe("robustesse", () => {
  test("un montant illisible est ignoré plutôt que de propager un NaN", () => {
    const g = upcomingByMonth([flux({ amount: "beaucoup" })], 3, NOW);
    assert.equal(g.length, 0);
  });

  test("une date de création invalide n'arrête pas le calendrier", () => {
    const g = upcomingByMonth([flux({ createdAt: "pas une date" }), flux({ id: 2 })], 3, NOW);
    for (const mois of g) assert.equal(mois.occurrences.length, 1);
  });

  test("aucun flux, aucun mois", () => {
    assert.deepEqual(upcomingByMonth([], 6, NOW), []);
  });

  test("chaque occurrence a une clé unique", () => {
    const g = upcomingByMonth([flux({ id: 1 }), flux({ id: 2, name: "CTO" })], 6, NOW);
    const cles = g.flatMap(m => m.occurrences.map(o => o.key));
    assert.equal(new Set(cles).size, cles.length);
  });
});

describe("échéances passées", () => {
  // Le pointage porte d'abord sur ce qui a DÉJÀ eu lieu : le prélèvement du 6
  // qu'on veut vérifier. La première version partait de `nextOccurrenceDate`,
  // qui ne renvoie que du futur — aucune échéance passée n'existait.
  test("une fenêtre qui commence dans le passé contient les échéances passées", () => {
    const debut = new Date(2026, 5, 1); // juin 2026
    const g = upcomingByMonth([flux({ createdAt: new Date(2026, 0, 6).toISOString() })], 4, debut);
    assert.ok(g.length >= 3, `${g.length} mois`);
    assert.match(g[0].label, /juin 2026/);
    assert.equal(g[0].occurrences[0].date.getDate(), 6, "le jour du mois est conservé");
  });

  test("un flux créé après la fenêtre ne produit rien", () => {
    const g = upcomingByMonth([flux({ createdAt: new Date(2027, 5, 1).toISOString() })], 3, NOW);
    assert.deepEqual(g, []);
  });

  test("un flux ponctuel n'apparaît qu'une fois, à sa date", () => {
    const ponctuel = flux({ frequency: "once", createdAt: new Date(2026, 8, 20).toISOString(), name: "Prime" });
    const g = upcomingByMonth([ponctuel], 6, NOW);
    const total = g.reduce((n, m) => n + m.occurrences.length, 0);
    assert.equal(total, 1);
    assert.match(g[0].label, /septembre 2026/);
  });

  test("un flux hebdomadaire ancien ne fait pas boucler le calcul", () => {
    const vieux = flux({ frequency: "weekly", createdAt: new Date(2015, 0, 1).toISOString() });
    const g = upcomingByMonth([vieux], 2, NOW);
    const total = g.reduce((n, m) => n + m.occurrences.length, 0);
    assert.ok(total >= 8 && total <= 10, `${total} occurrences`);
  });
});

describe("échéances de fin de mois", () => {
  // Régression : la boucle avançait avec `setMonth`, qui déborde. Un flux ancré
  // le 31 janvier donnait 31/01 puis **3 mars** — février disparaissait de la
  // liste, et toutes les échéances suivantes tombaient le 3 à vie. Sur un écran
  // dont le seul rôle est de confirmer qu'un prélèvement est bien passé, perdre
  // un mois entier est la panne la plus grave, et elle ne se voyait pas.
  const jours = (f: FlowLike, mois: number, depuis: Date) =>
    upcomingByMonth([f], mois, depuis)
      .flatMap(g => g.occurrences)
      .map(o => `${o.date.getFullYear()}-${String(o.date.getMonth() + 1).padStart(2, "0")}-${String(o.date.getDate()).padStart(2, "0")}`);

  test("un flux du 31 tombe au dernier jour des mois courts, puis revient au 31", () => {
    const f = flux({ createdAt: new Date(2026, 0, 31).toISOString() });
    assert.deepEqual(jours(f, 6, new Date(2026, 0, 1)), [
      "2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31", "2026-06-30",
    ]);
  });

  test("un flux du 30 ne saute pas février", () => {
    const f = flux({ createdAt: new Date(2026, 0, 30).toISOString() });
    assert.deepEqual(jours(f, 4, new Date(2026, 0, 1)), [
      "2026-01-30", "2026-02-28", "2026-03-30", "2026-04-30",
    ]);
  });

  test("le 29 février d'une année bissextile existe bien", () => {
    const f = flux({ createdAt: new Date(2024, 0, 29).toISOString() });
    assert.deepEqual(jours(f, 3, new Date(2024, 0, 1)), [
      "2024-01-29", "2024-02-29", "2024-03-29",
    ]);
  });

  test("un flux annuel du 29 février retombe au 28 les années communes", () => {
    // 40 mois depuis janvier 2024 : la fenêtre court jusqu'au 30 avril 2027.
    const f = flux({ frequency: "yearly", createdAt: new Date(2024, 1, 29).toISOString() });
    assert.deepEqual(jours(f, 40, new Date(2024, 0, 1)), [
      "2024-02-29", "2025-02-28", "2026-02-28", "2027-02-28",
    ]);
  });

  test("chaque mois de la fenêtre reçoit exactement une échéance mensuelle", () => {
    const f = flux({ createdAt: new Date(2025, 0, 31).toISOString() });
    const groupes = upcomingByMonth([f], 12, new Date(2026, 0, 1));
    assert.equal(groupes.length, 12, "douze mois attendus");
    for (const g of groupes) assert.equal(g.occurrences.length, 1, `${g.cle} : une seule échéance`);
  });

  test("les clés restent uniques et datées en heure locale", () => {
    const f = flux({ createdAt: new Date(2026, 0, 31).toISOString() });
    const cles = upcomingByMonth([f], 6, new Date(2026, 0, 1)).flatMap(g => g.occurrences.map(o => o.key));
    assert.equal(new Set(cles).size, cles.length);
    assert.ok(cles.includes("1-2026-02-28"), cles.join(","));
  });

  test("un flux annuel garde son mois d'origine", () => {
    const f = flux({ frequency: "yearly", createdAt: new Date(2020, 10, 20).toISOString() });
    // 30 mois depuis janvier 2026 : la fenêtre s'arrête au 30 juin 2028, donc
    // l'échéance de novembre 2028 en sort.
    const j = jours(f, 30, new Date(2026, 0, 1));
    assert.deepEqual(j, ["2026-11-20", "2027-11-20"]);
  });

  test("un flux hebdomadaire garde un pas de sept jours", () => {
    const f = flux({ frequency: "weekly", createdAt: new Date(2026, 0, 1).toISOString() });
    const j = jours(f, 2, new Date(2026, 0, 1));
    for (let i = 1; i < j.length; i++) {
      const a = new Date(j[i - 1]), b = new Date(j[i]);
      assert.equal((b.getTime() - a.getTime()) / 86_400_000, 7, `${j[i - 1]} → ${j[i]}`);
    }
  });
});

describe("jour d'échéance choisi", () => {
  // Sans ce champ, la date d'une échéance venait du jour de saisie du flux :
  // un foyer qui enregistre ses dix prélèvements le même après-midi obtenait
  // dix échéances au même jour, et aucun moyen de dire « ça tombe le 6 ».
  const jours = (f: FlowLike, mois: number, depuis: Date) =>
    upcomingByMonth([f], mois, depuis).flatMap(g => g.occurrences)
      .map(o => `${o.date.getFullYear()}-${String(o.date.getMonth() + 1).padStart(2, "0")}-${String(o.date.getDate()).padStart(2, "0")}`);

  test("le jour choisi l'emporte sur celui de la création", () => {
    const f = flux({ createdAt: new Date(2026, 0, 22).toISOString(), dueDay: 6 });
    assert.deepEqual(jours(f, 3, new Date(2026, 0, 1)), ["2026-01-06", "2026-02-06", "2026-03-06"]);
  });

  test("le 31 choisi devient le dernier jour des mois courts", () => {
    const f = flux({ createdAt: new Date(2026, 0, 15).toISOString(), dueDay: 31 });
    assert.deepEqual(jours(f, 4, new Date(2026, 0, 1)), ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  });

  test("sans jour choisi, on garde celui de la création", () => {
    const f = flux({ createdAt: new Date(2026, 0, 22).toISOString() });
    assert.deepEqual(jours(f, 2, new Date(2026, 0, 1)), ["2026-01-22", "2026-02-22"]);
  });

  test("un jour hors bornes est ignoré plutôt que de produire une date absurde", () => {
    for (const mauvais of [0, 32, -3, NaN]) {
      const f = flux({ createdAt: new Date(2026, 0, 22).toISOString(), dueDay: mauvais });
      assert.deepEqual(jours(f, 1, new Date(2026, 0, 1)), ["2026-01-22"], `dueDay=${mauvais}`);
    }
  });

  test("deux flux saisis le même jour peuvent tomber à des dates différentes", () => {
    const meme = new Date(2026, 0, 22).toISOString();
    const a = jours(flux({ id: 1, createdAt: meme, dueDay: 3 }), 1, new Date(2026, 0, 1));
    const b = jours(flux({ id: 2, createdAt: meme, dueDay: 28 }), 1, new Date(2026, 0, 1));
    assert.deepEqual(a, ["2026-01-03"]);
    assert.deepEqual(b, ["2026-01-28"]);
  });
});
