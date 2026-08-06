import { cookies } from "next/headers";

const COOKIE_NAME = "aurevia_auth";

export async function isAuthenticated() {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value === "ok";
}

export async function setAuthCookie() {
  const store = await cookies();
  store.set(COOKIE_NAME, "ok", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30, // 30 jours
    path: "/",
  });
}

export async function clearAuthCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
