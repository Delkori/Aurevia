"use client";

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ChevronRight } from "lucide-react";
import { formatMoney } from "@/lib/format";
import {
  construireSystemes, SYSTEME_DEPENSES, SYSTEME_INVESTISSEMENTS, SYSTEME_REVENUS,
  type EntreesSystemes, type Satellite, type SystemeId,
} from "@/lib/systemes";
import {
  FILTRE_ETEINT, SHIP_DIMS, SHIP_IMAGES, imageSatellite, imageSysteme, palierDepenses,
  palierVaisseau, type GenreSysteme,
} from "@/lib/skins";
import { brancherMolette, transformeDe, type Vue } from "@/lib/molette";

/**
 * La vue d'ensemble : cinq ou six corps, et ce qui circule entre eux.
 *
 * Elle ne répond qu'à une question — où va l'argent — et laisse le détail au
 * niveau du dessous. C'est ce qui règle l'illisibilité : non pas mieux ranger
 * trente-six planètes, mais ne pas les montrer toutes en même temps.
 *
 * Une règle de lecture, pas un détail : les revenus et les dépenses sont des
 * rythmes mensuels, le patrimoine et les projets sont des capitaux. Les
 * dimensionner sur la même échelle reviendrait à comparer des euros par mois à
 * des euros. Chaque famille a donc la sienne, et l'unité est écrite sous le
 * montant.
 *
 * Chaque corps tourne avec ce qu'il contient, et des points remontent le long
 * des flux. Immobile, la vue ne disait pas qu'elle était vivante ni qu'on
 * pouvait voyager vers un système ; c'est le mouvement qui le dit. Survolé,
 * un corps s'allume franchement — auréole, habillage éclairci, liseré appuyé —
 * pour qu'on sache lequel s'ouvrira sous le clic.
 */

const W = 1000, H = 620;
const COLONNES = [140, 500, 860];
/** Distance du corps à son anneau de satellites. */
const ORBITE = 30;
/** Ce que l'étiquette d'un satellite déborde sous son point. */
const DEBORD_ETIQUETTE = 18;
/**
 * Secteur laissé libre en bas de l'anneau, en radians. C'est là qu'est écrit
 * « voyager » : sans ce trou, un satellite venait s'asseoir dessus.
 */
const SECTEUR_LIBRE = 1.15;

/** Contour sombre autour des lettres : lisible par-dessus un corps comme sur le fond. */
const HALO_TEXTE = { paintOrder: "stroke", stroke: "#07070d", strokeWidth: 2.5, strokeLinejoin: "round" } as const;

type Corps = {
  id: SystemeId; label: string; montant: number; parMois: boolean;
  couleur: string; contenu: number; satellites: Satellite[];
  x: number; y: number; r: number;
  /** Habillage photographique, quand il y en a un pour ce corps. */
  image?: string;
  /** Filtre à appliquer à l'habillage — un volcan éteint, faute de dépense. */
  filtre?: string;
  genre: GenreSysteme;
};

/** Rayon d'un satellite, du plus petit au plus gros de son anneau. */
function rayonSatellite(montant: number, max: number): number {
  return 5 + Math.sqrt(Math.min(1, Math.abs(montant) / Math.max(1, max))) * 6;
}

function rayon(montant: number, max: number): number {
  if (max <= 0) return 36;
  // Racine carrée : la surface suit le montant, pas le rayon — sinon un
  // patrimoine quatre fois plus gros avale tout l'écran.
  return 30 + Math.sqrt(Math.min(1, Math.abs(montant) / max)) * 34;
}

/**
 * Répartit une colonne en réservant à chaque corps son encombrement réel —
 * anneau de satellites et étiquettes compris. Diviser la hauteur en parts
 * égales ignorait l'orbite : à trois projets, leurs anneaux se traversaient
 * et les noms se marchaient dessus.
 */
function placerColonne(encombrements: number[], hauteur: number): number[] {
  const total = encombrements.reduce((s, e) => s + e * 2, 0);
  const ecart = Math.max(0, hauteur - total) / (encombrements.length + 1);
  // Colonne trop chargée pour la hauteur : on répartit régulièrement et on
  // laisse les anneaux se frôler, plutôt que de sortir du cadre.
  if (total > hauteur) {
    return encombrements.map((_, i) => ((i + 0.5) / encombrements.length) * hauteur);
  }
  let curseur = ecart;
  return encombrements.map(e => {
    const centre = curseur + e;
    curseur += e * 2 + ecart;
    return centre;
  });
}

