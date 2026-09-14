"use client";

import { useSyncExternalStore } from "react";

/**
 * La date du jour, affichée en tête d'écran.
 *
 * Elle est lue au premier rendu client et non sur le serveur : le fuseau du
 * serveur n'est pas celui du lecteur, et une date rendue des deux côtés
 * produirait un écart d'hydratation — un jour de décalage, selon l'heure.
 *
 * Le rendu serveur renvoie donc la chaîne vide, et le composant ne réserve pas
 * de place tant qu'il n'a rien à dire : rien ne saute à l'affichage.
 */

/** Rien à écouter : la date ne change pas sans que la page soit rechargée. */
const neRienEcouter = () => () => {};

function aujourdhui(): string {
  return new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function DateDuJour({ className = "" }: { className?: string }) {
  const date = useSyncExternalStore(neRienEcouter, aujourdhui, () => "");
  if (!date) return null;
  return (
    <p className={`text-[10px] text-text-muted first-letter:uppercase ${className}`}>
      {date}
    </p>
  );
}
