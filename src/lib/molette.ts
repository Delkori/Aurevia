/**
 * Zoom à la molette sur une vue SVG.
 *
 * Le geste avait été réglé finement pour la galaxie détaillée — conversion des
 * unités de défilement, plafond par événement, une seule écriture par image —
 * et la vue d'ensemble n'en profitait pas : on ne pouvait pas s'y approcher.
 * Plutôt que de recopier une soixantaine de lignes subtiles, les deux vues
 * partagent celles-ci.
 *
 * Le module ne connaît pas React : il prend les éléments, rend un détachement.
 */

// `SENSIBILITE` se lit ainsi : un cran de souris (deltaY ≈ 100) donne
// `exp(100 × 0,0014) ≈ 1,15`, soit 15 % — la valeur qui « tombe juste » au
// poignet. Un effleurement de pavé tactile (deltaY ≈ 4) donne 1,006 : il en
// faut une bonne centaine pour doubler l'échelle, ce qui est exactement le
// geste attendu.
export const SENSIBILITE = 0.0014;
/** Amplitude maximale retenue d'un seul événement, pour qu'aucun ne fasse bondir la vue. */
export const PAS_MAX = 180;

/** L'état d'une vue : son échelle et son décalage, en unités du `viewBox`. */
export type Vue = { k: number; x: number; y: number };

export const transformeDe = (v: Vue) => `translate(${v.x},${v.y}) scale(${v.k})`;

export type OptionsMolette = {
  /** L'élément qui reçoit le geste. */
  svg: SVGSVGElement;
  /** Le groupe déplacé et mis à l'échelle. */
  racine: SVGGElement;
  /** L'état, modifié sur place : l'appelant le partage avec son glisser-déposer. */
  vue: Vue;
  /** Dimensions du `viewBox`, pour convertir les pixels de l'écran. */
  largeur: number;
  hauteur: number;
  min?: number;
  max?: number;
  /**
   * Rectangle de l'élément à l'écran. `getBoundingClientRect` force un
   * recalcul de mise en page : à plus de cent événements par seconde, mieux
   * vaut ne mesurer qu'aux moments où ça change. Sans fournisseur, on mesure.
   */
  rect?: () => DOMRect;
};

/**
 * Branche le zoom et rend la fonction de détachement.
 *
 * `vue` est modifié sur place plutôt que remplacé : le glisser-déposer de
 * l'appelant écrit dans le même objet, et les deux gestes doivent voir le même
 * état sans passer par un rendu React — qui coûterait, ici, un repeint complet.
 */
export function brancherMolette({
  svg, racine, vue, largeur, hauteur, min = 0.2, max = 6, rect: donneRect,
}: OptionsMolette): () => void {
  // Une écriture par image : le pavé tactile émet plus vite que l'écran
  // n'affiche, et chaque écriture invalide la peinture de tout le SVG.
  let trame = 0;
  const peindre = () => {
    trame = 0;
    racine.setAttribute("transform", transformeDe(vue));
  };

  const surMolette = (e: WheelEvent) => {
    e.preventDefault();

    // `deltaMode` varie d'un navigateur à l'autre : Firefox compte en lignes
    // là où Chrome compte en pixels. Sans conversion, le même geste zoome
    // plusieurs fois moins vite ici que là.
    const r = donneRect?.() ?? svg.getBoundingClientRect();
    let dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 16;
    else if (e.deltaMode === 2) dy *= r.height || 400;
    dy = Math.max(-PAS_MAX, Math.min(PAS_MAX, dy));

    const nk = Math.max(min, Math.min(max, vue.k * Math.exp(-dy * SENSIBILITE)));
    if (nk === vue.k) return; // déjà en butée : rien à redessiner

    // Le point sous le curseur reste sous le curseur.
    const mx = (e.clientX - r.left) / r.width * largeur;
    const my = (e.clientY - r.top) / r.height * hauteur;
    vue.x = mx - (mx - vue.x) * (nk / vue.k);
    vue.y = my - (my - vue.y) * (nk / vue.k);
    vue.k = nk;

    if (!trame) trame = requestAnimationFrame(peindre);
  };

  svg.addEventListener("wheel", surMolette, { passive: false });
  return () => {
    svg.removeEventListener("wheel", surMolette);
    if (trame) cancelAnimationFrame(trame);
  };
}
