import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "LÍA — Life Operating System",
    short_name: "LÍA",
    description: "Tu Chief of Staff personal: captura, prioriza y dirige tu vida con claridad.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f4ef",
    theme_color: "#f6f4ef",
    lang: "es",
    categories: ["productivity", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Capturar", short_name: "Capturar", url: "/capture", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Hablar con LÍA", short_name: "LÍA", url: "/lia", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Hoy", short_name: "Hoy", url: "/today", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
