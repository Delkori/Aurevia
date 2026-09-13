"use client";

import { useCallback, useEffect, useState } from "react";
import { Users, Save } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";

type Membre = { id: number; name: string; salary: string | null };
type Part = { flowId: number | null; memberId: number | null; sharePercent: string };

/**
 * La règle du foyer : qui porte quelle part des dépenses communes.
 *
 * Réglée une fois ici, elle s'applique à toute dépense cochée « du foyer ».
 * C'est le choix qu'on a fait plutôt qu'une saisie sur chaque ligne : dans un
 * couple, la quasi-totalité des dépenses suivent la même clé, et la ressaisir
 * dix fois serait une corvée pour un résultat identique.
 */
export default function ReglePartage({ ownerName }: { ownerName: string }) {
  const [membres, setMembres] = useState<Membre[]>([]);
  const [parts, setParts] = useState<Record<string, string>>({});
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enregistre, setEnregistre] = useState(false);

  const cle = (id: number | null) => (id == null ? "moi" : String(id));

  const charger = useCallback(async () => {
    try {
      const [m, s] = await Promise.all([apiFetch("/api/members"), apiFetch("/api/expense-shares")]);
      const foyer = (m as Membre[]).filter((x) => x.salary != null && Number(x.salary) > 0);
      setMembres(foyer);
      const regle = (s as Part[]).filter((p) => p.flowId === null);
      const initial: Record<string, string> = {};
      for (const p of regle) initial[cle(p.memberId)] = String(Math.round(Number(p.sharePercent) * 10) / 10);
      // Aucune règle posée : on propose des parts égales plutôt qu'un écran vide.
      if (regle.length === 0) {
        const part = String(Math.round((100 / (foyer.length + 1)) * 10) / 10);
        initial.moi = part;
        for (const x of foyer) initial[cle(x.id)] = part;
      }
      setParts(initial);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Chargement impossible.");
    } finally { setChargement(false); }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const lignes = [{ id: null as number | null, nom: ownerName }, ...membres.map((m) => ({ id: m.id, nom: m.name }))];
  const total = lignes.reduce((s, l) => s + (Number(parts[cle(l.id)]) || 0), 0);

  const enregistrer = async () => {
    setErreur(null);
    try {
      await apiFetch("/api/expense-shares", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flowId: null,
          shares: lignes.map((l) => ({ memberId: l.id, sharePercent: Number(parts[cle(l.id)]) || 0 })),
        }),
      });
      setEnregistre(true);
      setTimeout(() => setEnregistre(false), 2000);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Enregistrement impossible.");
    }
  };

  if (chargement) return null;
  if (membres.length === 0) return null; // seul, il n'y a rien à partager

  return (
    <section className="bg-surface border border-border rounded-lg p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 shrink-0 rounded-full bg-accent/15 flex items-center justify-center">
          <Users size={15} className="text-accent" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-medium font-[family-name:var(--font-heading)]">
            Partage des dépenses du foyer
          </h2>
          <p className="text-sm text-text-muted leading-relaxed mt-1">
            Une dépense cochée « du foyer » se répartit selon cette règle, au lieu de
            peser entière sur une seule personne. Réglée une fois ici — une dépense
            qui fait exception garde ses propres parts.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {lignes.map((l) => (
          <label key={cle(l.id)} className="flex items-center justify-between gap-4">
            <span className="text-sm min-w-0 truncate">{l.nom}</span>
            <span className="flex items-center gap-1.5 shrink-0">
              <input
                type="number" min={0} max={100} step={0.5}
                value={parts[cle(l.id)] ?? ""}
                onChange={(e) => setParts({ ...parts, [cle(l.id)]: e.target.value })}
                aria-label={`Part de ${l.nom}`}
                className="w-20 bg-bg border border-border rounded-md px-2 py-1 text-sm tabular text-right"
              />
              <span className="text-xs text-text-muted w-3">%</span>
            </span>
          </label>
        ))}
      </div>

      <div className="flex items-center justify-between gap-4">
        <p className="text-[11px] text-text-muted">
          {Math.abs(total - 100) < 0.05
            ? "Les parts font 100 %."
            : `Les parts font ${Math.round(total * 10) / 10} % — elles seront ramenées au prorata.`}
        </p>
        <button
          onClick={enregistrer}
          className="flex items-center gap-2 text-sm px-4 py-2 rounded-md bg-accent text-white font-medium hover:opacity-90 shrink-0"
        >
          <Save size={14} />{enregistre ? "Enregistré ✓" : "Enregistrer"}
        </button>
      </div>
      {erreur && <p className="text-xs text-negative">{erreur}</p>}
    </section>
  );
}
