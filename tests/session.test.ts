import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  DEMO_TTL_MS,
  SESSION_TTL_MS,
  createSessionToken,
  readSession,
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
    const token = await createSessionToken("owner", Date.now() - SESSION_TTL_MS - 1000);
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

describe("rôles de session", () => {
  test("une session propriétaire est reconnue comme telle", async () => {
    assert.equal(await readSession(await createSessionToken("owner")), "owner");
  });

  test("une session de démonstration est reconnue comme telle", async () => {
    assert.equal(await readSession(await createSessionToken("demo")), "demo");
  });

  test("on ne peut pas promouvoir une démo en propriétaire", async () => {
    // La signature couvre le rôle : réécrire "demo" en "owner" casse le jeton.
    const demo = await createSessionToken("demo");
    const [payload, signature] = demo.split(".");
    const promu = `${payload.replace("demo", "owner")}.${signature}`;
    assert.equal(await readSession(promu), null);
  });

  test("la session de démonstration expire plus vite", async () => {
    const demo = await createSessionToken("demo");
    const owner = await createSessionToken("owner");
    const expDemo = Number(demo.split("~")[0]);
    const expOwner = Number(owner.split("~")[0]);
    assert.ok(expOwner - expDemo > SESSION_TTL_MS - DEMO_TTL_MS - 5000);
  });

  test("un jeton émis avant les rôles reste valide et vaut propriétaire", async () => {
    // Compatibilité ascendante : les jetons déjà posés dans les navigateurs ont
    // une charge utile réduite à l'expiration, sans séparateur de rôle. On en
    // fabrique un en resignant à la main, sinon le test ne prouve rien.
    const legacyPayload = String(Date.now() + SESSION_TTL_MS);
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode("secret-de-test"),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const raw = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(legacyPayload));
    const sig = btoa(String.fromCharCode(...new Uint8Array(raw)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    assert.equal(await readSession(`${legacyPayload}.${sig}`), "owner");
  });
});
