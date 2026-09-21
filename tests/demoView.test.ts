import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  demoAssets, demoFlows, demoGoalLinks, demoGoals, demoLoans, demoMembers,
  demoOccurrences, demoOverdue, demoOwnerships, demoPortfolios, demoSettings,
  demoSnapshots, demoTours,
} from "../src/lib/demoView.ts";

const NOW = new Date(2026, 8, 12); // 12 septembre 2026

describe("foyer de démonstration", () => {
  test("chaque table a des identifiants uniques", () => {
    for (const [nom, rows] of Object.entries({
      membres: demoMembers(NOW), planètes: demoPortfolios(NOW), actifs: demoAssets(NOW),
      crédits: demoLoans(NOW), objectifs: demoGoals(NOW), liens: demoGoalLinks(NOW),
      quotesParts: demoOwnerships(NOW), flux: demoFlows(NOW), échéances: demoOccurrences(NOW),
    })) {
      const ids = (rows as { id: number }[]).map((r) => r.id);
      assert.equal(new Set(ids).size, ids.length, `${nom} : identifiants en double`);
      assert.ok(ids.every((i) => Number.isInteger(i) && i > 0), `${nom} : identifiant invalide`);
    }
  });

  // L'interface relie les actifs aux planètes par ces nombres : une référence
  // qui pointe dans le vide donne une galaxie trouée, ce qu'un prospect verrait.
  test("toutes les références pointent sur quelque chose d'existant", () => {
    const membres = new Set(demoMembers(NOW).map((m) => m.id));
    const planetes = new Set(demoPortfolios(NOW).map((p) => p.id));
    const actifs = new Set(demoAssets(NOW).map((a) => a.id));
    const objectifs = new Set(demoGoals(NOW).map((g) => g.id));

    for (const a of demoAssets(NOW)) assert.ok(a.portfolioId != null && planetes.has(a.portfolioId), a.name);
    for (const p of demoPortfolios(NOW)) if (p.memberId != null) assert.ok(membres.has(p.memberId), p.name);
    for (const l of demoLoans(NOW)) assert.ok(l.assetId != null && actifs.has(l.assetId), l.name);
    for (const g of demoGoals(NOW)) if (g.memberId != null) assert.ok(membres.has(g.memberId), g.name);
    for (const gl of demoGoalLinks(NOW)) {
      assert.ok(objectifs.has(gl.goalId));
      assert.ok(planetes.has(gl.portfolioId));
    }
    for (const o of demoOwnerships(NOW)) {
      assert.ok(planetes.has(o.portfolioId));
      if (o.memberId != null) assert.ok(membres.has(o.memberId));
    }
    for (const f of demoFlows(NOW)) {
      if (f.targetType === "portfolio") assert.ok(f.targetId != null && planetes.has(f.targetId), String(f.name));
      if (f.targetType === "goal") assert.ok(f.targetId != null && objectifs.has(f.targetId), String(f.name));
      if (f.sourceType === "member_salary") assert.ok(f.sourceId != null && membres.has(f.sourceId), String(f.name));
    }
  });

  test("les identifiants ne bougent pas d'un appel à l'autre", () => {
    const a = demoPortfolios(NOW).map((p) => `${p.id}:${p.name}`);
    const b = demoPortfolios(new Date(2027, 2, 4)).map((p) => `${p.id}:${p.name}`);
    assert.deepEqual(a, b);
  });

  // Le point de tout ce module : la démonstration se partage, donc elle ne doit
  // rien pouvoir emprunter à la vraie base.
  test("les quotes-parts d'une planète font 100 %", () => {
    const parPlanete = new Map<number, number>();
    for (const o of demoOwnerships(NOW)) {
      parPlanete.set(o.portfolioId, (parPlanete.get(o.portfolioId) ?? 0) + Number(o.sharePercent));
    }
    for (const [pid, total] of parPlanete) assert.equal(total, 100, `planète ${pid}`);
  });

  test("les échéances tombent à des jours variés, pas toutes le même", () => {
    const jours = new Set(demoFlows(NOW).map((f) => f.createdAt.getDate()));
    assert.ok(jours.size >= 5, `attendu au moins 5 jours distincts, reçu ${jours.size} : ${[...jours]}`);
  });

  test("le passé est pointé, le mois courant reste à faire", () => {
    const occ = demoOccurrences(NOW);
    assert.ok(occ.length > 20, `échéances : ${occ.length}`);
    const passees = occ.filter((o) => o.dueDate < "2026-09");
    assert.ok(passees.length > 0);
    assert.ok(passees.every((o) => o.status === "confirmed"), "une échéance passée non pointée");
    assert.ok(occ.some((o) => o.status === "pending"), "rien à pointer : la pastille ne s'allumerait jamais");
  });

  test("le compteur de retards correspond aux échéances échues non pointées", () => {
    const attendu = demoOccurrences(NOW)
      .filter((o) => o.status === "pending" && o.dueDate <= "2026-09-12").length;
    assert.equal(demoOverdue(NOW), attendu);
  });

  test("une échéance pointée porte un montant constaté, pas l'inverse", () => {
    for (const o of demoOccurrences(NOW)) {
      if (o.status === "confirmed") assert.ok(o.actualAmount != null, `${o.dueDate} pointée sans montant`);
      else assert.equal(o.actualAmount, null, `${o.dueDate} non pointée mais chiffrée`);
    }
  });

  test("l'historique est continu et strictement daté", () => {
    const s = demoSnapshots(NOW);
    assert.ok(s.length >= 12, `${s.length} points`);
    for (let i = 1; i < s.length; i++) assert.ok(s[i].date > s[i - 1].date, `${s[i - 1].date} → ${s[i].date}`);
    for (const p of s) {
      // Le net, comme dans la vraie table : la courbe et la fin de tour le lisent là.
      assert.equal(p.totalValue, p.netWorth);
      assert.ok(Number(p.netWorth) > 0);
    }
  });

  test("l'historique est identique d'un appel à l'autre", () => {
    assert.deepEqual(demoSnapshots(NOW), demoSnapshots(NOW));
  });

  test("les réglages donnent un foyer nommé et une devise", () => {
    const s = demoSettings();
    assert.ok(s.owner_name);
    assert.ok(s.display_currency);
    assert.ok(Number(s.monthly_salary) > 0);
  });
});

