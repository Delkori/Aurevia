import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/apiError";
import { requireOwner, requireSession } from "@/lib/auth";
import { isDatabaseEmpty, isDemoLoaded, removeDemo, seedDemo } from "@/lib/demoSeed";

/** État du jeu d'exemple, lu au chargement pour savoir quoi proposer. */
export async function GET() {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  try {
    const [loaded, empty] = await Promise.all([isDemoLoaded(), isDatabaseEmpty()]);
    return NextResponse.json({ loaded, canSeed: empty && !loaded });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST() {
  const unauthorized = await requireOwner();
  if (unauthorized) return unauthorized;

  try {
    if (!(await isDemoLoaded()) && !(await isDatabaseEmpty())) {
      return NextResponse.json(
        {
          error:
            "La galaxie contient déjà des données. Le patrimoine d'exemple ne s'ajoute que sur une galaxie vide, pour ne pas se mélanger aux tiennes.",
        },
        { status: 409 }
      );
    }
    await seedDemo();
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE() {
  const unauthorized = await requireOwner();
  if (unauthorized) return unauthorized;

  try {
    const removed = await removeDemo();
    if (!removed) {
      return NextResponse.json(
        { error: "Aucun patrimoine d'exemple à retirer." },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
