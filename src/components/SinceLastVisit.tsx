"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { ArrowDownRight, ArrowUpRight, CalendarClock, CloudOff, Coins, Target, X } from "lucide-react";
import {
  getVisitMemory,
  getVisitMemoryServer,
  subscribeVisitMemory,
  summarizeSinceLastVisit,
  writeVisitMemory,
  type Highlight,
  type SummaryInput,
  type VisitMemory,
} from "@/lib/sinceLastVisit";

const ICONS = {
  networth: { up: ArrowUpRight, down: ArrowDownRight },
  goal: Target,
  payment: CalendarClock,
  dividend: Coins,
  stale: CloudOff,
} as const;

function IconFor({ h }: { h: Highlight }) {
  const Icon =
    h.kind === "networth"
      ? h.tone === "positive"
        ? ICONS.networth.up
        : ICONS.networth.down
      : ICONS[h.kind];
  const color =
    h.tone === "positive" ? "text-positive" : h.tone === "negative" ? "text-negative" : "text-text-muted";
  return <Icon size={13} className={`${color} shrink-0 mt-0.5`} aria-hidden />;
}

/**
 * Carte « depuis ta dernière visite ».
 *
 * La mémoire de visite n'est enregistrée qu'au moment où l'utilisateur ferme la
 * carte : tant qu'il ne l'a pas vue, le point de comparaison ne doit pas
 * bouger, sinon un passage rapide effacerait l'évolution sans jamais l'avoir
 * montrée. Quand il n'y a rien à dire, on enregistre directement.
 */
export default function SinceLastVisit({
  data,
  disabled,
}: {
  data: Omit<SummaryInput, "memory">;
  disabled?: boolean;
}) {
  const memory = useSyncExternalStore(
    subscribeVisitMemory,
    getVisitMemory,
    getVisitMemoryServer
  );
  const [dismissed, setDismissed] = useState(false);

  // Le patrimoine mémorisé ne bouge pas tant que des cours manquent : il vaut
  // alors le prix de revient des lignes concernées, et l'enregistrer ferait de
  // ce repli le nouveau point de comparaison — la prochaine visite, cours
  // revenus, annoncerait une hausse tout aussi imaginaire. La date et les
  // objectifs avancent, eux : ils ne dépendent d'aucune cotation.
  const nextMemory = (): VisitMemory => ({
    date: new Date().toISOString().slice(0, 10),
    netWorth: data.staleCount > 0 && memory ? memory.netWorth : data.netWorth,
    goalProgress: Object.fromEntries(data.goals.map((g) => [String(g.id), g.progress])),
  });

  const { daysSince, highlights } = summarizeSinceLastVisit({ ...data, memory });
  const nothingToSay = highlights.length === 0;

  // Rien à signaler : on avance le point de comparaison tout de suite, sinon la
  // prochaine visite comparerait encore à une photo périmée.
  useEffect(() => {
    if (nothingToSay && !disabled) writeVisitMemory(nextMemory());
    // `nextMemory` se reconstruit à chaque rendu ; le déclencheur utile est
    // l'absence de nouveauté, pas l'identité de la fonction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nothingToSay, disabled]);

  if (disabled || nothingToSay || dismissed) return null;

  const close = () => {
    writeVisitMemory(nextMemory());
    setDismissed(true);
  };

  return (
    <div className="absolute top-16 lg:top-4 left-1/2 -translate-x-1/2 z-10 w-[min(28rem,calc(100%-2rem))]">
      <div className="bg-surface/95 border border-border rounded-xl shadow-xl backdrop-blur px-4 py-3.5">
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <p className="text-[10px] uppercase tracking-wider text-text-muted">
            {daysSince == null
              ? "À venir"
              : daysSince <= 0
                ? "Depuis tout à l'heure"
                : daysSince === 1
                  ? "Depuis hier"
                  : `Depuis ta dernière visite, il y a ${daysSince} jours`}
          </p>
          <button
            onClick={close}
            aria-label="Fermer le résumé"
            className="text-text-muted hover:text-text shrink-0 -mt-0.5 focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent rounded"
          >
            <X size={13} />
          </button>
        </div>

        <ul className="space-y-2">
          {highlights.map((h) => (
            <li key={h.id} className="flex items-start gap-2 text-xs leading-relaxed">
              <IconFor h={h} />
              <span className="text-text">{h.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
