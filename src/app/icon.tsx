import { ImageResponse } from "next/og";
import { pwaIcon } from "./pwaIcon";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(pwaIcon({ size: 32, letterRatio: 0.62 }), size);
}
