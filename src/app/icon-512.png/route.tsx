import { ImageResponse } from "next/og";
import { pwaIcon } from "../pwaIcon";

export const dynamic = "force-static";

export async function GET() {
  return new ImageResponse(pwaIcon({ size: 512, letterRatio: 0.56 }), { width: 512, height: 512 });
}
