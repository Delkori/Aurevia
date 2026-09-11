import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  ValidationError,
  oneOf,
  optColor,
  optDate,
  optId,
  optNumeric,
  optString,
  reqNumeric,
  reqString,
  routeId,
} from "../src/lib/validate.ts";

const rejects = (fn: () => unknown, fragment?: string) => {
  assert.throws(fn, (err: unknown) => {
    assert.ok(err instanceof ValidationError, `attendu ValidationError, reçu ${err}`);
    if (fragment) assert.match((err as Error).message, new RegExp(fragment));
    return true;
  });
};

describe("nombres", () => {
  test("accepte la virgule décimale d'un clavier français", () => {
    assert.equal(reqNumeric("12,5", "Quantité"), "12.5");
  });

  test("accepte les espaces de milliers, y compris insécables", () => {
    assert.equal(reqNumeric("1 200,50", "Prix"), "1200.5");
    assert.equal(reqNumeric("1 200,50", "Prix"), "1200.5");
    assert.equal(reqNumeric("1 200", "Prix"), "1200");
  });

  test("accepte un nombre JSON aussi bien qu'une chaîne", () => {
    assert.equal(reqNumeric(42, "Montant"), "42");
    assert.equal(reqNumeric("42", "Montant"), "42");
  });

  test("refuse ce qui n'est pas un nombre, en citant la valeur reçue", () => {
    rejects(() => reqNumeric("beaucoup", "Quantité"), "beaucoup");
    rejects(() => reqNumeric("12,5,3", "Quantité"));
    rejects(() => reqNumeric(NaN, "Quantité"));
    rejects(() => reqNumeric(Infinity, "Quantité"));
  });

  test("fait respecter les bornes", () => {
    rejects(() => reqNumeric("-5", "Quantité", { min: 0 }), "inférieur à 0");
    rejects(() => reqNumeric("150", "Part", { max: 100 }), "dépasser 100");
    assert.equal(reqNumeric("0", "Quantité", { min: 0 }), "0");
    assert.equal(reqNumeric("100", "Part", { max: 100 }), "100");
  });

  test("optNumeric distingue « absent » de « zéro »", () => {
    assert.equal(optNumeric(null, "x"), null);
    assert.equal(optNumeric("", "x"), null);
    assert.equal(optNumeric(undefined, "x"), null);
    assert.equal(optNumeric("0", "x"), "0");
    assert.equal(optNumeric(0, "x"), "0");
  });
});

describe("texte", () => {
  test("supprime les espaces autour", () => {
    assert.equal(reqString("  PEA  ", "Nom"), "PEA");
  });

  test("refuse une chaîne vide ou d'espaces", () => {
    rejects(() => reqString("", "Nom"), "obligatoire");
    rejects(() => reqString("   ", "Nom"), "obligatoire");
    rejects(() => reqString(null, "Nom"));
    rejects(() => reqString(42, "Nom"));
  });

  test("borne la longueur", () => {
    rejects(() => reqString("x".repeat(201), "Nom"), "200 caractères");
    rejects(() => optString("x".repeat(41), "Ticker", 40), "40 caractères");
  });

  test("optString ramène une chaîne d'espaces à null", () => {
    assert.equal(optString("   ", "Ticker"), null);
    assert.equal(optString("", "Ticker"), null);
    assert.equal(optString(" AAPL ", "Ticker"), "AAPL");
  });
});

describe("vocabulaires fermés", () => {
  const TYPES = ["stock", "etf"] as const;

  test("accepte une valeur du vocabulaire", () => {
    assert.equal(oneOf("etf", "Type", TYPES), "etf");
  });

  test("refuse une valeur hors vocabulaire en les listant", () => {
    rejects(() => oneOf("licorne", "Type", TYPES), "stock, etf");
  });

  test("utilise la valeur par défaut quand le champ est absent", () => {
    assert.equal(oneOf(undefined, "Devise", ["EUR", "USD"] as const, "EUR"), "EUR");
    assert.equal(oneOf("", "Devise", ["EUR", "USD"] as const, "EUR"), "EUR");
  });

  test("une valeur par défaut ne rattrape pas une valeur fausse", () => {
    rejects(() => oneOf("XBT", "Devise", ["EUR", "USD"] as const, "EUR"));
  });
});

describe("couleurs et dates", () => {
  test("n'accepte que #rrggbb", () => {
    assert.equal(optColor("#7c6af5", "Couleur", "#000000"), "#7c6af5");
    assert.equal(optColor(null, "Couleur", "#000000"), "#000000");
    rejects(() => optColor("rouge", "Couleur", "#000000"));
    rejects(() => optColor("#abc", "Couleur", "#000000"));
    rejects(() => optColor("7c6af5", "Couleur", "#000000"));
  });

  test("n'accepte que le format AAAA-MM-JJ", () => {
    assert.equal(optDate("2027-04-12", "Date"), "2027-04-12");
    assert.equal(optDate(null, "Date"), null);
    rejects(() => optDate("12/04/2027", "Date"), "AAAA-MM-JJ");
    rejects(() => optDate("2027-13-45", "Date"));
  });
});

describe("identifiants", () => {
  test("refuse un identifiant de route non entier", () => {
    assert.equal(routeId("42"), 42);
    rejects(() => routeId("abc"), "Identifiant invalide");
    rejects(() => routeId("-1"));
    rejects(() => routeId("1.5"));
    // Régression : `Number("abc")` donnait NaN, transmis tel quel à Postgres.
    rejects(() => routeId(""));
  });

  test("optId accepte l'absence mais pas une valeur bancale", () => {
    assert.equal(optId(null, "Membre"), null);
    assert.equal(optId("", "Membre"), null);
    assert.equal(optId("7", "Membre"), 7);
    rejects(() => optId("0", "Membre"));
    rejects(() => optId("abc", "Membre"));
  });
});
