"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Copy, Eye } from "lucide-react";

/**
 * Le lien à envoyer à un prospect.
 *
 * L'adresse se construit dans le navigateur : l'application n'a pas à connaître
 * son propre nom de domaine, et le lien affiché est forcément celui par lequel
 * on est arrivé — donc celui qui marchera chez le destinataire.
 */
export default function DemoLink() {
  const [copie, setCopie] = useState(false);

  // L'origine n'existe qu'au navigateur, mais la lire dans un effet provoque un
  // second rendu pour rien. `useSyncExternalStore` la donne au premier rendu
  // client, avec la chaîne vide comme instantané serveur : rien à écouter, une
  // origine ne change pas sans rechargement.
  const origine = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => ""
  );
  const url = origine ? `${origine}/demo` : "";

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      // Presse-papiers refusé (page non sécurisée, permission) : le champ est
      // sélectionnable, la copie manuelle reste possible.
    }
  };

  return (
    <section className="bg-surface border border-border rounded-lg p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 shrink-0 rounded-full bg-accent/15 flex items-center justify-center">
          <Eye size={15} className="text-accent" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-medium font-[family-name:var(--font-heading)]">
            Montrer Aurevia à quelqu&apos;un
          </h2>
          <p className="text-sm text-text-muted leading-relaxed mt-1">
            Ce lien ouvre une démonstration complète, sans mot de passe à transmettre.
            Elle présente un foyer fictif — Alex, Camille et Jonas, trois objectifs,
            un crédit immobilier — avec les <b className="font-medium text-text">vrais cours</b> du
            jour pour les actions et les cryptos.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          readOnly
          value={url}
          onClick={(e) => e.currentTarget.select()}
          aria-label="Lien de démonstration"
          className="flex-1 min-w-0 bg-bg border border-border rounded-md px-3 py-2 text-sm text-text-muted"
        />
        <button
          onClick={copier}
          className="flex items-center gap-2 shrink-0 text-sm px-3 py-2 rounded-md bg-accent text-white font-medium hover:opacity-90"
        >
          {copie ? <Check size={14} /> : <Copy size={14} />}
          {copie ? "Copié" : "Copier"}
        </button>
      </div>

      <p className="text-xs text-text-muted leading-relaxed">
        Tes données ne sont jamais exposées : la démonstration ne lit pas ta galaxie,
        elle a la sienne. Rien n&apos;y est modifiable, et la session expire au bout
        de 24 h. Pour désactiver le lien, mets <code className="text-text">DEMO_LINK=off</code> dans
        les variables d&apos;environnement.
      </p>
    </section>
  );
}
