"use client";

import { X } from "lucide-react";
import { BRANCHES, type Decouverte } from "@/lib/decouvertes";

/** Une couleur par branche — celle de sa nature quand elle en a une. */
const COULEURS: Record<Decouverte["branche"], string> = {
  fondations: "#ffcc55", discipline: "#9585ff", marches: "#3987e5", pierre: "#d95926", transmission: "#34d399",
};

/**
 * L'arbre des découvertes, en fenêtre.
 *
 * Cinq branches, quinze découvertes. Les pleines sont constatées dans les
 * données ; les pointillées disent ce qu'il reste à faire — et rien de plus :
 * aucune ne recommande un placement.
 */
export default function Decouvertes({ decouvertes, onClose }: { decouvertes: Decouverte[]; onClose: () => void }) {
  const total = decouvertes.length;
  const faites = decouvertes.filter(d => d.decouverte).length;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg/85 backdrop-blur-sm"
      role="dialog" aria-modal="true" aria-label="Arbre des découvertes" onClick={onClose}>
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto glass-panel border border-border rounded-2xl shadow-2xl p-5 space-y-4"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-heading)] font-semibold text-lg">Découvertes <span className="tabular text-text-muted font-normal text-sm">{faites} / {total}</span></h2>
            <p className="text-[11px] text-text-muted mt-0.5">Constatées dans tes données — rien à cocher. Ce qui manque dit ce qu&apos;il reste à faire, jamais quoi acheter.</p>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="p-1 rounded text-text-muted hover:text-text hover:bg-surface-hover shrink-0"><X size={16} /></button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {BRANCHES.map(b => {
            const lignes = decouvertes.filter(d => d.branche === b.id);
            const c = COULEURS[b.id];
            return (
              <section key={b.id} className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: c }}>
                  {b.nom} <span className="tabular text-text-muted font-normal">{lignes.filter(d => d.decouverte).length}/{lignes.length}</span>
                </p>
                {lignes.map(d => (
                  <div key={d.id} className="flex items-start gap-2 text-xs">
                    <span className="mt-1 w-2.5 h-2.5 rounded-full shrink-0"
                      style={d.decouverte
                        ? { background: c, boxShadow: `0 0 6px ${c}88` }
                        : { border: `1.5px dashed rgba(255,255,255,0.35)` }} />
                    <div className="min-w-0">
                      <p className={d.decouverte ? "text-text" : "text-text-muted"}>{d.nom}</p>
                      <p className="text-[10px] text-text-muted">{d.decouverte ? d.condition : `à découvrir : ${d.condition}`}</p>
                    </div>
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
