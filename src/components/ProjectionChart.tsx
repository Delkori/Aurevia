"use client";

import { useId, useState } from "react";
import { formatMoney } from "@/lib/format";

/**
 * Courbe de projection du patrimoine.
 *
 * Deux séries, et c'est le *creux entre les deux* qui porte l'information :
 * la ligne basse est ce qu'on aura versé de sa poche, la haute ce que ça
 * sera devenu. L'écart est le rendement composé — le seul chiffre qui
 * justifie d'attendre.
 *
 * Couleurs validées sur fond sombre (toutes paires) : violet du Patrimoine
 * contre orange, pire écart ΔE 30,4 en protanopie et 31,5 en vision normale.
 * La légende et les étiquettes en bout de courbe doublent la couleur, pour que
 * l'identité des séries ne repose jamais sur elle seule.
 */

export const COULEUR_VALEUR = "#7c6af5";
export const COULEUR_VERSE = "#d95926";

export type Point = { month: number; value: number; contributed: number };

const W = 720, H = 300;
// Les graduations vivent à gauche, les étiquettes de fin de courbe à droite.
// Les avoir mises du même côté les faisait se chevaucher : « 685 816 € » se
// superposait à la graduation « 750 000 € ».
const M = { haut: 18, droite: 86, bas: 30, gauche: 80 };

function joli(n: number): number {
  // Borne haute « ronde » : 1, 2, 2,5 ou 5 × une puissance de dix.
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(1, n))));
  for (const f of [1, 2, 2.5, 5, 10]) if (n <= f * p) return f * p;
  return 10 * p;
}

export default function ProjectionChart({
  points, devise, depart,
}: {
  points: Point[];
  devise: string;
  /** Date de départ, pour situer les mois en années réelles. */
  depart: Date;
}) {
  const id = useId();
  const [survol, setSurvol] = useState<number | null>(null);

  if (points.length < 2) return null;

  const moisMax = points[points.length - 1].month;
  const yMax = joli(Math.max(...points.map((p) => p.value)));
  const x = (m: number) => M.gauche + (m / moisMax) * (W - M.gauche - M.droite);
  const y = (v: number) => H - M.bas - (v / yMax) * (H - M.haut - M.bas);

  const ligne = (accesseur: (p: Point) => number) =>
    points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.month).toFixed(1)},${y(accesseur(p)).toFixed(1)}`).join(" ");

  const dernier = points[points.length - 1];
  const graduations = [0, 0.25, 0.5, 0.75, 1].map((f) => yMax * f);
  const anneeDe = (m: number) => new Date(depart.getFullYear(), depart.getMonth() + m, 1).getFullYear();
  const tousLesAns = points.filter((p) => p.month % 12 === 0).map((p) => p.month);
  // Un horizon de trente ans donnerait trente et un millésimes collés les uns
  // aux autres : on n'en garde qu'un sur n, en conservant toujours le dernier.
  const pasAnnee = Math.ceil(tousLesAns.length / 9);
  const annees = tousLesAns.filter((m, i) => i % pasAnnee === 0 || i === tousLesAns.length - 1);

  const actif = survol != null ? points[Math.min(points.length - 1, Math.max(0, survol))] : null;
  const fmt = (v: number) => formatMoney(v, devise);

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto select-none"
        role="img"
        aria-label={`Projection du patrimoine sur ${Math.round(moisMax / 12)} ans : ${fmt(dernier.value)} au terme, dont ${fmt(dernier.contributed)} versés.`}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          const m = ((px - M.gauche) / (W - M.gauche - M.droite)) * moisMax;
          setSurvol(Math.round((m / moisMax) * (points.length - 1)));
        }}
        onPointerLeave={() => setSurvol(null)}
      >
        <defs>
          <linearGradient id={`${id}-remplissage`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COULEUR_VALEUR} stopOpacity="0.22" />
            <stop offset="100%" stopColor={COULEUR_VALEUR} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Grille : discrète, elle situe sans attirer l'œil. */}
        {graduations.map((v) => (
          <g key={v}>
            <line x1={M.gauche} y1={y(v)} x2={W - M.droite} y2={y(v)}
              stroke="var(--border)" strokeWidth="1" />
            <text x={M.gauche - 8} y={y(v) + 3.5} fontSize="10" fill="var(--text-muted)"
              textAnchor="end" className="tabular">
              {v === 0 ? "0" : fmt(v)}
            </text>
          </g>
        ))}

        {/* Années en abscisse */}
        {annees.map((m) => (
          <text key={m} x={x(m)} y={H - 10} fontSize="10" fill="var(--text-muted)" textAnchor="middle">
            {anneeDe(m)}
          </text>
        ))}

        <path d={`${ligne((p) => p.value)} L${x(moisMax)},${y(0)} L${x(0)},${y(0)} Z`}
          fill={`url(#${id}-remplissage)`} stroke="none" />

        <path d={ligne((p) => p.contributed + points[0].value)} fill="none"
          stroke={COULEUR_VERSE} strokeWidth="2" strokeLinecap="round" />
        <path d={ligne((p) => p.value)} fill="none"
          stroke={COULEUR_VALEUR} strokeWidth="2" strokeLinecap="round" />

        {/* Étiquettes en bout de courbe : l'identité ne tient jamais à la couleur seule. */}
        <text x={x(moisMax) + 6} y={y(dernier.value) - 4} fontSize="10" fill="var(--text)" className="tabular">
          {fmt(dernier.value)}
        </text>
        <text x={x(moisMax) + 6} y={y(dernier.contributed + points[0].value) + 12} fontSize="10" fill="var(--text-muted)" className="tabular">
          {fmt(dernier.contributed + points[0].value)}
        </text>

        {actif && (
          <g pointerEvents="none">
            <line x1={x(actif.month)} y1={M.haut} x2={x(actif.month)} y2={H - M.bas}
              stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={x(actif.month)} cy={y(actif.value)} r="4"
              fill={COULEUR_VALEUR} stroke="var(--surface)" strokeWidth="2" />
            <circle cx={x(actif.month)} cy={y(actif.contributed + points[0].value)} r="4"
              fill={COULEUR_VERSE} stroke="var(--surface)" strokeWidth="2" />
          </g>
        )}
      </svg>

      <figcaption className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px]">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: COULEUR_VALEUR }} />
          <span className="text-text">Valeur projetée</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: COULEUR_VERSE }} />
          <span className="text-text-muted">Capital de départ + versements</span>
        </span>
        {actif && (
          <span className="text-text-muted tabular ml-auto">
            {anneeDe(actif.month)} · {fmt(actif.value)}
            <span className="text-positive"> (+{fmt(actif.value - actif.contributed - points[0].value)} de rendement)</span>
          </span>
        )}
      </figcaption>
    </figure>
  );
}
