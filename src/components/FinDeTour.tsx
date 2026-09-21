"use client";

import { ArrowDown, ArrowUp, Award, Check, Crown, Minus, Sparkles } from "lucide-react";
import type { BilanTour } from "@/lib/finDeTour";
import { PART_MAX } from "@/lib/score";

/**
 * L'écran de fin de tour, après « Enregistrer » dans le pointage.
 *
 * Il ne calcule rien : tout vient de `bilanDuTour`. Il ne fait que réunir,
 * à un moment qui a un début et une fin, des chiffres que l'app montre
 * déjà ailleurs — c'est ce moment qui manquait.
 */
export default function FinDeTour({ bilan, fmt, onRetour, onTourSuivant }: {
  bilan: BilanTour;
  fmt: (v: number) => string;
  onRetour: () => void;
  onTourSuivant: () => void;
}) {
  const { patrimoine, projets, planetes, score, situation, decouvertes, quetesAccomplies } = bilan;
  const delta = patrimoine.avant != null ? patrimoine.apres - patrimoine.avant : null;
  const depuis = patrimoine.depuis ? dateCourte(patrimoine.depuis) : null;

  const projetsBouges = projets.filter(p => p.avant != null && Math.round(p.apres * 100) !== Math.round(p.avant * 100));
  const planetesBougees = planetes.filter(p => p.pleinsAvant != null && p.pleinsAvant !== p.pleins);
  const merveilles = planetes.filter(p => p.pleine);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-bg/85 backdrop-blur-sm"
      role="dialog" aria-modal="true" aria-label={`Fin du tour, ${bilan.mois}`}>
      <div className="w-full max-w-lg glass-panel border border-border rounded-2xl shadow-2xl p-5 space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-[family-name:var(--font-heading)] font-semibold text-lg">Fin du tour · {bilan.mois}</h2>
          <span className="text-xs text-text-muted tabular shrink-0">
            {bilan.pointes} échéance{bilan.pointes > 1 ? "s" : ""} pointée{bilan.pointes > 1 ? "s" : ""}
          </span>
        </div>

        <div className="divide-y divide-border">
          {/* Patrimoine net */}
          {delta != null ? (
            <Ligne icone={delta >= 0 ? "haut" : "bas"}
              texte={<>Patrimoine net{depuis && <span className="text-text-muted"> depuis le {depuis}</span>}</>}
              valeur={`${delta >= 0 ? "+" : "−"}${fmt(Math.abs(delta))}`} ton={delta >= 0 ? "positive" : "negative"} />
          ) : (
            <Ligne icone="neutre" texte={<>Patrimoine net <span className="text-text-muted">— premier tour, rien à comparer encore</span></>}
              valeur={fmt(patrimoine.apres)} />
          )}

          {/* Projets */}
          {projetsBouges.map(p => {
            const monte = p.apres >= (p.avant ?? 0);
            return <Ligne key={`g-${p.id}`} icone={monte ? "haut" : "bas"}
              texte={<>{p.nom} <span className="text-text-muted">{Math.round((p.avant ?? 0) * 100)} → {Math.round(p.apres * 100)} %</span></>}
              valeur={p.apres >= 1 ? "atteint" : `${monte ? "+" : "−"}${Math.abs(Math.round(p.apres * 100) - Math.round((p.avant ?? 0) * 100))} pt`}
              ton={monte ? "positive" : "negative"} />;
          })}

          {/* Planètes */}
          {planetesBougees.map(p => {
            const d = p.pleins - (p.pleinsAvant ?? 0);
            return <Ligne key={`p-${p.id}`} icone={d >= 0 ? "haut" : "bas"}
              texte={<>{p.nom} <span className="text-text-muted">{p.pourcentage}</span></>}
              valeur={`${d >= 0 ? "+" : "−"}${Math.abs(d)} segment${Math.abs(d) > 1 ? "s" : ""}`}
              ton={d >= 0 ? "positive" : "negative"} />;
          })}
          {merveilles.map(p => (
            <Ligne key={`m-${p.id}`} icone="merveille" texte={<>{p.nom}</>} valeur="merveille" ton="or" />
          ))}
          {planetes.length > 0 && planetesBougees.length === 0 && merveilles.length === 0 && (
            <Ligne icone="neutre" texte={<span className="text-text-muted">Aucune barre de vie n&apos;a bougé ce tour</span>} valeur="" />
          )}
          {planetes.length === 0 && (
            <Ligne icone="neutre" texte={<span className="text-text-muted">Aucune planète n&apos;a de plafond : fixe-en un pour voir sa barre de vie ici</span>} valeur="" />
          )}

          {/* Les quêtes accomplies depuis le tour précédent : elles ne sont
              plus proposées, donc leur condition est remplie. Le premier tour
              n'a rien à comparer, et n'en montre jamais. */}
          {quetesAccomplies.map(titre => (
            <Ligne key={`q-${titre}`} icone="quete" texte={<>Accomplie : <strong className="font-medium">{titre}</strong></>} valeur="terminé" ton="positive" />
          ))}

          {/* Les découvertes du tour : une ligne chacune, une seule fois. Le
              premier tour en constate d'un coup tout ce que le foyer avait
              déjà — on les compte plutôt que de les énumérer. */}
          {decouvertes.length > 3 ? (
            <Ligne icone="decouverte" texte={<>{decouvertes.length} découvertes constatées <span className="text-text-muted">— l&apos;arbre est dans la barre latérale</span></>} valeur="découvert" ton="accent" />
          ) : decouvertes.map(nom => (
            <Ligne key={`d-${nom}`} icone="decouverte" texte={<>Découverte : <strong className="font-medium">{nom}</strong></>} valeur="découvert" ton="accent" />
          ))}

          {/* L'ère : où en est le foyer, et ce qui le sépare de la suivante. */}
          {situation && (
            <Ligne icone="ere"
              texte={<>{situation.ere.nom}{situation.prochaine && situation.manque[0] && (
                <span className="text-text-muted"> — {situation.prochaine.nom} : {situation.manque[0]}</span>
              )}</>}
              valeur={`ère ${["I", "II", "III", "IV", "V", "VI"][situation.ere.numero - 1]}`} ton="or" />
          )}
        </div>

        {/* Score */}
        {score && (
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-xs">
              <span className="text-text-muted">Score de structure</span>
              <span className={`tabular font-semibold ${score.total >= 70 ? "text-positive" : score.total >= 45 ? "text-accent" : "text-negative"}`}>{score.total} / 100</span>
            </div>
            <div className="h-1.5 rounded bg-border overflow-hidden">
              <div className="h-full rounded" style={{ width: `${score.total}%`, background: score.total >= 70 ? "#34d399" : score.total >= 45 ? "#7c6af5" : "#f87171" }} />
            </div>
            <p className="text-[10px] text-text-muted tabular">
              épargne {Math.round(score.parts.epargne)} · diversification {Math.round(score.parts.diversification)} · dette {Math.round(score.parts.dette)} · concentration {Math.round(score.parts.concentration)} — sur {PART_MAX} chacun
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onRetour} className="px-3 py-1.5 rounded-md text-xs border border-border text-text-muted hover:text-text hover:bg-surface-hover">
            Revenir au pointage
          </button>
          <button onClick={onTourSuivant} autoFocus className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-accent text-white hover:bg-accent-hover">
            Tour suivant
          </button>
        </div>
      </div>
    </div>
  );
}

