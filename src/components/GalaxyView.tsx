"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY,
  type Simulation, type SimulationNodeDatum,
} from "d3-force";
import { FolderPlus, Plus, PlusCircle, Star, Download, RotateCcw, RefreshCw, Wallet, TrendingUp, TrendingDown, Users, Link2, X, Eye, EyeOff, AlertTriangle, Bell, Clock, Menu, PanelRight, LayoutGrid, FlaskConical } from "lucide-react";
import { findAccessory } from "@/lib/astronautAccessories";
import { deNom, formatMoney } from "@/lib/format";
import { futureValue } from "@/lib/projection";
import { monthlyEquivalent } from "@/lib/flows";
import { partDe, type PartLike } from "@/lib/expenseShares";
import { proprietairesDe, arcsAnneau, type Proprietaire } from "@/lib/proprietaires";
import { goalIdDeProjet, systemeDuNoeud, type EntreesSystemes, type SystemeId } from "@/lib/systemes";
import SystemesView from "@/components/SystemesView";
import { currentValue, gain, gainPercent, goalProgress, totalDebt, ownedShare, type Rates, type ValuationContext } from "@/lib/networth";
import { getNodePosition, setNodePosition, clearAllPositions } from "@/lib/nodePositions";
import { getLogoUrl } from "@/lib/logos";
import {
  EXPENSES_IMAGES, SHIP_DIMS, SHIP_IMAGES, VACANCES_IMAGE, isVacationGoal, palierDepenses,
  planetSkin, salaryImage, skinImageForValue, type PlanetSkin,
} from "@/lib/skins";
import { NATURE_COLORS, NATURE_LABELS, NATURE_ORDER, natureOfPortfolio, type Nature } from "@/lib/natures";
import { flowLayout, LAYOUT_MODES, type LayoutMode } from "@/lib/galaxyLayout";
import { ChevronLeft, ClipboardCheck, Loader2 } from "lucide-react";
import DateDuJour from "@/components/DateDuJour";
import { daysUntilNextOccurrence } from "@/lib/dates";
import NodePanel, { PlanetModal, type Selection, type Actions } from "@/components/NodePanel";

type Asset = { id: number; name: string; type: string; ticker: string | null; quantity: string | null; avgBuyPrice: string | null; manualValue: string | null; yieldRate: string | null; currency: string; portfolioId: number | null };
type Portfolio = { id: number; name: string; color: string; skin: string | null; memberId: number | null };
type Goal = { id: number; name: string; targetAmount: string; targetDate: string | null; color: string; memberId: number | null };
type Loan = { id: number; name: string; remainingBalance: string; currency: string; assetId: number | null };
type Member = { id: number; name: string; role: string; color: string; salary: string | null; accessory: string | null };
type Flow = { id: number; name: string | null; sourceType: string; sourceId: number | null; targetType: string; targetId: number | null; amount: string; frequency: string; dueDay: number | null; shared?: boolean | null; memberId: number | null; createdAt: string };
type GoalLink = { id: number; goalId: number; portfolioId: number };
type PortfolioOwnership = { id: number; portfolioId: number; memberId: number | null; sharePercent: string };
type DividendEvent = { date: string; amount: number };
type DividendInfo = { ticker: string; currency: string; received: DividendEvent[]; projected: DividendEvent[] };
type Quote = { price: number; currency: string } | null;

const W = 1200, H = 800, CX = W / 2, CY = H / 2, CENTER_R = 32;

// Bornes et sensibilité du zoom à la molette.
//
// `SENSIBILITE_ZOOM` se lit ainsi : un cran de souris (deltaY ≈ 100) donne
// `exp(100 × 0,0014) ≈ 1,15`, soit 15 % — la valeur qui « tombe juste » au
// poignet. Un effleurement de pavé tactile (deltaY ≈ 4) donne 1,006 : il en
// faut une bonne centaine pour doubler l'échelle, ce qui est exactement le
// geste attendu.
const ZOOM_MIN = 0.2, ZOOM_MAX = 6;
const SENSIBILITE_ZOOM = 0.0014;
/** Amplitude maximale retenue d'un seul événement, pour qu'aucun ne fasse bondir la vue. */
const PAS_ZOOM_MAX = 180;
function sr(v: number, mx: number, mn: number, mxx: number) { return mx <= 0 ? mn : mn + (mxx - mn) * Math.sqrt(Math.max(0, Math.min(1, v / mx))); }

// Lightens (positive percent) or darkens (negative) a hex color, for building a
// gradient from a single user-picked base color instead of fixed stops.
function shade(hex: string, percent: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const num = parseInt(m[1], 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const t = percent < 0 ? 0 : 255, p = Math.abs(percent);
  const r = clamp(Math.round(((num >> 16) & 0xff) * (1 - p) + t * p));
  const g = clamp(Math.round(((num >> 8) & 0xff) * (1 - p) + t * p));
  const b = clamp(Math.round((num & 0xff) * (1 - p) + t * p));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function hashSeed(a: string, b: string) { let h = 0; for (const c of a + b) h = (h * 31 + c.charCodeAt(0)) | 0; return h; }
function curveControl(s: { x: number; y: number }, tg: { x: number; y: number }, seed: number) {
  const dx = tg.x - s.x, dy = tg.y - s.y, dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / dist, ny = dx / dist, sign = seed % 2 === 0 ? 1 : -1;
  const bend = Math.min(70, dist * 0.28) * sign;
  return { x: (s.x + tg.x) / 2 + nx * bend, y: (s.y + tg.y) / 2 + ny * bend };
}
function bezierPoint(s: { x: number; y: number }, c: { x: number; y: number }, tg: { x: number; y: number }, p: number) {
  const mt = 1 - p;
  const x = mt * mt * s.x + 2 * mt * p * c.x + p * p * tg.x;
  const y = mt * mt * s.y + 2 * mt * p * c.y + p * p * tg.y;
  const dx = 2 * mt * (c.x - s.x) + 2 * p * (tg.x - c.x);
  const dy = 2 * mt * (c.y - s.y) + 2 * p * (tg.y - c.y);
  return { x, y, angle: Math.atan2(dy, dx) * 180 / Math.PI };
}

interface GNode extends SimulationNodeDatum {
  id: string; kind: string; label: string; r: number; color: string;
  portfolioKey?: number | "unassigned"; assetId?: number; goalId?: number; memberId?: number | null;
  gainVal?: number; gainPct?: number; sub?: string; logoUrl?: string | null; skin?: PlanetSkin; nature?: Nature;
  ownerExpenseTotal?: number; ownerRevenue?: number; flowId?: number; amount?: number; isProjected?: boolean; accessory?: string | null;
  /** Dépense portée par plusieurs personnes : le nœud n'en montre qu'une part. */
  partagee?: boolean;
  /** À qui le nœud appartient — c'est ce qui teinte son anneau et ses flux. */
  proprietaires?: Proprietaire[];
}
interface GLink { source: string; target: string }

// Horloge d'animation de la galaxie. Chaque avance déclenche un rendu complet de
// GalaxyView, donc sa cadence est directement le coût de l'animation ambiante.
// Trois garde-fous, pour un résultat visuellement identique :
//  · 30 images/s au lieu de 60 — les animations les plus rapides tournent à
//    ~3 rad/s, très loin d'avoir besoin de 60 Hz ;
//  · arrêt complet quand l'onglet est masqué — inutile de peindre en arrière-plan ;
//  · arrêt complet si l'utilisateur a demandé « animations réduites », auquel cas
//    la scène est simplement figée dans son état de repos.
const FRAME_INTERVAL_MS = 1000 / 30;

function useAnimClock() {
  const [t, setT] = useState(0);
  const frame = useRef<number>(0);
  const start = useRef<number>(0);
  const lastEmit = useRef<number>(0);

  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    let running = false;

    const tick = (ts: number) => {
      if (!start.current) start.current = ts;
      if (ts - lastEmit.current >= FRAME_INTERVAL_MS) {
        lastEmit.current = ts;
        setT((ts - start.current) / 1000);
      }
      frame.current = requestAnimationFrame(tick);
    };

    const stop = () => {
      if (!running) return;
      running = false;
      cancelAnimationFrame(frame.current);
    };
    const play = () => {
      if (running || document.hidden || reduced?.matches) return;
      running = true;
      frame.current = requestAnimationFrame(tick);
    };
    const sync = () => (document.hidden || reduced?.matches ? stop() : play());

    sync();
    document.addEventListener("visibilitychange", sync);
    reduced?.addEventListener("change", sync);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", sync);
      reduced?.removeEventListener("change", sync);
    };
  }, []);

  return t;
}

const STARS = Array.from({ length: 260 }, (_, i) => ({
  x: (Math.sin(i * 127.1 + 311.7) * 0.5 + 0.5) * W,
  y: (Math.sin(i * 269.5 + 183.3) * 0.5 + 0.5) * H,
  r: i < 8 ? 1 + (i % 3) * 0.4 : 0.3 + (i % 5) * 0.15,
  op: i < 8 ? 0.4 + (i % 3) * 0.15 : 0.14 + (i % 7) * 0.06,
}));

/**
 * Marqueurs qui parcourent les courbes : vaisseaux des versements et points de
 * circulation. Ce sont les seules animations dont la position dépend du tracé
 * et ne peut donc pas se réduire à une transformation CSS périodique.
 *
 * Ils vivent dans leur propre composant, avec leur propre horloge : c'est ce
 * qui permet à GalaxyView de ne plus dépendre du temps du tout. Avant, une
 * cinquantaine de marqueurs en mouvement obligeaient React à reconstruire les
 * ~1000 éléments de la galaxie 22 fois par seconde.
 */
/** Contour sombre autour des lettres : lisible sur n'importe quel fond, photo comprise. */
const HALO_TEXTE = { paintOrder: "stroke", stroke: "#07070d", strokeWidth: 3.5, strokeLinejoin: "round" } as const;

type CoteEtiquette = "bas" | "gauche" | "droite";

/** Les planètes qui portent une `EtiquettePlanete` — les autres écrivent leur nom dedans. */
const PLANETES_ETIQUETEES = new Set(["portfolio", "goal", "salary", "member-salary", "expenses"]);

/**
 * Où écrire l'étiquette d'une planète. Sous elle, en général. En colonnes
 * (« de gauche à droite »), les planètes s'empilent verticalement et la
 * hauteur manque vite : l'étiquette va sur le côté, vers l'intérieur de
 * l'écran, où l'espace entre les colonnes ne demande qu'à servir. C'est la
 * position qui décide, pas la colonne théorique : quand un système n'a que
 * deux colonnes, la seconde est collée au bord droit.
 */
function coteEtiquette(mode: LayoutMode, x: number | undefined): CoteEtiquette {
  if (mode !== "horizontal") return "bas";
  return x != null && x > CX ? "gauche" : "droite";
}

/** Le bouton « + » d'une planète, en haut et du côté opposé à l'étiquette. */
function positionBouton(r: number, cote: CoteEtiquette): string {
  const d = r + 14, signe = cote === "droite" ? -1 : 1;
  return `translate(${signe * d * 0.866},${-d * 0.5})`;
}

/**
 * Étiquette d'une planète, posée à côté d'elle et non plus par-dessus. Sur
 * les habillages photographiques, un nom de 11 px en blanc se fondait dans
 * l'image ; ici le nom est en gras avec un contour sombre, le montant juste
 * dessous, et les lignes d'état (projection, gain, déficit) à la suite.
 */
function EtiquettePlanete({ r, cote = "bas", titre, sous, couleurSous, lignes = [] }: {
  r: number; cote?: CoteEtiquette; titre: string; sous?: string | null; couleurSous?: string;
  lignes?: { texte: string; couleur: string; className?: string }[];
}) {
  const nb = 1 + (sous ? 1 : 0) + lignes.length;
  // Sous la planète : on descend depuis son bord. Sur le côté : le bloc est
  // centré sur l'équateur, aligné vers la planète.
  const x = cote === "bas" ? 0 : cote === "gauche" ? -(r + 10) : r + 10;
  const y0 = cote === "bas" ? r + 16 : 4 - 6 * (nb - 1);
  const ancre = cote === "bas" ? "middle" : cote === "gauche" ? "end" : "start";
  return <>
    <text x={x} y={y0} textAnchor={ancre} fontSize={12} fontWeight={700} fill="#fff" style={HALO_TEXTE}>{titre}</text>
    {sous && <text x={x} y={y0 + 13} textAnchor={ancre} fontSize={10} fontWeight={600} fill={couleurSous ?? "rgba(255,255,255,0.92)"} style={HALO_TEXTE}>{sous}</text>}
    {lignes.map((l, i) => <text key={i} x={x} y={y0 + 13 + 12 * (i + 1)} textAnchor={ancre} fontSize={9} fontWeight={700} fill={l.couleur} className={l.className} style={HALO_TEXTE}>{l.texte}</text>)}
  </>;
}

/**
 * Anneau à la couleur de la personne propriétaire — c'est lui qui distingue,
 * au premier coup d'œil, la planète d'Alex de celle de Camille, quel que soit
 * l'habillage. Un bien détenu à plusieurs porte un arc par personne,
 * proportionnel à sa quote-part, en partant du haut et dans le sens horaire.
 */
function AnneauProprietaires({ r, proprietaires, epaisseur = 2.5 }: { r: number; proprietaires?: Proprietaire[]; epaisseur?: number }) {
  if (!proprietaires?.length) return null;
  const rayon = r + 3 + epaisseur / 2;
  const C = 2 * Math.PI * rayon;
  return <g transform="rotate(-90)" pointerEvents="none">
    {arcsAnneau(proprietaires, rayon).map((a, i) => (
      <circle key={i} r={rayon} fill="none" stroke={a.couleur} strokeWidth={epaisseur} strokeLinecap={proprietaires.length > 1 ? "round" : "butt"}
        strokeDasharray={`${a.longueur} ${C}`} strokeDashoffset={-a.decalage} />
    ))}
  </g>;
}

function TravelingMarkers({
  flowLinks, links, goalLinkEdges, nodeById, totalRevenue, centerColor,
}: {
  flowLinks: { source: string; target: string; amount: number; couleur: string }[];
  links: GLink[];
  goalLinkEdges: { source: string; target: string }[];
  nodeById: Map<string, GNode>;
  totalRevenue: number;
  centerColor: string;
}) {
  const t = useAnimClock();


  return <>
    {flowLinks.map((f, i) => {
      const s = nodeById.get(f.source), tg = nodeById.get(f.target);
      if (!s || !tg || s.x == null || tg.x == null) return null;
      const seed = hashSeed(f.source, f.target), c = curveControl({ x: s.x!, y: s.y! }, { x: tg.x!, y: tg.y! }, seed);
      const sp = 3 + i * 0.6, p = (t / sp) % 1;
      const head = bezierPoint({ x: s.x!, y: s.y! }, c, { x: tg.x!, y: tg.y! }, p);
      const trail = [0.05, 0.1, 0.16, 0.23].map(off =>
        bezierPoint({ x: s.x!, y: s.y! }, c, { x: tg.x!, y: tg.y! }, Math.max(0, p - off)));
      const pct = totalRevenue > 0 ? f.amount / totalRevenue : f.amount / 500;
      const shipTier: "small" | "medium" | "large" = pct < 0.08 ? "small" : pct < 0.25 ? "medium" : "large";
      const d = SHIP_DIMS[shipTier];
      return <g key={`rk-${i}`}>
        {trail.map((pt, ti) => <circle key={`tr-${i}-${ti}`} cx={pt.x} cy={pt.y} r={3.5 - ti * 0.7} fill={f.couleur} opacity={0.5 - ti * 0.11} />)}
        <g transform={`translate(${head.x},${head.y}) rotate(${head.angle})`}>
          <image href={SHIP_IMAGES[shipTier]} x={-d.w / 2} y={-d.h / 2} width={d.w} height={d.h} opacity={0.95} />
        </g>
      </g>;
    })}

    {links.filter(l => nodeById.get(l.target)?.kind !== "expense-item" && nodeById.get(l.target)?.kind !== "income-item").map(l => {
      const s = nodeById.get(l.source), tg = nodeById.get(l.target);
      if (!s || !tg || s.x == null || tg.x == null) return null;
      // Les liens de propriété (patrimoine/membre → planète) font circuler leur
      // point à l'envers : visuellement, la valeur de la planète remonte vers
      // son propriétaire, elle ne s'en éloigne pas.
      const isOwnershipLink = (s.kind === "member" || s.kind === "center") && (tg.kind === "portfolio" || tg.kind === "goal" || tg.kind === "member" || tg.kind === "member-salary");
      const from = isOwnershipLink ? tg : s, to = isOwnershipLink ? s : tg;
      const seed = hashSeed(s.id, tg.id), c = curveControl({ x: s.x!, y: s.y! }, { x: tg.x!, y: tg.y! }, seed);
      const sp = 5 + (s.id.charCodeAt(0) % 4), p = (t / sp) % 1;
      const pt = bezierPoint({ x: from.x!, y: from.y! }, c, { x: to.x!, y: to.y! }, p);
      const dotColor = isOwnershipLink ? (s.kind === "center" ? centerColor : s.color) : tg.color;
      return <circle key={`dot-${s.id}-${tg.id}`} cx={pt.x} cy={pt.y} r={isOwnershipLink ? 2.6 : 2} fill={dotColor} opacity={isOwnershipLink ? 0.75 : 0.5} />;
    })}

    {goalLinkEdges.map((l, i) => {
      const s = nodeById.get(l.source), tg = nodeById.get(l.target);
      if (!s || !tg || s.x == null || tg.x == null) return null;
      const seed = hashSeed(l.source, l.target), c = curveControl({ x: s.x!, y: s.y! }, { x: tg.x!, y: tg.y! }, seed);
      const pt = bezierPoint({ x: s.x!, y: s.y! }, c, { x: tg.x!, y: tg.y! }, (t / 6) % 1);
      return <circle key={`gd-${i}`} cx={pt.x} cy={pt.y} r={2.5} fill="#34d399" opacity={0.85} />;
    })}
  </>;
}

