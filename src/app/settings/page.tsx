"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, X, Plus, Trash2, Save } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";

type Member = { id: number; name: string; role: string; color: string };

const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "JPY", "CAD", "AUD"];
const ROLES = [
  { value: "owner", label: "Propriétaire" },
  { value: "spouse", label: "Conjoint·e" },
  { value: "child", label: "Enfant" },
  { value: "other", label: "Autre" },
];
const COLORS = ["#7c6af5", "#34d399", "#60a5fa", "#fb923c", "#f0abfc", "#fbbf24", "#f87171"];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [newMember, setNewMember] = useState({ name: "", role: "child", color: "#60a5fa" });

  const load = useCallback(async () => {
    setError(null);
    try {
      const [s, m] = await Promise.all([
        apiFetch("/api/settings"),
        apiFetch("/api/members"),
      ]);
      setSettings(s as Record<string, string>);
      setMembers(m as Member[]);
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

  const addMember = async () => {
    if (!newMember.name.trim()) return;
    setError(null);
    try {
      await apiFetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newMember),
      });
      setNewMember({ name: "", role: "child", color: "#60a5fa" });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur.");
    }
  };

  const deleteMember = async (id: number) => {
    if (!confirm("Supprimer ce membre ?")) return;
    try {
      await apiFetch(`/api/members/${id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur.");
    }
  };

  if (loading) return <div className="p-10 text-text-muted text-sm">Chargement…</div>;

  return (
    <div className="p-8 md:p-10 max-w-3xl mx-auto space-y-8">
      <header>
        <h1 className="text-2xl font-semibold font-[family-name:var(--font-heading)]">Paramètres</h1>
        <p className="text-sm text-text-muted mt-1">Devise, revenus, membres du foyer.</p>
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
            <label className="text-xs text-text-muted">Salaire mensuel net</label>
            <input
              type="number"
              value={settings.monthly_salary || ""}
              onChange={(e) => setSettings({ ...settings, monthly_salary: e.target.value })}
              placeholder="2800"
              className="w-full mt-1 bg-bg border border-border rounded-md px-3 py-2 text-sm tabular"
            />
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

        <button
          onClick={saveSettings}
          className="flex items-center gap-2 text-sm px-4 py-2 rounded-md bg-accent text-white font-medium hover:opacity-90"
        >
          <Save size={14} /> {saved ? "Enregistré ✓" : "Sauvegarder"}
        </button>
      </section>

      <section className="bg-surface border border-border rounded-lg p-6 space-y-5">
        <h2 className="text-lg font-medium font-[family-name:var(--font-heading)]">Foyer</h2>
        <p className="text-sm text-text-muted">
          Chaque membre a sa propre couleur dans la galaxie. Tu peux rattacher des portefeuilles et des objectifs à un membre.
        </p>

        {members.length > 0 && (
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 bg-bg rounded-lg px-4 py-3">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: m.color }} />
                <span className="text-sm font-medium flex-1">{m.name}</span>
                <span className="text-xs text-text-muted">{ROLES.find((r) => r.value === m.role)?.label}</span>
                <button onClick={() => deleteMember(m.id)} className="p-1 text-text-muted hover:text-negative">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 flex-wrap">
          <div className="flex-1 min-w-[140px]">
            <label className="text-xs text-text-muted">Nom</label>
            <input
              value={newMember.name}
              onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
              placeholder="Prénom"
              className="w-full mt-1 bg-bg border border-border rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted">Rôle</label>
            <select
              value={newMember.role}
              onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
              className="w-full mt-1 bg-bg border border-border rounded-md px-3 py-2 text-sm"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1 pb-0.5">
            {COLORS.slice(0, 4).map((c) => (
              <button
                key={c}
                onClick={() => setNewMember({ ...newMember, color: c })}
                className={`w-6 h-6 rounded-full ${newMember.color === c ? "ring-2 ring-offset-1 ring-offset-surface ring-text" : ""}`}
                style={{ background: c }}
              />
            ))}
          </div>
          <button
            onClick={addMember}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-md border border-border text-text-muted hover:text-text hover:bg-surface-hover"
          >
            <Plus size={14} /> Ajouter
          </button>
        </div>
      </section>
    </div>
  );
}
