import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // ── Dette connue, volontairement en `warn` et non `error` ──────────────
      //
      // Ces trois règles viennent du React Compiler et visent toutes le même
      // endroit : GalaxyView lit pendant le rendu la carte de nœuds que la
      // simulation d3 met à jour par référence (`nodesMapRef.current`). C'est
      // le cœur du composant, et le corriger veut dire déplacer l'état de la
      // simulation dans un `useState` et découper le fichier — un chantier à
      // part entière, pas un correctif ponctuel.
      //
      // En `error`, ces règles rendraient la CI rouge en permanence et on
      // cesserait de la regarder. En `warn`, la CI reste utile pour tout le
      // reste et le compteur de dette reste visible à chaque `npm run lint`.
      //
      // À repasser en `error` une fois GalaxyView découpé
      // (useGalaxySimulation / useGalaxyViewport / PlanetNode) : c'est aussi ce
      // qui débloquera `reactCompiler: true` dans next.config.ts, lequel
      // mémoïse automatiquement tout le composant.
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
