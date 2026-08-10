"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, AlertTriangle, X } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { apiFetch, ApiError } from "@/lib/api";

type Loan = {
  id: number;
  name: string;
  assetId: number | null;
  principal: string;
  remainingBalance: string;
  interestRate: string | null;
  monthlyPayment: string | null;
  currency: string;
};

type RealEstateAsset = { id: number; name: string };

const CURRENCIES = ["EUR", "USD", "GBP", "CHF"];

type DraftRow = {
  name: string;
  assetId: string;
  principal: string;
  remainingBalance: string;
  interestRate: string;
  monthlyPayment: string;
  currency: string;
};

const emptyDraft: DraftRow = {
  name: "",
  assetId: "",
  principal: "",
  remainingBalance: "",
  interestRate: "",
  monthlyPayment: "",
  currency: "EUR",
};

export default function LoansTable({ realEstateAssets }: { realEstateAssets: RealEstateAsset[] }) {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | "draft" | null>(null);
  const [draft, setDraft] = useState<DraftRow>(emptyDraft);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = (await apiFetch("/api/loans")) as Loan[];
      setLoans(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur de chargement.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveLoan = async (loan: Loan) => {
    setSavingId(loan.id);
    setError(null);
    try {
      await apiFetch(`/api/loans/${loan.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: loan.name,
          assetId: loan.assetId,
          principal: loan.principal,
          remainingBalance: loan.remainingBalance,
          interestRate: loan.interestRate,
          monthlyPayment: loan.monthlyPayment,
          currency: loan.currency,
        }),
      });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Échec de l'enregistrement.");
    } finally {
      setSavingId(null);
    }
  };

  const updateField = (id: number, patch: Partial<Loan>) => {
    setLoans((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const remove = async (id: number) => {
    if (!confirm("Supprimer ce crédit ?")) return;
    setError(null);
    try {
      await apiFetch(`/api/loans/${id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Échec de la suppression.");
    }
  };

  const commitDraft = async () => {
    if (!draft.name.trim() || !draft.remainingBalance) return;
    setSavingId("draft");
    setError(null);
    try {
      await apiFetch("/api/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          assetId: draft.assetId ? Number(draft.assetId) : null,
          principal: draft.principal || draft.remainingBalance,
          remainingBalance: draft.remainingBalance,
          interestRate: draft.interestRate || null,
          monthlyPayment: draft.monthlyPayment || null,
          currency: draft.currency,
        }),
      });
      setDraft(emptyDraft);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Échec de la création.");
    } finally {
      setSavingId(null);
    }
  };

  const totalDebt = loans.reduce((s, l) => s + Number(l.remainingBalance || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold font-[family-name:var(--font-heading)]">Crédits</h2>
          <p className="text-xs text-text-muted mt-0.5">
            Prêts immobiliers ou autres emprunts — déduits automatiquement de ton patrimoine net.
          </p>
        </div>
        {totalDebt > 0 && (
          <p className="text-sm text-negative tabular">-{formatMoney(totalDebt)}</p>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-3 bg-negative/10 border border-negative/40 rounded-lg px-4 py-3 text-sm text-negative">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Un problème est survenu</p>
            <p className="text-xs mt-1 opacity-90">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-negative/70 hover:text-negative">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="bg-surface border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[820px]">
          <thead>
            <tr className="text-xs text-text-muted border-b border-border">
              <th className="text-left font-medium px-4 py-3">Nom</th>
              <th className="text-left font-medium px-3 py-3">Bien lié</th>
              <th className="text-right font-medium px-3 py-3">Capital emprunté</th>
              <th className="text-right font-medium px-3 py-3">Restant dû</th>
              <th className="text-right font-medium px-3 py-3">Taux (%)</th>
              <th className="text-right font-medium px-3 py-3">Mensualité</th>
              <th className="text-left font-medium px-3 py-3">Devise</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {loans.map((l) => (
              <tr key={l.id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-2">
                  <input
                    value={l.name}
                    onChange={(e) => updateField(l.id, { name: e.target.value })}
                    onBlur={() => saveLoan(l)}
                    className="w-full bg-transparent focus:bg-bg rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-accent"
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    value={l.assetId ?? ""}
                    onChange={(e) => {
                      const assetId = e.target.value ? Number(e.target.value) : null;
                      updateField(l.id, { assetId });
                      saveLoan({ ...l, assetId });
                    }}
                    className="bg-transparent focus:bg-bg rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-accent max-w-[150px]"
                  >
                    <option value="">—</option>
                    {realEstateAssets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    step="any"
                    value={l.principal}
                    onChange={(e) => updateField(l.id, { principal: e.target.value })}
                    onBlur={() => saveLoan(l)}
                    className="w-28 bg-transparent focus:bg-bg rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-accent text-right tabular"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    step="any"
                    value={l.remainingBalance}
                    onChange={(e) => updateField(l.id, { remainingBalance: e.target.value })}
                    onBlur={() => saveLoan(l)}
                    className="w-28 bg-transparent focus:bg-bg rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-accent text-right tabular text-negative"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    step="any"
                    value={l.interestRate ?? ""}
                    onChange={(e) => updateField(l.id, { interestRate: e.target.value })}
                    onBlur={() => saveLoan(l)}
                    className="w-16 bg-transparent focus:bg-bg rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-accent text-right tabular"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    step="any"
                    value={l.monthlyPayment ?? ""}
                    onChange={(e) => updateField(l.id, { monthlyPayment: e.target.value })}
                    onBlur={() => saveLoan(l)}
                    className="w-24 bg-transparent focus:bg-bg rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-accent text-right tabular"
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    value={l.currency}
                    onChange={(e) => {
                      updateField(l.id, { currency: e.target.value });
                      saveLoan({ ...l, currency: e.target.value });
                    }}
                    className="bg-transparent focus:bg-bg rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-accent"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => remove(l.id)}
                    className="p-1.5 text-text-muted hover:text-negative"
                    title={savingId === l.id ? "Enregistrement…" : "Supprimer"}
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}

            <tr className="bg-accent-soft/40">
              <td className="px-4 py-2">
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  onBlur={commitDraft}
                  placeholder="+ Nom du crédit…"
                  className="w-full bg-transparent focus:bg-bg rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-accent placeholder:text-text-muted"
                />
              </td>
              <td className="px-3 py-2">
                <select
                  value={draft.assetId}
                  onChange={(e) => setDraft({ ...draft, assetId: e.target.value })}
                  className="bg-transparent focus:bg-bg rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-accent max-w-[150px]"
                >
                  <option value="">—</option>
                  {realEstateAssets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-2 text-right">
                <input
                  type="number"
                  step="any"
                  value={draft.principal}
                  onChange={(e) => setDraft({ ...draft, principal: e.target.value })}
                  onBlur={commitDraft}
                  className="w-28 bg-transparent focus:bg-bg rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-accent text-right tabular"
                />
              </td>
              <td className="px-3 py-2 text-right">
                <input
                  type="number"
                  step="any"
                  value={draft.remainingBalance}
                  onChange={(e) => setDraft({ ...draft, remainingBalance: e.target.value })}
                  onBlur={commitDraft}
                  className="w-28 bg-transparent focus:bg-bg rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-accent text-right tabular"
                />
              </td>
              <td className="px-3 py-2 text-right">
                <input
                  type="number"
                  step="any"
                  value={draft.interestRate}
                  onChange={(e) => setDraft({ ...draft, interestRate: e.target.value })}
                  onBlur={commitDraft}
                  className="w-16 bg-transparent focus:bg-bg rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-accent text-right tabular"
                />
              </td>
              <td className="px-3 py-2 text-right">
                <input
                  type="number"
                  step="any"
                  value={draft.monthlyPayment}
                  onChange={(e) => setDraft({ ...draft, monthlyPayment: e.target.value })}
                  onBlur={commitDraft}
                  className="w-24 bg-transparent focus:bg-bg rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-accent text-right tabular"
                />
              </td>
              <td className="px-3 py-2">
                <select
                  value={draft.currency}
                  onChange={(e) => setDraft({ ...draft, currency: e.target.value })}
                  className="bg-transparent focus:bg-bg rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-accent"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-2 text-right">
                <button onClick={commitDraft} className="p-1.5 text-accent hover:opacity-80" title="Ajouter">
                  <Plus size={16} />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        {!loading && loans.length === 0 && (
          <p className="text-sm text-text-muted px-5 py-6 text-center">
            Aucun crédit. Remplis la ligne surlignée pour en ajouter un.
          </p>
        )}
      </div>
    </div>
  );
}
