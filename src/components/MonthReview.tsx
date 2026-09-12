"use client";

import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Minus, RotateCcw, X } from "lucide-react";
import { formatMoney } from "@/lib/format";

type Flow = {
  id: number;
  name: string | null;
  sourceType: string;
  targetType: string;
  targetId: number | null;
};

export type Occurrence = {
  id: number;
  flowId: number;
  dueDate: string;
  expectedAmount: string;
  actualAmount: string | null;
  status: string;
  note: string | null;
};

const MOIS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

function cleMois(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Fenêtre de pointage mensuel.
 *
 * Le reste de l'app décrit un patrimoine tel qu'il *devrait* être : des règles,
 * des montants prévus. Cet écran est le seul endroit où on confronte ces règles
 * au réel — « les 380 € de crèche sont-ils bien passés, et pour quel montant ? »
 *
 * L'écart entre prévu et constaté est le chiffre que ni un tableur ni un
 * agrégateur ne donne : l'un ignore ce qui était prévu, l'autre ignore ce qui
 * s'est réellement produit.
 */
export default function MonthReview({
  occurrences, flows, destinations, displayCurrency, onUpdate, onClose, readOnly,
}: {
  occurrences: Occurrence[];
  flows: Flow[];
  /** `"portfolio:3"` → « PEA », pour nommer un versement sans libellé. */
  destinations: Record<string, string>;
  displayCurrency: string;
  onUpdate: (id: number, patch: { status: string; actualAmount?: string | null }) => Promise<void>;
  onClose: () => void;
  readOnly?: boolean;
}) {
  const [mois, setMois] = useState(() => new Date());
  const [saisie, setSaisie] = useState<Record<number, string>>({});
  const [enCours, setEnCours] = useState<number | null>(null);

  const fmt = (v: number) => formatMoney(v, displayCurrency);
  const nomDe = (flowId: number) => {
    const f = flows.find((x) => x.id === flowId);
    if (!f) return "Mouvement";
    if (f.name) return f.name;
    const dest = f.targetId != null ? destinations[`${f.targetType}:${f.targetId}`] : undefined;
    if (dest) return `Versement → ${dest}`;
    return f.targetType === "income" ? "Revenu" : "Versement";
  };
  const estRevenu = (flowId: number) => flows.find((x) => x.id === flowId)?.targetType === "income";

  const duMois = useMemo(() => {
    const cle = cleMois(mois);
    return occurrences
      .filter((o) => o.dueDate.slice(0, 7) === cle)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id - b.id);
  }, [occurrences, mois]);

  const bilan = useMemo(() => {
    // L'écart ne compare que ce qui est pointé. Confronter le prévu du mois
    // entier au constaté partiel donnait un chiffre faux — et flatteur : tant
    // qu'une seule dépense sur dix était pointée, l'écart s'affichait en vert.
    let prevuTotal = 0, prevuPointe = 0, constate = 0, aVerifier = 0;
    for (const o of duMois) {
      if (o.status === "skipped") continue;
      const signe = estRevenu(o.flowId) ? 1 : -1;
      const attendu = signe * Number(o.expectedAmount);
      prevuTotal += attendu;
      if (o.status === "confirmed") {
        prevuPointe += attendu;
        constate += signe * Number(o.actualAmount ?? o.expectedAmount);
      } else {
        aVerifier++;
      }
    }
    return { prevuTotal, ecart: constate - prevuPointe, constate, aVerifier, toutPointe: aVerifier === 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duMois, flows]);

  const aujourdhui = new Date().toISOString().slice(0, 10);

  const valider = async (o: Occurrence, status: string) => {
    setEnCours(o.id);
    try {
      const brut = saisie[o.id];
      await onUpdate(o.id, {
        status,
        actualAmount: status === "confirmed" ? (brut?.trim() || o.expectedAmount) : null,
      });
    } finally {
      setEnCours(null);
    }
  };

  const decaler = (n: number) =>
    setMois((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg/80 backdrop-blur-sm"
      role="dialog" aria-modal="true" aria-label="Pointage du mois">
      <div className="w-full max-w-xl max-h-[85vh] flex flex-col bg-surface border border-border rounded-xl shadow-2xl">

        <header className="flex items-center gap-3 px-5 py-3.5 border-b border-border shrink-0">
          <div className="flex items-center gap-1">
            <button onClick={() => decaler(-1)} aria-label="Mois précédent"
              className="p-1 rounded text-text-muted hover:text-text hover:bg-surface-hover">
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => decaler(1)} aria-label="Mois suivant"
              className="p-1 rounded text-text-muted hover:text-text hover:bg-surface-hover">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold font-[family-name:var(--font-heading)] leading-tight">
              {MOIS[mois.getMonth()]} {mois.getFullYear()}
            </h2>
            <p className="text-[11px] text-text-muted">
              {bilan.aVerifier > 0
                ? `${bilan.aVerifier} mouvement${bilan.aVerifier > 1 ? "s" : ""} à vérifier`
                : duMois.length > 0 ? "Tout est pointé" : "Aucun mouvement ce mois-ci"}
            </p>
          </div>
          <button onClick={onClose} aria-label="Fermer"
            className="p-1 rounded text-text-muted hover:text-text hover:bg-surface-hover">
            <X size={16} />
          </button>
        </header>

        {duMois.length > 0 && (
          <div className="grid grid-cols-3 gap-px bg-border border-b border-border shrink-0">
            <div className="bg-surface px-4 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-text-muted">Prévu au mois</p>
              <p className="text-sm tabular font-semibold text-text">{fmt(bilan.prevuTotal)}</p>
            </div>
            <div className="bg-surface px-4 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-text-muted">Pointé</p>
              <p className="text-sm tabular font-semibold text-text">{fmt(bilan.constate)}</p>
            </div>
            <div className="bg-surface px-4 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-text-muted">
                Écart{!bilan.toutPointe && <span className="normal-case tracking-normal"> (sur le pointé)</span>}
              </p>
              <p className={`text-sm tabular font-semibold ${
                bilan.ecart === 0 ? "text-text-muted" : bilan.ecart > 0 ? "text-positive" : "text-negative"}`}>
                {bilan.ecart === 0 ? "—" : `${bilan.ecart > 0 ? "+" : "−"}${fmt(Math.abs(bilan.ecart))}`}
              </p>
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto">
          {duMois.length === 0 ? (
            <p className="p-6 text-sm text-text-muted text-center">
              Rien de programmé sur ce mois. Les mouvements viennent des liens que tu crées
              dans la galaxie.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {duMois.map((o) => {
                const attendu = Number(o.expectedAmount);
                const constate = o.actualAmount != null ? Number(o.actualAmount) : null;
                const ecart = constate != null ? constate - attendu : 0;
                const enRetard = o.status === "pending" && o.dueDate <= aujourdhui;
                const revenu = estRevenu(o.flowId);

                return (
                  <li key={o.id} className={`px-5 py-3 ${enRetard ? "bg-negative/5" : ""}`}>
                    <div className="flex items-baseline justify-between gap-3 mb-1.5">
                      <span className="text-sm min-w-0 truncate">
                        <span className="tabular text-text-muted mr-2">
                          {o.dueDate.slice(8, 10)}/{o.dueDate.slice(5, 7)}
                        </span>
                        {nomDe(o.flowId)}
                      </span>
                      <span className={`text-sm tabular shrink-0 ${revenu ? "text-positive" : "text-text"}`}>
                        {revenu ? "+" : "−"}{fmt(attendu)}
                      </span>
                    </div>

                    {o.status === "confirmed" ? (
                      <div className="flex items-center gap-2 text-xs">
                        <Check size={13} className="text-positive shrink-0" />
                        <span className="text-text-muted">
                          Pointé{constate != null && constate !== attendu && (
                            <> à <span className="tabular text-text">{fmt(constate)}</span>
                              <span className={ecart >= 0 ? "text-positive" : "text-negative"}>
                                {" "}({ecart >= 0 ? "+" : "−"}{fmt(Math.abs(ecart))})
                              </span>
                            </>
                          )}
                        </span>
                        {!readOnly && (
                          <button onClick={() => valider(o, "pending")} disabled={enCours === o.id}
                            className="ml-auto text-text-muted hover:text-text" title="Annuler le pointage">
                            <RotateCcw size={12} />
                          </button>
                        )}
                      </div>
                    ) : o.status === "skipped" ? (
                      <div className="flex items-center gap-2 text-xs text-text-muted">
                        <Minus size={13} className="shrink-0" />
                        <span>Ignoré ce mois-ci</span>
                        {!readOnly && (
                          <button onClick={() => valider(o, "pending")} disabled={enCours === o.id}
                            className="ml-auto hover:text-text" title="Remettre à vérifier">
                            <RotateCcw size={12} />
                          </button>
                        )}
                      </div>
                    ) : readOnly ? (
                      <p className="text-xs text-text-muted">À vérifier</p>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="text" inputMode="decimal"
                          value={saisie[o.id] ?? ""}
                          onChange={(e) => setSaisie((s) => ({ ...s, [o.id]: e.target.value }))}
                          placeholder={String(attendu)}
                          aria-label={`Montant constaté pour ${nomDe(o.flowId)}`}
                          className="w-24 bg-bg border border-border rounded-md px-2 py-1 text-xs tabular text-right"
                        />
                        <button onClick={() => valider(o, "confirmed")} disabled={enCours === o.id}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-accent text-white text-xs font-medium hover:opacity-90 disabled:opacity-50">
                          <Check size={12} />Pointer
                        </button>
                        <button onClick={() => valider(o, "skipped")} disabled={enCours === o.id}
                          className="px-2.5 py-1 rounded-md border border-border text-xs text-text-muted hover:text-text disabled:opacity-50">
                          Ignorer
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="px-5 py-2.5 border-t border-border shrink-0">
          <p className="text-[10px] text-text-muted">
            Laisse le champ vide pour pointer au montant prévu ; saisis-en un autre s&apos;il a changé.
          </p>
        </footer>
      </div>
    </div>
  );
}
