import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  SESSION_TTL_MS,
  createSessionToken,
  timingSafeEqual,
  verifySessionToken,
} from "../src/lib/session.ts";

const ORIGINAL = process.env.SESSION_SECRET;

before(() => {
  process.env.SESSION_SECRET = "secret-de-test";
});
after(() => {
  if (ORIGINAL === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = ORIGINAL;
});

describe("timingSafeEqual", () => {
  test("reconnaît deux chaînes identiques", () => {
    assert.equal(timingSafeEqual("abc", "abc"), true);
  });

  test("rejette une différence, y compris de longueur", () => {
    assert.equal(timingSafeEqual("abc", "abd"), false);
    assert.equal(timingSafeEqual("abc", "abcd"), false);
    assert.equal(timingSafeEqual("", "a"), false);
  });
});

describe("jeton de session", () => {
  test("un jeton fraîchement signé est accepté", async () => {
    assert.equal(await verifySessionToken(await createSessionToken()), true);
  });

  test("la sentinelle constante de l'ancienne version est refusée", async () => {
    // C'était toute l'authentification : poser un cookie valant "ok" suffisait.
    assert.equal(await verifySessionToken("ok"), false);
  });

  test("un jeton fabriqué à la main sans la clé est refusé", async () => {
    const future = String(Date.now() + SESSION_TTL_MS);
    assert.equal(await verifySessionToken(`${future}.signature-inventee`), false);
    assert.equal(await verifySessionToken(future), false);
  });

  test("prolonger l'expiration invalide la signature", async () => {
    const token = await createSessionToken();
    const [, signature] = token.split(".");
    const prolonge = `${Date.now() + 10 * SESSION_TTL_MS}.${signature}`;
    assert.equal(await verifySessionToken(prolonge), false);
  });

  test("un jeton expiré est refusé", async () => {
    const token = await createSessionToken(Date.now() - SESSION_TTL_MS - 1000);
    assert.equal(await verifySessionToken(token), false);
  });

  test("un jeton signé avec une autre clé est refusé", async () => {
    const token = await createSessionToken();
    process.env.SESSION_SECRET = "une-autre-cle";
    try {
      assert.equal(await verifySessionToken(token), false);
    } finally {
      process.env.SESSION_SECRET = "secret-de-test";
    }
  });

  test("une valeur absente ou vide est refusée", async () => {
    assert.equal(await verifySessionToken(undefined), false);
    assert.equal(await verifySessionToken(""), false);
    assert.equal(await verifySessionToken("."), false);
  });
});
