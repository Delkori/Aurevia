import type { ReactElement } from "react";

/**
 * Le glyphe de l'app, partagé par toutes les tailles d'icône générées
 * (favicon, apple-icon, icônes du manifeste). Fond dégradé plein cadre :
 * le masque adaptatif d'Android et l'arrondi d'iOS s'appliquent par-dessus
 * sans jamais couper la lettre, tant que `letterRatio` laisse une marge.
 */
export function pwaIcon({ size, letterRatio = 0.56 }: { size: number; letterRatio?: number }): ReactElement {
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0d0d0f 0%, #18142a 100%)",
      }}
    >
      <span style={{ fontSize: size * letterRatio, fontWeight: 700, color: "#7c6af5", fontFamily: "sans-serif", lineHeight: 1 }}>
        A
      </span>
    </div>
  );
}