/**
 * `false` quand le système demande des animations réduites — les points des
 * flux sont du SMIL, que la feuille de style ne peut pas neutraliser comme le
 * reste. Rendu serveur : `true`, le cas courant, pour ne pas faire clignoter
 * la vue à l'hydratation.
 */
function useAnimations(): boolean {
  return useSyncExternalStore(
    (surChangement) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", surChangement);
      return () => mq.removeEventListener("change", surChangement);
    },
    () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true,
  );
}

export default function SystemesView({
  entrees, devise, onEntrer,
}: {
  entrees: EntreesSystemes;
  devise: string;
  onEntrer: (id: SystemeId) => void;
}) {
  const id = useId();
  const [survol, setSurvol] = useState<SystemeId | null>(null);
  const anime = useAnimations();
  const fmt = (v: number) => formatMoney(v, devise);

  // Zoom et déplacement, comme dans la galaxie détaillée : on pouvait entrer
  // dans un système mais pas s'approcher de la vue d'ensemble, alors qu'elle
  // porte désormais des satellites nommés de huit pixels.
  const svgRef = useRef<SVGSVGElement | null>(null);
  const racineRef = useRef<SVGGElement | null>(null);
  const vueRef = useRef<Vue>({ k: 1, x: 0, y: 0 });
  const rectRef = useRef<DOMRect | null>(null);
  const glisse = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const svg = svgRef.current, racine = racineRef.current;
    if (!svg || !racine) return;
    const remesurer = () => { rectRef.current = svg.getBoundingClientRect(); };
    remesurer();
    const ro = new ResizeObserver(remesurer);
    ro.observe(svg);
    window.addEventListener("resize", remesurer);
    const detacher = brancherMolette({
      svg, racine, vue: vueRef.current, largeur: W, hauteur: H,
      rect: () => rectRef.current ?? svg.getBoundingClientRect(),
    });
    return () => { detacher(); ro.disconnect(); window.removeEventListener("resize", remesurer); };
  }, []);

  const auDoigtPose = (e: React.PointerEvent) => {
    // Un corps reste cliquable : seul le fond déplace la vue, sinon on ne
    // pourrait plus voyager vers un système sans le déplacer d'abord.
    if ((e.target as Element).closest("g[role=button]")) return;
    glisse.current = { sx: e.clientX, sy: e.clientY, ox: vueRef.current.x, oy: vueRef.current.y };
    (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
  };
  const auDoigtBouge = (e: React.PointerEvent) => {
    const g = glisse.current;
    if (!g) return;
    const r = rectRef.current ?? svgRef.current!.getBoundingClientRect();
    vueRef.current.x = g.ox + (e.clientX - g.sx) / r.width * W;
    vueRef.current.y = g.oy + (e.clientY - g.sy) / r.height * H;
    racineRef.current?.setAttribute("transform", transformeDe(vueRef.current));
  };
  const auDoigtLeve = (e: React.PointerEvent) => {
    glisse.current = null;
    (e.currentTarget as SVGSVGElement).releasePointerCapture?.(e.pointerId);
  };
  const recadrer = () => {
    vueRef.current = { k: 1, x: 0, y: 0 };
    racineRef.current?.setAttribute("transform", "");
  };

  const { corps, traits } = useMemo(() => {
    const { systemes, flux } = construireSystemes(entrees);

    const colonneDe = (s: SystemeId) =>
      s === SYSTEME_REVENUS ? 0 : s === SYSTEME_DEPENSES || s === SYSTEME_INVESTISSEMENTS ? 1 : 2;

    // Deux familles d'unités, deux échelles. Les mélanger ferait paraître un
    // patrimoine de 300 000 € cent fois plus « gros » qu'un revenu de 3 200 €/mois,
    // alors que les deux nombres ne se comparent pas.
    const maxFlux = Math.max(1, ...systemes.filter(s => s.parMois).map(s => Math.abs(s.montant)));
    const maxStock = Math.max(1, ...systemes.filter(s => !s.parMois).map(s => Math.abs(s.montant)));

    const parColonne = new Map<number, typeof systemes>();
    for (const s of systemes) {
      const c = colonneDe(s.id);
      if (!parColonne.has(c)) parColonne.set(c, []);
      parColonne.get(c)!.push(s);
    }

    const corps: Corps[] = [];
    for (const [c, membres] of parColonne) {
      const rayons = membres.map(s => rayon(s.montant, s.parMois ? maxFlux : maxStock));
      const ys = placerColonne(
        rayons.map((r, i) => (membres[i].satellites.length > 0 ? r + ORBITE + DEBORD_ETIQUETTE : r + 10)),
        H,
      );
      membres.forEach((s, i) => {
        const genre: GenreSysteme = s.id === SYSTEME_REVENUS ? "revenus"
          : s.id === SYSTEME_DEPENSES ? "depenses"
          : s.id === SYSTEME_INVESTISSEMENTS ? "investissements" : "projet";
        corps.push({
          ...s, x: COLONNES[c], y: ys[i], r: rayons[i], genre,
          filtre: genre === "depenses" && palierDepenses(s.montant, entrees.revenus) === "calm"
            ? FILTRE_ETEINT : undefined,
          image: imageSysteme({
            genre,
            label: s.label,
            montant: s.montant,
            revenus: entrees.revenus,
            contenus: s.satellites.map(sat => sat.nom),
            max: s.parMois ? maxFlux : maxStock,
          }),
        });
      });
    }

    const parId = new Map(corps.map(c => [c.id, c]));
    const traits = flux
      .map(f => ({ ...f, a: parId.get(f.source), b: parId.get(f.cible) }))
      .filter((t): t is typeof t & { a: Corps; b: Corps } => !!t.a && !!t.b);

    return { corps, traits };
  }, [entrees]);

  if (corps.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-text-muted px-8 text-center">
        Rien à montrer pour l&apos;instant. Ajoute un revenu, une dépense ou une planète.
      </div>
    );
  }

  const maxTrait = Math.max(1, ...traits.map(t => t.montant));

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-full select-none touch-none"
      onPointerDown={auDoigtPose} onPointerMove={auDoigtBouge}
      onPointerUp={auDoigtLeve} onPointerCancel={auDoigtLeve}
      onDoubleClick={recadrer}>
      <defs>
        {/* Le reflet sphérique et le liseré d'ombre sont les mêmes pour tous :
            c'est ce qui fait passer un disque plat pour une planète, image ou
            pas. Repris tels quels de la galaxie détaillée. */}
        <radialGradient id={`${id}-reflet`} cx="28%" cy="20%" r="28%">
          <stop offset="0%" stopColor="white" stopOpacity="0.55" />
          <stop offset="50%" stopColor="white" stopOpacity="0.12" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        {corps.map(c => (
          <radialGradient key={c.id} id={`${id}-sph-${c.id}`} cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor={c.couleur} stopOpacity="0.95" />
            <stop offset="100%" stopColor={c.couleur} stopOpacity="0.42" />
          </radialGradient>
        ))}
        {/* L'auréole qui s'allume au survol. Un dégradé plutôt qu'un flou : il
            coûte le même prix qu'un cercle, là où un filtre de flou repeint la
            zone à chaque image — et la scène en a déjà six en rotation. */}
        {corps.map(c => (
          <radialGradient key={`l-${c.id}`} id={`${id}-lueur-${c.id}`} cx="50%" cy="50%" r="50%">
            <stop offset="30%" stopColor={c.couleur} stopOpacity="0.55" />
            <stop offset="62%" stopColor={c.couleur} stopOpacity="0.22" />
            <stop offset="100%" stopColor={c.couleur} stopOpacity="0" />
          </radialGradient>
        ))}
        {corps.filter(c => c.image).map(c => (
          <clipPath key={c.id} id={`${id}-cp-${c.id}`}><circle r={c.r} cx={c.x} cy={c.y} /></clipPath>
        ))}
        {/* Un détourage par satellite illustré. Le cercle est posé à l'origine
            du repère du satellite, qui tourne avec lui : une rotation ne change
            rien à un cercle centré. */}
        {corps.flatMap(c => {
          const maxSat = Math.max(1, ...c.satellites.map(sat => Math.abs(sat.montant)));
          return c.satellites.map((sat, i) => imageSatellite(sat, c.genre) ? (
            <clipPath key={`${c.id}-${i}`} id={`${id}-cps-${c.id}-${i}`}>
              <circle r={rayonSatellite(sat.montant, maxSat)} />
            </clipPath>
          ) : null);
        })}
      </defs>

      {/* Tout ce qui se déplace et se met à l'échelle d'un bloc. */}
      <g ref={racineRef}>
      {traits.map(t => {
        const largeur = 1.5 + (t.montant / maxTrait) * 5;
        const mx = (t.a.x + t.b.x) / 2;
        const trace = `M${t.a.x + t.a.r},${t.a.y} C${mx},${t.a.y} ${mx},${t.b.y} ${t.b.x - t.b.r},${t.b.y}`;
        // Un gros versement envoie plus de vaisseaux qu'un petit, et de plus
        // gros : le débit se lit dans la densité et dans la taille, pas
        // seulement dans l'épaisseur du trait.
        const part = t.montant / maxTrait;
        const points = 1 + Math.round(part * 2);
        const vaisseau = palierVaisseau(part);
        const d = SHIP_DIMS[vaisseau];
        const duree = 5.2;
        return (
          <g key={`${t.source}-${t.cible}`}>
            <path d={trace} fill="none" stroke={t.b.couleur} strokeOpacity={0.42}
              strokeWidth={largeur} strokeLinecap="round" />
            {anime && Array.from({ length: points }, (_, k) => (
              // `rotate="auto"` oriente le vaisseau sur la tangente du tracé :
              // il suit la courbe au lieu de glisser de côté.
              <g key={k}>
                <image href={SHIP_IMAGES[vaisseau]} x={-d.w / 2} y={-d.h / 2}
                  width={d.w} height={d.h} opacity={0.95} />
                <animateMotion dur={`${duree}s`} repeatCount="indefinite" path={trace}
                  rotate="auto" begin={`${-(k * duree) / points}s`} />
              </g>
            ))}
            <text x={mx} y={(t.a.y + t.b.y) / 2 - 7} textAnchor="middle"
              fontSize={12} fill="var(--text-muted)" className="tabular">
              {fmt(t.montant)}/mois
            </text>
          </g>
        );
      })}

      {corps.map((c, iCorps) => {
        const actif = survol === c.id;
        const rOrbite = c.r + ORBITE;
        // Cadences distinctes : à durée identique, les trois systèmes tournaient
        // comme un seul engrenage, ce qui se lisait comme une image qui pivote
        // plutôt que comme trois corps indépendants.
        const duree = 34 + iCorps * 9;
        const maxSat = Math.max(1, ...c.satellites.map(s => Math.abs(s.montant)));
        return (
          <g key={c.id} transform={`translate(${c.x},${c.y})`} style={{ cursor: "pointer" }}
            onPointerEnter={() => setSurvol(c.id)} onPointerLeave={() => setSurvol(s => s === c.id ? null : s)}
            onClick={() => onEntrer(c.id)}
            role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onEntrer(c.id); } }}
            aria-label={`${c.label}, ${fmt(c.montant)}${c.parMois ? " par mois" : ""}${c.contenu > 0 ? `, ${c.contenu} élément${c.contenu > 1 ? "s" : ""}` : ""}. Voyager vers ce système.`}>

            {/* Toujours dans le DOM, à opacité nulle au repos : une auréole
                montée au survol n'aurait pas eu de fondu, elle aurait claqué. */}
            <circle r={c.r + 46} fill={`url(#${id}-lueur-${c.id})`} pointerEvents="none"
              opacity={actif ? 1 : 0} style={{ transition: "opacity 0.2s ease-out" }} />

            {/* Les satellites ne se cliquent pas séparément : c'est le système
                entier qu'on ouvre, et laisser un point avaler le clic donnerait
                une cible qui se dérobe puisqu'elle bouge. */}
            {c.satellites.length > 0 && (
              <g className="sv-orbite" style={{ animationDuration: `${duree}s` }} pointerEvents="none">
                <circle r={rOrbite} fill="none" stroke={c.couleur}
                  strokeOpacity={actif ? 0.35 : 0.16} strokeDasharray="2 8" />
                {c.satellites.map((sat, i) => {
                  const angle = Math.PI / 2 + SECTEUR_LIBRE / 2
                    + ((i + 0.5) / c.satellites.length) * (Math.PI * 2 - SECTEUR_LIBRE);
                  const rSat = rayonSatellite(sat.montant, maxSat);
                  const vignette = imageSatellite(sat, c.genre);
                  const nom = sat.nom.length > 12 ? `${sat.nom.slice(0, 11)}…` : sat.nom;
                  return (
                    <g key={`${sat.nom}-${i}`}
                      transform={`translate(${Math.cos(angle) * rOrbite},${Math.sin(angle) * rOrbite})`}>
                      <g className="sv-contre" style={{ animationDuration: `${duree}s` }}>
                        {vignette ? (
                          <>
                            <g clipPath={`url(#${id}-cps-${c.id}-${i})`}>
                              <image href={vignette} x={-rSat} y={-rSat} width={rSat * 2} height={rSat * 2}
                                preserveAspectRatio="xMidYMid slice" />
                            </g>
                            <circle r={rSat} fill={`url(#${id}-reflet)`} />
                            <circle r={rSat} fill="none" stroke={c.couleur} strokeOpacity={0.9} strokeWidth={1.2} />
                          </>
                        ) : (
                          <circle r={rSat} fill={c.couleur} fillOpacity={0.95}
                            stroke="#07070d" strokeWidth={0.8} />
                        )}
                        <text y={rSat + 10} textAnchor="middle" fontSize={8.5} fontWeight={600}
                          fill="rgba(255,255,255,0.82)" style={HALO_TEXTE}>{nom}</text>
                        <title>{`${sat.nom} · ${fmt(sat.montant)}`}</title>
                      </g>
                    </g>
                  );
                })}
              </g>
            )}

            <circle r={c.r + 7} fill={c.couleur} opacity={actif ? 0.34 : 0.1}
              style={{ transition: "opacity 0.2s ease-out" }} />
            {/* Le corps lui-même s'éclaire : sans ça, seul son pourtour changeait
                et l'habillage restait aussi terne qu'au repos. */}
            <g style={{ filter: actif ? `${c.filtre ?? ""} brightness(1.22) saturate(1.12)`.trim() : (c.filtre ?? "none"), transition: "filter 0.2s ease-out" }}>
              {c.image ? (
                // Le détourage est posé dans les coordonnées du SVG, pas dans
                // celles du groupe : on annule donc la translation du corps.
                <g clipPath={`url(#${id}-cp-${c.id})`} transform={`translate(${-c.x},${-c.y})`}>
                  <image href={c.image} x={c.x - c.r} y={c.y - c.r} width={c.r * 2} height={c.r * 2}
                    preserveAspectRatio="xMidYMid slice" />
                </g>
              ) : (
                <circle r={c.r} fill={`url(#${id}-sph-${c.id})`} />
              )}
              <circle r={c.r} fill={`url(#${id}-reflet)`} />
            </g>
            <circle r={c.r} fill="none" stroke={c.couleur} strokeOpacity={actif ? 1 : 0.6}
              strokeWidth={actif ? 3 : 2} style={{ transition: "stroke-opacity 0.2s ease-out, stroke-width 0.2s ease-out" }} />
            <circle r={c.r - 1} fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth={1.5} />

            {/* Un nom de projet est libre : « Apport résidence principale » dépasse
                largement son cercle. Le contour sombre le laisse mordre sur le
                fond plutôt que de le réduire à « Apport réside… » — la largeur
                utile est celle de l'anneau, pas celle du disque. */}
            <text y={-6} textAnchor="middle" fontSize={c.label.length > 14 ? 12 : 15}
              fontWeight={600} fill="#fff" style={HALO_TEXTE}>
              {(() => {
                const taille = c.label.length > 14 ? 12 : 15;
                const maxCar = Math.max(8, Math.floor((rOrbite * 1.8) / (taille * 0.52)));
                return c.label.length > maxCar ? `${c.label.slice(0, maxCar - 1)}…` : c.label;
              })()}
            </text>
            <title>{c.label}</title>
            <text y={14} textAnchor="middle" fontSize={13} fill="rgba(255,255,255,0.92)"
              className="tabular" style={HALO_TEXTE}>
              {fmt(c.montant)}
            </text>
            <text y={29} textAnchor="middle" fontSize={10} fill="rgba(255,255,255,0.65)" style={HALO_TEXTE}>
              {c.parMois ? "par mois" : c.contenu > 0 ? `${c.contenu} planète${c.contenu > 1 ? "s" : ""}` : "capital"}
            </text>

            {/* Toujours présent, appuyé au survol : réservé au survol, rien ne
                disait qu'un corps s'ouvrait tant qu'on n'avait pas la souris
                dessus — et rien du tout au doigt. Posé entre le corps et son
                anneau : au-delà, il allait chevaucher le corps voisin. */}
            <g transform={`translate(0,${c.r + 17})`} pointerEvents="none"
              opacity={actif ? 1 : 0.55} style={{ transition: "opacity 0.2s ease-out" }}>
              <text textAnchor="middle" fontSize={actif ? 12 : 11} fontWeight={actif ? 700 : 500}
                fill={actif ? "#fff" : "var(--text-muted)"} style={HALO_TEXTE}>voyager</text>
              <ChevronRight x={30} y={-9} size={11} color={actif ? "#fff" : "var(--text-muted)"} />
            </g>
          </g>
        );
      })}
      </g>
    </svg>
  );
}
