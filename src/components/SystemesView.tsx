"use client";

import { useId, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { formatMoney } from "@/lib/format";
import {
  construireSystemes, SYSTEME_DEPENSES, SYSTEME_INVESTISSEMENTS, SYSTEME_REVENUS,
  type EntreesSystemes, type SystemeId,
} from "@/lib/systemes";

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
 */

const W = 1000, H = 620;
const COLONNES = [140, 500, 860];

type Corps = {
  id: SystemeId; label: string; montant: number; parMois: boolean;
  couleur: string; contenu: number; x: number; y: number; r: number;
};

function rayon(montant: number, max: number): number {
  if (max <= 0) return 44;
  // Racine carrée : la surface suit le montant, pas le rayon — sinon un
  // patrimoine quatre fois plus gros avale tout l'écran.
  return 38 + Math.sqrt(Math.min(1, Math.abs(montant) / max)) * 46;
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
  const fmt = (v: number) => formatMoney(v, devise);

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
      membres.forEach((s, i) => {
        corps.push({
          ...s,
          x: COLONNES[c],
          y: (H / (membres.length + 1)) * (i + 1),
          r: rayon(s.montant, s.parMois ? maxFlux : maxStock),
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
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full select-none">
      <defs>
        {corps.map(c => (
          <radialGradient key={c.id} id={`${id}-sph-${c.id}`} cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor={c.couleur} stopOpacity="0.95" />
            <stop offset="100%" stopColor={c.couleur} stopOpacity="0.42" />
          </radialGradient>
        ))}
      </defs>

      {traits.map(t => {
        const largeur = 1.5 + (t.montant / maxTrait) * 5;
        const mx = (t.a.x + t.b.x) / 2;
        return (
          <g key={`${t.source}-${t.cible}`}>
            <path
              d={`M${t.a.x + t.a.r},${t.a.y} C${mx},${t.a.y} ${mx},${t.b.y} ${t.b.x - t.b.r},${t.b.y}`}
              fill="none" stroke={t.b.couleur} strokeOpacity={0.42} strokeWidth={largeur}
              strokeLinecap="round"
            />
            <text x={mx} y={(t.a.y + t.b.y) / 2 - 7} textAnchor="middle"
              fontSize={12} fill="var(--text-muted)" className="tabular">
              {fmt(t.montant)}/mois
            </text>
          </g>
        );
      })}

      {corps.map(c => {
        const actif = survol === c.id;
        return (
          <g key={c.id} transform={`translate(${c.x},${c.y})`} style={{ cursor: "pointer" }}
            onPointerEnter={() => setSurvol(c.id)} onPointerLeave={() => setSurvol(s => s === c.id ? null : s)}
            onClick={() => onEntrer(c.id)}
            role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onEntrer(c.id); } }}
            aria-label={`${c.label}, ${fmt(c.montant)}${c.parMois ? " par mois" : ""}. Entrer dans ce système.`}>
            <circle r={c.r + 7} fill={c.couleur} opacity={actif ? 0.22 : 0.1} />
            <circle r={c.r} fill={`url(#${id}-sph-${c.id})`} />
            <circle r={c.r} fill="none" stroke={c.couleur} strokeOpacity={actif ? 0.9 : 0.45} strokeWidth={1.5} />

            {/* Un nom de projet est libre : « Apport résidence principale » dépasse
                largement son cercle. On le coupe à ce que la largeur autorise,
                police réduite comprise, plutôt que de le laisser déborder. */}
            <text y={-6} textAnchor="middle" fontSize={c.label.length > 14 ? 12 : 15} fontWeight={600} fill="#fff">
              {(() => {
                const taille = c.label.length > 14 ? 12 : 15;
                const maxCar = Math.max(6, Math.floor((c.r * 2 - 10) / (taille * 0.52)));
                return c.label.length > maxCar ? `${c.label.slice(0, maxCar - 1)}…` : c.label;
              })()}
            </text>
            <title>{c.label}</title>
            <text y={14} textAnchor="middle" fontSize={13} fill="rgba(255,255,255,0.9)" className="tabular">
              {fmt(c.montant)}
            </text>
            <text y={29} textAnchor="middle" fontSize={10} fill="rgba(255,255,255,0.6)">
              {c.parMois ? "par mois" : c.contenu > 0 ? `${c.contenu} planète${c.contenu > 1 ? "s" : ""}` : "capital"}
            </text>

            {actif && (
              <g transform={`translate(0,${c.r + 20})`} pointerEvents="none">
                <text textAnchor="middle" fontSize={11} fill="var(--text-muted)">entrer</text>
                <ChevronRight x={26} y={-9} size={11} color="var(--text-muted)" />
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
