import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  monthlyRateFromAnnual,
  monthsToReach,
  projectNetWorth,
} from "../src/lib/projection.ts";
import { daysUntilNextOccurrence, nextOccurrenceDate } from "../src/lib/dates.ts";

describe("monthlyRateFromAnnual", () => {
  test("12 mois de taux mensuel composé redonnent le taux annuel", () => {
    const r = monthlyRateFromAnnual(7);
    assert.ok(Math.abs((1 + r) ** 12 - 1.07) < 1e-12);
  });

  test("un rendement nul reste nul", () => {
    assert.equal(monthlyRateFromAnnual(0), 0);
  });
});

describe("projectNetWorth", () => {
  test("part de la valeur actuelle au mois 0", () => {
    const pts = projectNetWorth(10000, 500, 5, 12);
    assert.equal(pts[0].value, 10000);
    assert.equal(pts[0].contributed, 0);
    assert.equal(pts.length, 13);
  });

  test("sans rendement, la croissance est exactement la somme des versements", () => {
    const pts = projectNetWorth(1000, 100, 0, 10);
    assert.equal(pts[10].value, 2000);
    assert.equal(pts[10].contributed, 1000);
  });

  test("le rendement fait dépasser la somme des versements", () => {
    const pts = projectNetWorth(1000, 100, 8, 120);
    assert.ok(pts[120].value > 1000 + pts[120].contributed);
  });
});

describe("monthsToReach", () => {
  test("renvoie 0 si l'objectif est déjà atteint", () => {
    assert.equal(monthsToReach(5000, 100, 5, 5000), 0);
    assert.equal(monthsToReach(6000, 100, 5, 5000), 0);
  });

  test("compte les mois sans rendement", () => {
    assert.equal(monthsToReach(0, 100, 0, 1000), 10);
  });

  test("renvoie null si l'objectif est hors de portée", () => {
    assert.equal(monthsToReach(0, 0, 0, 1000), null);
  });

  test("un rendement plus élevé ne peut pas rallonger le délai", () => {
    const lent = monthsToReach(1000, 200, 2, 50000)!;
    const rapide = monthsToReach(1000, 200, 9, 50000)!;
    assert.ok(rapide <= lent);
  });
});

describe("daysUntilNextOccurrence", () => {
  test("une échéance mensuelle tombe dans moins de 32 jours", () => {
    const old = new Date(Date.now() - 400 * 86400000).toISOString();
    const d = daysUntilNextOccurrence(old, "monthly");
    assert.ok(d >= 0 && d <= 32, `attendu 0..32, reçu ${d}`);
  });

  test("une échéance hebdomadaire tombe dans moins de 8 jours", () => {
    const old = new Date(Date.now() - 400 * 86400000).toISOString();
    const d = daysUntilNextOccurrence(old, "weekly");
    assert.ok(d >= 0 && d <= 8, `attendu 0..8, reçu ${d}`);
  });

  test("une date invalide ne fait pas planter l'affichage", () => {
    assert.ok(Number.isNaN(daysUntilNextOccurrence("pas une date", "monthly")));
    assert.equal(nextOccurrenceDate("pas une date", "monthly"), null);
  });

  test("la prochaine occurrence est toujours dans le futur", () => {
    const old = new Date(Date.now() - 900 * 86400000).toISOString();
    for (const freq of ["daily", "weekly", "monthly", "yearly"]) {
      const next = nextOccurrenceDate(old, freq)!;
      assert.ok(next.getTime() > Date.now(), `${freq} : ${next.toISOString()}`);
    }
  });
});

