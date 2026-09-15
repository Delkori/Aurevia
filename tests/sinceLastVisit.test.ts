import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  summarizeSinceLastVisit,
  type SummaryInput,
  type VisitMemory,
} from "../src/lib/sinceLastVisit.ts";

const NOW = new Date("2026-09-11T10:00:00Z");
const fmt = (v: number) => `${Math.round(v)} €`;

const base = (over: Partial<SummaryInput> = {}): SummaryInput => ({
  memory: null,
  netWorth: 100000,
  goals: [],
  flows: [],
  dividends: [],
  staleCount: 0,
  formatMoney: fmt,
  now: NOW,
  ...over,
});

const memory = (over: Partial<VisitMemory> = {}): VisitMemory => ({
  date: "2026-09-04",
  netWorth: 100000,
  goalProgress: {},
  ...over,
});

const ids = (input: SummaryInput) =>
  summarizeSinceLastVisit(input).highlights.map((h) => h.id);

describe("première visite", () => {
  test("sans mémoire, aucun delta n'est inventé", () => {
    const { daysSince, highlights } = summarizeSinceLastVisit(base());
    assert.equal(daysSince, null);
    assert.equal(highlights.length, 0);
  });

  test("les échéances à venir s'affichent même sans mémoire", () => {
    const input = base({
      dividends: [
        { ticker: "MC.PA", assetName: "LVMH", date: "2026-09-20", amount: 140 },
      ],
    });
    assert.deepEqual(ids(input), ["dividends"]);
  });
});

describe("patrimoine net", () => {
  test("compte les jours écoulés", () => {
    const { daysSince } = summarizeSinceLastVisit(base({ memory: memory() }));
    assert.equal(daysSince, 7);
  });

  test("signale une hausse", () => {
    const { highlights } = summarizeSinceLastVisit(
      base({ memory: memory({ netWorth: 100000 }), netWorth: 104000 })
    );
    assert.equal(highlights[0].tone, "positive");
    assert.match(highlights[0].text, /hausse de 4000 €/);
    assert.match(highlights[0].text, /\+4\.0 %/);
  });

  test("signale une baisse", () => {
    const { highlights } = summarizeSinceLastVisit(
      base({ memory: memory({ netWorth: 100000 }), netWorth: 92000 })
    );
    assert.equal(highlights[0].tone, "negative");
    assert.match(highlights[0].text, /baisse de 8000 €/);
  });

  test("ignore le bruit de cotation sous 0,1 %", () => {
    const input = base({ memory: memory({ netWorth: 100000 }), netWorth: 100050 });
    assert.deepEqual(ids(input), []);
  });

  test("un patrimoine précédent nul ne produit pas de pourcentage infini", () => {
    const input = base({ memory: memory({ netWorth: 0 }), netWorth: 5000 });
    assert.deepEqual(ids(input), []);
  });
});

describe("paliers d'objectifs", () => {
  const goal = (progress: number) => [{ id: 1, name: "Japon", progress }];

  test("signale un palier franchi", () => {
    const { highlights } = summarizeSinceLastVisit(
      base({
        memory: memory({ goalProgress: { "1": 0.45 } }),
        goals: goal(0.62),
      })
    );
    assert.equal(highlights[0].id, "goal-1");
    assert.match(highlights[0].text, /50 % franchis/);
  });

  test("annonce l'objectif atteint plutôt qu'un palier", () => {
    const { highlights } = summarizeSinceLastVisit(
      base({ memory: memory({ goalProgress: { "1": 0.8 } }), goals: goal(1.0) })
    );
    assert.match(highlights[0].text, /atteint/);
  });

  test("ne répète pas un palier déjà franchi", () => {
    const input = base({
      memory: memory({ goalProgress: { "1": 0.62 } }),
      goals: goal(0.68),
    });
    assert.deepEqual(ids(input), []);
  });

  test("un objectif inconnu de la dernière visite ne déclenche rien", () => {
    const input = base({ memory: memory({ goalProgress: {} }), goals: goal(0.9) });
    assert.deepEqual(ids(input), []);
  });

  test("un objectif qui recule ne déclenche rien", () => {
    const input = base({
      memory: memory({ goalProgress: { "1": 0.8 } }),
      goals: goal(0.4),
    });
    assert.deepEqual(ids(input), []);
  });
});