describe("journal des tours de démonstration", () => {
  test("trois tours déjà joués, un par mois, chronologiques", () => {
    const t = demoTours(NOW);
    assert.equal(t.length, 3);
    const mois = t.map((x) => x.mois);
    assert.deepEqual([...mois].sort(), mois, "les tours doivent déjà être dans l'ordre chronologique");
    assert.equal(new Set(mois).size, mois.length, "un tour par mois");
  });

  test("le patrimoine progresse d'un tour à l'autre, comme le montre le journal", () => {
    const t = demoTours(NOW);
    for (let i = 1; i < t.length; i++) {
      assert.ok(Number(t[i].patrimoineNet) > Number(t[i - 1].patrimoineNet), `${t[i - 1].mois} → ${t[i].mois}`);
    }
  });

  test("le premier tour constate beaucoup de découvertes d'un coup, les suivants peu ou aucune", () => {
    const [premier, ...reste] = demoTours(NOW);
    assert.ok(premier.decouvertes.length >= 10, `${premier.decouvertes.length} découvertes au premier tour`);
    for (const t of reste) assert.ok(t.decouvertes.length <= 2, `${t.mois} : ${t.decouvertes.length} découvertes`);
  });

  test("chaque tour propose au moins une quête, avec un id et un titre", () => {
    for (const t of demoTours(NOW)) {
      assert.ok(t.quetes.length > 0, t.mois);
      for (const q of t.quetes) { assert.ok(q.id); assert.ok(q.titre); }
    }
  });

  test("l'historique est identique d'un appel à l'autre", () => {
    assert.deepEqual(demoTours(NOW), demoTours(NOW));
  });
});
