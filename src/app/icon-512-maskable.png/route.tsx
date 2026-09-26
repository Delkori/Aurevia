import { ImageResponse } from "next/og";
import { pwaIcon } from "../pwaIcon";

// Android recadre les icônes « maskable » dans un cercle central : la lettre
// doit tenir dans la zone de sécurité (~80 % du canevas), d'où un ratio
// plus petit que les icônes normales pour ne jamais être coupée.
export const dynamic = "force-static";

export async function GET() {
  return new ImageResponse(pwaIcon({ size: 512, letterRatio: 0.4 }), { width: 512, height: 512 });
}