function Ligne({ icone, texte, valeur, ton }: {
  icone: "haut" | "bas" | "neutre" | "merveille" | "ere" | "decouverte" | "quete";
  texte: React.ReactNode;
  valeur: string;
  ton?: "positive" | "negative" | "or" | "accent";
}) {
  const classes = {
    haut: "bg-positive/15 text-positive", bas: "bg-negative/15 text-negative",
    neutre: "bg-border text-text-muted", merveille: "bg-[#ffcc55]/15 text-[#ffcc55]", ere: "bg-[#ffcc55]/15 text-[#ffcc55]",
    decouverte: "bg-accent/15 text-accent", quete: "bg-positive/15 text-positive",
  }[icone];
  const Icone = { haut: ArrowUp, bas: ArrowDown, neutre: Minus, merveille: Award, ere: Crown, decouverte: Sparkles, quete: Check }[icone];
  const couleur = ton === "positive" ? "text-positive" : ton === "negative" ? "text-negative" : ton === "or" ? "text-[#ffcc55]" : ton === "accent" ? "text-accent" : "text-text";
  return (
    <div className="grid grid-cols-[18px_1fr_auto] items-center gap-2.5 py-2 text-xs">
      <span className={`w-[18px] h-[18px] rounded-full grid place-items-center ${classes}`}><Icone size={10} strokeWidth={2.5} /></span>
      <span className="min-w-0 truncate">{texte}</span>
      <span className={`tabular shrink-0 ${couleur}`}>{valeur}</span>
    </div>
  );
}

/** « 30 août » — sans l'année, on est dans le même tour. */
function dateCourte(iso: string): string {
  const [a, m, j] = iso.split("-").map(Number);
  const mois = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  return `${j}${j === 1 ? "er" : ""} ${mois[(m ?? 1) - 1]}${a === new Date().getFullYear() ? "" : ` ${a}`}`;
}