describe("échéances à venir", () => {
  const flow = (over = {}) => ({
    id: 1,
    name: null,
    amount: 600,
    frequency: "monthly",
    createdAt: "2026-09-13T00:00:00Z",
    targetLabel: "PEA",
    ...over,
  });

  test("annonce un versement unique avec sa destination", () => {
    const { highlights } = summarizeSinceLastVisit(base({ flows: [flow()] }));
    assert.equal(highlights[0].kind, "payment");
    assert.match(highlights[0].text, /600 € vers PEA/);
    assert.match(highlights[0].text, /dans 2 j/);
  });

  test("agrège plusieurs versements de la semaine", () => {
    const { highlights } = summarizeSinceLastVisit(
      base({ flows: [flow(), flow({ id: 2, amount: 250, targetLabel: "CTO" })] })
    );
    assert.match(highlights[0].text, /2 versements/);
    assert.match(highlights[0].text, /850 €/);
  });

  test("ignore ce qui tombe au-delà de 7 jours", () => {
    const input = base({ flows: [flow({ createdAt: "2026-09-25T00:00:00Z" })] });
    assert.deepEqual(ids(input), []);
  });

  test("ignore un dividende déjà passé", () => {
    const input = base({
      dividends: [{ ticker: "MC.PA", assetName: "LVMH", date: "2026-08-01", amount: 140 }],
    });
    assert.deepEqual(ids(input), []);
  });
});

describe("cours manquants", () => {
  test("aucune variation de patrimoine n'est annoncée quand des cours manquent", () => {
    // Un cours qui n'arrive pas fait retomber sa ligne sur son prix de revient :
    // le total chute sans que rien n'ait bougé. Annoncer « en baisse de 8000 € »
    // serait un mouvement inventé — la ligne « cours manquants » dit déjà le vrai.
    const input = base({ memory: memory({ netWorth: 100000 }), netWorth: 92000, staleCount: 1 });
    assert.deepEqual(ids(input), ["stale"]);
  });

  test("une hausse non plus : la comparaison entière est suspendue", () => {
    const input = base({ memory: memory({ netWorth: 100000 }), netWorth: 104000, staleCount: 2 });
    assert.deepEqual(ids(input), ["stale"]);
  });

  test("le patrimoine reparle dès que tous les cours sont là", () => {
    const input = base({ memory: memory({ netWorth: 100000 }), netWorth: 92000, staleCount: 0 });
    assert.deepEqual(ids(input), ["networth"]);
  });

  test("le singulier et le pluriel sont corrects", () => {
    assert.match(
      summarizeSinceLastVisit(base({ staleCount: 1 })).highlights[0].text,
      /^1 ligne est valorisée/
    );
    assert.match(
      summarizeSinceLastVisit(base({ staleCount: 3 })).highlights[0].text,
      /^3 lignes sont valorisées/
    );
  });
});

describe("ordre des informations", () => {
  test("le patrimoine passe avant les objectifs, puis les échéances", () => {
    const input = base({
      memory: memory({ netWorth: 90000, goalProgress: { "1": 0.4 } }),
      netWorth: 100000,
      goals: [{ id: 1, name: "Japon", progress: 0.55 }],
      flows: [
        { id: 1, name: null, amount: 600, frequency: "monthly", createdAt: "2026-09-13T00:00:00Z", targetLabel: "PEA" },
      ],
      dividends: [{ ticker: "MC.PA", assetName: "LVMH", date: "2026-09-20", amount: 140 }],
    });
    assert.deepEqual(ids(input), ["networth", "goal-1", "payments", "dividends"]);
  });

  test("les cours manquants ferment la liste", () => {
    const input = base({
      flows: [
        { id: 1, name: null, amount: 600, frequency: "monthly", createdAt: "2026-09-13T00:00:00Z", targetLabel: "PEA" },
      ],
      dividends: [{ ticker: "MC.PA", assetName: "LVMH", date: "2026-09-20", amount: 140 }],
      staleCount: 2,
    });
    assert.deepEqual(ids(input), ["payments", "dividends", "stale"]);
  });
});
