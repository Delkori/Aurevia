"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm({ demoOuvert }: { demoOuvert: boolean }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Erreur de connexion.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div className="w-full max-w-sm space-y-3">
        <form
          onSubmit={submit}
          className="bg-surface border border-border rounded-lg p-8 space-y-4"
        >
          <div>
            <h1 className="text-lg font-[family-name:var(--font-heading)] font-semibold">
              Aurevia
            </h1>
            <p className="text-xs text-text-muted mt-1">
              Suivi de patrimoine — accès privé
            </p>
          </div>
          <input
            type="password"
            required
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe"
            className="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm"
          />
          {error && <p className="text-xs text-negative">{error}</p>}
          <button
            type="submit"
            className="w-full text-sm px-4 py-2 rounded-md bg-accent text-bg font-medium hover:opacity-90"
          >
            Entrer
          </button>
        </form>

        {/* La démonstration n'a rien à protéger — elle ne montre qu'un foyer
            fictif et ne peut rien écrire. Le mot de passe n'y servait qu'à
            faire demi-tour au prospect arrivé sur cette page sans le lien
            direct. */}
        {demoOuvert && (
          <a
            href="/demo"
            className="block text-center text-sm px-4 py-2.5 rounded-lg border border-border bg-surface text-text hover:border-accent/60 hover:text-accent transition-colors"
          >
            Voir la démonstration
            <span className="block text-[11px] text-text-muted mt-0.5 font-normal">
              Un foyer d&apos;exemple, sans mot de passe
            </span>
          </a>
        )}
      </div>
    </div>
  );
}