export default function GalaxyView({
  assets, portfolios, goals, loans, members, flows, goalLinks, portfolioOwnerships, quotes, dividends, actions, salary, onUpdateSalary, onUpdateSelf, onRefresh, showCountdown, ownerName, centerColor, ownerAccessory, rates, displayCurrency, readOnly = false, layoutMode, onLayoutMode, overdueCount = 0, onOpenReview, demoLoaded = false, onRemoveDemo, demoBusy = false, expenseShares = [], systeme = null, onSortirSysteme, onEntrerSysteme, entreesSystemes,
}: {
  assets: Asset[]; portfolios: Portfolio[]; goals: Goal[]; loans: Loan[];
  members: Member[]; flows: Flow[]; goalLinks: GoalLink[]; portfolioOwnerships: PortfolioOwnership[]; quotes: Record<string, Quote>; dividends: Record<string, DividendInfo | null>;
  actions: Actions; salary: number; onUpdateSalary: (v: number) => Promise<void>; onUpdateSelf: (name: string, color: string, accessory: string | null) => Promise<void>; onRefresh: () => void; showCountdown: boolean;
  ownerName: string; centerColor: string; ownerAccessory: string | null;
  rates: Rates; displayCurrency: string; readOnly?: boolean;
  layoutMode: LayoutMode; onLayoutMode: (m: LayoutMode) => void;
  overdueCount?: number; onOpenReview: () => void;
  /** Règle du foyer et exceptions : qui porte quelle part de chaque dépense. */
  expenseShares?: PartLike[];
  /** Système visité, ou `null` pour la galaxie entière. */
  systeme?: SystemeId | null;
  onSortirSysteme?: () => void;
  onEntrerSysteme?: (id: SystemeId) => void;
  entreesSystemes?: EntreesSystemes;
  /** Le foyer d'exemple est chargé : on propose de le retirer. */
  demoLoaded?: boolean; onRemoveDemo?: () => void; demoBusy?: boolean;
}) {
  const [expanded, setExpanded] = useState<Set<number | "unassigned">>(new Set());
  const [selected, setSelected] = useState<Selection>(null);
  const [createMode, setCreateMode] = useState<string | null>(null);
  const [linkMode, setLinkMode] = useState(false);
  const [showPlanetModal, setShowPlanetModal] = useState(false);
  const [ownerMode, setOwnerMode] = useState(false);
  const [ownerSourceNode, setOwnerSourceNode] = useState<{ id: string; kind: "center" | "member"; memberId?: number; label: string } | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [expenseMemberId, setExpenseMemberId] = useState<number | null>(null);
  const [hideAmounts, setHideAmounts] = useState(false);
  // Sous `lg`, les deux panneaux latéraux ne tiennent pas à côté de la galaxie :
  // ils deviennent des tiroirs superposés, et la galaxie garde toute la largeur.
  const [drawer, setDrawer] = useState<"menu" | "details" | null>(null);
  const [logoErrors, setLogoErrors] = useState<Set<string>>(new Set());
  const [showScrubBar, setShowScrubBar] = useState(false);
  const mask = (s: string) => hideAmounts ? "•••" : s;
  const [scrubYears, setScrubYears] = useState(0);
  const [scrubGrowth, setScrubGrowth] = useState(5);
  const [linkSourceNode, setLinkSourceNode] = useState<{ id: string; kind: string; portfolioKey?: number | "unassigned"; memberId?: number; label: string } | null>(null);
  const [pendingLink, setPendingLink] = useState<{ sourceType: string; sourceId: number | null; sourceLabel: string; targetType: string; targetId: number; targetLabel: string } | null>(null);
  const [linkAmount, setLinkAmount] = useState("");
  const [linkFrequency, setLinkFrequency] = useState("monthly");
  const simRef = useRef<Simulation<GNode, GLink> | null>(null);
  const nodesMapRef = useRef<Map<string, GNode>>(new Map());
  const [, setTick] = useState(0);
  const [dragId, setDragId] = useState<string | null>(null);
  const dragIdRef = useRef<string | null>(null);
  dragIdRef.current = dragId;
  const linksRef = useRef<GLink[]>([]);
  /** Cibles de mise en page, lues à chaque tick — voir `snapColumns`. */
  const targetsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const [snapTarget, setSnapTarget] = useState<string | null>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomRef = useRef<{ k: number; x: number; y: number }>({ k: 1, x: 0, y: 0 });
  const rootRef = useRef<SVGGElement | null>(null);
  /** Cadre du SVG, mesuré aux changements plutôt qu'à chaque événement. */
  const rectRef = useRef<DOMRect | null>(null);
  const layoutModeRef = useRef(layoutMode);
  layoutModeRef.current = layoutMode;

  // Toutes les valorisations passent par ce contexte : sans lui, une ligne cotée
  // en USD était additionnée comme si c'était des euros.
  const ctx: ValuationContext = useMemo(
    () => ({ rates, displayCurrency }),
    [rates, displayCurrency]
  );
  const fmt = useCallback((v: number) => formatMoney(v, displayCurrency), [displayCurrency]);

  const groups = useMemo(() => {
    const byP = new Map<number | "unassigned", Asset[]>();
    for (const a of assets) { const k = a.portfolioId ?? "unassigned"; if (!byP.has(k)) byP.set(k, []); byP.get(k)!.push(a); }
    for (const p of portfolios) { if (!byP.has(p.id)) byP.set(p.id, []); } // keep empty planets visible
    return [...byP.entries()].map(([key, list]) => {
      const p = key === "unassigned" ? { id: "unassigned" as const, name: "Sans portefeuille", color: "#6b6b72", skin: null, memberId: null } : portfolios.find(p => p.id === key) ?? { id: key, name: "?", color: "#6b6b72", skin: null, memberId: null };
      const valued = list.map(a => ({ asset: a, value: currentValue(a, a.ticker ? quotes[a.ticker] : null, ctx) }));
      return { key, portfolio: p, valued, total: valued.reduce((s, v) => s + v.value, 0), nature: natureOfPortfolio(valued) };
    }).sort((a, b) => b.total - a.total);
  }, [assets, portfolios, quotes, ctx]);

  const grossTotal = groups.reduce((s, g) => s + g.total, 0);
  const debt = totalDebt(loans, ctx);
  const grandTotal = grossTotal - debt;
  const scrubMonthlyContribution = flows.reduce((s, f) => {
    if (f.targetType !== "portfolio" && f.targetType !== "goal") return s;
    return s + monthlyEquivalent(f);
  }, 0);
  const scrubProjectedTotal = scrubYears === 0 ? grandTotal : futureValue(grandTotal, scrubMonthlyContribution, scrubGrowth, scrubYears * 12);
  const currentYearForScrub = new Date().getFullYear();
  const scrubYear = currentYearForScrub + scrubYears;

  const progressOf = useCallback(
    (goal: Goal) =>
      goalProgress(goal, goalLinks, pid => groups.find(g => g.key === pid)?.total ?? 0),
    [goalLinks, groups]
  );

  // Build graph
  const { targetNodes, links, flowLinks, goalLinkEdges, resteAInvestir, totalExpenseFlows, totalRevenue, totalInvest } = useMemo(() => {
    const nodes: GNode[] = [];
    const links: GLink[] = [];
    const flowLinks: { source: string; target: string; label: string; amount: number; couleur: string; days?: number; isSalarySource?: boolean }[] = [];

    // La couleur d'une personne teinte tout ce qui lui appartient : anneau de
    // ses planètes, halo, flux qui partent de chez elle. Le propriétaire du
    // compte garde `centerColor`, choisie dans ses réglages.
    const personne = (mid: number | null): Proprietaire => {
      if (mid === null) return { memberId: null, nom: ownerName, couleur: centerColor, part: 1 };
      const m = members.find(m => m.id === mid);
      return { memberId: mid, nom: m?.name ?? "?", couleur: m?.color ?? "#8a8a99", part: 1 };
    };

    const monthlyAmount = monthlyEquivalent;

    // Simulateur "avance rapide" : projette la valeur de CE portefeuille (pas une moyenne
    // globale) à scrubYears, à partir de ses propres flux entrants réguliers — deux
    // portefeuilles alimentés différemment ne grossissent pas au même rythme.
    const projectedGroupTotal = (g: typeof groups[number]) => {
      if (scrubYears === 0) return g.total;
      const monthlyContribution = flows
        .filter(f => f.targetType === "portfolio" && f.targetId === g.key)
        .reduce((s, f) => s + monthlyAmount(f), 0);
      return futureValue(g.total, monthlyContribution, scrubGrowth, scrubYears * 12);
    };
    const maxPV = Math.max(1, ...groups.map(g => projectedGroupTotal(g)));

    const incomeFlows = flows.filter(f => f.targetType === "income");
    const totalIncomeItems = incomeFlows.reduce((s, f) => s + Number(f.amount), 0);
    const totalRevenue = salary + totalIncomeItems;

    if (totalRevenue > 0) nodes.push({ id: "salary", kind: "salary", label: "Revenus", r: 32, color: "#34d399", sub: fmt(totalRevenue), amount: totalRevenue, proprietaires: [personne(null)] });
    // Le Soleil grossit lui aussi avec la projection globale (racine carrée, comme sr(),
    // pour une croissance visuelle proportionnée plutôt que linéaire — un patrimoine x4
    // ne doit pas donner un Soleil x4 en rayon, sinon il avale tout le reste).
    const grossNow = groups.reduce((s, g) => s + g.total, 0);
    const globalMonthlyContribution = flows.reduce((s, f) => (f.targetType === "portfolio" || f.targetType === "goal") ? s + monthlyAmount(f) : s, 0);
    const sunProjectedTotal = scrubYears === 0 ? grossNow : futureValue(grossNow, globalMonthlyContribution, scrubGrowth, scrubYears * 12);
    const growthRatio = scrubYears === 0 ? 1 : sunProjectedTotal / Math.max(1, grossNow);
    const centerR = CENTER_R * Math.max(0.85, Math.min(1.55, Math.sqrt(growthRatio)));
    nodes.push({ id: "center", kind: "center", label: "Patrimoine", r: centerR, color: "#7c6af5" });
    // "Moi" est son propre système (comme chaque membre), pas juste un fourre-tout collé
    // au centre — ses planètes non attribuées à un membre s'accrochent ici plutôt que
    // directement à Patrimoine, symétrique à `m-${m.id}` pour un membre du foyer.
    // Chaque planète-personne grossit avec SON patrimoine (portefeuilles qui lui sont
    // directement attribués), sur une échelle commune à Moi + tous les membres, pour que
    // les tailles restent comparables d'une personne à l'autre.
    // Les quotes-parts font foi quand elles existent : un bien commun réparti
    // 50/50 compte pour moitié chez chacun, au lieu d'être attribué en entier au
    // propriétaire déclaré de la planète.
    const personTotal = (mid: number | null) => groups.reduce(
      (s, g) => s + g.total * ownedShare(g.key, g.portfolio.memberId, mid, portfolioOwnerships), 0);
    const selfTotal = personTotal(null);
    const memberTotal = (mid: number) => personTotal(mid);
    const maxPersonTotal = Math.max(1, selfTotal, ...members.map(m => memberTotal(m.id)));
    nodes.push({ id: "self", kind: "member", label: ownerName, r: sr(selfTotal, maxPersonTotal, 24, 48), color: centerColor, memberId: null, sub: fmt(selfTotal), accessory: ownerAccessory });
    links.push({ source: "center", target: "self" });
    if (totalRevenue > 0) links.push({ source: "salary", target: "center" });

    incomeFlows.forEach(inf => {
      const iid = `inc-${inf.id}`;
      nodes.push({ id: iid, kind: "income-item", label: inf.name || "Revenu", r: 10 + Math.min(8, Number(inf.amount) / 200), color: "#34d399", sub: fmt(Number(inf.amount)), flowId: inf.id });
      links.push({ source: "salary", target: iid });
    });

    // Chaque personne (Moi + chaque membre) a sa propre planète Dépenses — avant, tous les
    // flux de dépense atterrissaient sur un seul nœud "expenses" partagé par le foyer entier,
    // impossible à dupliquer pour un conjoint. On regroupe donc les flux de dépense par
    // memberId (null = Moi) et on crée un nœud par propriétaire.
    const expFlows = flows.filter(f => f.targetType === "expense");
    const totalExpenseFlows = expFlows.reduce((s, f) => s + Number(f.amount), 0);
    // Chacun ne porte que sa part. Une dépense commune comptait auparavant
    // entière sur son porteur déclaré : le taux d'épargne de celui-là
    // s'effondrait, celui de l'autre était flatté, et aucun des deux n'était vrai.
    const partDepense = (f: Flow, mid: number | null) => Number(f.amount) * partDe(f, expenseShares, mid);
    const myExpFlows = expFlows.filter(f => partDe(f, expenseShares, null) > 0);
    const myExpenseTotal = expFlows.reduce((s, f) => s + partDepense(f, null), 0);
    const salInvest = flows.filter(f => f.sourceType === "salary" && (f.targetType === "portfolio" || f.targetType === "goal"));
    const totalInvest = salInvest.reduce((s, f) => s + Number(f.amount), 0);
    const resteAInvestir = totalRevenue > 0 ? Math.max(0, totalRevenue - totalInvest - totalExpenseFlows) : 0;

    if (totalRevenue > 0) {
      nodes.push({ id: "expenses", kind: "expenses", label: `Dépenses ${deNom(ownerName)}`, r: 22 + Math.min(18, myExpenseTotal / 80), color: "#f87171", ownerExpenseTotal: myExpenseTotal, ownerRevenue: totalRevenue, proprietaires: [personne(null)] });
      links.push({ source: "salary", target: "expenses" });
      if (myExpenseTotal > 0) flowLinks.push({ source: "salary", target: "expenses", label: fmt(myExpenseTotal), amount: myExpenseTotal, couleur: centerColor });
      myExpFlows.forEach(ef => {
        const eid = `exp-${ef.id}`;
        const part = partDepense(ef, null);
        nodes.push({ id: eid, kind: "expense-item", label: ef.name || "Dépense", r: 10 + Math.min(8, part / 100), color: "#f87171", sub: fmt(part), flowId: ef.id, partagee: ef.shared === true });
        links.push({ source: "expenses", target: eid });
      });
    }
    if (totalRevenue > 0 && resteAInvestir > 0) {
      nodes.push({ id: "reste", kind: "reste", label: "Reste", r: 18, color: "#9585ff" });
      links.push({ source: "salary", target: "reste" });
      flowLinks.push({ source: "salary", target: "reste", label: fmt(resteAInvestir), amount: resteAInvestir, couleur: centerColor });
    }

    members.forEach(m => {
      const mTotal = memberTotal(m.id);
      nodes.push({ id: `m-${m.id}`, kind: "member", label: m.name, r: sr(mTotal, maxPersonTotal, 20, 44), color: m.color, memberId: m.id, sub: fmt(mTotal), accessory: m.accessory });
      links.push({ source: "center", target: `m-${m.id}` });
      if (m.salary && Number(m.salary) > 0) {
        nodes.push({ id: `ms-${m.id}`, kind: "member-salary", label: `Salaire de ${m.name}`, r: 22, color: m.color, memberId: m.id, sub: fmt(Number(m.salary)), amount: Number(m.salary), proprietaires: [personne(m.id)] });
        links.push({ source: `m-${m.id}`, target: `ms-${m.id}` });
      }
      const memberExpFlows = expFlows.filter(f => partDe(f, expenseShares, m.id) > 0);
      const memberExpenseTotal = expFlows.reduce((s, f) => s + partDepense(f, m.id), 0);
      const memberRevenue = m.salary ? Number(m.salary) : 0;
      const meid = `exp-m-${m.id}`;
      nodes.push({ id: meid, kind: "expenses", label: `Dépenses ${deNom(m.name)}`, r: 22 + Math.min(18, memberExpenseTotal / 80), color: "#f87171", memberId: m.id, ownerExpenseTotal: memberExpenseTotal, ownerRevenue: memberRevenue, proprietaires: [personne(m.id)] });
      links.push({ source: `m-${m.id}`, target: meid });
      if (memberExpenseTotal > 0 && memberRevenue > 0) {
        flowLinks.push({ source: `ms-${m.id}`, target: meid, label: fmt(memberExpenseTotal), amount: memberExpenseTotal, couleur: m.color });
      }
      memberExpFlows.forEach(ef => {
        const eid = `exp-m${m.id}-${ef.id}`;
        const part = partDepense(ef, m.id);
        nodes.push({ id: eid, kind: "expense-item", label: ef.name || "Dépense", r: 10 + Math.min(8, part / 100), color: "#f87171", sub: fmt(part), flowId: ef.id, partagee: ef.shared === true });
        links.push({ source: meid, target: eid });
      });
    });

    for (const g of groups) {
      const pid = `p-${g.key}`;
      const memberNode = g.portfolio.memberId ? `m-${g.portfolio.memberId}` : null;
      const totalGain = g.valued.reduce((s, v) => { const a = v.asset; return s + ((a.avgBuyPrice && Number(a.avgBuyPrice) > 0) ? gain(a, a.ticker ? quotes[a.ticker] : null, ctx) : 0); }, 0);
      const skin = planetSkin(g.portfolio.name, g.valued, g.portfolio.skin);
      const projTotal = projectedGroupTotal(g);
      const proprietaires = proprietairesDe(g.key, g.portfolio.memberId, portfolioOwnerships, personne);
      // En simulation, le gain affiché (calculé sur les cours réels du jour) perdrait son
      // sens à côté d'une valeur projetée dans le futur — on le masque plutôt que d'afficher
      // un chiffre qui semblerait porter sur la projection alors qu'il ne la concerne pas.
      nodes.push({ id: pid, kind: "portfolio", label: g.portfolio.name, r: sr(projTotal, maxPV, 20, 78), color: NATURE_COLORS[g.nature], nature: g.nature, portfolioKey: g.key, gainVal: scrubYears > 0 ? undefined : totalGain, sub: fmt(projTotal), skin, isProjected: scrubYears > 0, proprietaires });
      links.push({ source: memberNode ?? "self", target: pid });
      if (expanded.has(g.key)) {
        const maxAV = Math.max(1, ...g.valued.map(v => v.value));
        for (const v of g.valued) {
          const a = v.asset, hasG = a.avgBuyPrice && Number(a.avgBuyPrice) > 0;
          const q = a.ticker ? quotes[a.ticker] : null;
          const gn = hasG ? gain(a, q, ctx) : 0;
          const gp = hasG ? gainPercent(a, q, ctx) : undefined;
          nodes.push({ id: `a-${a.id}`, kind: "asset", label: a.name, r: sr(v.value, maxAV, 10, 28), color: NATURE_COLORS[g.nature], nature: g.nature, portfolioKey: g.key, assetId: a.id, gainVal: hasG ? gn : undefined, gainPct: gp, sub: fmt(v.value), logoUrl: getLogoUrl(a.type, a.ticker), proprietaires });
          links.push({ source: pid, target: `a-${a.id}` });
        }
      }
    }

    const goalLinkEdges: { source: string; target: string }[] = [];
    for (const goal of goals) {
      const memberNode = goal.memberId ? `m-${goal.memberId}` : null;
      const linkedPortfolioIds = goalLinks.filter(gl => gl.goalId === goal.id).map(gl => gl.portfolioId);
      const prog = progressOf(goal);
      nodes.push({ id: `g-${goal.id}`, kind: "goal", label: goal.name, r: 16 + Math.min(1, prog) * 44, color: goal.color, goalId: goal.id, sub: `${Math.round(prog * 100)}%`, proprietaires: [personne(goal.memberId)] });
      links.push({ source: memberNode ?? "self", target: `g-${goal.id}` });
      linkedPortfolioIds.forEach(pid => { if (nodes.find(n => n.id === `p-${pid}`)) goalLinkEdges.push({ source: `g-${goal.id}`, target: `p-${pid}` }); });
    }

    flows.forEach(f => {
      if (f.targetType === "expense" || f.targetType === "income") return;
      const sId = f.sourceType === "salary" ? "salary" : f.sourceType === "portfolio" ? `p-${f.sourceId}` : f.sourceType === "member_salary" ? `ms-${f.sourceId}` : null;
      const tId = f.targetType === "portfolio" ? `p-${f.targetId}` : f.targetType === "goal" ? `g-${f.targetId}` : null;
      const depart = nodes.find(n => n.id === sId);
      if (sId && tId && depart && nodes.find(n => n.id === tId))
        // Un flux prend la couleur de la personne dont l'argent part : le salaire
        // de Camille qui alimente le livret de Jonas se lit vert vers un anneau bleu.
        flowLinks.push({ source: sId, target: tId, label: fmt(Number(f.amount)), amount: Number(f.amount), couleur: depart.proprietaires?.[0]?.couleur ?? centerColor, days: daysUntilNextOccurrence(f.createdAt, f.frequency), isSalarySource: f.sourceType === "salary" || f.sourceType === "member_salary" });
    });

    // Entrer dans un système ne change pas la façon de construire la galaxie :
    // on la construit entière, puis on retire ce qui n'en fait pas partie.
    // Restructurer la construction pour qu'elle filtre en amont aurait touché
    // huit cents lignes pour le même résultat visible.
    if (systeme) {
      const objectifDuSysteme = goalIdDeProjet(systeme);
      const garde = new Set<string>();
      for (const n of nodes) {
        const appartenance = systemeDuNoeud(n.kind);
        if (appartenance === "contexte") { garde.add(n.id); continue; }
        if (objectifDuSysteme != null) {
          // Un projet montre son objectif et les planètes qui l'alimentent.
          if (n.kind === "goal" && n.goalId === objectifDuSysteme) garde.add(n.id);
          if (n.kind === "portfolio" && goalLinks.some(gl => gl.goalId === objectifDuSysteme && gl.portfolioId === n.portfolioKey)) garde.add(n.id);
          continue;
        }
        if (appartenance === systeme) garde.add(n.id);
      }
      // Les satellites suivent leur parent : un actif n'a pas de sens sans sa
      // planète. Uniquement les satellites : propager le long de *tous* les
      // liens ramenait tout, puisque le foyer est du contexte et que chaque
      // planète y est rattachée — « Dépenses » affichait les six planètes.
      const parGenre = new Map(nodes.map(n => [n.id, n.kind]));
      const estSatellite = (id: string) => {
        const k = parGenre.get(id);
        return k === "asset" || k === "expense-item" || k === "income-item";
      };
      for (const l of links) if (garde.has(l.source) && estSatellite(l.target)) garde.add(l.target);
      // Le parcours de l'argent ne s'arrête pas à la frontière du système : une
      // planète alimentée par un salaire garde ce salaire en vue, sinon les
      // vaisseaux disparaissaient de toutes les vues. Seule la source suit —
      // tirer aussi les destinations ramènerait toutes les planètes dans
      // « Revenus ».
      for (const f of flowLinks) if (garde.has(f.target) && !garde.has(f.source)) garde.add(f.source);

      const retenus = nodes.filter(n => garde.has(n.id));
      const dansLeSysteme = (l: { source: string; target: string }) => garde.has(l.source) && garde.has(l.target);
      return {
        targetNodes: retenus,
        links: links.filter(dansLeSysteme),
        flowLinks: flowLinks.filter(dansLeSysteme),
        goalLinkEdges: goalLinkEdges.filter(dansLeSysteme),
        resteAInvestir, totalExpenseFlows, totalRevenue, totalInvest,
      };
    }

    return { targetNodes: nodes, links, flowLinks, goalLinkEdges, resteAInvestir, totalExpenseFlows, totalRevenue, totalInvest };
  }, [groups, expanded, goals, members, flows, quotes, salary, goalLinks, progressOf, scrubYears, scrubGrowth, ownerName, centerColor, ownerAccessory, ctx, portfolioOwnerships, expenseShares, systeme, fmt]);
  linksRef.current = links;

  // Simulation
  useEffect(() => {
    const map = nodesMapRef.current;
    const nodes: GNode[] = targetNodes.map(n => {
      const prev = map.get(n.id);
      if (prev) return { ...prev, ...n, x: prev.x, y: prev.y, vx: prev.vx, vy: prev.vy };
      const saved = getNodePosition(layoutMode, n.id);
      if (saved) return { ...n, x: saved.x, y: saved.y, fx: saved.x, fy: saved.y };
      return { ...n, x: CX + (Math.random() - 0.5) * 80, y: CY + (Math.random() - 0.5) * 80 };
    });
    nodesMapRef.current = new Map(nodes.map(n => [n.id, n]));
    const nm = nodesMapRef.current;

    // Changement de disposition : tout ce qui n'est pas épinglé *dans cette
    // lecture-ci* doit être relâché. Les nœuds sont réutilisés d'un rendu à
    // l'autre pour garder leur élan, ce qui leur faisait traîner le `fx`/`fy`
    // d'un glissement fait en orbite — la planète restait clouée là où on
    // l'avait posée, en travers des colonnes.
    nm.forEach(node => {
      if (!getNodePosition(layoutMode, node.id)) { node.fx = null; node.fy = null; }
    });

    if (layoutMode === "radial") {
      const c = nm.get("center"); if (c && !getNodePosition("radial", "center")) { c.fx = CX; c.fy = CY; }
      const s = nm.get("salary"); if (s && !getNodePosition("radial", "salary")) { s.fx = CX; s.fy = 80; }
      const e = nm.get("expenses"); if (e && !getNodePosition("radial", "expenses")) { e.fx = CX + 350; e.fy = 180; }
    }

    // Radial layout: instead of leaving members/portfolios/goals to pure spring physics
    // (which reads as chaotic clutter with crossing links and overlap once there are more
    // than a handful), arrange them like an orrery — Patrimoine at the center is the
    // household's own planet, its directly-owned planets/objectifs sit on a close inner
    // ring, and each member becomes their own "system": a hub further out, with their own
    // planets fanned out around them. Ring/fan radii are packed from each node's actual
    // size so bigger planets always get more room instead of overlapping. Only applies to
    // nodes without a saved manual position, so dragged layouts are never fought.
    const structuralParent = new Map<string, string>();
    for (const l of links) {
      const tgt = nm.get(l.target);
      if (tgt && (tgt.kind === "portfolio" || tgt.kind === "goal" || tgt.kind === "member" || tgt.kind === "member-salary")) {
        structuralParent.set(l.target, l.source);
      }
    }
    const packRadius = (arr: GNode[], span: number, gap: number, minR: number) => {
      const arc = arr.reduce((s, n) => s + n.r * 2 + gap, 0);
      return Math.max(minR, arc / span);
    };
    const directChildren = [...nm.values()].filter(n => structuralParent.get(n.id) === "center");
    const unowned = directChildren.filter(n => n.kind !== "member").sort((a, b) => (a.kind === "goal" ? 1 : 0) - (b.kind === "goal" ? 1 : 0) || a.id.localeCompare(b.id));
    const memberHubs = directChildren.filter(n => n.kind === "member").sort((a, b) => (a.id === "self" ? -1 : b.id === "self" ? 1 : a.id.localeCompare(b.id)));
    const radialTargets = new Map<string, { x: number; y: number }>();
    if (layoutMode === "radial") {
    if (unowned.length > 0) {
      const r1 = packRadius(unowned, Math.PI * 2, 34, 190);
      unowned.forEach((n, i) => {
        const angle = (i / unowned.length) * Math.PI * 2 - Math.PI / 2;
        radialTargets.set(n.id, { x: CX + Math.cos(angle) * r1, y: CY + Math.sin(angle) * r1 });
      });
    }
    if (memberHubs.length > 0) {
      const r2 = packRadius(memberHubs, Math.PI * 2, 70, 320);
      memberHubs.forEach((n, i) => {
        const angle = (i / memberHubs.length) * Math.PI * 2 - Math.PI / 2;
        radialTargets.set(n.id, { x: CX + Math.cos(angle) * r2, y: CY + Math.sin(angle) * r2 });
      });
    }
    memberHubs.forEach(member => {
      const children = [...nm.values()].filter(n => structuralParent.get(n.id) === member.id);
      if (children.length === 0) return;
      const base = radialTargets.get(member.id)!;
      const baseAngle = Math.atan2(base.y - CY, base.x - CX);
      const spread = Math.min(Math.PI * 1.4, 0.6 + 0.4 * children.length);
      const r3 = packRadius(children, spread, 30, 150);
      children.forEach((child, i) => {
        const off = children.length > 1 ? (i / (children.length - 1) - 0.5) * spread : 0;
        const angle = baseAngle + off;
        radialTargets.set(child.id, { x: base.x + Math.cos(angle) * r3, y: base.y + Math.sin(angle) * r3 });
      });
    });
    } else {
      // Lecture « flux » : les rangées remplacent les anneaux. Le poids sert à
      // ranger les plus grosses planètes au milieu de leur colonne.
      //
      // Une planète qui porte des satellites occupe bien plus que son rayon :
      // ils orbitent à `parent.r + enfant.r + 12`. En ne réservant que le rayon,
      // la colonne des dépenses se tassait en bas — « Loyer », « Courses » et
      // « Énergie » se chevauchaient avec la planète voisine. On réserve donc
      // l'encombrement réel, halo compris.
      const halo = new Map<string, number>();
      for (const l of links) {
        const enfant = nm.get(l.target);
        if (!enfant || (enfant.kind !== "asset" && enfant.kind !== "expense-item" && enfant.kind !== "income-item")) continue;
        const parent = nm.get(l.source);
        if (!parent) continue;
        halo.set(l.source, Math.max(halo.get(l.source) ?? 0, parent.r + enfant.r * 2 + 12));
      }
      // En rangées (« de haut en bas »), l'étiquette écrite sous une petite
      // planète dépasse nettement du disque : c'est sa demi-largeur qu'il faut
      // réserver de part et d'autre. En colonnes, elle est sur le côté et ne
      // change rien à l'empilement.
      const demiLargeurEtiquette = (node: GNode) =>
        layoutMode === "vertical" && PLANETES_ETIQUETEES.has(node.kind) ? Math.min(node.label.length, 18) * 3.6 : 0;
      const cibles = flowLayout(
        [...nm.values()].map(node => ({
          id: node.id,
          kind: node.kind,
          r: Math.max(node.r, halo.get(node.id) ?? 0, demiLargeurEtiquette(node)),
          // Le poids reste le vrai rayon : on ordonne par taille de planète, pas
          // par nombre de satellites.
          weight: node.r,
        })),
        layoutMode,
        { width: W, height: H }
      );
      cibles.forEach((p, id) => radialTargets.set(id, p));
    }
    targetsRef.current = radialTargets;

    /**
     * Fixe l'axe principal des rangées, à chaque tick.
     *
     * `forceCollide` de d3 n'est pas pondérée par `alpha`, contrairement à
     * `forceX`/`forceY`. À mesure que la simulation refroidit, l'aimant de la
     * mise en page s'éteint pendant que la collision, elle, continue de
     * pousser : ce sont donc les collisions qui décidaient des positions
     * finales, et la colonne du milieu s'étalait sur 338 px.
     *
     * L'axe principal *est* la colonne — il dit « ceci est un revenu, cela une
     * destination » — donc il ne se négocie pas. L'axe transverse reste libre :
     * c'est là que la collision fait son travail, en écartant les planètes sans
     * rien casser de la lecture.
     */
    const snapColumns = () => {
      if (layoutModeRef.current === "radial") return;
      const horizontal = layoutModeRef.current === "horizontal";
      nodesMapRef.current.forEach(node => {
        if (node.id === dragIdRef.current) return;
        const cible = targetsRef.current.get(node.id);
        if (!cible) return;
        // Un nœud volontairement posé par l'utilisateur garde sa place.
        if (getNodePosition(layoutModeRef.current, node.id)) return;
        if (horizontal) { node.x = cible.x; node.vx = 0; }
        else { node.y = cible.y; node.vy = 0; }
      });
    };

    // Locks satellites (assets, expense/income items) to an evenly-spaced ring around
    // their parent planet every tick, instead of letting them drift semi-independently
    // under generic link/charge forces — they now visually move as one piece with the
    // planet they orbit, which reads much cleaner while the planet is dragged or settles.
    // Marge : le rayon de la planète, plus la place de son étiquette et du
    // petit astronaute qui se tient au-dessus.
    const contain = () => {
      const nm = nodesMapRef.current;
      // Un nœud qui porte des satellites occupe bien plus que son rayon : ils
      // orbitent à `parent.r + enfant.r + 12`. Sans en tenir compte, la planète
      // tenait dans le cadre mais ses satellites en sortaient.
      const orbite = new Map<string, number>();
      for (const l of linksRef.current) {
        const enfant = nm.get(l.target);
        if (!enfant || (enfant.kind !== "asset" && enfant.kind !== "expense-item" && enfant.kind !== "income-item")) continue;
        const parent = nm.get(l.source);
        if (!parent) continue;
        orbite.set(l.source, Math.max(orbite.get(l.source) ?? 0, parent.r + enfant.r * 2 + 12));
      }
      nm.forEach(node => {
        if (node.id === dragIdRef.current) return;
        const etendue = Math.max(node.r, orbite.get(node.id) ?? 0);
        const margeHaut = etendue + 26;
        const margeBas = etendue + 20;
        const margeCote = etendue + 12;
        if (node.x != null) node.x = Math.max(margeCote, Math.min(W - margeCote, node.x));
        if (node.y != null) node.y = Math.max(margeHaut, Math.min(H - margeBas, node.y));
        // Un nœud figé par un glisser-déposer doit être ramené lui aussi,
        // sinon il reste hors cadre après un « rangement auto ».
        if (node.fx != null) node.fx = Math.max(margeCote, Math.min(W - margeCote, node.fx));
        if (node.fy != null) node.fy = Math.max(margeHaut, Math.min(H - margeBas, node.fy));
      });
    };

    const snapSatellites = () => {
      const nm = nodesMapRef.current;
      const childrenByParent = new Map<string, string[]>();
      for (const l of linksRef.current) {
        const tgt = nm.get(l.target);
        if (!tgt || (tgt.kind !== "asset" && tgt.kind !== "expense-item" && tgt.kind !== "income-item")) continue;
        if (!childrenByParent.has(l.source)) childrenByParent.set(l.source, []);
        childrenByParent.get(l.source)!.push(l.target);
      }
      childrenByParent.forEach((childIds, parentId) => {
        const parent = nm.get(parentId);
        if (!parent || parent.x == null || parent.y == null) return;
        const sorted = [...childIds].sort();
        // On laisse libre le secteur où est écrite l'étiquette de la planète, et
        // on répartit les satellites sur le reste du tour, en partant juste
        // après lui, dans le sens horaire.
        const cote = coteEtiquette(layoutModeRef.current, parent.x);
        const centreEtiquette = cote === "bas" ? Math.PI / 2 : cote === "gauche" ? Math.PI : 0;
        const secteurEtiquette = 0.65;
        const depart = centreEtiquette + secteurEtiquette;
        const arc = Math.PI * 2 - secteurEtiquette * 2;
        sorted.forEach((childId, i) => {
          if (childId === dragIdRef.current) return;
          const child = nm.get(childId);
          if (!child) return;
          const angle = depart + ((i + 0.5) / sorted.length) * arc;
          const R = parent.r + child.r + 12;
          child.x = parent.x! + Math.cos(angle) * R;
          child.y = parent.y! + Math.sin(angle) * R;
          child.fx = child.x; child.fy = child.y;
        });
      });
    };

    if (!simRef.current) {
      simRef.current = forceSimulation<GNode>(nodes)
        .force("charge", forceManyBody().strength(d => {
          const k = (d as GNode).kind;
          const satellite = k === "expense-item" || k === "income-item" || k === "asset";
          if (satellite) return k === "asset" ? -60 : -30;
          // En colonnes, une forte répulsion entre planètes les éjecte de leur
          // rangée : la disposition s'en charge, la répulsion n'a plus à écarter
          // que ce qui se superpose vraiment.
          return layoutModeRef.current === "radial" ? -180 : -40;
        }))
        .force("x", forceX<GNode>(CX).strength(() => layoutModeRef.current === "radial" ? 0.02 : 0))
        .force("y", forceY<GNode>(CY).strength(() => layoutModeRef.current === "radial" ? 0.02 : 0))
        .alphaDecay(0.018).on("tick", () => { snapColumns(); contain(); snapSatellites(); setTick(n => n + 1); });
    } else simRef.current.nodes(nodes);
    snapColumns();
    contain();
    snapSatellites();

    // d3's forceLink() mutates each link object in place, replacing .source/.target
    // (our plain string ids) with the actual resolved node objects once the simulation
    // initializes — permanently, on the same object. Since `links`/`goalLinkEdges` are the
    // very same arrays used for rendering (which assume .source/.target stay strings for
    // nodeById.get() lookups), every link would render fine for one frame and then silently
    // disappear the instant the simulation ticked and mutated them. Pass shallow clones so
    // d3 mutates its own copies and our render-time arrays keep their string ids forever.
    const enFlux = layoutMode !== "radial";

    // En orbite, la collision est la seule chose qui empêche les planètes de se
    // superposer, d'où la marge généreuse. En colonnes, la mise en page réserve
    // déjà la place de chaque nœud — halo de satellites compris — et cette même
    // marge ne faisait plus que désordonner la rangée : `forceCollide` n'étant
    // pas pondérée par `alpha`, elle continue de pousser après extinction de
    // l'aimant et c'est elle qui fixait l'ordre final.
    simRef.current.force("collide", forceCollide<GNode>()
      .radius(d => d.r + (enFlux ? 6 : 26)).strength(0.9));

    simRef.current.force("link", forceLink<GNode, GLink>(links.map(l => ({ ...l }))).id(d => d.id).distance(l => {
      const tgt = typeof l.target === "object" ? l.target : nm.get(l.target as unknown as string);
      return tgt?.kind === "expense-item" || tgt?.kind === "income-item" ? 45 : tgt?.kind === "asset" ? 65 : tgt?.kind === "member" ? 130 : 180;
    }).strength(enFlux ? 0.04 : 0.3));
    simRef.current.force("goalLink", forceLink<GNode, GLink>(goalLinkEdges.map(l => ({ ...l }))).id(d => d.id).distance(160).strength(0.08));
    // Les deux axes ne jouent pas le même rôle en lecture « flux ». L'axe
    // principal *est* la colonne : c'est lui qui dit « ceci est un revenu, cela
    // une destination », et une planète qui en dérive de 100 px change de sens.
    // L'axe transverse n'est qu'un rangement : la force de collision doit
    // pouvoir y écarter deux planètes sans se battre contre l'aimant.
    // À force égale sur les deux axes, la charge et les liens étalaient la
    // colonne du milieu sur 253 px — les rangées ne se lisaient plus.
    const aimant = layoutMode === "radial" ? 0.22 : 0.8;
    const principal = layoutMode === "radial" ? aimant : 0.96;
    const transverse = layoutMode === "radial" ? aimant : 0.75;
    const tenu = (d: GNode) => radialTargets.has(d.id) && !getNodePosition(layoutMode, d.id);
    simRef.current.force("radialX", forceX<GNode>(d => radialTargets.get(d.id)?.x ?? d.x ?? CX)
      .strength(d => tenu(d) ? (layoutMode === "vertical" ? transverse : principal) : 0));
    simRef.current.force("radialY", forceY<GNode>(d => radialTargets.get(d.id)?.y ?? d.y ?? CY)
      .strength(d => tenu(d) ? (layoutMode === "vertical" ? principal : transverse) : 0));
    simRef.current.alpha(0.7).restart();
  }, [targetNodes, links, goalLinkEdges, layoutMode]);

  useEffect(() => { const sim = simRef.current; return () => { sim?.stop(); }; }, []);

  /**
   * Zoom à la molette.
   *
   * L'ancienne version multipliait l'échelle par un pas fixe de 12 % à *chaque*
   * événement, sans regarder l'amplitude du geste. Une souris émet un événement
   * par cran (deltaY ≈ 100) : le pas tombait à peu près juste. Un pavé tactile
   * en émet des dizaines par seconde, minuscules (deltaY ≈ 4), et chacun valait
   * aussi 12 % — mesuré : soixante effleurements faisaient passer l'échelle de
   * 0,89 au plancher de 0,20 en quatre secondes. D'où la sensation de zoom qui
   * part tout seul et par à-coups.
   *
   * Le facteur suit donc maintenant la distance réellement parcourue.
   */
  useEffect(() => {
    const svg = svgRef.current, root = rootRef.current;
    if (!svg || !root) return;

    // `getBoundingClientRect` force un recalcul de mise en page. À plus de cent
    // événements par seconde, autant ne mesurer qu'aux moments où ça change.
    const remesurer = () => { rectRef.current = svg.getBoundingClientRect(); };
    remesurer();
    const ro = new ResizeObserver(remesurer);
    ro.observe(svg);
    window.addEventListener("scroll", remesurer, true);
    window.addEventListener("resize", remesurer);

    // Une écriture par image : le pavé tactile émet plus vite que l'écran
    // n'affiche, et chaque écriture invalide la peinture de tout le SVG.
    let trame = 0;
    const peindre = () => {
      trame = 0;
      const z = zoomRef.current;
      root.setAttribute("transform", `translate(${z.x},${z.y}) scale(${z.k})`);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      // `deltaMode` varie d'un navigateur à l'autre : Firefox compte en lignes
      // là où Chrome compte en pixels. Sans conversion, le même geste zoome
      // plusieurs fois moins vite ici que là.
      const rect = rectRef.current ?? svg.getBoundingClientRect();
      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 16;
      else if (e.deltaMode === 2) dy *= rect.height || 400;
      // Un événement isolé ne doit jamais faire faire un bond à la vue, même si
      // le système en agrège plusieurs d'un coup.
      dy = Math.max(-PAS_ZOOM_MAX, Math.min(PAS_ZOOM_MAX, dy));

      const z = zoomRef.current;
      const nk = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z.k * Math.exp(-dy * SENSIBILITE_ZOOM)));
      if (nk === z.k) return; // déjà en butée : rien à redessiner

      // Le point sous le curseur reste sous le curseur.
      const mx = (e.clientX - rect.left) / rect.width * W;
      const my = (e.clientY - rect.top) / rect.height * H;
      z.x = mx - (mx - z.x) * (nk / z.k);
      z.y = my - (my - z.y) * (nk / z.k);
      z.k = nk;

      if (!trame) trame = requestAnimationFrame(peindre);
    };

    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      svg.removeEventListener("wheel", onWheel);
      ro.disconnect();
      window.removeEventListener("scroll", remesurer, true);
      window.removeEventListener("resize", remesurer);
      if (trame) cancelAnimationFrame(trame);
    };
  }, []);

  // Drag + Pan + Snap
  const panState = useRef<{ active: boolean; sx: number; sy: number; ox: number; oy: number } | null>(null);
  const screenToSvg = (cx: number, cy: number) => {
    const svg = svgRef.current!; const rect = rectRef.current ?? svg.getBoundingClientRect(); const z = zoomRef.current;
    return { x: ((cx - rect.left) / rect.width * W - z.x) / z.k, y: ((cy - rect.top) / rect.height * H - z.y) / z.k };
  };

  const onBgDown = (e: React.PointerEvent) => {
    if ((e.target as Element).closest(".nd")) return;
    panState.current = { active: true, sx: e.clientX, sy: e.clientY, ox: zoomRef.current.x, oy: zoomRef.current.y };
  };
  const onBgMove = (e: React.PointerEvent) => {
    if (dragId) {
      const node = nodesMapRef.current.get(dragId);
      if (!node) return;
      const { x, y } = screenToSvg(e.clientX, e.clientY);
      node.fx = x; node.fy = y;
      if (node.kind === "asset" && node.assetId != null) {
        let closest: string | null = null, closestDist = 80;
        nodesMapRef.current.forEach(pn => {
          if (pn.kind !== "portfolio" || pn.portfolioKey === node.portfolioKey) return;
          const d = Math.sqrt(((pn.x ?? 0) - x) ** 2 + ((pn.y ?? 0) - y) ** 2) - pn.r;
          if (d < closestDist) { closestDist = d; closest = pn.id; }
        });
        setSnapTarget(closest);
      }
      return;
    }
    if (!panState.current?.active) return;
    const p = panState.current, svg = svgRef.current!, rect = rectRef.current ?? svg.getBoundingClientRect();
    zoomRef.current.x = p.ox + (e.clientX - p.sx) / rect.width * W;
    zoomRef.current.y = p.oy + (e.clientY - p.sy) / rect.height * H;
    rootRef.current?.setAttribute("transform", `translate(${zoomRef.current.x},${zoomRef.current.y}) scale(${zoomRef.current.k})`);
  };
  const onBgUp = () => {
    if (dragId) {
      const node = nodesMapRef.current.get(dragId);
      // Magnetic snap
      if (node?.kind === "asset" && node.assetId != null && snapTarget) {
        const tgt = nodesMapRef.current.get(snapTarget);
        if (tgt?.portfolioKey != null && tgt.portfolioKey !== "unassigned") {
          actions.updateAsset(node.assetId, { portfolioId: tgt.portfolioKey as number });
          node.fx = null; node.fy = null; // release so it snaps to new parent
        }
      } else if (node && node.x != null && node.y != null) {
        setNodePosition(layoutModeRef.current, dragId, { x: node.x, y: node.y });
      }
      simRef.current?.alphaTarget(0);
      setDragId(null); setSnapTarget(null);
    }
    panState.current = null;
  };

  const nodes = [...nodesMapRef.current.values()];
  const nowMs = new Date().getTime(); // référence unique pour situer les dividendes proches/à venir
  const nodeById = nodesMapRef.current;
  const toggle = (key: number | "unassigned") => setExpanded(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  const onNodeDown = (id: string) => (e: React.PointerEvent) => {
    e.stopPropagation();
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    setDragId(id);
    simRef.current?.alphaTarget(0.3).restart();
  };

  const handleClick = (n: GNode, e: React.MouseEvent) => {
    // Ignore if it was a real drag (moved > 5px)
    if (dragStartPos.current) {
      const dx = e.clientX - dragStartPos.current.x, dy = e.clientY - dragStartPos.current.y;
      if (Math.sqrt(dx * dx + dy * dy) > 5) { dragStartPos.current = null; return; }
    }
    dragStartPos.current = null;

    if (ownerMode) {
      const isCenter = n.kind === "center";
      const isMember = n.kind === "member" && n.memberId != null;
      const isPortfolio = n.kind === "portfolio" && n.portfolioKey !== undefined && n.portfolioKey !== "unassigned";
      const isGoal = n.kind === "goal" && n.goalId != null;
      if (!ownerSourceNode) {
        if (isCenter) setOwnerSourceNode({ id: n.id, kind: "center", label: ownerName });
        else if (isMember) setOwnerSourceNode({ id: n.id, kind: "member", memberId: n.memberId ?? undefined, label: n.label });
        return;
      }
      const newMemberId = ownerSourceNode.kind === "center" ? null : (ownerSourceNode.memberId as number);
      if (isPortfolio) {
        const g = groups.find(gr => gr.key === n.portfolioKey);
        if (g && g.key !== "unassigned") actions.updatePortfolio(g.key as number, { name: g.portfolio.name, color: g.portfolio.color, skin: g.portfolio.skin, memberId: newMemberId });
      } else if (isGoal) {
        const goal = goals.find(gg => gg.id === n.goalId);
        if (goal) actions.updateGoal(goal.id, { name: goal.name, targetAmount: goal.targetAmount, targetDate: goal.targetDate, color: goal.color, memberId: newMemberId });
      }
      setOwnerSourceNode(null);
      setOwnerMode(false);
      return;
    }

    if (linkMode) {
      const isSalary = n.kind === "salary";
      const isMemberSalary = n.kind === "member-salary" && n.memberId != null;
      const isPortfolio = n.kind === "portfolio" && n.portfolioKey !== undefined && n.portfolioKey !== "unassigned";
      const isGoal = n.kind === "goal" && n.goalId != null;
      const eligibleSource = isSalary || isMemberSalary || isPortfolio;
      const eligibleTarget = isPortfolio || isGoal;
      if (!linkSourceNode) {
        if (eligibleSource) setLinkSourceNode({ id: n.id, kind: n.kind, portfolioKey: n.portfolioKey, memberId: n.memberId ?? undefined, label: n.label });
        return;
      }
      if (n.id === linkSourceNode.id) { setLinkSourceNode(null); return; }
      if (eligibleTarget) {
        const sourceType = linkSourceNode.kind === "salary" ? "salary" : linkSourceNode.kind === "member-salary" ? "member_salary" : "portfolio";
        const sourceId = linkSourceNode.kind === "salary" ? null : linkSourceNode.kind === "member-salary" ? (linkSourceNode.memberId as number) : (linkSourceNode.portfolioKey as number);
        const targetType = isGoal ? "goal" : "portfolio";
        const targetId = isGoal ? n.goalId! : (n.portfolioKey as number);
        setPendingLink({ sourceType, sourceId, sourceLabel: linkSourceNode.label, targetType, targetId, targetLabel: n.label });
        setLinkSourceNode(null);
        setLinkMode(false);
      }
      return;
    }

    setCreateMode(null);
    if (n.kind === "center") setSelected({ kind: "total", total: grandTotal, grossTotal, debt });
    else if (n.kind === "salary") { setCreateMode("salary"); setSelected({ kind: "total", total: grandTotal, grossTotal, debt }); }
    else if ((n.kind === "expense-item" || n.kind === "income-item") && n.flowId != null) setSelected({ kind: "flow-item", flowId: n.flowId, label: n.label, isExpense: n.kind === "expense-item" });
    else if (n.kind === "expenses" || n.kind === "reste") setSelected({ kind: "total", total: grandTotal, grossTotal, debt });
    else if (n.kind === "portfolio" && n.portfolioKey !== undefined) {
      const g = groups.find(gr => gr.key === n.portfolioKey)!;
      toggle(n.portfolioKey);
      setSelected({ kind: "portfolio", id: n.portfolioKey, name: g.portfolio.name, color: g.portfolio.color, skin: g.portfolio.skin, total: g.total, count: g.valued.length, memberId: g.portfolio.memberId });
    }
    else if (n.kind === "asset" && n.assetId != null) {
      const g = groups.find(gr => gr.key === n.portfolioKey)!;
      const v = g.valued.find(val => val.asset.id === n.assetId)!;
      const q = v.asset.ticker ? quotes[v.asset.ticker] : null;
      setSelected({ kind: "asset", asset: v.asset, value: v.value, gain: gain(v.asset, q, ctx), gainPct: gainPercent(v.asset, q, ctx), portfolioName: g.portfolio.name });
    }
    else if (n.kind === "goal" && n.goalId != null) {
      const goal = goals.find(g => g.id === n.goalId)!;
      setSelected({ kind: "goal", goal, progress: progressOf(goal), linkedPortfolioIds: goalLinks.filter(gl => gl.goalId === goal.id).map(gl => gl.portfolioId) });
    }
    else if (n.id === "self") setSelected({ kind: "self", name: ownerName, color: centerColor, accessory: ownerAccessory });
    else if (n.kind === "member" && n.memberId != null) {
      const member = members.find(m => m.id === n.memberId)!;
      const mTotal = portfolios.filter(p => p.memberId === member.id).reduce((s, p) => s + (groups.find(gr => gr.key === p.id)?.total ?? 0), 0);
      setSelected({ kind: "member", member, total: mTotal });
    }
    else if (n.kind === "member-salary" && n.memberId != null) {
      const member = members.find(m => m.id === n.memberId)!;
      const mTotal = portfolios.filter(p => p.memberId === member.id).reduce((s, p) => s + (groups.find(gr => gr.key === p.id)?.total ?? 0), 0);
      setSelected({ kind: "member", member, total: mTotal });
      setCreateMode("edit-member");
    }
  };

  const autoLayout = () => { clearAllPositions(layoutModeRef.current); nodesMapRef.current.forEach(n => { if (n.id !== "center") { n.fx = null; n.fy = null; } }); zoomRef.current = { k: 1, x: 0, y: 0 }; rootRef.current?.setAttribute("transform", ""); simRef.current?.alpha(1).restart(); };

  const exportPdf = async () => {
    const svg = svgRef.current; if (!svg) return;
    const { default: jsPDF } = await import("jspdf");
    const W = 1400, H = 1000;
    const canvas = document.createElement("canvas"); const ctx = canvas.getContext("2d")!;
    canvas.width = W; canvas.height = H;
    ctx.fillStyle = "#0a0a0e"; ctx.fillRect(0, 0, W, H);
    const img = new Image();
    await new Promise<void>(resolve => {
      img.onload = () => resolve();
      img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(new XMLSerializer().serializeToString(svg))));
    });
    ctx.drawImage(img, 0, 0, W, 820);
    ctx.fillStyle = "#e2e2e6"; ctx.font = "bold 26px sans-serif";
    ctx.fillText("Aurevia — Patrimoine", 40, 865);
    ctx.font = "15px sans-serif"; ctx.fillStyle = "#8e8e96";
    const dateStr = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    ctx.fillText(dateStr, W - 200, 865);
    ctx.font = "16px sans-serif"; ctx.fillStyle = "#b8b8c2";
    ctx.fillText(`Net : ${fmt(grandTotal)}   ·   Actifs bruts : ${fmt(grossTotal)}   ·   Crédits : ${fmt(debt)}`, 40, 900);
    if (totalRevenue > 0) ctx.fillText(`Revenus mensuels : ${fmt(totalRevenue)}   ·   Dépenses : ${fmt(totalExpenseFlows)}   ·   Épargne : ${tauxEpargne}%`, 40, 930);
    if (structureScore !== null) { ctx.fillStyle = structureScore >= 70 ? "#34d399" : structureScore >= 45 ? "#9585ff" : "#f87171"; ctx.font = "bold 16px sans-serif"; ctx.fillText(`Score de structure : ${structureScore}/100`, 40, 965); }

    const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [W, H] });
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, W, H);

    // ── Page 2: detailed breakdown table ──
    pdf.addPage([W, H], "landscape");
    pdf.setFillColor(10, 10, 14); pdf.rect(0, 0, W, H, "F");
    let y = 60;
    pdf.setTextColor(226, 226, 230); pdf.setFont("helvetica", "bold"); pdf.setFontSize(22);
    pdf.text("Détail du patrimoine", 40, y); y += 20;
    pdf.setDrawColor(60, 60, 68); pdf.line(40, y, W - 40, y); y += 34;

    pdf.setFontSize(14); pdf.text("Planètes", 40, y); y += 22;
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(11);
    for (const g of groups) {
      if (g.total <= 0 && g.valued.length === 0) continue;
      pdf.setTextColor(200, 200, 208);
      pdf.text(String(g.portfolio.name), 50, y);
      pdf.setTextColor(150, 150, 160);
      pdf.text(`${g.valued.length} actif${g.valued.length > 1 ? "s" : ""}`, 320, y);
      pdf.setTextColor(226, 226, 230);
      pdf.text(fmt(g.total), W - 100, y, { align: "right" });
      y += 18;
      if (y > H - 60) { pdf.addPage([W, H], "landscape"); pdf.setFillColor(10, 10, 14); pdf.rect(0, 0, W, H, "F"); y = 60; }
    }

    if (debt > 0) {
      y += 12; pdf.setTextColor(248, 113, 113); pdf.setFont("helvetica", "bold"); pdf.setFontSize(12);
      pdf.text(`Crédits en cours : ${fmt(debt)}`, 50, y); y += 12;
    }

    if (goals.length > 0) {
      y += 26; pdf.setTextColor(226, 226, 230); pdf.setFont("helvetica", "bold"); pdf.setFontSize(14);
      pdf.text("Objectifs", 40, y); y += 22;
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(11);
      for (const g of goals) {
        const prog = Math.round(progressOf(g) * 100);
        pdf.setTextColor(200, 200, 208);
        pdf.text(String(g.name), 50, y);
        pdf.setTextColor(150, 150, 160);
        pdf.text(`${fmt(Number(g.targetAmount))} visé`, 320, y);
        pdf.setTextColor(prog >= 100 ? 52 : 149, prog >= 100 ? 211 : 133, prog >= 100 ? 153 : 255);
        pdf.text(`${prog}%`, W - 100, y, { align: "right" });
        y += 18;
        if (y > H - 60) { pdf.addPage([W, H], "landscape"); pdf.setFillColor(10, 10, 14); pdf.rect(0, 0, W, H, "F"); y = 60; }
      }
    }

    if (members.length > 0) {
      y += 26; pdf.setTextColor(226, 226, 230); pdf.setFont("helvetica", "bold"); pdf.setFontSize(14);
      pdf.text("Membres du foyer", 40, y); y += 22;
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(11);
      for (const m of members) {
        pdf.setTextColor(200, 200, 208);
        pdf.text(String(m.name), 50, y);
        pdf.setTextColor(150, 150, 160);
        pdf.text(String(m.role || ""), 320, y);
        if (m.salary) { pdf.setTextColor(226, 226, 230); pdf.text(fmt(Number(m.salary)), W - 100, y, { align: "right" }); }
        y += 18;
        if (y > H - 60) { pdf.addPage([W, H], "landscape"); pdf.setFillColor(10, 10, 14); pdf.rect(0, 0, W, H, "F"); y = 60; }
      }
    }

    pdf.setFontSize(9); pdf.setTextColor(110, 110, 118);
    pdf.text("Score de structure organisationnel — ne constitue pas un conseil en investissement.", 40, H - 30);

    pdf.save("aurevia.pdf");
  };

  const parNature = useMemo(() => {
    const somme = new Map<Nature, number>();
    for (const g of groups) somme.set(g.nature, (somme.get(g.nature) ?? 0) + Math.max(0, g.total));
    const total = [...somme.values()].reduce((a, b) => a + b, 0);
    return NATURE_ORDER
      .map(nature => ({ nature, montant: somme.get(nature) ?? 0 }))
      .filter(l => l.montant > 0)
      .map(l => ({ ...l, part: total > 0 ? l.montant / total : 0 }))
      .sort((a, b) => b.montant - a.montant);
  }, [groups]);

  const budgetRatio = totalRevenue > 0 ? totalExpenseFlows / totalRevenue : 0; // 0..1+ (1+ = deficit)
  const tauxEpargne = totalRevenue > 0 ? Math.round((totalRevenue - totalExpenseFlows) / totalRevenue * 100) : 0;

  // Score de structure /100 — purement organisationnel (diversification, dette,
  // concentration, taux d'épargne), aucune recommandation d'investissement.
  const structureScore = useMemo(() => {
    if (grossTotal <= 0) return null;
    const savingsPart = totalRevenue > 0 ? Math.min(25, Math.max(0, tauxEpargne / 40 * 25)) : 12.5;
    const skins = new Set(groups.filter(g => g.total > 0).map(g => planetSkin(g.portfolio.name, g.valued, g.portfolio.skin)));
    const diversificationPart = Math.min(25, skins.size * 6);
    const debtRatio = grossTotal > 0 ? debt / grossTotal : 0;
    const debtPart = Math.max(0, 25 - debtRatio * 100 / 4);
    const largestShare = grossTotal > 0 ? Math.max(0, ...groups.map(g => g.total)) / grossTotal : 0;
    const concentrationPart = largestShare <= 0.3 ? 25 : Math.max(0, 25 - (largestShare - 0.3) / 0.7 * 25);
    return Math.round(savingsPart + diversificationPart + debtPart + concentrationPart);
  }, [grossTotal, totalRevenue, tauxEpargne, groups, debt]);

  // Alertes de trajectoire : purement factuelles (écart en €), aucun conseil d'investissement.
  const alerts = useMemo(() => {
    const list: { id: string; text: string }[] = [];
    if (totalRevenue > 0 && totalExpenseFlows > totalRevenue) {
      list.push({ id: "exp", text: `Dépenses (${fmt(totalExpenseFlows)}) supérieures aux revenus (${fmt(totalRevenue)}) : ${fmt(totalExpenseFlows - totalRevenue)}/mois de déficit.` });
    }
    if (totalRevenue > 0 && totalInvest > totalRevenue) {
      list.push({ id: "inv", text: `Investissements programmés (${fmt(totalInvest)}) supérieurs aux revenus (${fmt(totalRevenue)}) : ${fmt(totalInvest - totalRevenue)}/mois au-delà de ce qui rentre.` });
    }
    return list;
  }, [totalRevenue, totalExpenseFlows, totalInvest, fmt]);

  return (
    <div className="relative grid h-full grid-cols-1 lg:grid-cols-[160px_1fr_280px]">
      {/* Voile sous le tiroir ouvert : un clic en dehors le referme. */}
      {drawer && (
        <button
          aria-label="Fermer le panneau"
          onClick={() => setDrawer(null)}
          className="lg:hidden absolute inset-0 z-20 bg-bg/70 cursor-default"
        />
      )}
      {/* ── LEFT MENU ── */}
      <div className={`glass-panel border-r border-border flex-col overflow-y-auto h-full min-h-0
        max-lg:absolute max-lg:inset-y-0 max-lg:left-0 max-lg:z-30 max-lg:w-52 max-lg:shadow-2xl
        ${drawer === "menu" ? "flex" : "hidden lg:flex"}`}>
        <button
          onClick={() => setDrawer(null)}
          aria-label="Fermer le menu"
          className="lg:hidden self-end p-3 text-text-muted hover:text-text"
        >
          <X size={16} />
        </button>
        {/* Stats header */}
        <div className="px-4 pt-4 pb-3 border-b border-border space-y-1">
          <DateDuJour className="mb-1.5" />
          <div>
            <p className="text-lg font-[family-name:var(--font-mono-num)] tabular font-semibold">{fmt(grandTotal)}</p>
            <p className="text-[10px] text-text-muted mt-0.5">Patrimoine net{debt > 0 && <span className="tabular"> · {fmt(grossTotal)} brut</span>}</p>
          </div>
          {totalRevenue > 0 && (
            <div className="flex items-center justify-between text-[10px] pt-1.5" title={`Dépenses ${Math.round(budgetRatio * 100)} % des revenus · reste ${fmt(resteAInvestir)}`}>
              <span className="text-text-muted flex items-center gap-1">
                {tauxEpargne >= 0
                  ? <TrendingUp size={10} className="text-positive" />
                  : <TrendingDown size={10} className="text-negative" />}
                Taux d&apos;épargne
              </span>
              <span className={`tabular font-medium ${tauxEpargne >= 0 ? "text-positive" : "text-negative"}`}>{tauxEpargne}%</span>
            </div>
          )}

          {parNature.length > 0 && (
            <div className="pt-2.5 space-y-1.5">
              {/* Barre de répartition : elle fait office de légende de la couleur
                  des planètes et des flux, tout en donnant le partage réel. */}
              <div className="flex h-1.5 rounded-full overflow-hidden gap-px" role="img"
                aria-label={parNature.map(l => `${NATURE_LABELS[l.nature]} ${Math.round(l.part * 100)} %`).join(", ")}>
                {parNature.map(l => (
                  <div key={l.nature} style={{ width: `${l.part * 100}%`, background: NATURE_COLORS[l.nature] }} />
                ))}
              </div>
              {parNature.map(l => (
                <div key={l.nature} className="flex items-center justify-between text-[10px] gap-2">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: NATURE_COLORS[l.nature] }} />
                    <span className="text-text-muted truncate">{NATURE_LABELS[l.nature]}</span>
                  </span>
                  <span className="tabular text-text-muted shrink-0">{Math.round(l.part * 100)}%</span>
                </div>
              ))}
            </div>
          )}
          {structureScore !== null && (
            <div className="pt-1.5" title="Score organisationnel : diversification, dette, concentration, épargne — pas un conseil d'investissement.">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-text-muted">Score</span>
                <span className={`tabular font-semibold ${structureScore >= 70 ? "text-positive" : structureScore >= 45 ? "text-accent" : "text-negative"}`}>{structureScore}/100</span>
              </div>
              <div className="h-1 rounded bg-bg mt-1 overflow-hidden">
                <div className="h-full rounded" style={{ width: `${structureScore}%`, background: structureScore >= 70 ? "#34d399" : structureScore >= 45 ? "#7c6af5" : "#f87171" }} />
              </div>
            </div>
          )}
        </div>

        {/* ── Lecture : disposition et simulateur ── */}
        <div className="px-3 py-3 border-b border-border space-y-2">
          <p className="text-[9px] text-text-muted uppercase tracking-wider px-1 flex items-center gap-1.5">
            <LayoutGrid size={10} />Disposition
          </p>
          <div className="space-y-0.5">
            {LAYOUT_MODES.map(({ mode, label, hint }) => (
              <button key={mode} onClick={() => onLayoutMode(mode)} title={hint}
                aria-pressed={layoutMode === mode}
                className={`w-full text-left px-2 py-1.5 rounded-md text-[11px] leading-tight transition-colors ${
                  layoutMode === mode ? "bg-accent/15 text-accent" : "text-text-muted hover:text-text hover:bg-surface-hover"}`}>
                {label}
              </button>
            ))}
          </div>

          <button onClick={onOpenReview}
            className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs text-text-muted hover:text-text hover:bg-surface-hover">
            <ClipboardCheck size={13} className="shrink-0" />
            Pointer le mois
            {overdueCount > 0 && (
              <span className="ml-auto px-1.5 rounded-full bg-[#fbbf24] text-[#1a1400] text-[10px] font-bold tabular">
                {overdueCount > 99 ? "99+" : overdueCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setShowScrubBar(v => {
              // Refermer le simulateur ramène à aujourd'hui. Sans ça, la galaxie
              // restait projetée alors que plus aucun réglage n'était visible
              // pour l'expliquer ni pour revenir en arrière.
              if (v) setScrubYears(0);
              return !v;
            })}
            aria-pressed={showScrubBar}
            className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs mt-1 transition-colors ${
              showScrubBar ? "bg-accent/15 text-accent" : "text-text-muted hover:text-text hover:bg-surface-hover"}`}>
            <FlaskConical size={13} className="shrink-0" />Simulateur
          </button>

          {showScrubBar && (
            <div className="px-1 pt-1 space-y-2">
              <label className="flex items-center justify-between text-[10px] text-text-muted">
                <span>Horizon</span>
                <span className="tabular text-accent font-medium">
                  {scrubYears === 0 ? "aujourd'hui" : `+${scrubYears} an${scrubYears > 1 ? "s" : ""}`}
                </span>
              </label>
              <input type="range" min={0} max={30} step={1} value={scrubYears}
                onChange={e => setScrubYears(Number(e.target.value))}
                aria-label="Horizon de projection en années"
                className="w-full accent-accent" />
              <label className="flex items-center justify-between text-[10px] text-text-muted">
                <span>Rendement</span>
                <span className="tabular text-accent font-medium">{scrubGrowth} %/an</span>
              </label>
              <input type="range" min={0} max={15} step={0.5} value={scrubGrowth}
                onChange={e => setScrubGrowth(Number(e.target.value))}
                aria-label="Rendement annuel moyen supposé"
                className="w-full accent-accent" />
              {scrubYears > 0 && (
                <div className="pt-1 border-t border-border">
                  <p className="text-[10px] text-text-muted">En {scrubYear}</p>
                  <p className="text-sm font-[family-name:var(--font-mono-num)] tabular font-semibold text-accent">
                    {fmt(scrubProjectedTotal)}
                  </p>
                  <p className="text-[9px] text-text-muted mt-0.5">
                    hypothèse, pas une prévision
                  </p>
                  <button
                    onClick={() => setScrubYears(0)}
                    className="flex items-center gap-1.5 mt-2 w-full px-2 py-1 rounded-md text-[10px] text-text-muted hover:text-text hover:bg-surface-hover"
                  >
                    <RotateCcw size={11} className="shrink-0" />Revenir à aujourd&apos;hui
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Create actions — masquées en lecture seule : un bouton qui ne peut
            qu'échouer n'a pas sa place dans une démonstration. */}
        {!readOnly && <div className="px-3 py-3 space-y-0.5">
          <p className="text-[9px] text-text-muted uppercase tracking-wider px-1 mb-1.5">Créer</p>
          {[
            { icon: FolderPlus, label: "Planète", mode: "portfolio" },
            { icon: Star, label: "Objectifs", mode: "goal" },
            { icon: Users, label: "Membres", mode: "member" },
            { icon: Link2, label: "Liens", mode: "link" },
          ].map(({ icon: Icon, label, mode }) => {
            const active = mode === "link" ? linkMode : createMode === mode;
            return <button key={mode} onClick={() => {
              if (mode === "link") { setSelected(null); setCreateMode(null); setOwnerMode(false); setOwnerSourceNode(null); setLinkSourceNode(null); setLinkMode(m => !m); }
              else if (mode === "portfolio") { setSelected(null); setLinkMode(false); setLinkSourceNode(null); setOwnerMode(false); setOwnerSourceNode(null); setExpenseMemberId(null); setShowPlanetModal(true); }
              else { setSelected(null); setLinkMode(false); setLinkSourceNode(null); setOwnerMode(false); setOwnerSourceNode(null); setExpenseMemberId(null); setCreateMode(mode); }
            }}
              className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs transition-colors ${active ? "bg-accent/15 text-accent" : "text-text-muted hover:text-text hover:bg-surface-hover"}`}>
              <Icon size={13} className="shrink-0" />{label}
            </button>;
          })}
          {linkMode && <p className="text-[10px] text-accent px-2 pt-1">
            {linkSourceNode ? `Clique la destination (depuis "${linkSourceNode.label}")…` : "Clique la planète source…"}
          </p>}
        </div>}

        {/* Salary */}
        {!readOnly && <div className="px-3 py-2 border-t border-border">
          <p className="text-[9px] text-text-muted uppercase tracking-wider px-1 mb-1.5">Revenus</p>
          <button onClick={() => { setSelected(null); setCreateMode("salary"); }}
            className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs ${createMode === "salary" ? "bg-accent/15 text-accent" : "text-text-muted hover:text-text hover:bg-surface-hover"}`}>
            <Wallet size={13} className="shrink-0" />
            Salaire principal
            {salary > 0 && <span className="ml-auto text-[10px] tabular text-text-muted">{fmt(salary)}</span>}
          </button>
          <button onClick={() => { setSelected(null); setCreateMode("income"); }}
            className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs ${createMode === "income" ? "bg-accent/15 text-accent" : "text-text-muted hover:text-text hover:bg-surface-hover"}`}>
            <PlusCircle size={13} className="shrink-0" />
            Source de revenus
          </button>
        </div>}


        <div className="flex-1" />

        {/* Bottom actions */}
        <div className="px-3 py-3 border-t border-border space-y-0.5">
          <button onClick={() => setExpanded(prev => prev.size > 0 ? new Set() : new Set(groups.map(g => g.key)))} className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs text-text-muted hover:text-text hover:bg-surface-hover">
            {expanded.size > 0 ? <EyeOff size={13} /> : <Eye size={13} />}
            {expanded.size > 0 ? "Masquer les satellites" : "Afficher les satellites"}
          </button>
          <button onClick={onRefresh} className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs text-text-muted hover:text-text hover:bg-surface-hover">
            <RefreshCw size={13} />Actualiser
          </button>
          <button onClick={autoLayout} className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs text-text-muted hover:text-text hover:bg-surface-hover">
            <RotateCcw size={13} />Rangement auto
          </button>
          <button onClick={exportPdf} className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs text-text-muted hover:text-text hover:bg-surface-hover">
            <Download size={13} />Export PDF
          </button>
          {demoLoaded && !readOnly && onRemoveDemo && (
            <button
              onClick={onRemoveDemo}
              disabled={demoBusy}
              title="Supprime uniquement les lignes créées par l'exemple"
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs text-text-muted hover:text-negative hover:bg-surface-hover disabled:opacity-50"
            >
              {demoBusy ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
              <span className="min-w-0 truncate">Retirer l&apos;exemple</span>
            </button>
          )}
        </div>
      </div>

      {/* ── GRAPH ── */}
      <div className="relative overflow-hidden" style={{
        background: [
          "radial-gradient(ellipse 55% 40% at 25% 22%, rgba(124,106,245,0.08), transparent 60%)",
          "radial-gradient(ellipse 60% 45% at 78% 68%, rgba(45,180,190,0.10), transparent 55%)",
          "radial-gradient(ellipse 55% 50% at 12% 82%, rgba(200,90,60,0.07), transparent 50%)",
          "radial-gradient(ellipse 40% 35% at 55% 45%, rgba(255,255,255,0.02), transparent 65%)",
          "#050409",
        ].join(", "),
      }}>
        {/* Commandes mobiles : sous `lg`, les panneaux sont des tiroirs, il faut
            de quoi les ouvrir — et le patrimoine net doit rester lisible sans
            avoir à en ouvrir un. */}
        <div className="lg:hidden absolute top-0 inset-x-0 z-10 flex items-center gap-2 px-3 py-2 bg-bg/80 backdrop-blur border-b border-border">
          <button
            onClick={() => setDrawer(d => (d === "menu" ? null : "menu"))}
            aria-label="Ouvrir le menu"
            aria-expanded={drawer === "menu"}
            className="shrink-0 p-1.5 -m-1.5 text-text-muted hover:text-text"
          >
            <Menu size={18} />
          </button>
          <div className="flex-1 min-w-0 text-center">
            <p className="text-sm font-[family-name:var(--font-mono-num)] tabular font-semibold truncate">{fmt(grandTotal)}</p>
            <p className="text-[9px] text-text-muted -mt-0.5">Patrimoine net</p>
          </div>
          <button
            onClick={() => setDrawer(d => (d === "details" ? null : "details"))}
            aria-label="Ouvrir le détail"
            aria-expanded={drawer === "details"}
            className="shrink-0 p-1.5 -m-1.5 text-text-muted hover:text-text"
          >
            <PanelRight size={18} />
          </button>
        </div>
        {systeme === null && entreesSystemes && onEntrerSysteme ? (
          <div className="absolute inset-0 max-lg:top-11">
            <SystemesView entrees={entreesSystemes} devise={displayCurrency} onEntrer={onEntrerSysteme} />
          </div>
        ) : (<>
        {systeme !== null && onSortirSysteme && (
          <button
            onClick={onSortirSysteme}
            className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg glass-panel border border-border text-xs text-text-muted hover:text-text max-lg:top-14"
          >
            <ChevronLeft size={13} />Vue d&apos;ensemble
          </button>
        )}
        {/* Qui est de quelle couleur — l'anneau seul ne suffit pas, il faut le nom à côté. */}
        {members.length > 0 && (
          <div className="absolute bottom-3 left-3 z-10 hidden lg:flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg glass-panel border border-border text-[11px] pointer-events-none" aria-label="Couleur de chaque personne">
            <span className="text-[10px] uppercase tracking-wide text-text-muted">Anneau = propriétaire</span>
            {[{ nom: ownerName, couleur: centerColor }, ...members.map(m => ({ nom: m.name, couleur: m.color }))].map(p => (
              <span key={p.nom} className="flex items-center gap-1 text-text"><span className="w-2.5 h-2.5 rounded-full border-2 shrink-0" style={{ borderColor: p.couleur }} />{p.nom}</span>
            ))}
          </div>
        )}
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-full select-none touch-none block absolute inset-0"
          onPointerDown={onBgDown} onPointerMove={onBgMove} onPointerUp={onBgUp} onPointerLeave={onBgUp}
          onClick={() => { if (linkSourceNode) { setLinkSourceNode(null); return; } if (ownerSourceNode) { setOwnerSourceNode(null); return; } setSelected(null); setCreateMode(null); }}>
          <defs>
            <filter id="gl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" /></filter>
            <filter id="glow-strong" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>

            <radialGradient id="sph-center" cx="35%" cy="28%" r="65%"><stop offset="0%" stopColor={shade(centerColor, 0.85)} /><stop offset="15%" stopColor={shade(centerColor, 0.45)} /><stop offset="35%" stopColor={centerColor} /><stop offset="60%" stopColor={shade(centerColor, -0.35)} /><stop offset="100%" stopColor={shade(centerColor, -0.8)} /></radialGradient>
            <radialGradient id="glow-center" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor={shade(centerColor, 0.4)} stopOpacity="0.3" /><stop offset="60%" stopColor={centerColor} stopOpacity="0.08" /><stop offset="100%" stopColor={centerColor} stopOpacity="0" /></radialGradient>
            <radialGradient id="sph-salary" cx="38%" cy="28%" r="60%"><stop offset="0%" stopColor="#a8f0b0" /><stop offset="20%" stopColor="#5ec06a" /><stop offset="40%" stopColor="#2a8040" /><stop offset="60%" stopColor="#1c6535" /><stop offset="80%" stopColor="#0e4020" /><stop offset="100%" stopColor="#082810" /></radialGradient>
            <radialGradient id="salary-land" cx="55%" cy="45%" r="35%"><stop offset="0%" stopColor="#8b6a3a" stopOpacity="0.4" /><stop offset="100%" stopColor="#8b6a3a" stopOpacity="0" /></radialGradient>
            <radialGradient id="sph-expenses" cx="38%" cy="28%" r="60%"><stop offset="0%" stopColor="#ff9090" /><stop offset="25%" stopColor="#d04040" /><stop offset="50%" stopColor="#8a1515" /><stop offset="75%" stopColor="#4a0808" /><stop offset="100%" stopColor="#200303" /></radialGradient>
            <radialGradient id="sph-lava" cx="38%" cy="28%" r="60%"><stop offset="0%" stopColor="#ff8844" /><stop offset="20%" stopColor="#ff4400" /><stop offset="45%" stopColor="#cc2200" /><stop offset="70%" stopColor="#7a1100" /><stop offset="100%" stopColor="#2a0500" /></radialGradient>
            <radialGradient id="lava-cracks" cx="60%" cy="60%" r="50%"><stop offset="0%" stopColor="#ff6600" stopOpacity="0.35" /><stop offset="100%" stopColor="#ff0000" stopOpacity="0" /></radialGradient>
            <radialGradient id="glow-lava" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#ff4500" stopOpacity="0.4" /><stop offset="60%" stopColor="#ff2200" stopOpacity="0.1" /><stop offset="100%" stopColor="#ff0000" stopOpacity="0" /></radialGradient>
            <radialGradient id="sph-reste" cx="38%" cy="28%" r="60%"><stop offset="0%" stopColor="#d4c8ff" /><stop offset="30%" stopColor="#a088ff" /><stop offset="60%" stopColor="#6a50d0" /><stop offset="100%" stopColor="#201548" /></radialGradient>
            <radialGradient id="sph-hl" cx="28%" cy="20%" r="28%"><stop offset="0%" stopColor="white" stopOpacity="0.55" /><stop offset="50%" stopColor="white" stopOpacity="0.12" /><stop offset="100%" stopColor="white" stopOpacity="0" /></radialGradient>
            <clipPath id="clip-sal"><circle r={32} /></clipPath>
            <radialGradient id="vignette" cx="50%" cy="45%" r="72%"><stop offset="55%" stopColor="#000" stopOpacity={0} /><stop offset="100%" stopColor="#000" stopOpacity={0.55} /></radialGradient>
            <radialGradient id="rocket-trail" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#ffb870" stopOpacity={0.9} /><stop offset="100%" stopColor="#ffb870" stopOpacity={0} /></radialGradient>

            {/* Trame HUD discrète — un léger quadrillage technique qui rappelle un
                dashboard de contrôle, estompé vers les bords pour ne jamais rivaliser
                avec les planètes ni la lisibilité du texte. */}
            <pattern id="hud-grid" width={56} height={56} patternUnits="userSpaceOnUse">
              <path d="M 56 0 L 0 0 0 56" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
            </pattern>
            <radialGradient id="hud-grid-fade" cx="50%" cy="42%" r="65%">
              <stop offset="0%" stopColor="#fff" stopOpacity={1} />
              <stop offset="70%" stopColor="#fff" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#fff" stopOpacity={0} />
            </radialGradient>
            <mask id="hud-grid-mask"><rect x={0} y={0} width={W} height={H} fill="url(#hud-grid-fade)" /></mask>

            {/* Planet skins by dominant asset type */}
            <radialGradient id="sph-skin-tech" cx="38%" cy="28%" r="60%"><stop offset="0%" stopColor="#baffee" /><stop offset="25%" stopColor="#2dd4c8" /><stop offset="55%" stopColor="#0e8a80" /><stop offset="80%" stopColor="#0a3a38" /><stop offset="100%" stopColor="#041816" /></radialGradient>
            <radialGradient id="sph-skin-crypto" cx="38%" cy="28%" r="60%"><stop offset="0%" stopColor="#f0c8ff" /><stop offset="25%" stopColor="#b060f0" /><stop offset="50%" stopColor="#7020b0" /><stop offset="75%" stopColor="#380860" /><stop offset="100%" stopColor="#140228" /></radialGradient>
            <radialGradient id="sph-skin-terrain" cx="38%" cy="28%" r="60%"><stop offset="0%" stopColor="#e8d0a0" /><stop offset="25%" stopColor="#b08858" /><stop offset="50%" stopColor="#7a5c38" /><stop offset="75%" stopColor="#42301c" /><stop offset="100%" stopColor="#1a1208" /></radialGradient>
            <radialGradient id="sph-skin-ocean" cx="38%" cy="28%" r="60%"><stop offset="0%" stopColor="#b8f0ff" /><stop offset="25%" stopColor="#38b8e0" /><stop offset="50%" stopColor="#1868a0" /><stop offset="75%" stopColor="#0c3860" /><stop offset="100%" stopColor="#041828" /></radialGradient>
            <radialGradient id="sph-skin-empty" cx="38%" cy="28%" r="60%"><stop offset="0%" stopColor="#d8d4e8" /><stop offset="30%" stopColor="#9a92b8" /><stop offset="60%" stopColor="#5c5478" /><stop offset="100%" stopColor="#201c30" /></radialGradient>
            <radialGradient id="glow-crypto" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#b060f0" stopOpacity={0.35} /><stop offset="60%" stopColor="#b060f0" stopOpacity={0.08} /><stop offset="100%" stopColor="#b060f0" stopOpacity={0} /></radialGradient>

            {/* Full-surface skin patterns — much more visible than the old subtle filters */}
            <pattern id="pat-tech" width="13" height="13" patternUnits="userSpaceOnUse">
              <path d="M0 6.5 H13 M6.5 0 V13" stroke="#5cfff0" strokeWidth="0.7" opacity="0.55" />
              <circle cx="6.5" cy="6.5" r="1.1" fill="#baffee" opacity="0.85" />
            </pattern>
            <pattern id="pat-terrain" width="17" height="17" patternUnits="userSpaceOnUse">
              <circle cx="4" cy="4" r="2.3" fill="#20130a" opacity="0.6" />
              <circle cx="12" cy="10" r="1.6" fill="#180d06" opacity="0.55" />
              <circle cx="7" cy="14" r="1.1" fill="#2a1c10" opacity="0.5" />
              <circle cx="14" cy="3" r="1" fill="#160b05" opacity="0.45" />
            </pattern>
            <pattern id="pat-ocean" width="22" height="11" patternUnits="userSpaceOnUse">
              <path d="M0 5.5 Q5.5 2 11 5.5 T22 5.5" stroke="#d0f7ff" strokeWidth="1" fill="none" opacity="0.45" />
            </pattern>
            <pattern id="pat-crypto" width="11" height="11" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="11" stroke="#e8c0ff" strokeWidth="1.6" opacity="0.4" />
            </pattern>
            <pattern id="pat-empty" width="19" height="19" patternUnits="userSpaceOnUse">
              <circle cx="5" cy="5" r="1.3" fill="#a8a2ba" opacity="0.4" />
              <circle cx="13" cy="12" r="0.9" fill="#8a84a0" opacity="0.35" />
            </pattern>

            {nodes.filter(n => ["portfolio", "member", "goal"].includes(n.kind)).map(n => {
              // Le halo est à la couleur de la personne, pas de la nature : c'est
              // le propriétaire qu'on cherche du regard, la nature est dans la légende.
              const halo = n.proprietaires?.[0]?.couleur ?? n.color;
              return <React.Fragment key={`sph-grp-${n.id}`}>
                <radialGradient id={`sph-${n.id}`} cx="38%" cy="28%" r="60%">
                  <stop offset="0%" stopColor={n.color} stopOpacity={1} />
                  <stop offset="25%" stopColor={n.color} stopOpacity={0.9} />
                  <stop offset="50%" stopColor={n.color} stopOpacity={0.6} />
                  <stop offset="75%" stopColor={n.color} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={n.color} stopOpacity={0.06} />
                </radialGradient>
                <radialGradient id={`atmo-${n.id}`} cx="50%" cy="50%" r="50%">
                  <stop offset="70%" stopColor={halo} stopOpacity={0} />
                  <stop offset="100%" stopColor={halo} stopOpacity={n.kind === "member" ? 0.12 : 0.3} />
                </radialGradient>
              </React.Fragment>;
            })}
          </defs>

          {/* Nébuleuse dérivante — profondeur derrière les planètes, mouvement à peine
              perceptible (comme les filtres de turbulence, en beaucoup plus lent).
              Une seule, discrète : deux halos superposés près du même coin (celui-ci
              + le dégradé CSS du fond) créaient une bande violette trop marquée en haut
              de l'écran sur les moniteurs larges et peu hauts. */}
          <g opacity={0.35}>
            <ellipse cx={W * 0.8} cy={H * 0.72} rx={220} ry={170} fill="url(#glow-crypto)" opacity={0.28} />
          </g>
          {/* Quadrillage HUD, estompé vers les bords */}
          <rect x={0} y={0} width={W} height={H} fill="url(#hud-grid)" mask="url(#hud-grid-mask)" opacity={0.6} pointerEvents="none" />
          {/* Fond étoilé — 180 points fixes (seedés, stables entre rendus serveur/client),
              8 d'entre eux scintillent doucement */}
          {STARS.map((s, i) => i < 8
            ? <circle key={`s${i}`} cx={s.x} cy={s.y} r={s.r} fill="#fff" className="g-twinkle"
                style={{ "--g-op-min": s.op * 0.65, "--g-op-max": s.op, animationDelay: `${i * 0.6}s` } as React.CSSProperties} />
            : <circle key={`s${i}`} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={s.op} />)}
          <circle cx={CX} cy={CY} r={200} fill="none" stroke="rgba(255,255,255,0.03)" strokeDasharray="4 12" />
          <circle cx={CX} cy={CY} r={350} fill="none" stroke="rgba(255,255,255,0.02)" strokeDasharray="4 16" />

          <g ref={rootRef}>
            {links.map(l => {
              const s = nodeById.get(l.source), tg = nodeById.get(l.target);
              if (!s || !tg || s.x == null || tg.x == null) return null;
              const seed = hashSeed(s.id, tg.id), c = curveControl({ x: s.x!, y: s.y! }, { x: tg.x!, y: tg.y! }, seed);
              const isOwnershipLink = (s.kind === "member" || s.kind === "center") && (tg.kind === "portfolio" || tg.kind === "goal" || tg.kind === "member" || tg.kind === "member-salary");
              // Ownership links are drawn later, in their own top-layer pass after all node
              // circles, so a nearby planet can never visually cover them — skip them here.
              if (isOwnershipLink) return null;
              const isItemNode = tg.kind === "expense-item" || tg.kind === "income-item";
              return <path key={`ln-${s.id}-${tg.id}`} d={`M ${s.x} ${s.y} Q ${c.x} ${c.y} ${tg.x} ${tg.y}`} fill="none" stroke={tg.color} strokeOpacity={isItemNode ? 0.1 : 0.22} strokeWidth={isItemNode ? 0.5 : 1} strokeDasharray={tg.kind === "goal" ? "4 5" : undefined} />;
            })}
            {flowLinks.map((f, i) => {
              const s = nodeById.get(f.source), tg = nodeById.get(f.target);
              if (!s || !tg || s.x == null || tg.x == null) return null;
              const seed = hashSeed(f.source, f.target), c = curveControl({ x: s.x!, y: s.y! }, { x: tg.x!, y: tg.y! }, seed);
              // Tous les montants écrits au milieu de leur courbe se rassemblaient
              // au même endroit quand plusieurs flux partent de la même source :
              // « 100 € », « 50 € » et « dans 19j » s'empilaient par-dessus la
              // personne. On les échelonne le long de la courbe, à un point
              // stable pour un flux donné.
              const t = 0.32 + ((seed >>> 0) % 7) * 0.06;
              const mid = bezierPoint({ x: s.x!, y: s.y! }, c, { x: tg.x!, y: tg.y! }, t);
              return <g key={`fl-${i}`}>
                <path d={`M ${s.x} ${s.y} Q ${c.x} ${c.y} ${tg.x} ${tg.y}`} fill="none" stroke={f.couleur} strokeOpacity={0.55} strokeWidth={1.5} strokeDasharray="6 4" />
                <text x={mid.x} y={mid.y - 12} textAnchor="middle" fontSize={10} fill={f.couleur} fontWeight={700} style={HALO_TEXTE}>{mask(f.label)}</text>
                {showCountdown && f.days !== undefined && !Number.isNaN(f.days) && (
                  <text x={mid.x} y={mid.y + 2} textAnchor="middle" fontSize={8} fill="#fbbf24" opacity={0.85} fontWeight={600}>
                    {f.days === 0 ? "aujourd'hui" : `dans ${f.days}j`}
                  </text>
                )}
              </g>;
            })}
            <TravelingMarkers
              flowLinks={flowLinks} links={links} goalLinkEdges={goalLinkEdges}
              nodeById={nodeById} totalRevenue={totalRevenue} centerColor={centerColor}
            />

            {/* Tracés objectif ↔ planète (le point qui les parcourt est dans TravelingMarkers) */}
            {goalLinkEdges.map((l, i) => {
              const s = nodeById.get(l.source), tg = nodeById.get(l.target);
              if (!s || !tg || s.x == null || tg.x == null) return null;
              const seed = hashSeed(l.source, l.target), c = curveControl({ x: s.x!, y: s.y! }, { x: tg.x!, y: tg.y! }, seed);
              return <path key={`gl-${i}`} d={`M ${s.x} ${s.y} Q ${c.x} ${c.y} ${tg.x} ${tg.y}`} fill="none" stroke="#34d399" strokeOpacity={0.4} strokeWidth={1.4} />;
            })}

            {/* Link mode source highlight */}
            {linkSourceNode && (() => { const tg = nodeById.get(linkSourceNode.id); if (!tg || tg.x == null) return null; return <circle cx={tg.x} cy={tg.y} r={tg.r + 10} fill="none" stroke="#34d399" strokeWidth={2} strokeDasharray="3 4" className="pulse-ring" style={{ transformOrigin: `${tg.x}px ${tg.y}px` }} />; })()}

            {/* Owner mode source highlight */}
            {ownerSourceNode && (() => { const tg = nodeById.get(ownerSourceNode.id); if (!tg || tg.x == null) return null; return <circle cx={tg.x} cy={tg.y} r={tg.r + 10} fill="none" stroke={centerColor} strokeWidth={2} strokeDasharray="3 4" className="pulse-ring" style={{ transformOrigin: `${tg.x}px ${tg.y}px` }} />; })()}

            {/* Magnetic snap halo */}
            {snapTarget && (() => { const tg = nodeById.get(snapTarget); if (!tg || tg.x == null) return null; return <g><circle cx={tg.x} cy={tg.y} r={tg.r + 20} fill="none" stroke="#9585ff" strokeOpacity={0.6} strokeWidth={2.5} strokeDasharray="4 3" className="pulse-ring pulse-ring-fast" style={{ transformOrigin: `${tg.x}px ${tg.y}px` }} /><circle cx={tg.x} cy={tg.y} r={tg.r + 12} fill="rgba(149,133,255,0.06)" /></g>; })()}

            {/* Nodes */}
            {nodes.map(n => {
              if (n.x == null || n.y == null) return null;
              const isExp = n.kind === "portfolio" && n.portfolioKey !== undefined && expanded.has(n.portfolioKey);
              const gp = n.kind === "goal" && n.goalId != null ? (() => { const goal = goals.find(g => g.id === n.goalId); return goal ? progressOf(goal) : null; })() : null;
              const ts = { textShadow: "0 1px 3px rgba(0,0,0,0.95), 0 0 8px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,1)" } as const;
              const isHoveredNode = hoveredId === n.id;
              const cote = coteEtiquette(layoutMode, n.x);

              return <g key={n.id} className="nd" data-node-id={n.id} data-kind={n.kind} transform={`translate(${n.x},${n.y}) scale(${isHoveredNode ? 1.08 : 1})`} style={{ cursor: "pointer", transition: "transform 0.15s ease-out" }}
                onPointerDown={onNodeDown(n.id)} onClick={e => { e.stopPropagation(); handleClick(n, e as unknown as React.MouseEvent); }}
                onPointerEnter={() => setHoveredId(n.id)} onPointerLeave={() => setHoveredId(id => id === n.id ? null : id)}>

                {n.kind === "center" && (() => {
                  const R = n.r;
                  const bob = 0; // la respiration est désormais une animation CSS (.g-bob)
                  return <>
                    <circle r={R + 25} fill="url(#glow-center)" />
                    <circle r={R} fill="url(#sph-center)" filter="url(#glow-strong)" />
                    <circle r={R} fill="url(#sph-hl)" />

                    {/* ── Little astronaut standing on top ── */}
                    <g className="g-bob-t" style={{ ["--g-y" as string]: `${-R - 16 + bob}px` }}>
                      {/* Legs */}
                      <line x1={-2.5} y1={8} x2={-3} y2={14} stroke="#e8e8ee" strokeWidth={2.2} strokeLinecap="round" />
                      <line x1={2.5} y1={8} x2={3} y2={14} stroke="#e8e8ee" strokeWidth={2.2} strokeLinecap="round" />
                      {/* Body */}
                      <rect x={-4} y={-2} width={8} height={11} rx={3} fill="#f0f0f5" stroke="#c8c8d5" strokeWidth={0.5} />
                      {/* Backpack */}
                      <rect x={-5.5} y={0} width={2.5} height={7} rx={1} fill="#b8b8c8" />
                      {/* Arms (crossed pose) */}
                      <line x1={-4} y1={2} x2={2} y2={4.5} stroke="#e8e8ee" strokeWidth={2} strokeLinecap="round" />
                      <line x1={4} y1={2} x2={-2} y2={4.5} stroke="#e8e8ee" strokeWidth={2} strokeLinecap="round" />
                      {/* Helmet */}
                      <circle cy={-6} r={5} fill="#f5f5fa" stroke="#c8c8d5" strokeWidth={0.6} />
                      {/* Visor */}
                      <ellipse cx={0.5} cy={-6} rx={3.2} ry={2.8} fill="#2a3550" />
                      <ellipse cx={-0.5} cy={-7} rx={1} ry={0.7} fill="rgba(255,255,255,0.5)" />
                      {/* Antenna */}
                      <line x1={0} y1={-11} x2={0} y2={-13.5} stroke="#c8c8d5" strokeWidth={0.7} />
                      <circle cy={-14} r={0.9} fill="#ff5555" className="g-blink-fast" />
                    </g>

                    <text y={-3} textAnchor="middle" fontSize={12} fontWeight={600} fill="#fff" style={ts}>{scrubYears > 0 ? `Patrimoine en ${scrubYear}` : "Patrimoine"}</text>
                    <text y={13} textAnchor="middle" fontSize={10} fill={scrubYears > 0 ? "#9585ff" : "rgba(255,230,160,0.9)"} fontWeight={scrubYears > 0 ? 600 : 400}>{mask(fmt(scrubProjectedTotal))}{scrubYears > 0 ? " (projection)" : ""}</text>
                  </>;
                })()}

                {n.kind === "salary" && (() => { const salImg = salaryImage(n.amount ?? 0); return <>
                  <clipPath id={`cp-${n.id}`}><circle r={n.r} /></clipPath>
                  <circle r={n.r + 3} fill="none" stroke="rgba(100,255,150,0.08)" />
                  {salImg ? (
                    <g clipPath={`url(#cp-${n.id})`}><image href={salImg} x={-n.r} y={-n.r} width={n.r * 2} height={n.r * 2} preserveAspectRatio="xMidYMid slice" /></g>
                  ) : <>
                    <circle r={n.r} fill="url(#sph-salary)" />
                    <g clipPath={`url(#cp-${n.id})`}><circle r={n.r} fill="url(#sph-salary)" /><circle r={n.r} fill="url(#salary-land)" /></g>
                    <g clipPath="url(#clip-sal)">{Array.from({ length: 18 }, (_, i) => <line key={i} x1={-n.r + 3 + i * 3.5} y1={n.r - 1} x2={-n.r + 3 + i * 3.5 + (i % 2 ? 1 : -1)} y2={n.r - 1 - (3 + (i * 7 % 7))} stroke="#30e060" strokeWidth={1.3} strokeLinecap="round" opacity={0.4 + (i % 3) * 0.2} />)}</g>
                  </>}
                  <circle r={n.r} fill="url(#sph-hl)" stroke="rgba(0,0,0,0.4)" strokeWidth={1} />
                  <AnneauProprietaires r={n.r} proprietaires={n.proprietaires} />
                  <EtiquettePlanete r={n.r + 3} cote={cote} titre="Revenus" sous={n.sub && `${mask(n.sub)}/mois`} couleurSous="#6ee7b7" />
                  <g transform={positionBouton(n.r, cote)} style={{ cursor: "pointer" }}
                    onPointerDown={e => e.stopPropagation()}
                    onClick={e => { e.stopPropagation(); setSelected(null); setCreateMode("income"); }}>
                    <circle r={11} fill="#12121a" stroke="#34d399" strokeWidth={1.2} />
                    <Plus x={-6} y={-6} size={12} color="#6ee7b7" />
                  </g>
                </>; })()}

                {n.kind === "income-item" && <><circle r={n.r} fill="rgba(52,211,153,0.1)" stroke="rgba(52,211,153,0.25)" strokeWidth={0.5} /><text y={-1} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.7)">{n.label.length > 10 ? n.label.slice(0, 9) + "…" : n.label}</text><text y={8} textAnchor="middle" fontSize={7} fill="rgba(52,211,153,0.85)">{n.sub && mask(n.sub)}</text></>}

                {n.kind === "expenses" && (() => {
                  const R = n.r;
                  const ownerExpenseTotal = n.ownerExpenseTotal ?? 0;
                  const ownerRevenue = n.ownerRevenue ?? 0;
                  const ownerBudgetRatio = ownerRevenue > 0 ? ownerExpenseTotal / ownerRevenue : 0;
                  const tier = palierDepenses(ownerExpenseTotal, ownerRevenue);
                  const tierImage = tier !== "calm" ? EXPENSES_IMAGES[tier] : null;
                  const isOverBudget = tier === "eruption" || tier === "critical";
                  return <>
                    {/* Heat glow */}
                    {tier === "critical" && <circle r={R + 26} fill="url(#glow-lava)" className="g-anim g-pulse-fast" />}
                    {tier === "eruption" && <circle r={R + 18} fill="url(#glow-lava)" opacity={0.8} className="g-anim g-pulse-fast" />}
                    {tier === "warning" && <circle r={R + 10} fill="url(#glow-lava)" opacity={0.4} />}
                    {/* Planet body */}
                    <clipPath id={`cp-${n.id}`}><circle r={R} /></clipPath>
                    {tierImage ? (
                      <g clipPath={`url(#cp-${n.id})`}><image href={tierImage} x={-R} y={-R} width={R * 2} height={R * 2} preserveAspectRatio="xMidYMid slice" /></g>
                    ) : <circle r={R} fill="url(#sph-expenses)" />}
                    <circle r={R} fill="url(#sph-hl)" stroke="rgba(0,0,0,0.4)" strokeWidth={1} />
                    <AnneauProprietaires r={R} proprietaires={n.proprietaires} />

                    {/* ── ERUPTION: fire particles (eruption/critical only) ── */}
                    {isOverBudget && Array.from({ length: tier === "critical" ? 16 : 12 }, (_, i) => {
                      const ang = -Math.PI / 2 + (Math.sin(i * 7.3) * 0.9);
                      const cols = ["#ff6600", "#ff4400", "#ffaa00", "#ff2200"];
                      return <circle key={`fire-${i}`} cx={Math.cos(ang) * R} cy={Math.sin(ang) * R} r={3.5} fill={cols[i % 4]}
                        className="g-ember" style={{
                          ["--g-dx" as string]: `${Math.cos(ang) * 45}px`,
                          ["--g-dy" as string]: `${Math.sin(ang) * 45 - 15}px`,
                          animationDelay: `${-i * 0.35}s`,
                        }} />;
                    })}
                    {/* Smoke plumes */}
                    {isOverBudget && Array.from({ length: tier === "critical" ? 9 : 6 }, (_, i) => {
                      return <circle key={`smoke-${i}`} cx={0} cy={-R} r={9} fill="#555"
                        className="g-smoke" style={{
                          ["--g-dx" as string]: `${Math.sin(i * 2) * 10}px`,
                          ["--g-dy" as string]: "-55px",
                          animationDelay: `${-i * 0.5}s`,
                        }} />;
                    })}
                    {/* Lava projections (arcs) */}
                    {isOverBudget && Array.from({ length: 4 }, (_, i) => {
                      const dir = i % 2 === 0 ? 1 : -1;
                      return <circle key={`proj-${i}`} cx={0} cy={-R * 0.7} r={1.6} fill="#ff5500"
                        className="g-arc" style={{
                          ["--g-dx" as string]: `${dir * 35}px`,
                          animationDelay: `${-i * 0.42}s`,
                        }} />;
                    })}
                    {overdueCount > 0 && n.memberId == null && (
                      <g transform={`translate(${R * 0.72},${-R * 0.72})`} style={{ cursor: "pointer" }}
                        onPointerDown={e => e.stopPropagation()}
                        onClick={e => { e.stopPropagation(); onOpenReview(); }}>
                        <title>{`${overdueCount} mouvement${overdueCount > 1 ? "s" : ""} à vérifier`}</title>
                        <circle r={10} fill="#fbbf24" className="g-anim g-pulse" />
                        <circle r={10} fill="#fbbf24" />
                        <text y={3.5} textAnchor="middle" fontSize={11} fontWeight={700} fill="#1a1400">
                          {overdueCount > 9 ? "9+" : overdueCount}
                        </text>
                      </g>
                    )}
                    <g className={isOverBudget ? "g-anim g-shake" : undefined}>
                      <EtiquettePlanete r={R + 3} cote={cote} titre={n.label} sous={`${mask(ownerExpenseTotal > 0 ? fmt(ownerExpenseTotal) : "0 €")}/mois`}
                        couleurSous={isOverBudget ? "#ffaa70" : tier === "warning" ? "#ffd280" : undefined}
                        lignes={[
                          ...(ownerRevenue > 0 ? [{ texte: `${Math.round(ownerBudgetRatio * 100)} % des revenus`, couleur: tier === "critical" ? "#ff4a30" : tier === "eruption" ? "#ff6b35" : "#ffb84d" }] : []),
                          ...(tier === "critical" ? [{ texte: "DÉFICIT CRITIQUE", couleur: "#ff4a30", className: "g-blink-fast" }] : []),
                          ...(tier === "eruption" ? [{ texte: "DÉFICIT", couleur: "#ff6b35", className: "g-blink" }] : []),
                        ]} />
                    </g>
                    <g transform={positionBouton(R, cote)} style={{ cursor: "pointer" }}
                      onPointerDown={e => e.stopPropagation()}
                      onClick={e => { e.stopPropagation(); setExpenseMemberId(n.memberId ?? null); setCreateMode("expense"); }}>
                      <circle r={11} fill="#12121a" stroke="#f87171" strokeWidth={1.2} />
                      <Plus x={-6} y={-6} size={12} color="#fca5a5" />
                    </g>
                  </>;
                })()}

                {n.kind === "expense-item" && <><circle r={n.r} fill="rgba(248,113,113,0.1)" stroke="rgba(248,113,113,0.2)" strokeWidth={0.5} /><text y={-1} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.65)">{n.label.length > 10 ? n.label.slice(0, 9) + "…" : n.label}</text><text y={8} textAnchor="middle" fontSize={7} fill="rgba(248,113,113,0.75)">{n.sub && mask(n.sub)}</text></>}

                {n.kind === "reste" && <><circle r={n.r} fill="url(#sph-reste)" /><circle r={n.r} fill="url(#sph-hl)" /><text y={-4} textAnchor="middle" fontSize={10} fontWeight={500} fill="#e0d8ff">Reste</text><text y={9} textAnchor="middle" fontSize={9} fill="rgba(200,185,255,0.8)">{mask(fmt(resteAInvestir))}/m</text></>}

                {n.kind === "portfolio" && (() => {
                  const skin = n.skin ?? "generic";
                  const imageHref = skinImageForValue(skin, n.r - 20, 58);
                  const skinFill = skin === "generic" ? `url(#sph-${n.id})` : `url(#sph-skin-${skin})`;
                  return <>
                    {isExp && <ellipse rx={n.r + 42} ry={(n.r + 42) * 0.55} fill="none" stroke={n.color} strokeOpacity={0.18} strokeWidth={1} strokeDasharray="2 7" />}
                    {/* Simulateur "avance rapide" : anneau fantôme + opacité réduite pour
                        qu'une planète en projection ne soit jamais confondue avec son état
                        réel actuel — la taille bouge, mais l'habillage reste clairement
                        "hypothétique" tant que le curseur temporel n'est pas revenu à zéro. */}
                    {n.isProjected && <circle r={n.r + 14} fill="none" stroke="#9585ff" strokeOpacity={0.35} strokeWidth={1.5} strokeDasharray="1 5" className="spin-ring" />}
                    <g opacity={n.isProjected ? 0.72 : 1}>
                    <clipPath id={`cp-${n.id}`}><circle r={n.r} /></clipPath>
                    <circle r={n.r + 12} fill={`url(#atmo-${n.id})`} />
                    {/* Anneau(x) d'objectif — un anneau par objectif lié à cette planète,
                        concentriques si plusieurs (le plus avancé à l'intérieur). Les
                        objectifs restent aussi des satellites cliquables à part entière
                        (utile quand un même objectif est réparti sur plusieurs planètes, ou
                        alimenté par un flux dédié) — ces anneaux ne sont qu'un raccourci
                        visuel en plus, jamais la seule source de vérité. */}
                    {skin === "crypto" && !imageHref && <circle r={n.r + 14} fill="url(#glow-crypto)" className="g-anim g-pulse" />}

                    {imageHref ? (
                      <g clipPath={`url(#cp-${n.id})`}>
                        <image href={imageHref} x={-n.r} y={-n.r} width={n.r * 2} height={n.r * 2} preserveAspectRatio="xMidYMid slice" />
                      </g>
                    ) : <>
                      <circle r={n.r} fill={skinFill} />
                      <g clipPath={`url(#cp-${n.id})`}>
                        <circle r={n.r} fill={skinFill} opacity={0.65} />
                        {skin !== "generic" && <circle r={n.r} fill={`url(#pat-${skin})`} />}

                        {skin === "ocean" && <>
                          {[0.22, 0.5, 0.78].map((ry, i) => (
                            <ellipse key={`wave-${i}`} className="g-anim g-wave" style={{ animationDelay: `${-i * 3.3}s` }} cx={0} cy={n.r * (ry - 0.5) * 1.5} rx={n.r * 1.05} ry={2.5 + i * 0.8} fill="#d0f7ff" opacity={0.16 + (i === 1 ? 0.1 : 0)} />
                          ))}
                          <ellipse cx={-n.r * 0.32} cy={n.r * 0.2} rx={n.r * 0.24} ry={n.r * 0.11} fill="#245a34" opacity={0.65} />
                          <ellipse cx={-n.r * 0.32} cy={n.r * 0.14} rx={n.r * 0.1} ry={n.r * 0.05} fill="#3a8a4c" opacity={0.5} />
                        </>}

                        {skin === "terrain" && [[-0.32, -0.22, 0.15], [0.26, 0.12, 0.11], [0.02, 0.38, 0.09]].map((c, i) => (
                          <ellipse key={`cr-${i}`} cx={c[0] * n.r} cy={c[1] * n.r} rx={c[2] * n.r} ry={c[2] * n.r * 0.6} fill="#241608" opacity={0.45} />
                        ))}

                        {skin === "crypto" && Array.from({ length: 6 }, (_, i) => {
                          const ang = (i / 6) * Math.PI * 2;
                          const pulse = 0.5;
                          return <line key={`ve-${i}`} x1={0} y1={0} x2={Math.cos(ang) * n.r * 0.95} y2={Math.sin(ang) * n.r * 0.95} className="g-blink" style={{ animationDelay: `${i * 0.26}s` }} stroke="#e8c0ff" strokeWidth={0.7 + pulse * 0.9} opacity={0.25 + pulse * 0.45} />;
                        })}
                      </g>

                      {skin === "empty" && <g className="g-anim g-spin-slow">{Array.from({ length: 3 }, (_, i) => {
                        const ang = (i / 3) * Math.PI * 2;
                        const rr = n.r + 15;
                        return <circle key={`rock-${i}`} cx={Math.cos(ang) * rr} cy={Math.sin(ang) * rr * 0.55} r={1.6 + i * 0.6} fill="#8a84a0" opacity={0.55} />;
                      })}</g>}
                    </>}

                    {skin === "tech" && !imageHref && <>
                      <g className="g-anim g-spin-med">{Array.from({ length: 5 }, (_, i) => {
                        const ang = (i / 5) * Math.PI * 2;
                        return <line key={`tc-${i}`} x1={Math.cos(ang) * n.r * 0.12} y1={Math.sin(ang) * n.r * 0.12} x2={Math.cos(ang) * n.r * 0.92} y2={Math.sin(ang) * n.r * 0.92} stroke="#5cfff0" strokeWidth={0.6} className="g-blink" style={{ animationDelay: `${-i * 0.31}s` }} clipPath={`url(#cp-${n.id})`} />;
                      })}</g>
                      <g className="g-anim g-spin-rev">{Array.from({ length: 4 }, (_, i) => {
                        const ang = (i / 4) * Math.PI * 2;
                        return <circle key={`td-${i}`} cx={Math.cos(ang) * n.r * 0.55} cy={Math.sin(ang) * n.r * 0.55} r={1.5} fill="#baffee" className="g-blink" style={{ animationDelay: `${-i * 0.4}s` }} clipPath={`url(#cp-${n.id})`} />;
                      })}</g>
                      <ellipse rx={n.r * 1.38} ry={n.r * 0.3} fill="none" stroke="#5cfff0" strokeOpacity={0.3} strokeWidth={1} className="g-anim g-spin-ring" />
                    </>}

                    <circle r={n.r} fill="url(#sph-hl)" stroke="rgba(0,0,0,0.4)" strokeWidth={1} />
                    <AnneauProprietaires r={n.r} proprietaires={n.proprietaires} epaisseur={isExp ? 3.5 : 2.5} />
                    <EtiquettePlanete r={n.r + 3} cote={cote} titre={n.label} sous={n.sub && mask(n.sub)} couleurSous={n.isProjected ? "#c8bfff" : undefined}
                      lignes={[
                        ...(n.isProjected ? [{ texte: `projection ${scrubYear}`, couleur: "#b8a5ff" }] : []),
                        ...(!n.isProjected && (n.gainVal ?? 0) !== 0 ? [{ texte: mask(`${(n.gainVal ?? 0) >= 0 ? "+" : ""}${fmt(n.gainVal ?? 0)}`), couleur: (n.gainVal ?? 0) >= 0 ? "#34d399" : "#fb7185" }] : []),
                        ...((n.proprietaires?.length ?? 0) > 1 ? [{ texte: n.proprietaires!.map(p => `${p.nom} ${Math.round(p.part * 100)} %`).join(" · "), couleur: "rgba(255,255,255,0.75)" }] : []),
                      ]} />
                    </g>
                    {selected?.kind === "portfolio" && selected.id === n.portfolioKey && (
                      <g transform={positionBouton(n.r, cote)} style={{ cursor: "pointer" }}
                        onPointerDown={e => e.stopPropagation()}
                        onClick={e => { e.stopPropagation(); setCreateMode("asset"); }}>
                        <circle r={11} fill="#12121a" stroke="#9585ff" strokeWidth={1.2} />
                        <Plus x={-6} y={-6} size={12} color="#b8a5ff" />
                      </g>
                    )}
                  </>;
                })()}

                {n.kind === "goal" && (() => {
                  const isVacation = isVacationGoal(n.label);
                  return <>
                    <clipPath id={`cp-${n.id}`}><circle r={n.r} /></clipPath>
                    <circle r={n.r + 12} fill={`url(#atmo-${n.id})`} />
                    {isVacation ? (
                      <g clipPath={`url(#cp-${n.id})`}><image href={VACANCES_IMAGE} x={-n.r} y={-n.r} width={n.r * 2} height={n.r * 2} preserveAspectRatio="xMidYMid slice" /></g>
                    ) : <>
                      <circle r={n.r} fill={`url(#sph-${n.id})`} />
                      <g clipPath={`url(#cp-${n.id})`}><circle r={n.r} fill={`url(#sph-${n.id})`} opacity={0.6} /></g>
                    </>}
                    <circle r={n.r} fill="url(#sph-hl)" stroke="rgba(0,0,0,0.4)" strokeWidth={1} />
                    <AnneauProprietaires r={n.r} proprietaires={n.proprietaires} />
                    {(gp ?? 0) >= 1 && <circle r={n.r + 10} fill="none" stroke="#34d399" strokeOpacity={0.6} strokeWidth={1.5} strokeDasharray="3 3" />}
                    <EtiquettePlanete r={n.r + 3} cote={cote} titre={n.label.length > 18 ? n.label.slice(0, 17) + "…" : n.label} sous={n.sub && `${n.sub} atteint`} couleurSous={(gp ?? 0) >= 1 ? "#6ee7b7" : undefined} />
                  </>;
                })()}

                {/* Le pourcentage de progression d'un objectif n'est pas un montant à masquer. */}

                {n.kind === "asset" && (() => {
                  const isPos = (n.gainVal ?? 0) >= 0;
                  const isCracked = (n.gainPct ?? 0) <= -20;
                  const hasLogo = !!n.logoUrl && !isCracked && !logoErrors.has(n.id);
                  const logoR = Math.max(8, n.r - 4);
                  // ── Calendrier de dividendes : pluie de particules dorées si un versement
                  // (réel ou estimé) tombe dans les 7 jours ; sinon un petit badge discret
                  // si un versement est estimé dans les 30 prochains jours.
                  const assetRow = n.assetId != null ? assets.find(a => a.id === n.assetId) : undefined;
                  const divInfo = assetRow?.ticker ? dividends[assetRow.ticker] : null;
                  const DAY_MS = 86_400_000;
                  const nearDividend = divInfo
                    ? [...divInfo.received, ...divInfo.projected].some(e => Math.abs(new Date(e.date).getTime() - nowMs) <= 7 * DAY_MS)
                    : false;
                  const nextUpcoming = divInfo
                    ? [...divInfo.projected].filter(e => new Date(e.date).getTime() >= nowMs).sort((a, b) => a.date.localeCompare(b.date))[0]
                    : undefined;
                  return <>
                    {isCracked ? <>
                      <circle r={n.r} fill="rgba(120,116,130,0.14)" stroke="rgba(180,175,190,0.4)" strokeWidth={0.8} />
                      {[[-0.6, -0.8, 0.1, 0.2], [0.3, -0.9, -0.2, 0.5], [-0.4, 0.3, 0.5, 0.9]].map((c, i) => (
                        <line key={`crack-${n.id}-${i}`} x1={c[0] * n.r} y1={c[1] * n.r} x2={c[2] * n.r} y2={c[3] * n.r} stroke="rgba(200,195,210,0.5)" strokeWidth={0.7} />
                      ))}
                    </> : <circle r={n.r} fill={isPos ? "rgba(52,211,153,0.06)" : "rgba(251,113,133,0.06)"} stroke={isPos ? "rgba(52,211,153,0.25)" : "rgba(251,113,133,0.25)"} strokeWidth={0.6} />}
                    {hasLogo && <>
                      {/* Fond clair discret derrière le logo : beaucoup de favicons ont une icône
                          sombre ou semi-transparente qui disparaîtrait sinon sur le satellite. */}
                      <circle cy={-logoR * 0.2} r={logoR * 0.58} fill="rgba(255,255,255,0.92)" />
                      <clipPath id={`logo-${n.id}`}><circle cy={-logoR * 0.2} r={logoR * 0.55} /></clipPath>
                      <image href={n.logoUrl!} x={-logoR * 0.55} y={-logoR * 0.75} width={logoR * 1.1} height={logoR * 1.1} clipPath={`url(#logo-${n.id})`} style={{ opacity: 0.95 }}
                        onError={() => setLogoErrors(prev => prev.has(n.id) ? prev : new Set(prev).add(n.id))} />
                      <circle cy={-logoR * 0.2} r={logoR * 0.55} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={0.6} />
                    </>}
                    <text y={hasLogo ? n.r * 0.55 : -3} textAnchor="middle" fontSize={hasLogo ? 7.5 : 9} fontWeight={500} fill={isCracked ? "#c8c4d2" : "#d8d8dc"}>{n.label.length > 11 ? n.label.slice(0, 10) + "…" : n.label}</text>
                    {n.gainVal !== undefined && <text y={hasLogo ? n.r * 0.55 + 10 : 8} textAnchor="middle" fontSize={hasLogo ? 7 : 8} fill={isCracked ? "#fb7185" : n.gainVal >= 0 ? "#34d399" : "#fb7185"} fontWeight={isCracked ? 700 : 400}>{mask(`${n.gainVal >= 0 ? "+" : ""}${fmt(n.gainVal)}`)}</text>}
                    {n.gainVal === undefined && <text y={hasLogo ? n.r * 0.55 + 10 : 8} textAnchor="middle" fontSize={hasLogo ? 7 : 8} fill="rgba(255,255,255,0.5)">{n.sub && mask(n.sub)}</text>}
                    {nearDividend && Array.from({ length: 5 }, (_, i) => {
                      const px = Math.sin(i * 13.7) * n.r * 0.7;
                      return <circle key={`div-${n.id}-${i}`} cx={px} cy={-n.r * 1.7} r={1.3} fill="#ffd76a"
                        className="g-spark" style={{
                          ["--g-dy" as string]: `${n.r * 3.4}px`,
                          filter: "drop-shadow(0 0 3px #ffcf4a)",
                          animationDelay: `${-i * 0.82}s`,
                        }} />;
                    })}
                    {!nearDividend && nextUpcoming && (
                      <circle cx={n.r * 0.7} cy={-n.r * 0.7} r={3.5} fill="#12121a" stroke="#ffd76a" strokeWidth={1} opacity={0.85}>
                        <title>{`Prochain dividende estimé le ${nextUpcoming.date}`}</title>
                      </circle>
                    )}
                  </>;
                })()}

                {n.kind === "member" && (() => {
                  const bob = 0; // idem (.g-bob-slow-t)
                  const accessory = findAccessory(n.accessory);
                  return <>
                    <circle r={n.r} fill={`url(#sph-${n.id})`} />
                    <circle r={n.r} fill="url(#sph-hl)" />
                    <g className="g-bob-slow-t" style={{ ["--g-y" as string]: `${-n.r - 13 + bob}px` }}>
                      <line x1={-2.2} y1={7} x2={-2.6} y2={12} stroke="#e8e8ee" strokeWidth={2} strokeLinecap="round" />
                      <line x1={2.2} y1={7} x2={2.6} y2={12} stroke="#e8e8ee" strokeWidth={2} strokeLinecap="round" />
                      <rect x={-3.4} y={-2} width={6.8} height={9.5} rx={2.6} fill="#f0f0f5" stroke={n.color} strokeWidth={0.7} />
                      <line x1={-3.4} y1={1.5} x2={2} y2={3.5} stroke="#e8e8ee" strokeWidth={1.7} strokeLinecap="round" />
                      <line x1={3.4} y1={1.5} x2={-2} y2={3.5} stroke="#e8e8ee" strokeWidth={1.7} strokeLinecap="round" />
                      <circle cy={-5.2} r={4.3} fill="#f5f5fa" stroke={n.color} strokeWidth={0.6} />
                      <ellipse cx={0.4} cy={-5.2} rx={2.7} ry={2.4} fill="#2a3550" />
                      <ellipse cx={-0.4} cy={-6} rx={0.8} ry={0.6} fill="rgba(255,255,255,0.5)" />
                      {/* Accessoire cosmétique du petit astronaute — un badge sur la poitrine */}
                      {accessory && <accessory.Icon x={-3.2} y={0.5} size={6.4} color={accessory.color} strokeWidth={2.5} fill={accessory.id === "flag" || accessory.id === "rocket" ? "none" : accessory.color} />}
                    </g>
                    <text y={4} textAnchor="middle" fontSize={10} fontWeight={500} fill="#fff" style={ts}>{n.label}</text>
                    {n.sub && <text y={16} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.75)" style={ts}>{mask(n.sub)}</text>}
                  </>;
                })()}

                {n.kind === "member-salary" && (() => { const salImg = salaryImage(n.amount ?? 0); return <>
                  <clipPath id={`cp-${n.id}`}><circle r={n.r} /></clipPath>
                  <circle r={n.r + 3} fill="none" stroke="rgba(100,255,150,0.08)" />
                  {salImg ? (
                    <g clipPath={`url(#cp-${n.id})`}><image href={salImg} x={-n.r} y={-n.r} width={n.r * 2} height={n.r * 2} preserveAspectRatio="xMidYMid slice" /></g>
                  ) : <circle r={n.r} fill="url(#sph-salary)" />}
                  <circle r={n.r} fill="url(#sph-hl)" stroke="rgba(0,0,0,0.4)" strokeWidth={1} />
                  <AnneauProprietaires r={n.r} proprietaires={n.proprietaires} />
                  <EtiquettePlanete r={n.r + 3} cote={cote} titre={n.label} sous={n.sub && `${mask(n.sub)}/mois`} couleurSous="#6ee7b7" />
                </>; })()}
              </g>;
            })}

            {/* Ownership links, drawn last so no planet circle can ever cover them.
                Soft glow (real feMerge-based blur, not the broken pure-blur "gl" filter)
                behind a thin dotted core reads as a gentle starlight thread instead of a
                flat bold line. */}
            {links.map(l => {
              const s = nodeById.get(l.source), tg = nodeById.get(l.target);
              if (!s || !tg || s.x == null || tg.x == null) return null;
              const isOwnershipLink = (s.kind === "member" || s.kind === "center") && (tg.kind === "portfolio" || tg.kind === "goal" || tg.kind === "member" || tg.kind === "member-salary");
              if (!isOwnershipLink) return null;
              const seed = hashSeed(s.id, tg.id), c = curveControl({ x: s.x!, y: s.y! }, { x: tg.x!, y: tg.y! }, seed);
              const ownerColor = s.kind === "center" ? centerColor : s.color;
              const isHovered = hoveredId === s.id || hoveredId === tg.id;
              const d = `M ${s.x} ${s.y} Q ${c.x} ${c.y} ${tg.x} ${tg.y}`;
              const dash = tg.kind === "goal" ? "1 6" : "1.5 4.5";
              return <g key={`own-${s.id}-${tg.id}`} pointerEvents="none">
                <path d={d} fill="none" stroke={ownerColor} strokeOpacity={isHovered ? 0.4 : 0.22} strokeWidth={isHovered ? 7 : 5} filter="url(#glow-strong)" />
                <path d={d} fill="none" stroke={ownerColor} strokeOpacity={isHovered ? 1 : 0.8} strokeWidth={isHovered ? 2 : 1.4} strokeDasharray={dash} strokeLinecap="round" />
              </g>;
            })}
          </g>
          <rect x={0} y={0} width={W} height={H} fill="url(#vignette)" pointerEvents="none" />
        </svg>
        <p className="hidden lg:block absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-white/20 pointer-events-none">Molette = zoom · glisser pour déplacer · glisser un actif vers un portefeuille pour le réassigner</p>
        </>)}

        {/* Curseur chronologique : projette le Patrimoine à une date future, hypothèse à taux constant */}
        {showScrubBar && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[min(620px,92%)] glass-panel border border-border rounded-lg px-4 py-2.5 flex items-center gap-3">
            <span className="text-[10px] text-text-muted tabular shrink-0">{currentYearForScrub}</span>
            <input type="range" min={0} max={30} value={scrubYears} onChange={e => setScrubYears(Number(e.target.value))} className="flex-1" />
            <span className="text-[10px] text-text-muted tabular shrink-0">{currentYearForScrub + 30}</span>
            <span className={`text-xs font-semibold tabular shrink-0 w-24 text-right ${scrubYears > 0 ? "text-[#9585ff]" : "text-text-muted"}`}>
              {scrubYears === 0 ? "Maintenant" : scrubYear}
            </span>
            <div className="w-px h-4 bg-border shrink-0" />
            <input type="number" step="0.5" min={0} max={20} value={scrubGrowth} onChange={e => setScrubGrowth(Number(e.target.value))} title="Croissance annuelle moyenne supposée" className="w-12 bg-bg border border-border rounded px-1 py-0.5 text-[10px] tabular shrink-0" />
            <span className="text-[10px] text-text-muted shrink-0">%/an</span>
            <button title="Masquer la simulation" onClick={() => setShowScrubBar(false)} className="shrink-0 text-text-muted hover:text-negative">
              <X size={13} />
            </button>
          </div>
        )}

        {pendingLink && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface border border-border rounded-xl p-4 w-64 shadow-xl space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium">{pendingLink.sourceLabel} → {pendingLink.targetLabel}</p>
              <button onClick={() => { setPendingLink(null); setLinkAmount(""); }} className="text-text-muted hover:text-text"><X size={14} /></button>
            </div>
            <label className="text-[10px] text-text-muted uppercase tracking-wide block">Montant</label>
            <input autoFocus type="number" step="any" value={linkAmount} onChange={e => setLinkAmount(e.target.value)} placeholder="200"
              className="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm tabular" />
            <label className="text-[10px] text-text-muted uppercase tracking-wide block">Fréquence</label>
            <select value={linkFrequency} onChange={e => setLinkFrequency(e.target.value)} className="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm">
              <option value="monthly">Mensuel</option><option value="weekly">Hebdo</option><option value="yearly">Annuel</option>
            </select>
            <div className="flex gap-2 pt-1">
              <button onClick={() => { setPendingLink(null); setLinkAmount(""); }} className="text-xs px-3 py-2 rounded-md font-medium border border-border text-text-muted hover:text-text">Annuler</button>
              <button disabled={!linkAmount} onClick={async () => {
                await actions.createFlow({ sourceType: pendingLink.sourceType, sourceId: pendingLink.sourceId, targetType: pendingLink.targetType, targetId: pendingLink.targetId, amount: linkAmount, frequency: linkFrequency, name: null });
                setPendingLink(null); setLinkAmount("");
              }} className="flex-1 text-xs px-3 py-2 rounded-md font-medium bg-accent text-white hover:opacity-90 disabled:opacity-40">Créer le lien</button>
            </div>
          </div>
        )}
      </div>

      {/* ── PANEL ── */}
      <div className={`grid grid-rows-[44px_minmax(0,1fr)] h-full min-h-0
        max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:z-30 max-lg:w-[19rem] max-lg:bg-surface max-lg:shadow-2xl
        ${drawer === "details" ? "" : "max-lg:hidden"}`}>
        <div className="border-l border-b border-border bg-surface/40 flex items-center justify-end gap-2 pl-4 pr-5 min-w-0">
          <button
            onClick={() => setDrawer(null)}
            aria-label="Fermer le détail"
            className="lg:hidden mr-auto text-text-muted hover:text-text"
          >
            <X size={16} />
          </button>
          <button title={hideAmounts ? "Afficher les montants" : "Masquer les montants"} onClick={() => setHideAmounts(h => !h)} className={`shrink-0 ${hideAmounts ? "text-accent" : "text-text-muted"} hover:text-text`}>
            {hideAmounts ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          <div className="w-px h-5 bg-border shrink-0" />
          <button title={showScrubBar ? "Masquer la simulation future" : "Afficher la simulation future"} onClick={() => setShowScrubBar(s => !s)} className={`shrink-0 ${showScrubBar ? "text-accent" : "text-text-muted"} hover:text-text`}>
            <Clock size={16} />
          </button>
          <div className="w-px h-5 bg-border shrink-0" />
          <button title="Notifications" className="shrink-0 text-text-muted hover:text-text">
            <Bell size={16} />
          </button>
          <div className="w-px h-5 bg-border shrink-0" />
          <div className="relative shrink-0">
            <button title="Alertes" onClick={() => setAlertsOpen(o => !o)} className={`relative block ${alerts.length > 0 ? "text-negative" : "text-text-muted"} hover:text-text`}>
              <AlertTriangle size={16} />
              {alerts.length > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-negative" />}
            </button>
            {alertsOpen && (
              <div className="absolute right-0 top-8 z-10 w-72 max-w-[90vw] glass-panel border border-border rounded-lg shadow-xl p-3 space-y-1.5">
                {alerts.length === 0 ? (
                  <p className="text-xs text-text-muted">Aucune alerte.</p>
                ) : alerts.map(a => (
                  <div key={a.id} className="flex items-start gap-1.5 text-[11px] text-negative bg-negative/10 border border-negative/30 rounded-md px-2 py-1.5">
                    <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                    <span>{a.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="min-h-0 h-full">
          <NodePanel selected={selected} loans={loans} portfolios={portfolios} members={members} goals={goals} flows={flows} goalLinks={goalLinks} portfolioOwnerships={portfolioOwnerships} actions={actions} onClear={() => setSelected(null)} createMode={createMode} setCreateMode={setCreateMode} salary={salary} onUpdateSalary={onUpdateSalary} onUpdateSelf={onUpdateSelf} groups={groups.map(g => ({ key: g.key, total: g.total, valued: g.valued }))} grossTotal={grossTotal} debt={debt} ownerName={ownerName} expenseMemberId={expenseMemberId} dividends={dividends} displayCurrency={displayCurrency} ctx={ctx}
            onPortfolioCreated={p => setSelected({ kind: "portfolio", id: p.id, name: p.name, color: p.color, skin: p.skin, total: 0, count: 0, memberId: p.memberId })} />
        </div>
      </div>
      {showPlanetModal && (
        <PlanetModal members={members} ownerName={ownerName}
          onSubmit={async d => { const p = await actions.createPortfolio(d); setSelected({ kind: "portfolio", id: p.id, name: p.name, color: p.color, skin: p.skin, total: 0, count: 0, memberId: p.memberId }); }}
          onClose={() => setShowPlanetModal(false)} />
      )}
    </div>
  );
}
