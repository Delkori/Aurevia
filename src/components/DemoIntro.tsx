"use client";

import { useState, useSyncExternalStore } from "react";
import { Coins, Users, ClipboardCheck, X } from "lucide-react";

/**
 * Premier écran d'une démonstration reçue par lien.
 *
 * Le prospect arrive sans contexte, sur une galaxie qu'il n'a pas construite.
 * Le bandeau de démonstration l'avertissait que rien n'était modifiable — utile,
 * mais ça ne dit pas ce qu'il regarde ni pourquoi ça vaut son temps.
 *
 * Trois points, pas plus, et sur ce que les agrégateurs ne font pas : sinon
 * autant lui envoyer une page de tarifs.
 */

const CLE = "aurevia:demoIntroVue";

function lireVue(): boolean {
  try {
    return localStorage.getItem(CLE) === "1";
  } catch {
    return false;
  }
}

const POINTS = [
  {
    icone: Coins,
    titre: "Ce que ça vaut, maintenant",
    texte: "Les actions, ETF et cryptos sont valorisés aux cours du jour — ceux-ci sont réels. L'immobilier et l'épargne, que rien n'agrège automatiquement, se saisissent à la main et comptent pareil.",
  },
  {
    icone: Users,
    titre: "À plusieurs",
    texte: "L'appartement est détenu moitié-moitié : chacun voit sa part, et le total du foyer reste juste. C'est la question que se pose tout couple qui a acheté ensemble.",
  },
  {
    icone: ClipboardCheck,
    titre: "Prévu contre constaté",
    texte: "Chaque échéance se pointe au fil du mois. L'écart entre ce qui était prévu et ce qui est réellement passé est le chiffre qu'aucun tableur ne donne.",
  },
];

export default function DemoIntro() {
  // Lu au premier rendu client : un effet provoquerait un affichage puis un
  // escamotage, visible à l'œil.
  const dejaVue = useSyncExternalStore(() => () => {}, lireVue, () => true);
  const [ferme, setFerme] = useState(false);

  if (dejaVue || ferme) return null;

  const fermer = () => {
    setFerme(true);
    try { localStorage.setItem(CLE, "1"); } catch { /* stockage refusé : l'intro reviendra, sans gravité */ }
  };

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-bg/85 backdrop-blur-sm"
      role="dialog" aria-modal="true" aria-label="Bienvenue">
      <div className="w-full max-w-lg bg-surface border border-border rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-start gap-3 px-6 pt-6 pb-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold font-[family-name:var(--font-heading)] leading-tight">
              Le patrimoine d&apos;Alex et Camille
            </h2>
            <p className="text-sm text-text-muted mt-1.5 leading-relaxed">
              Un foyer d&apos;exemple, pour voir Aurevia avec quelque chose dedans.
              Tout est explorable — rien n&apos;est modifiable.
            </p>
          </div>
          <button onClick={fermer} aria-label="Fermer"
            className="p-1 rounded text-text-muted hover:text-text hover:bg-surface-hover shrink-0">
            <X size={16} />
          </button>
        </div>

        <ul className="px-6 space-y-3.5">
          {POINTS.map(({ icone: Icone, titre, texte }) => (
            <li key={titre} className="flex gap-3">
              <div className="w-7 h-7 shrink-0 rounded-full bg-accent/15 flex items-center justify-center mt-0.5">
                <Icone size={14} className="text-accent" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{titre}</p>
                <p className="text-[13px] text-text-muted leading-relaxed mt-0.5">{texte}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="px-6 py-5">
          <button onClick={fermer}
            className="w-full px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:opacity-90">
            Explorer la galaxie
          </button>
        </div>
      </div>
    </div>
  );
}
