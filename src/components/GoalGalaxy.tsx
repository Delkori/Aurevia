"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatMoney } from "@/lib/format";
import { getGoalPosition, setGoalPosition } from "@/lib/goalPositions";

type Goal = {
  id: number;
  name: string;
  targetAmount: string;
  targetDate: string | null;
  color: string;
};

type StarNode = Goal & { x: number; y: number };

const VIEW_W = 1200;
const VIEW_H = 800;
const CENTER = { x: VIEW_W / 2, y: VIEW_H / 2 };
const CORE_R = 26;

function defaultPosition(index: number, count: number) {
  const angle = (index / Math.max(1, count)) * Math.PI * 2 - Math.PI / 2;
  const radius = 240 + (index % 2) * 60;
  return {
    x: CENTER.x + Math.cos(angle) * radius,
    y: CENTER.y + Math.sin(angle) * radius,
  };
}

function starPoints(outer: number, inner: number, points = 5) {
  const coords: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const angle = (Math.PI / points) * i - Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    coords.push(`${Math.cos(angle) * r},${Math.sin(angle) * r}`);
  }
  return coords.join(" ");
}

function useAnimationClock() {
  const [t, setT] = useState(0);
  const raf = useRef<number | null>(null);
  const start = useRef<number | null>(null);
  useEffect(() => {
    const tick = (ts: number) => {
      if (start.current === null) start.current = ts;
      setT((ts - start.current) / 1000);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);
  return t;
}

export default function GoalGalaxy({
  goals,
  currentTotal,
  onCreate,
  onUpdate,
  onDelete,
}: {
  goals: Goal[];
  currentTotal: number;
  onCreate: (draft: { name: string; targetAmount: string; color: string }) => Promise<void>;
  onUpdate: (id: number, patch: { name: string; targetAmount: string; color: string }) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [positions, setPositions] = useState<Record<number, { x: number; y: number }>>({});
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", targetAmount: "", color: "#7c6af5" });
  const [showAddForm, setShowAddForm] = useState(false);
  const t = useAnimationClock();

  useEffect(() => {
    const map: Record<number, { x: number; y: number }> = {};
    goals.forEach((g, i) => {
      map[g.id] = getGoalPosition(g.id) ?? defaultPosition(i, goals.length);
    });
    setPositions(map);
  }, [goals]);

  const nodes: StarNode[] = useMemo(
    () =>
      goals.map((g, i) => ({
        ...g,
        x: positions[g.id]?.x ?? defaultPosition(i, goals.length).x,
        y: positions[g.id]?.y ?? defaultPosition(i, goals.length).y,
      })),
    [goals, positions]
  );

  const selected = nodes.find((n) => n.id === selectedId) ?? null;

  useEffect(() => {
    if (selected) {
      setForm({ name: selected.name, targetAmount: selected.targetAmount, color: selected.color });
    }
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // La fusée file vers l'objectif le plus proche d'être atteint (hors ceux déjà à 100%)
  const rocketTarget = useMemo(() => {
    const inProgress = nodes
      .map((n) => ({ n, progress: Math.min(1, currentTotal / Number(n.targetAmount)) }))
      .filter((x) => x.progress < 1)
      .sort((a, b) => b.progress - a.progress);
    return inProgress[0]?.n ?? null;
  }, [nodes, currentTotal]);

  const toSvgPoint = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * VIEW_W,
      y: ((clientY - rect.top) / rect.height) * VIEW_H,
    };
  };

  const onPointerDown = (id: number) => (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    setDragId(id);
    setSelectedId(id);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (dragId === null) return;
    const p = toSvgPoint(e.clientX, e.clientY);
    const clamped = {
      x: Math.max(60, Math.min(VIEW_W - 60, p.x)),
      y: Math.max(60, Math.min(VIEW_H - 60, p.y)),
    };
    setPositions((prev) => ({ ...prev, [dragId]: clamped }));
  };

  const endDrag = () => {
    if (dragId !== null) {
      const pos = positions[dragId];
      if (pos) setGoalPosition(dragId, pos);
    }
    setDragId(null);
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selected) {
      await onUpdate(selected.id, form);
    } else {
      await onCreate(form);
      setShowAddForm(false);
    }
    setForm({ name: "", targetAmount: "", color: "#7c6af5" });
  };

  const removeSelected = async () => {
    if (!selected) return;
    if (!confirm(`Supprimer "${selected.name}" ?`)) return;
    await onDelete(selected.id);
    setSelectedId(null);
  };

  return (
    <div className="grid lg:grid-cols-4 gap-6">
      <aside className="lg:col-span-1 space-y-4 order-2 lg:order-1">
        <button
          onClick={() => {
            setSelectedId(null);
            setShowAddForm(true);
            setForm({ name: "", targetAmount: "", color: "#7c6af5" });
          }}
          className="w-full text-sm px-4 py-2.5 rounded-md bg-accent text-white font-medium hover:opacity-90"
        >
          + Ajouter une étoile
        </button>

        {(selected || showAddForm) && (
          <form
            onSubmit={submitForm}
            className="bg-surface border border-border rounded-lg p-4 space-y-3"
          >
            <p className="text-xs text-text-muted uppercase tracking-wide">
              {selected ? "Modifier l'objectif" : "Nouvel objectif"}
            </p>
            <div>
              <label className="text-xs text-text-muted">Nom</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Vacances"
                className="w-full mt-1 bg-bg border border-border rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted">Montant cible</label>
              <input
                required
                type="number"
                step="any"
                value={form.targetAmount}
                onChange={(e) => setForm({ ...form, targetAmount: e.target.value })}
                className="w-full mt-1 bg-bg border border-border rounded-md px-3 py-2 text-sm tabular"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted">Couleur</label>
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="w-full mt-1 h-9 bg-bg border border-border rounded-md"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 text-sm px-3 py-2 rounded-md bg-accent text-white font-medium hover:opacity-90"
              >
                {selected ? "Enregistrer" : "Créer"}
              </button>
              {selected && (
                <button
                  type="button"
                  onClick={removeSelected}
                  className="text-sm px-3 py-2 rounded-md border border-negative/40 text-negative hover:bg-negative/10"
                >
                  Suppr.
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setSelectedId(null);
                  setShowAddForm(false);
                }}
                className="text-sm px-3 py-2 rounded-md border border-border text-text-muted hover:text-text"
              >
                Fermer
              </button>
            </div>
          </form>
        )}

        {!selected && !showAddForm && (
          <div className="bg-surface border border-border rounded-lg p-4 text-xs text-text-muted space-y-2">
            <p>Clique une étoile pour la modifier, glisse-la pour la repositionner.</p>
            <p>La fusée se dirige automatiquement vers l&apos;objectif le plus proche d&apos;être atteint.</p>
          </div>
        )}
      </aside>

      <div
        className="lg:col-span-3 rounded-lg overflow-hidden border border-border relative order-1 lg:order-2"
        style={{
          background:
            "radial-gradient(circle at 20% 20%, rgba(124,106,245,0.12), transparent 25%), radial-gradient(circle at 80% 15%, rgba(94,234,212,0.10), transparent 24%), radial-gradient(circle at 50% 75%, rgba(251,191,36,0.06), transparent 26%), linear-gradient(180deg, #08080a 0%, #0d0d0f 45%, #121215 100%)",
        }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="w-full h-auto select-none touch-none block"
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
          onClick={() => {
            setSelectedId(null);
            setShowAddForm(false);
          }}
        >
          <defs>
            <filter id="goalGlow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="35%" stopColor="#c9c2ff" stopOpacity="0.9" />
              <stop offset="75%" stopColor="#7c6af5" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#7c6af5" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Cercles de repère + cœur "Patrimoine" */}
          <circle cx={CENTER.x} cy={CENTER.y} r={250} fill="none" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 14" />
          <circle cx={CENTER.x} cy={CENTER.y} r={120} fill="none" stroke="rgba(255,255,255,0.04)" strokeDasharray="2 12" />
          <circle cx={CENTER.x} cy={CENTER.y} r={80} fill="url(#coreGlow)" opacity={0.6} />
          <circle cx={CENTER.x} cy={CENTER.y} r={CORE_R * 0.5} fill="#ffffff" filter="url(#goalGlow)" />
          <text x={CENTER.x} y={CENTER.y + 56} textAnchor="middle" fontSize={13} fill="#e8e8ea" fontFamily="var(--font-heading)" letterSpacing={1}>
            {formatMoney(currentTotal)}
          </text>

          {/* Liens courbes centre → étoile */}
          {nodes.map((n) => {
            const midX = (CENTER.x + n.x) / 2;
            const midY = (CENTER.y + n.y) / 2 - 30;
            const progress = Math.min(1, currentTotal / Number(n.targetAmount));
            return (
              <path
                key={`line-${n.id}`}
                d={`M ${CENTER.x} ${CENTER.y} Q ${midX} ${midY} ${n.x} ${n.y}`}
                fill="none"
                stroke={n.color}
                strokeOpacity={0.3 + progress * 0.3}
                strokeWidth={1.5}
                strokeDasharray="7 7"
              />
            );
          })}

          {/* Fusée en direction de l'objectif le plus proche */}
          {rocketTarget && (() => {
            const midX = (CENTER.x + rocketTarget.x) / 2;
            const midY = (CENTER.y + rocketTarget.y) / 2 - 30;
            const progress = (t / 6) % 1;
            const u = 1 - progress;
            // point sur la courbe quadratique de Bézier
            const x = u * u * CENTER.x + 2 * u * progress * midX + progress * progress * rocketTarget.x;
            const y = u * u * CENTER.y + 2 * u * progress * midY + progress * progress * rocketTarget.y;
            const dx = 2 * u * (midX - CENTER.x) + 2 * progress * (rocketTarget.x - midX);
            const dy = 2 * u * (midY - CENTER.y) + 2 * progress * (rocketTarget.y - midY);
            const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
            return (
              <g transform={`translate(${x} ${y}) rotate(${angle})`} filter="url(#goalGlow)">
                <path d="M -9 -3.5 L 6 -3.5 L 12 0 L 6 3.5 L -9 3.5 Z" fill="#f7fbff" />
                <path d="M -7 -3.5 L -11 -8 L -7 -1 Z" fill="#c8d1ff" />
                <path d="M -7 3.5 L -11 8 L -7 1 Z" fill="#c8d1ff" />
                <path d="M -10 0 L -16 -4 L -14.5 0 L -16 4 Z" fill="#fb923c" />
              </g>
            );
          })()}

          {/* Étoiles (objectifs) */}
          {nodes.map((n) => {
            const progress = Math.min(1, currentTotal / Number(n.targetAmount));
            const size = 22 + progress * 10;
            const isSelected = n.id === selectedId;
            return (
              <g
                key={n.id}
                transform={`translate(${n.x} ${n.y})`}
                className="cursor-pointer"
                onPointerDown={onPointerDown(n.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedId(n.id);
                  setShowAddForm(false);
                }}
              >
                <polygon
                  points={starPoints(size + 9, size * 0.5 + 4)}
                  fill="none"
                  stroke={isSelected ? "#ffffff" : "rgba(255,255,255,0.12)"}
                  strokeWidth={isSelected ? 2 : 1}
                />
                <polygon points={starPoints(size, size * 0.48)} fill={n.color} filter="url(#goalGlow)" />
                {progress >= 1 && (
                  <circle r={size + 16} fill="none" stroke="var(--positive)" strokeOpacity={0.5} strokeWidth={1.5} />
                )}
                <circle r={5} fill="rgba(255,255,255,0.6)" />
                <text y={size + 24} textAnchor="middle" fontSize={13} fontWeight={600} fill="#e8e8ea">
                  {n.name}
                </text>
                <text y={size + 40} textAnchor="middle" fontSize={11} fill="#9a9aa2" className="tabular">
                  {progress >= 1 ? "atteint 🎉" : `${formatMoney(Number(n.targetAmount))} · ${(progress * 100).toFixed(0)}%`}
                </text>
              </g>
            );
          })}

          {nodes.length === 0 && (
            <text x={CENTER.x} y={CENTER.y + 140} textAnchor="middle" fill="#6b6b72" fontSize={14}>
              Ajoute ton premier objectif pour peupler la galaxie
            </text>
          )}
        </svg>
      </div>
    </div>
  );
}
