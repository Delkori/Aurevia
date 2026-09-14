/**
 * Zoom d'une vue SVG : molette à la souris, pincement au doigt.
 *
 * Le geste avait été réglé finement pour la galaxie détaillée — conversion des
 * unités de défilement, plafond par événement, une seule écriture par image —
 * et la vue d'ensemble n'en profitait pas : on ne pouvait pas s'y approcher.
 * Plutôt que de recopier une soixantaine de lignes subtiles, les deux vues
 * partagent celles-ci.
 *
 * Le pincement est indispensable, pas décoratif : sur téléphone la galaxie
 * s'ouvre forcément de loin — un graphe large ne tient pas sur trois cents
 * pixels — et sans geste pour s'approcher, il n'y avait aucun moyen de lire
 * quoi que ce soit. La molette ne répond qu'à la souris.
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

export type OptionsZoom = {
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

/** Ce que rend `brancherZoom` : de quoi se détacher, et de quoi s'effacer. */
export type Zoom = {
  detacher: () => void;
  /**
   * `true` tant que deux doigts sont posés. Le glisser-déposer de l'appelant
   * s'en sert pour se taire : sans ça, le premier doigt continuait de déplacer
   * la vue pendant que les deux la mettaient à l'échelle, et le geste partait
   * en vrille.
   */
  pince: () => boolean;
};

/**
 * Branche le zoom et rend de quoi le détacher.
 *
 * `vue` est modifié sur place plutôt que remplacé : le glisser-déposer de
 * l'appelant écrit dans le même objet, et les deux gestes doivent voir le même
 * état sans passer par un rendu React — qui coûterait, ici, un repeint complet.
 */
export function brancherZoom({
  svg, racine, vue, largeur, hauteur, min = 0.2, max = 6, rect: donneRect,
}: OptionsZoom): Zoom {
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

  // ── Pincement ─────────────────────────────────────────────────────────────
  // Deux doigts donnent à la fois l'échelle (leur écartement) et le
  // déplacement (le milieu qui bouge) : les traiter ensemble évite que la vue
  // fuie sous les doigts quand on pince en biais.
  const doigts = new Map<number, { x: number; y: number }>();
  let precedent: { ecart: number; mx: number; my: number } | null = null;

  /** Écartement et milieu des deux doigts, en unités du `viewBox`. */
  const mesure = () => {
    const [a, b] = [...doigts.values()];
    const r = donneRect?.() ?? svg.getBoundingClientRect();
    const enX = (cx: number) => (cx - r.left) / r.width * largeur;
    const enY = (cy: number) => (cy - r.top) / r.height * hauteur;
    const ax = enX(a.x), ay = enY(a.y), bx = enX(b.x), by = enY(b.y);
    return { ecart: Math.hypot(bx - ax, by - ay), mx: (ax + bx) / 2, my: (ay + by) / 2 };
  };

  const surPose = (e: PointerEvent) => {
    if (e.pointerType !== "touch") return;
    doigts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    precedent = doigts.size === 2 ? mesure() : null;
  };

  const surBouge = (e: PointerEvent) => {
    if (!doigts.has(e.pointerId)) return;
    doigts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (doigts.size !== 2) return;
    const m = mesure();
    if (!precedent || precedent.ecart <= 0 || m.ecart <= 0) { precedent = m; return; }
    e.preventDefault();

    const nk = Math.max(min, Math.min(max, vue.k * (m.ecart / precedent.ecart)));
    // Le point pincé reste sous les doigts, et la vue suit le milieu.
    vue.x = m.mx - (precedent.mx - vue.x) * (nk / vue.k);
    vue.y = m.my - (precedent.my - vue.y) * (nk / vue.k);
    vue.k = nk;
    precedent = m;

    if (!trame) trame = requestAnimationFrame(peindre);
  };

  const surLeve = (e: PointerEvent) => {
    if (!doigts.delete(e.pointerId)) return;
    // Le doigt qui reste ne doit pas faire sauter la vue : on repart de zéro.
    precedent = doigts.size === 2 ? mesure() : null;
  };

  svg.addEventListener("wheel", surMolette, { passive: false });
  svg.addEventListener("pointerdown", surPose);
  svg.addEventListener("pointermove", surBouge, { passive: false });
  svg.addEventListener("pointerup", surLeve);
  svg.addEventListener("pointercancel", surLeve);

  return {
    pince: () => doigts.size >= 2,
    detacher: () => {
      svg.removeEventListener("wheel", surMolette);
      svg.removeEventListener("pointerdown", surPose);
      svg.removeEventListener("pointermove", surBouge);
      svg.removeEventListener("pointerup", surLeve);
      svg.removeEventListener("pointercancel", surLeve);
      if (trame) cancelAnimationFrame(trame);
    },
  };
}

/**
 * Échelle visée à l'ouverture, en pixels par unité du repère. En dessous de
 * 0,8, les étiquettes de 10 à 11 unités tombent sous les huit pixels et ne se
 * lisent plus.
 */
export const ECHELLE_LISIBLE = 0.85;

/**
 * Vue d'ouverture, centrée, sur un écran trop étroit pour tout montrer.
 *
 * Le repère de dessin fait mille deux cents unités de large. Sur un téléphone
 * de trois cents pixels, tout est rendu au quart : le texte tombe à trois
 * pixels et la galaxie se réduit à une bande illisible au milieu de deux
 * grands vides. Réduire uniformément le repère *et* ce qu'on y dessine n'y
 * changerait rien — c'est la même image, au même rapport.
 *
 * Il n'y a donc qu'une issue honnête : montrer moins, et plus gros. On ouvre à
 * l'échelle où le texte se lit, quitte à ce que le reste dépasse du cadre —
 * c'est ce que fait n'importe quelle carte sur téléphone, et le pincement fait
 * le reste. Le débordement est bien peint : un SVG rogne sur son cadre à
 * l'écran, pas sur son `viewBox`.
 *
 * Sur un écran assez large, `k` vaudrait moins de 1 : on rend la vue neutre
 * plutôt que de dézoomer ce qui tenait déjà.
 */
export function vueDOuverture(
  { largeurPx, hauteurPx, largeur, hauteur, max = 6, cible = ECHELLE_LISIBLE, centre }: {
    largeurPx: number; hauteurPx: number; largeur: number; hauteur: number;
    max?: number; cible?: number;
    /**
     * Point du repère à amener au milieu du cadre. À défaut, le milieu du
     * repère — ce qui ouvre sur du vide quand le dessin n'y est pas centré.
     */
    centre?: { x: number; y: number };
  }
): Vue {
  const neutre = { k: 1, x: 0, y: 0 };
  if (!(largeurPx > 0) || !(hauteurPx > 0)) return neutre;

  // Échelle imposée par `preserveAspectRatio="xMidYMid meet"` : le repère
  // entier tient dans le cadre, donc c'est le côté le plus contraint qui gagne.
  const base = Math.min(largeurPx / largeur, hauteurPx / hauteur);
  const k = Math.min(max, cible / base);
  if (!(k > 1.02)) return neutre; // déjà lisible : on n'y touche pas

  // Le cadre est centré sur le `viewBox` : son milieu est celui du repère.
  const cx = centre?.x ?? largeur / 2;
  const cy = centre?.y ?? hauteur / 2;
  return { k, x: largeur / 2 - k * cx, y: hauteur / 2 - k * cy };
}

/** Largeur au-delà de laquelle la galaxie tient sans se resserrer. */
export const LARGEUR_ETROITE = 640;
