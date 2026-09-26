import { ImageResponse } from "next/og";
import { pwaIcon } from "./pwaIcon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(pwaIcon({ size: 180, letterRatio: 0.56 }), size);
}