describe("échéances anciennes", () => {
  // Régression : la boucle plafonnée à 1000 itérations rendait la main avec une
  // date encore passée pour un flux quotidien vieux de plus de ~3 ans, affiché
  // « aujourd'hui » à tort.
  const TROIS_ANS = 3 * 365 * 86400000;

  test("un flux quotidien vieux de 3 ans reste à moins de 2 jours", () => {
    const vieux = new Date(Date.now() - TROIS_ANS).toISOString();
    const d = daysUntilNextOccurrence(vieux, "daily");
    assert.ok(d >= 0 && d <= 2, `attendu 0..2, reçu ${d}`);
  });

  test("un flux quotidien vieux de 10 ans tombe toujours dans le futur", () => {
    const tresVieux = new Date(Date.now() - 10 * 365 * 86400000).toISOString();
    const next = nextOccurrenceDate(tresVieux, "daily")!;
    assert.ok(next.getTime() > Date.now());
    assert.ok(next.getTime() - Date.now() <= 2 * 86400000);
  });

  test("une date de création future est renvoyée telle quelle", () => {
    const futur = new Date(Date.now() + 10 * 86400000);
    assert.equal(
      nextOccurrenceDate(futur.toISOString(), "monthly")!.getTime(),
      futur.getTime()
    );
  });

  test("un flux du 31 ne se perd pas dans les mois courts", () => {
    const le31 = new Date(2024, 0, 31).toISOString();
    const next = nextOccurrenceDate(le31, "monthly")!;
    assert.ok(next.getTime() > Date.now());
  });
});

describe("échéance de la période en cours", () => {
  // Régression : la formule ajoutait une période sans regarder si celle de la
  // période courante était encore devant. Un prélèvement annuel du 20 novembre
  // consulté en septembre annonçait novembre de l'ANNÉE SUIVANTE ; un
  // prélèvement mensuel du 25 consulté le 3 annonçait le mois d'après.
  const dansCombienDeJours = (creation: Date, freq: string) =>
    Math.ceil((nextOccurrenceDate(creation.toISOString(), freq)!.getTime() - Date.now()) / 86400000);

  test("un flux annuel tombe dans moins d'un an", () => {
    const il_y_a_10_mois = new Date();
    il_y_a_10_mois.setMonth(il_y_a_10_mois.getMonth() - 10);
    const j = dansCombienDeJours(il_y_a_10_mois, "yearly");
    assert.ok(j > 0 && j <= 366, `attendu 1..366, reçu ${j}`);
  });

  test("un flux mensuel tombe dans moins de 32 jours", () => {
    const il_y_a_3_mois = new Date();
    il_y_a_3_mois.setMonth(il_y_a_3_mois.getMonth() - 3);
    const j = dansCombienDeJours(il_y_a_3_mois, "monthly");
    assert.ok(j > 0 && j <= 32, `attendu 1..32, reçu ${j}`);
  });

  test("une échéance d'hier passe au mois suivant, pas au surlendemain", () => {
    const hier = new Date();
    hier.setDate(hier.getDate() - 1);
    hier.setMonth(hier.getMonth() - 2);
    const j = dansCombienDeJours(hier, "monthly");
    assert.ok(j >= 27 && j <= 32, `attendu ~30, reçu ${j}`);
  });
});

describe("date de référence injectée", () => {
  // Régression : `nextOccurrenceDate` appelait `new Date()` en dur. Le résumé
  // « depuis ta dernière visite » lui passait pourtant sa propre date de
  // référence, si bien que deux « maintenant » différents cohabitaient dans le
  // même calcul. Résultat : trois tests qui ne dépendaient d'aucune horloge en
  // apparence se sont mis à échouer au simple changement de jour.
  const LE_11 = new Date("2026-09-11T10:00:00Z");

  test("une échéance future est rendue telle quelle, quelle que soit l'heure réelle", () => {
    const d = nextOccurrenceDate("2026-09-13T00:00:00Z", "monthly", LE_11)!;
    assert.equal(d.toISOString().slice(0, 10), "2026-09-13");
  });

  test("le nombre de jours se compte depuis la date fournie, pas depuis aujourd'hui", () => {
    assert.equal(daysUntilNextOccurrence("2026-09-13T00:00:00Z", "monthly", LE_11), 2);
  });

  test("deux appels à des dates de référence différentes ne donnent pas le même résultat", () => {
    const depuisLe11 = daysUntilNextOccurrence("2026-09-13T00:00:00Z", "monthly", LE_11);
    const depuisLe12 = daysUntilNextOccurrence("2026-09-13T00:00:00Z", "monthly", new Date("2026-09-12T10:00:00Z"));
    assert.equal(depuisLe11, 2);
    assert.equal(depuisLe12, 1);
  });

  test("sans date fournie, l'horloge réelle sert toujours de référence", () => {
    const loin = new Date(Date.now() + 30 * 86400000).toISOString();
    assert.equal(nextOccurrenceDate(loin, "monthly")!.toISOString(), loin);
  });
});
