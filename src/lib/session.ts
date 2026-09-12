// Jeton de session signé (HMAC-SHA256), vérifiable aussi bien dans le proxy
// (runtime Edge) que dans les route handlers (runtime Node) — on n'utilise donc
// que la Web Crypto API, disponible dans les deux.
//
// Format : "<expiration en ms>[~<rôle>].<signature base64url>". La signature
// couvre l'expiration ET le rôle, donc un visiteur ne peut ni fabriquer un
// jeton, ni en prolonger un, ni promouvoir une session de démonstration en
// session propriétaire. C'est ce qui remplace l'ancien cookie sentinelle dont
// la valeur constante ("ok") suffisait à se faire passer pour authentifié.

export const SESSION_COOKIE = "aurevia_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours
// Une session de démonstration est plus courte : elle sert à faire visiter
// l'app, pas à s'y installer.
export const DEMO_TTL_MS = 24 * 60 * 60 * 1000; // 24 h

/** `owner` peut tout faire ; `demo` est en lecture seule. */
export type SessionRole = "owner" | "demo";

const encoder = new TextEncoder();

/**
 * Clé de signature. `SESSION_SECRET` est la bonne variable à définir ; à défaut
 * on retombe sur `APP_PASSWORD` pour qu'un déploiement existant continue de
 * fonctionner sans nouvelle variable d'environnement. Conséquence assumée de ce
 * repli : changer le mot de passe invalide les sessions en cours.
 */
function signingKey(): string {
  const secret = process.env.SESSION_SECRET || process.env.APP_PASSWORD;
  if (!secret) {
    throw new Error(
      "SESSION_SECRET (ou à défaut APP_PASSWORD) doit être défini pour signer les sessions."
    );
  }
  return secret;
}

function base64url(bytes: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(payload: string, key: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return base64url(await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(payload)));
}

/**
 * Comparaison à temps constant. `a === b` s'arrête au premier caractère
 * différent : le temps de réponse fuite alors la longueur du préfixe correct,
 * ce qui permet de reconstruire une signature octet par octet.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(
  role: SessionRole = "owner",
  now = Date.now()
): Promise<string> {
  const ttl = role === "demo" ? DEMO_TTL_MS : SESSION_TTL_MS;
  const payload = `${now + ttl}~${role}`;
  return `${payload}.${await sign(payload, signingKey())}`;
}

/**
 * Renvoie le rôle porté par le jeton, ou `null` si le jeton est absent,
 * falsifié ou expiré. Un jeton émis avant l'introduction des rôles (charge
 * utile réduite à l'expiration) reste valide et vaut `owner`.
 */
export async function readSession(
  token: string | undefined,
  now = Date.now()
): Promise<SessionRole | null> {
  if (!token) return null;
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;

  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  let expected: string;
  try {
    expected = await sign(payload, signingKey());
  } catch {
    // Secret absent côté serveur : on refuse plutôt que de laisser passer.
    return null;
  }
  if (!timingSafeEqual(signature, expected)) return null;

  const [rawExpiry, rawRole = "owner"] = payload.split("~");
  const expiresAt = Number(rawExpiry);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return null;

  return rawRole === "demo" ? "demo" : "owner";
}

export async function verifySessionToken(
  token: string | undefined,
  now = Date.now()
): Promise<boolean> {
  return (await readSession(token, now)) !== null;
}
