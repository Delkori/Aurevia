"use client";

import { useId, useState } from "react";
import { formatMoney } from "@/lib/format";

/**
 * Courbe du patrimoine réellement mesuré, point par point.
 *
 * Écrite en SVG plutôt qu'avec une bibliothèque : c'était le seul graphique de
 * l'app à dépendre de `recharts`, soit 9,6 Mo installés pour une aire et deux
 * axes, quand le reste des graphiques était déjà dessiné à la main.
 *
 * Une seule série, donc pas de légende : le titre de la section la nomme déjà.
 */

type Snapshot = { date: string; totalValue: string };

const W = 720, H = 260;
const M = { haut: 16, droite: 14, bas: 28, gauche: 84 };
const COULEUR = "#7c6af5";

function joli(n: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(1, n))));
  for (const f of [1, 2, 2.5, 5, 10]) if (n <= f * p) return f * p;
  return 10 * p;
}

export default function NetWorthChart({ data }: { data: Snapshot[] }) {
  const id = useId();
  const [survol, setSurvol] = useState<number | null>(null);

  const points = data
    .map((d) => ({ t: new Date(d.date).getTime(), v: Number(d.totalValue), brut: d.date }))
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v))
    .sort((a, b) => a.t - b.t);

  if (points.length < 2) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-text-muted border border-dashed border-border rounded-lg text-center px-6">
        La courbe apparaît après quelques jours de suivi. Ajoute tes actifs
        pour commencer.
      </div>
    );
  }

  const yMax = joli(Math.max(...points.map((p) => p.v)));
  const x = (i: number) => M.gauche + (i / (points.length - 1)) * (W - M.gauche - M.droite);
  const y = (v: number) => H - M.bas - (v / yMax) * (H - M.haut - M.bas);

  const ligne = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const aire = `${ligne} L${x(points.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;

  const graduations = [0, 0.5, 1].map((f) => yMax * f);
  // Au plus six dates en abscisse : au-delà elles se chevauchent.
  const pas = Math.max(1, Math.ceil(points.length / 6));
  const jourCourt = (t: number) =>
    new Date(t).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  const jourLong = (t: number) =>
    new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  const actif = survol != null ? points[Math.min(points.length - 1, Math.max(0, survol))] : null;

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto select-none"
        role="img"
        aria-label={`Patrimoine du ${jourLong(points[0].t)} au ${jourLong(points[points.length - 1].t)} : de ${formatMoney(points[0].v)} à ${formatMoney(points[points.length - 1].v)}.`}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          setSurvol(Math.round(((px - M.gauche) / (W - M.gauche - M.droite)) * (points.length - 1)));
        }}
        onPointerLeave={() => setSurvol(null)}
      >
        <defs>
          <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COULEUR} stopOpacity="0.35" />
            <stop offset="100%" stopColor={COULEUR} stopOpacity="0" />
          </linearGradient>
        </defs>

        {graduations.map((v) => (
          <g key={v}>
            <line x1={M.gauche} y1={y(v)} x2={W - M.droite} y2={y(v)} stroke="var(--border)" strokeWidth="1" />
            <text x={M.gauche - 8} y={y(v) + 3.5} fontSize="11" fill="var(--text-muted)"
              textAnchor="end" className="tabular">
              {v === 0 ? "0" : formatMoney(v)}
            </text>
          </g>
        ))}

        {points.map((p, i) => (i % pas === 0 || i === points.length - 1) && (
          <text key={p.brut} x={x(i)} y={H - 9} fontSize="11" fill="var(--text-muted)" textAnchor="middle">
            {jourCourt(p.t)}
          </text>
        ))}

        <path d={aire} fill={`url(#${id}-fill)`} stroke="none" />
        <path d={ligne} fill="none" stroke={COULEUR} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {actif && (
          <g pointerEvents="none">
            <line x1={x(points.indexOf(actif))} y1={M.haut} x2={x(points.indexOf(actif))} y2={H - M.bas}
              stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={x(points.indexOf(actif))} cy={y(actif.v)} r="4"
              fill={COULEUR} stroke="var(--surface)" strokeWidth="2" />
          </g>
        )}
      </svg>

      <figcaption className="mt-1 text-[11px] text-text-muted tabular h-4">
        {actif && <>{jourLong(actif.t)} · <span className="text-text">{formatMoney(actif.v)}</span></>}
      </figcaption>
    </figure>
  );
}
