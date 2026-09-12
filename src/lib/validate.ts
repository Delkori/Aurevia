/**
 * Validation des corps de requête, avec des messages destinés à l'utilisateur.
 *
 * Avant, un champ mal saisi (« 12,5 » au lieu de « 12.5 », un texte dans une
 * quantité) partait tel quel vers Postgres, qui renvoyait une erreur de type.
 * Tant que ces erreurs remontaient brutes au client, c'était au moins lisible ;
 * maintenant qu'elles sont génériques en production — comme elles doivent
 * l'être — l'utilisateur n'aurait plus qu'un « Erreur côté serveur ». D'où
 * cette couche : une saisie invalide doit produire un 400 qui dit quoi
 * corriger, jamais un 500.
 */

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

function fail(message: string): never {
  throw new ValidationError(message);
}

export function reqString(value: unknown, label: string, maxLength = 200): string {
  if (typeof value !== "string" || value.trim() === "") {
    fail(`Le champ « ${label} » est obligatoire.`);
  }
  const trimmed = (value as string).trim();
  if (trimmed.length > maxLength) {
    fail(`Le champ « ${label} » ne peut pas dépasser ${maxLength} caractères.`);
  }
  return trimmed;
}

export function optString(value: unknown, label: string, maxLength = 200): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") fail(`Le champ « ${label} » doit être du texte.`);
  const trimmed = (value as string).trim();
  if (trimmed === "") return null;
  if (trimmed.length > maxLength) {
    fail(`Le champ « ${label} » ne peut pas dépasser ${maxLength} caractères.`);
  }
  return trimmed;
}

/**
 * Normalise un nombre destiné à une colonne `numeric`. Accepte la virgule
 * décimale et les espaces de milliers, parce que c'est ce qu'un clavier
 * français produit naturellement.
 */
function toNumber(value: unknown, label: string): number {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail(`Le champ « ${label} » doit être un nombre valide.`);
    return value;
  }
  if (typeof value !== "string") fail(`Le champ « ${label} » doit être un nombre.`);
  const cleaned = (value as string).replace(/\s| | /g, "").replace(",", ".");
  const parsed = Number(cleaned);
  if (cleaned === "" || !Number.isFinite(parsed)) {
    fail(`Le champ « ${label} » doit être un nombre (reçu : « ${value} »).`);
  }
  return parsed;
}

export function reqNumeric(
  value: unknown,
  label: string,
  { min, max }: { min?: number; max?: number } = {}
): string {
  if (value == null || value === "") fail(`Le champ « ${label} » est obligatoire.`);
  const n = toNumber(value, label);
  if (min != null && n < min) fail(`Le champ « ${label} » ne peut pas être inférieur à ${min}.`);
  if (max != null && n > max) fail(`Le champ « ${label} » ne peut pas dépasser ${max}.`);
  return String(n);
}

export function optNumeric(
  value: unknown,
  label: string,
  opts: { min?: number; max?: number } = {}
): string | null {
  if (value == null || value === "") return null;
  return reqNumeric(value, label, opts);
}

export function optId(value: unknown, label: string): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n <= 0) fail(`Le champ « ${label} » est invalide.`);
  return n;
}

export function reqId(value: unknown, label: string): number {
  const id = optId(value, label);
  if (id == null) fail(`Le champ « ${label} » est obligatoire.`);
  return id;
}

/** Identifiant de route (`params.id`) : renvoie 400 plutôt qu'un NaN silencieux. */
export function routeId(value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) fail("Identifiant invalide.");
  return n;
}

export function oneOf<T extends string>(
  value: unknown,
  label: string,
  allowed: readonly T[],
  fallback?: T
): T {
  if ((value == null || value === "") && fallback !== undefined) return fallback;
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    fail(`Le champ « ${label} » doit être l'une de ces valeurs : ${allowed.join(", ")}.`);
  }
  return value as T;
}

/** Couleur hexadécimale `#rrggbb`, telle que produite par `<input type="color">`. */
export function optColor(value: unknown, label: string, fallback: string): string {
  if (value == null || value === "") return fallback;
  if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value)) {
    fail(`Le champ « ${label} » doit être une couleur au format #rrggbb.`);
  }
  return value as string;
}

export function optDate(value: unknown, label: string): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    fail(`Le champ « ${label} » doit être une date au format AAAA-MM-JJ.`);
  }
  if (Number.isNaN(new Date(value as string).getTime())) {
    fail(`Le champ « ${label} » n'est pas une date valide.`);
  }
  return value as string;
}

export async function jsonBody(req: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    fail("Corps de requête illisible : JSON attendu.");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    fail("Corps de requête invalide : un objet JSON est attendu.");
  }
  return body as Record<string, unknown>;
}

// ── Vocabulaires du domaine ──────────────────────────────────────────────────

export const ASSET_TYPES = [
  "stock", "etf", "crypto", "precious_metal", "real_estate", "scpi",
  "private_equity", "art", "life_insurance", "cash", "other",
] as const;

export const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "JPY", "CAD", "AUD"] as const;

export const MEMBER_ROLES = ["owner", "spouse", "child", "other"] as const;

export const FLOW_FREQUENCIES = ["daily", "weekly", "monthly", "yearly", "once"] as const;

export const FLOW_SOURCE_TYPES = ["salary", "member_salary", "portfolio", "external"] as const;

export const FLOW_TARGET_TYPES = ["portfolio", "goal", "expense", "income", "external"] as const;
