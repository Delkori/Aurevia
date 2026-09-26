import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aurevia",
    short_name: "Aurevia",
    description: "Suivi de patrimoine personnel",
    start_url: "/",
    display: "standalone",
    background_color: "#0d0d0f",
    theme_color: "#0d0d0f",
    lang: "fr",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
