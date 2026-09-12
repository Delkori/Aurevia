/**
 * Calendrier des mouvements à venir, groupés par mois.
 *
 * La liste « flux mensuels » énumérait des *règles* (« Salaire → PEA, 600 € »)
 * sans dire quand elles tombent. Un flux annuel y voisinait un flux quotidien
 * comme s'ils pesaient pareil. On déroule donc chaque règle en occurrences
 * datées, et on les range par mois : la question à laquelle personne ne pouvait
 * répondre était « qu'est-ce qui part en novembre ».
 */

/** `2026-02-28`, en heure locale — `toISOString` décalerait d'un jour. */
function cleJour(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

export type FlowLike = {
  id: number;
  name: string | null;
  amount: string | number;
  frequency: string;
  createdAt: string;
  sourceType: string;
  targetType: string;
  targetId: number | null;
};

/** Où va l'argent, du point de vue du budget. */
export type Direction = "entree" | "epargne" | "sortie";

export type Occurrence = {
  key: string;
  flowId: number;
  date: Date;
  label: string;
  amount: number;
  direction: Direction;
};

export type MoisGroupe = {
  /** `2026-10`, pour les clés React et le tri. */
  cle: string;
  label: string;
  occurrences: Occurrence[];
  entrees: number;
  epargne: number;
  sorties: number;
};

export function directionOf(flow: FlowLike): Direction {
  if (flow.targetType === "income") return "entree";
  if (flow.targetType === "expense") return "sortie";
  return "epargne";
}

/**
 * Déroule une règle en occurrences datées sur la fenêtre `[debut, fin]`.
 *
 * On part de la date d'origine du flux et on avance période par période, ce qui
 * permet d'atteindre aussi les échéances **passées**. C'est indispensable au
 * pointage : ce qu'on veut vérifier, c'est le prélèvement du 6 qui a déjà eu
 * lieu, pas celui du mois prochain.
 *
 * Les flux quotidiens ne sont pas énumérés jour par jour — trente lignes
 * identiques n'apprennent rien. Ils sont agrégés en une occurrence mensuelle
 * qui porte le cumul, et le libellé le dit.
 */
function occurrencesDe(flow: FlowLike, debut: Date, fin: Date): Occurrence[] {
  const montant = Number(flow.amount);
  if (!Number.isFinite(montant)) return [];

  const origine = new Date(flow.createdAt);
  if (Number.isNaN(origine.getTime())) return [];

  const label = flow.name || (flow.targetType === "income" ? "Revenu" : "Versement");
  const direction = directionOf(flow);
  const out: Occurrence[] = [];

  if (flow.frequency === "daily") {
    const curseur = new Date(debut.getFullYear(), debut.getMonth(), 1);
    while (curseur <= fin) {
      if (curseur >= new Date(origine.getFullYear(), origine.getMonth(), 1)) {
        const jours = new Date(curseur.getFullYear(), curseur.getMonth() + 1, 0).getDate();
        out.push({
          key: `${flow.id}-${curseur.getFullYear()}-${curseur.getMonth()}`,
          flowId: flow.id,
          date: new Date(curseur),
          label: `${label} (quotidien)`,
          amount: montant * jours,
          direction,
        });
      }
      curseur.setMonth(curseur.getMonth() + 1);
    }
    return out;
  }

  if (flow.frequency === "once") {
    if (origine >= debut && origine <= fin) {
      out.push({
        key: `${flow.id}-${cleJour(origine)}`,
        flowId: flow.id, date: new Date(origine), label, amount: montant, direction,
      });
    }
    return out;
  }

  const pousser = (d: Date) => out.push({
    key: `${flow.id}-${cleJour(d)}`,
    flowId: flow.id, date: d, label, amount: montant, direction,
  });

  if (flow.frequency === "weekly") {
    // Sept jours sont sept jours : aucun report à craindre, on avance.
    const curseur = new Date(origine);
    if (curseur < debut) {
      const sauts = Math.floor((debut.getTime() - curseur.getTime()) / (7 * 86_400_000));
      curseur.setDate(curseur.getDate() + sauts * 7);
    }
    for (let garde = 0; curseur <= fin && garde < 600; garde++) {
      if (curseur >= debut) pousser(new Date(curseur));
      curseur.setDate(curseur.getDate() + 7);
    }
    return out;
  }

  // Mensuel et annuel : on avance par *rang de période* et on reconstruit la
  // date à chaque fois, en ramenant le jour au dernier du mois quand il n'existe
  // pas.
  //
  // `setMonth` ne peut pas servir ici. Appliqué au 31 janvier il déborde sur le
  // 3 mars : février disparaissait purement et simplement de la liste, et toutes
  // les échéances suivantes tombaient le 3 à vie. Pour un écran dont le seul but
  // est de dire « les 380 € sont-ils bien passés », perdre un mois entier de
  // prélèvement est la pire panne possible — d'autant qu'elle est silencieuse.
  const pas = flow.frequency === "yearly" ? 12 : 1;
  const jourVoulu = origine.getDate();
  const rangOrigine = origine.getFullYear() * 12 + origine.getMonth();
  const dateAuRang = (rang: number) => {
    const an = Math.floor(rang / 12), mois = rang - an * 12;
    const dernier = new Date(an, mois + 1, 0).getDate();
    return new Date(an, mois, Math.min(jourVoulu, dernier),
      origine.getHours(), origine.getMinutes(), origine.getSeconds());
  };

  const rangDebut = debut.getFullYear() * 12 + debut.getMonth();
  let k = Math.max(0, Math.ceil((rangDebut - rangOrigine) / pas));
  for (let garde = 0; garde < 600; garde++, k++) {
    const d = dateAuRang(rangOrigine + k * pas);
    if (d > fin) break;
    if (d >= debut) pousser(d);
  }
  return out;
}

export function upcomingByMonth(
  flows: FlowLike[],
  mois = 6,
  maintenant = new Date()
): MoisGroupe[] {
  const debut = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1);
  const fin = new Date(maintenant.getFullYear(), maintenant.getMonth() + mois, 0, 23, 59, 59);

  const parMois = new Map<string, MoisGroupe>();

  for (const flow of flows) {
    for (const occ of occurrencesDe(flow, debut, fin)) {
      const cle = `${occ.date.getFullYear()}-${String(occ.date.getMonth() + 1).padStart(2, "0")}`;
      if (!parMois.has(cle)) {
        parMois.set(cle, {
          cle,
          label: `${MOIS[occ.date.getMonth()]} ${occ.date.getFullYear()}`,
          occurrences: [],
          entrees: 0,
          epargne: 0,
          sorties: 0,
        });
      }
      const groupe = parMois.get(cle)!;
      groupe.occurrences.push(occ);
      if (occ.direction === "entree") groupe.entrees += occ.amount;
      else if (occ.direction === "epargne") groupe.epargne += occ.amount;
      else groupe.sorties += occ.amount;
    }
  }

  return [...parMois.values()]
    .sort((a, b) => a.cle.localeCompare(b.cle))
    .map((g) => ({
      ...g,
      occurrences: g.occurrences.sort(
        (a, b) => a.date.getTime() - b.date.getTime() || a.label.localeCompare(b.label)
      ),
    }));
}
