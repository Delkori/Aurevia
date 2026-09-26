"use client";

import { useSyncExternalStore } from "react";
import { CheckCircle2, Download, Share2 } from "lucide-react";

/** L'événement que Chrome/Edge/Android envoient quand l'app est installable — absent du DOM standard de TypeScript. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type EtatInstallation = { installee: boolean; evenement: BeforeInstallPromptEvent | null; ios: boolean };

function estIOS(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return /iPad|iPhone|iPod/.test(nav.userAgent) || (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);
}

function dejaInstallee(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

// L'installabilité vit hors de React (des événements du navigateur, pas un
// état qu'on possède) : elle s'expose comme une source externe
// (`useSyncExternalStore`), sur le même principe que `sinceLastVisit.ts` pour
// la mémoire de visite. Les écouteurs ne se posent qu'une fois, au premier
// accès — le composant peut se démonter et remonter sans les reposer.
let etat: EtatInstallation = { installee: false, evenement: null, ios: false };
const ecouteurs = new Set<() => void>();
let ecoutePosee = false;

function avertir() {
  ecouteurs.forEach((l) => l());
}

function poserEcoute() {
  if (ecoutePosee || typeof window === "undefined") return;
  ecoutePosee = true;
  etat = { ...etat, installee: dejaInstallee(), ios: estIOS() };
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    etat = { ...etat, evenement: e as BeforeInstallPromptEvent };
    avertir();
  });
  window.addEventListener("appinstalled", () => {
    etat = { ...etat, installee: true, evenement: null };
    avertir();
  });
}

function subscribe(onChange: () => void): () => void {
  poserEcoute();
  ecouteurs.add(onChange);
  return () => { ecouteurs.delete(onChange); };
}

function getSnapshot(): EtatInstallation {
  poserEcoute();
  return etat;
}

function getServerSnapshot(): EtatInstallation {
  return { installee: false, evenement: null, ios: false };
}

/**
 * Le bouton « Installer l'application », dans les paramètres.
 *
 * Trois cas, parce que les navigateurs ne s'accordent pas : Android/Chrome/Edge
 * proposent un événement à intercepter, iOS Safari n'en a aucun et demande un
 * geste manuel (Partager → Sur l'écran d'accueil), et le reste n'a ni l'un ni
 * l'autre — un simple rappel du menu du navigateur suffit alors.
 */
export default function InstallApp() {
  const { installee, evenement, ios } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const installer = async () => {
    if (!evenement) return;
    await evenement.prompt();
    const { outcome } = await evenement.userChoice;
    etat = { ...etat, installee: outcome === "accepted" || etat.installee, evenement: null };
    avertir();
  };

  return (
    <section className="bg-surface border border-border rounded-lg p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 shrink-0 rounded-full bg-accent/15 flex items-center justify-center">
          {installee ? <CheckCircle2 size={15} className="text-accent" /> : <Download size={15} className="text-accent" />}
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-medium font-[family-name:var(--font-heading)]">
            Application mobile
          </h2>
          <p className="text-sm text-text-muted leading-relaxed mt-1">
            {installee
              ? "Aurevia est installée sur cet appareil : une icône l'ouvre en plein écran, sans barre de navigateur."
              : "Installe Aurevia comme une application : icône sur l'écran d'accueil, ouverture en plein écran."}
          </p>
        </div>
      </div>

      {!installee && evenement && (
        <button
          onClick={installer}
          className="flex items-center gap-2 text-sm px-4 py-2 rounded-md bg-accent text-white font-medium hover:opacity-90"
        >
          <Download size={14} /> Installer l&apos;application
        </button>
      )}

      {!installee && !evenement && ios && (
        <p className="text-xs text-text-muted leading-relaxed flex items-start gap-2">
          <Share2 size={13} className="mt-0.5 shrink-0 text-text-muted" />
          Appuie sur <b className="font-medium text-text">Partager</b>, puis
          sur <b className="font-medium text-text">Sur l&apos;écran d&apos;accueil</b>.
        </p>
      )}

      {!installee && !evenement && !ios && (
        <p className="text-xs text-text-muted leading-relaxed">
          Cherche <b className="font-medium text-text">Installer l&apos;application</b> ou <b className="font-medium text-text">Ajouter à l&apos;écran d&apos;accueil</b> dans
          le menu du navigateur.
        </p>
      )}
    </section>
  );
}
