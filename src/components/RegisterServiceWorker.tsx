"use client";

import { useEffect } from "react";

/** Enregistre le service worker de la coquille PWA — silencieusement, sans rien afficher. */
export default function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Un navigateur qui refuse (mode privé, politique d'entreprise) laisse
        // simplement l'app fonctionner comme un site classique.
      });
    }
  }, []);
  return null;
}
