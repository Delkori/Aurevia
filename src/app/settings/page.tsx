"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, X, Save } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";

const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "JPY", "CAD", "AUD"];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const s = await apiFetch("/api/settings");
      setSettings(s as Record<string, string>);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur de chargement.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveSettings = async () => {
    setError(null);
    try {
      await apiFetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur de sauvegarde.");
    }
  };

  if (loading) return <div className="p-10 text-text-muted text-sm">Chargement…</div>;

  return (
    <div className="p-8 md:p-10 max-w-3xl mx-auto space-y-8">
      <header>
        <h1 className="text-2xl font-semibold font-[family-name:var(--font-heading)]">Paramètres</h1>
        <p className="text-sm text-text-muted mt-1">
          Devise et seuils d&apos;alerte. Le salaire, les membres du foyer et les planètes se gèrent directement dans la galaxie.
        </p>
      </header>

      {error && (
        <div className="flex items-start gap-3 bg-negative/10 border border-negative/40 rounded-lg px-4 py-3 text-sm text-negative">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div className="flex-1"><p className="text-xs opacity-90">{error}</p></div>
          <button onClick={() => setError(null)} className="text-negative/70 hover:text-negative"><X size={16} /></button>
        </div>
      )}

      <section className="bg-surface border border-border rounded-lg p-6 space-y-5">
        <h2 className="text-lg font-medium font-[family-name:var(--font-heading)]">Général</h2>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-text-muted">Devise d&apos;affichage</label>
            <select
              value={settings.display_currency || "EUR"}
              onChange={(e) => setSettings({ ...settings, display_currency: e.target.value })}
              className="w-full mt-1 bg-bg border border-border rounded-md px-3 py-2 text-sm"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-text-muted">Seuil d&apos;alerte patrimoine</label>
            <input
              type="number"
              value={settings.alert_threshold || ""}
              onChange={(e) => setSettings({ ...settings, alert_threshold: e.target.value })}
              placeholder="50000"
              className="w-full mt-1 bg-bg border border-border rounded-md px-3 py-2 text-sm tabular"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={settings.show_payment_countdown !== "false"}
            onChange={(e) => setSettings({ ...settings, show_payment_countdown: e.target.checked ? "true" : "false" })}
          />
          Afficher le compte à rebours avant chaque versement dans la galaxie
        </label>

        <button
          onClick={saveSettings}
          className="flex items-center gap-2 text-sm px-4 py-2 rounded-md bg-accent text-white font-medium hover:opacity-90"
        >
          <Save size={14} /> {saved ? "Enregistré ✓" : "Sauvegarder"}
        </button>
      </section>
    </div>
  );
}
