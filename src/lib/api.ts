export class ApiError extends Error {}

export async function apiFetch(url: string, options?: RequestInit) {
  let res: Response;
  try {
    res = await fetch(url, options);
  } catch {
    throw new ApiError(
      `Impossible de contacter le serveur (${url}). Vérifie ta connexion.`
    );
  }

  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    const message =
      (body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : null) ??
      (typeof body === "string" ? body : null) ??
      `Erreur ${res.status} sur ${url}`;
    throw new ApiError(message);
  }

  return body;
}
