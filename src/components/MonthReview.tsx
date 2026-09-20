"use client";

import { useMemo, useState } from "react";
import { Check, CheckCheck, ChevronLeft, Loader2, ChevronRight, Minus, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { formatMoney } from "@/lib/format";

type Flow = {
  id: number;
  name: string | null;
  sourceType: string;
  targetType: string;
  targetId: number | null;
};

export type Occurrence = {
  id: number;
  /** `null` pour un mouvement exceptionnel, saisi à la main. */
  flowId: number | null;
  label: string | null;
  direction: string | null;
  dueDate: string;
  expectedAmount: string;
  actualAmount: string | null;
  status: string;
  note: string | null;
};

const MOIS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

function cleMois(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Saisie d'un mouvement exceptionnel, ou correction d'un mouvement déjà saisi.
 *
 * Volontairement court : un libellé, un montant, un jour, un sens. Tout ce qui
 * se répète a sa place dans les règles de la galaxie, pas ici.
 */
function FormulaireMouvement({ initial, mois, onValider, onAnnuler }: {
  initial?: Occurrence;
  /** Mois affiché, pour proposer une date qui tombe dedans. */
  mois: Date;
  onValider: (d: SaisieMouvement) => Promise<void>;
  onAnnuler: () => void;
}) {
  const parDefaut = () => {
    const aujourdhui = new Date();
    const memeMois = aujourdhui.getFullYear() === mois.getFullYear() && aujourdhui.getMonth() === mois.getMonth();
    const d = memeMois ? aujourdhui : new Date(mois.getFullYear(), mois.getMonth(), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const [f, setF] = useState<SaisieMouvement>({
    label: initial?.label ?? "",
    amount: initial?.expectedAmount ?? "",
    dueDate: initial?.dueDate ?? parDefaut(),
    direction: initial?.direction ?? "out",
  });
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const valider = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnvoi(true); setErreur(null);
    try {
      await onValider(f);
      onAnnuler();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally { setEnvoi(false); }
  };

  return (
    <form onSubmit={valider} className="px-5 py-3 bg-surface-hover/40 border-b border-border space-y-2">
      <div className="flex gap-2">
        <input
          required autoFocus value={f.label}
          onChange={(e) => setF({ ...f, label: e.target.value })}
          placeholder="Réparation voiture, prime, cadeau…"
          aria-label="Libellé du mouvement"
          className="flex-1 min-w-0 bg-bg border border-border rounded-md px-2.5 py-1.5 text-xs"
        />
        <input
          required type="date" value={f.dueDate}
          onChange={(e) => setF({ ...f, dueDate: e.target.value })}
          aria-label="Date du mouvement"
          className="w-36 bg-bg border border-border rounded-md px-2 py-1.5 text-xs tabular"
        />
      </div>
      <div className="flex gap-2">
        <select
          value={f.direction} onChange={(e) => setF({ ...f, direction: e.target.value })}
          aria-label="Sens du mouvement"
          className="w-28 bg-bg border border-border rounded-md px-2 py-1.5 text-xs"
        >
          <option value="out">Dépense</option>
          <option value="in">Rentrée</option>
        </select>
        <input
          required type="text" inputMode="decimal" value={f.amount}
          onChange={(e) => setF({ ...f, amount: e.target.value })}
          placeholder="Montant" aria-label="Montant du mouvement"
          className="flex-1 min-w-0 bg-bg border border-border rounded-md px-2.5 py-1.5 text-xs tabular"
        />
        <button type="submit" disabled={envoi}
          className="px-3 py-1.5 rounded-md bg-accent text-white text-xs font-medium hover:opacity-90 disabled:opacity-50">
          {initial ? "Enregistrer" : "Ajouter"}
        </button>
        <button type="button" onClick={onAnnuler}
          className="px-2.5 py-1.5 rounded-md border border-border text-xs text-text-muted hover:text-text">
          Annuler
        </button>
      </div>
      {erreur && <p className="text-[11px] text-negative">{erreur}</p>}
    </form>
  );
}

/**
 * Fenêtre de pointage mensuel.
 *
 * Le reste de l'app décrit un patrimoine tel qu'il *devrait* être : des règles,
 * des montants prévus. Cet écran est le seul endroit où on confronte ces règles
 * au réel — « les 380 € de crèche sont-ils bien passés, et pour quel montant ? »
 *
 * L'écart entre prévu et constaté est le chiffre que ni un tableur ni un
 * agrégateur ne donne : l'un ignore ce qui était prévu, l'autre ignore ce qui
 * s'est réellement produit.
 */
export type SaisieMouvement = { label: string; amount: string; dueDate: string; direction: string };

export default function MonthReview({
  occurrences, flows, destinations, displayCurrency, onUpdate, onCreate, onEdit, onDelete,
  onUpdateMany, onClose, readOnly, ephemere,
}: {
  occurrences: Occurrence[];
  flows: Flow[];
  /** `"portfolio:3"` → « PEA », pour nommer un versement sans libellé. */
  destinations: Record<string, string>;
  displayCurrency: string;
  onUpdate: (id: number, patch: { status: string; actualAmount?: string | null }) => Promise<void>;
  /** Mouvement exceptionnel : ce que la liste des règles ne pouvait pas prévoir. */
  onCreate: (d: SaisieMouvement) => Promise<void>;
  onEdit: (id: number, d: SaisieMouvement) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  /**
   * Pointer tout un mois d'un coup. Sans ça, « Tout pointer » enchaînait un
   * aller-retour réseau *et* un rechargement complet des échéances par ligne :
   * quinze mouvements, trente requêtes en file, plusieurs secondes de fenêtre
   * figée. L'appelant regroupe.
   */
  /** Reçoit aussi le mois pointé : c'est le tour dont on fait le bilan. */
  onUpdateMany?: (majs: { id: number; status: string; actualAmount?: string | null }[], mois: Date) => Promise<void>;
  onClose: () => void;
  readOnly?: boolean;
  /** Démonstration : tout est manipulable, rien n'est enregistré. */
  ephemere?: boolean;
}) {
  const [mois, setMois] = useState(() => new Date());
  const [saisie, setSaisie] = useState<Record<number, string>>({});
  /**
   * Pointages décidés mais pas encore enregistrés.
   *
   * Chaque ligne partait au serveur au clic, sans retour possible : une fois
   * « Tout pointer » cliqué par erreur, il fallait annuler douze lignes une à
   * une. Les décisions s'accumulent donc ici, la fenêtre en montre l'effet sur
   * les totaux, et rien n'est écrit avant « Enregistrer ».
   */
  const [brouillon, setBrouillon] = useState<Record<number, { status: string; actualAmount: string | null }>>({});
  /** `"nouveau"` pour une saisie vierge, un identifiant pour une correction. */
  const [formulaire, setFormulaire] = useState<"nouveau" | number | null>(null);

  const fmt = (v: number) => formatMoney(v, displayCurrency);
  const nomDe = (o: Occurrence) => {
    if (o.flowId == null) return o.label || "Mouvement";
    const f = flows.find((x) => x.id === o.flowId);
    if (!f) return "Mouvement";
    if (f.name) return f.name;
    const dest = f.targetId != null ? destinations[`${f.targetType}:${f.targetId}`] : undefined;
    if (dest) return `Versement → ${dest}`;
    return f.targetType === "income" ? "Revenu" : "Versement";
  };
  const estRevenu = (o: Occurrence) =>
    o.flowId == null ? o.direction === "in" : flows.find((x) => x.id === o.flowId)?.targetType === "income";

  const duMois = useMemo(() => {
    const cle = cleMois(mois);
    return occurrences
      .filter((o) => o.dueDate.slice(0, 7) === cle)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id - b.id);
  }, [occurrences, mois]);

  /**
   * Ce que la fenêtre montre : l'état enregistré, recouvert du brouillon. Tout
   * le reste — bilan, boutons, compteur — lit cette liste et non `duMois`,
   * pour que l'écart se recalcule à mesure qu'on pointe.
   */
  const duMoisVu = useMemo(
    () => duMois.map((o) => (brouillon[o.id] ? { ...o, ...brouillon[o.id] } : o)),
    [duMois, brouillon]
  );
  const enAttente = Object.keys(brouillon).length;

  const bilan = useMemo(() => {
    // L'écart ne compare que ce qui est pointé. Confronter le prévu du mois
    // entier au constaté partiel donnait un chiffre faux — et flatteur : tant
    // qu'une seule dépense sur dix était pointée, l'écart s'affichait en vert.
    let prevuTotal = 0, prevuPointe = 0, constate = 0, aVerifier = 0;
    for (const o of duMoisVu) {
      if (o.status === "skipped") continue;
      const signe = estRevenu(o) ? 1 : -1;
      const attendu = signe * Number(o.expectedAmount);
      prevuTotal += attendu;
      if (o.status === "confirmed") {
        prevuPointe += attendu;
        constate += signe * Number(o.actualAmount ?? o.expectedAmount);
      } else {
        aVerifier++;
      }
    }
    return { prevuTotal, ecart: constate - prevuPointe, constate, aVerifier, toutPointe: aVerifier === 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duMoisVu, flows]);

  const aujourdhui = new Date().toISOString().slice(0, 10);

  /** Note la décision sans l'envoyer : c'est « Enregistrer » qui écrit. */
  const valider = (o: Occurrence, status: string) => {
    const brut = saisie[o.id];
    setBrouillon((b) => ({
      ...b,
      [o.id]: { status, actualAmount: status === "confirmed" ? (brut?.trim() || o.expectedAmount) : null },
    }));
  };

  /**
   * Pointer d'un coup tout ce qui reste à vérifier, au montant prévu.
   *
   * C'est le cas courant : sur douze prélèvements, onze sont passés pour le
   * montant attendu et un seul a bougé. Ligne à ligne, il fallait douze clics
   * pour n'en corriger qu'un. On pointe tout, puis on rectifie le seul qui
   * diffère — « Annuler le pointage » est à côté de chaque ligne.
   *
   * Ce qui a déjà un montant saisi garde ce montant : on ne va pas écraser une
   * correction en cours sous prétexte qu'on valide le reste.
   */
  const aPointer = duMoisVu.filter((o) => o.status === "pending");
  const pointerTout = () => {
    if (aPointer.length === 0) return;
    setBrouillon((b) => {
      const suivant = { ...b };
      for (const o of aPointer) {
        suivant[o.id] = { status: "confirmed", actualAmount: saisie[o.id]?.trim() || o.expectedAmount };
      }
      return suivant;
    });
  };

  /** Envoie tout le brouillon, en une fois. */
  const [enregistrement, setEnregistrement] = useState(false);
  const enregistrer = async () => {
    const majs = Object.entries(brouillon).map(([id, v]) => ({ id: Number(id), ...v }));
    if (majs.length === 0) return;
    setEnregistrement(true);
    try {
      if (onUpdateMany) await onUpdateMany(majs, mois);
      else for (const m of majs) await onUpdate(m.id, { status: m.status, actualAmount: m.actualAmount });
      setBrouillon({});
      setSaisie({});
    } finally {
      setEnregistrement(false);
    }
  };

  const annuler = () => { setBrouillon({}); setSaisie({}); };

  /** Fermer en laissant des pointages non enregistrés les perdrait. */
  const fermer = () => {
    if (enAttente > 0 && !confirm(`${enAttente} pointage${enAttente > 1 ? "s" : ""} non enregistré${enAttente > 1 ? "s" : ""}. Fermer quand même ?`)) return;
    onClose();
  };

  const decaler = (n: number) =>
    setMois((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg/80 backdrop-blur-sm"
      role="dialog" aria-modal="true" aria-label="Pointage du mois">
      <div className="w-full max-w-xl max-h-[85vh] flex flex-col bg-surface border border-border rounded-xl shadow-2xl">

        <header className="flex items-center gap-3 px-5 py-3.5 border-b border-border shrink-0">
          <div className="flex items-center gap-1">
            <button onClick={() => decaler(-1)} aria-label="Mois précédent"
              className="p-1 rounded text-text-muted hover:text-text hover:bg-surface-hover">
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => decaler(1)} aria-label="Mois suivant"
              className="p-1 rounded text-text-muted hover:text-text hover:bg-surface-hover">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold font-[family-name:var(--font-heading)] leading-tight">
              {MOIS[mois.getMonth()]} {mois.getFullYear()}
            </h2>
            <p className="text-[11px] text-text-muted">
              {bilan.aVerifier > 0
                ? `${bilan.aVerifier} mouvement${bilan.aVerifier > 1 ? "s" : ""} à vérifier`
                : duMoisVu.length > 0 ? "Tout est pointé" : "Aucun mouvement ce mois-ci"}
            </p>
          </div>
          {!readOnly && aPointer.length > 0 && (
            <button onClick={pointerTout}
              title="Pointer au montant prévu tout ce qui reste à vérifier"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium shrink-0 bg-accent text-white hover:opacity-90 disabled:opacity-50">
              <CheckCheck size={13} />Tout pointer
            </button>
          )}
          {!readOnly && (
            <button onClick={() => setFormulaire(formulaire === "nouveau" ? null : "nouveau")}
              aria-pressed={formulaire === "nouveau"}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs shrink-0 ${
                formulaire === "nouveau"
                  ? "bg-accent/15 text-accent"
                  : "text-text-muted hover:text-text hover:bg-surface-hover"}`}>
              <Plus size={13} />Ajouter
            </button>
          )}
          <button onClick={fermer} aria-label="Fermer"
            className="p-1 rounded text-text-muted hover:text-text hover:bg-surface-hover">
            <X size={16} />
          </button>
        </header>

        {formulaire === "nouveau" && (
          <FormulaireMouvement
            mois={mois}
            onValider={onCreate}
            onAnnuler={() => setFormulaire(null)}
          />
        )}

        {duMoisVu.length > 0 && (
          <div className="grid grid-cols-3 gap-px bg-border border-b border-border shrink-0">
            <div className="bg-surface px-4 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-text-muted">Prévu au mois</p>
              <p className="text-sm tabular font-semibold text-text">{fmt(bilan.prevuTotal)}</p>
            </div>
            <div className="bg-surface px-4 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-text-muted">Pointé</p>
              <p className="text-sm tabular font-semibold text-text">{fmt(bilan.constate)}</p>
            </div>
            <div className="bg-surface px-4 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-text-muted">
                Écart{!bilan.toutPointe && <span className="normal-case tracking-normal"> (sur le pointé)</span>}
              </p>
              <p className={`text-sm tabular font-semibold ${
                bilan.ecart === 0 ? "text-text-muted" : bilan.ecart > 0 ? "text-positive" : "text-negative"}`}>
                {bilan.ecart === 0 ? "—" : `${bilan.ecart > 0 ? "+" : "−"}${fmt(Math.abs(bilan.ecart))}`}
              </p>
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto">
          {duMoisVu.length === 0 ? (
            <p className="p-6 text-sm text-text-muted text-center">
              Rien de programmé sur ce mois. Les mouvements récurrents viennent des liens
              que tu crées dans la galaxie ; « Ajouter » sert à tout le reste.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {duMoisVu.map((o) => {
                const attendu = Number(o.expectedAmount);
                const constate = o.actualAmount != null ? Number(o.actualAmount) : null;
                const ecart = constate != null ? constate - attendu : 0;
                const enRetard = o.status === "pending" && o.dueDate <= aujourdhui;
                const revenu = estRevenu(o);

                const exceptionnel = o.flowId == null;

                if (formulaire === o.id) {
                  return (
                    <li key={o.id}>
                      <FormulaireMouvement
                        initial={o} mois={mois}
                        onValider={(d) => onEdit(o.id, d)}
                        onAnnuler={() => setFormulaire(null)}
                      />
                    </li>
                  );
                }

                return (
                  <li key={o.id} className={`px-5 py-3 group ${enRetard ? "bg-negative/5" : ""}`}>
                    <div className="flex items-baseline justify-between gap-3 mb-1.5">
                      <span className="text-sm min-w-0 truncate">
                        <span className="tabular text-text-muted mr-2">
                          {o.dueDate.slice(8, 10)}/{o.dueDate.slice(5, 7)}
                        </span>
                        {nomDe(o)}
                      </span>
                      <span className="flex items-baseline gap-2 shrink-0">
                        {exceptionnel && !readOnly && (
                          <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                            <button onClick={() => setFormulaire(o.id)} title="Modifier"
                              className="p-0.5 text-text-muted hover:text-text">
                              <Pencil size={12} />
                            </button>
                            <button onClick={() => onDelete(o.id)} title="Supprimer"
                              className="p-0.5 text-text-muted hover:text-negative">
                              <Trash2 size={12} />
                            </button>
                          </span>
                        )}
                        <span className={`text-sm tabular ${revenu ? "text-positive" : "text-text"}`}>
                          {revenu ? "+" : "−"}{fmt(attendu)}
                        </span>
                      </span>
                    </div>

                    {o.status === "confirmed" ? (
                      <div className="flex items-center gap-2 text-xs">
                        <Check size={13} className="text-positive shrink-0" />
                        <span className="text-text-muted">
                          Pointé{constate != null && constate !== attendu && (
                            <> à <span className="tabular text-text">{fmt(constate)}</span>
                              <span className={ecart >= 0 ? "text-positive" : "text-negative"}>
                                {" "}({ecart >= 0 ? "+" : "−"}{fmt(Math.abs(ecart))})
                              </span>
                            </>
                          )}
                        </span>
                        {!readOnly && (
                          <button onClick={() => valider(o, "pending")}
                            className="ml-auto text-text-muted hover:text-text" title="Annuler le pointage">
                            <RotateCcw size={12} />
                          </button>
                        )}
                      </div>
                    ) : o.status === "skipped" ? (
                      <div className="flex items-center gap-2 text-xs text-text-muted">
                        <Minus size={13} className="shrink-0" />
                        <span>Ignoré ce mois-ci</span>
                        {!readOnly && (
                          <button onClick={() => valider(o, "pending")}
                            className="ml-auto hover:text-text" title="Remettre à vérifier">
                            <RotateCcw size={12} />
                          </button>
                        )}
                      </div>
                    ) : readOnly ? (
                      <p className="text-xs text-text-muted">À vérifier</p>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="text" inputMode="decimal"
                          value={saisie[o.id] ?? ""}
                          onChange={(e) => setSaisie((s) => ({ ...s, [o.id]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); valider(o, "confirmed"); } }}
                          placeholder={String(attendu)}
                          aria-label={`Montant constaté pour ${nomDe(o)}`}
                          className="w-24 bg-bg border border-border rounded-md px-2 py-1 text-xs tabular text-right"
                        />
                        <button onClick={() => valider(o, "confirmed")}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-accent text-white text-xs font-medium hover:opacity-90 disabled:opacity-50">
                          <Check size={12} />Pointer
                        </button>
                        <button onClick={() => valider(o, "skipped")}
                          className="px-2.5 py-1 rounded-md border border-border text-xs text-text-muted hover:text-text disabled:opacity-50">
                          Ignorer
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="px-5 py-2.5 border-t border-border shrink-0 space-y-2">
          {enAttente > 0 && !readOnly && (
            <div className="flex items-center gap-2">
              <p className="flex-1 min-w-0 text-[11px] text-accent font-medium">
                {enAttente} pointage{enAttente > 1 ? "s" : ""} à enregistrer
              </p>
              <button onClick={annuler} disabled={enregistrement}
                className="px-3 py-1.5 rounded-md border border-border text-xs text-text-muted hover:text-text disabled:opacity-50">
                Annuler
              </button>
              <button onClick={enregistrer} disabled={enregistrement}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-white text-xs font-medium hover:opacity-90 disabled:opacity-50">
                {enregistrement ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                Enregistrer
              </button>
            </div>
          )}
          <p className="text-[10px] text-text-muted">
            Laisse le champ vide pour pointer au montant prévu ; saisis-en un autre s&apos;il a changé.
            {" Rien n\u2019est écrit avant « Enregistrer »."}
            {ephemere && " Version de démonstration : les pointages restent dans cet onglet."}
          </p>
        </footer>
      </div>
    </div>
  );
}
