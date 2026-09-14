"use client";

import { useState, useSyncExternalStore } from "react";
import { Coins, Users, ClipboardCheck, Orbit, X } from "lucide-react";

/**
 * Premier écran d'une démonstration reçue par lien.
 *
 * Le prospect arrive sans contexte, sur une galaxie qu'il n'a pas construite.
 * Le bandeau de démonstration l'avertissait que rien n'était modifiable — utile,
 * mais ça ne dit ni ce qu'il regarde, ni ce que fait Aurevia, ni pourquoi ça
 * vaut son temps.
 *
 * **Une fois par visite, pas une fois par navigateur.** L'écran était mémorisé
 * en `localStorage` : celui qui avait ouvert le lien une fois ne revoyait
 * jamais l'explication, et la démonstration se rouvrait sur une galaxie muette.
 * Or c'est un lien qu'on renvoie, qu'on montre à deux, qu'on rouvre des
 * semaines plus tard. Le repère est donc celui de l'onglet (`sessionStorage`) :
 * il évite la répétition pendant qu'on navigue entre les écrans, et laisse
 * l'explication revenir à chaque nouvelle connexion.
 *
 * `?intro=1`, posé par la route `/demo`, passe outre : ouvrir le lien de
 * démonstration montre l'explication, même dans un onglet qui l'a déjà vue.
 *
 * Quatre points, pas plus, et sur ce que les agrégateurs ne font pas : sinon
 * autant envoyer une page de tarifs.
 */

const CLE = "aurevia:demoIntroVue";

/** `true` quand l'écran a déjà été fermé dans cet onglet et que rien ne l'impose. */
function dejaVueIci(): boolean {
  try {
    if (new URLSearchParams(window.location.search).has("intro")) return false;
    return sessionStorage.getItem(CLE) === "1";
  } catch {
    return false;
  }
}

const POINTS = [
  {
    icone: Coins,
    titre: "Tout le patrimoine, pas seulement ce qui se connecte",
    texte: "Les actions, ETF et cryptos sont valorisés aux cours du jour — ceux-ci sont réels. L'immobilier, l'assurance-vie et l'épargne, que rien n'agrège automatiquement, se saisissent à la main et comptent pareil. Les crédits se déduisent.",
  },
  {
    icone: Users,
    titre: "Un foyer, pas un compte",
    texte: "L'appartement d'Alex et Camille est détenu moitié-moitié : chacun voit sa part, le total du foyer reste juste, et les dépenses communes se répartissent de la même façon. C'est la question que se pose tout couple qui a acheté ensemble.",
  },
  {
    icone: ClipboardCheck,
    titre: "Prévu contre constaté",
    texte: "Chaque échéance se pointe au fil du mois, en un clic. L'écart entre ce qui était prévu et ce qui est réellement passé est le chiffre qu'aucun tableur ne donne — et il se pointe aussi dans cette démonstration.",
  },
  {
    icone: Orbit,
    titre: "Une galaxie plutôt qu'un tableau",
    texte: "Les revenus, les dépenses, les placements et les projets sont des systèmes ; on y voyage. Chaque planète porte l'anneau de son propriétaire et chaque versement son trajet : d'où part l'argent, et où il va.",
  },
];

export default function DemoIntro() {
  // Lu au premier rendu client : un effet provoquerait un affichage puis un
  // escamotage, visible à l'œil.
  const dejaVue = useSyncExternalStore(() => () => {}, dejaVueIci, () => true);
  const [ferme, setFerme] = useState(false);

  if (dejaVue || ferme) return null;

  const fermer = () => {
    setFerme(true);
    try { sessionStorage.setItem(CLE, "1"); } catch { /* stockage refusé : l'écran reviendra, sans gravité */ }
    // Le paramètre a joué son rôle ; l'effacer évite qu'un rechargement de la
    // page rouvre l'écran qu'on vient de fermer.
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has("intro")) {
        url.searchParams.delete("intro");
        window.history.replaceState(null, "", url.pathname + url.search + url.hash);
      }
    } catch { /* URL exotique : rien à nettoyer */ }
  };

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-bg/85 backdrop-blur-sm overflow-y-auto"
      role="dialog" aria-modal="true" aria-label="Bienvenue">
      <div className="w-full max-w-lg my-auto bg-surface border border-border rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-start gap-3 px-6 pt-6 pb-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold font-[family-name:var(--font-heading)] leading-tight">
              Aurevia, en un coup d&apos;œil
            </h2>
            <p className="text-sm text-text-muted mt-1.5 leading-relaxed">
              Le suivi du patrimoine d&apos;un foyer : ce qu&apos;il possède, ce qui rentre,
              ce qui sort, et où ça va. Voici celui d&apos;Alex et Camille, un foyer
              d&apos;exemple — tout est explorable, rien n&apos;est enregistré.
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
