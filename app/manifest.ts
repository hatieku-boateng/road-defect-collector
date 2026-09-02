import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/collect",
    name: "Ghana Road Defect Collector",
    short_name: "Road Collector",
    description:
      "Capture privacy-processed, GPS-backed road defect reports across Ghana.",
    start_url: "/collect?source=installed-app",
    scope: "/",
    display: "standalone",
    background_color: "#f3f7f3",
    theme_color: "#0b5d4b",
    orientation: "portrait-primary",
    categories: ["government", "productivity", "utilities"],
    icons: [
      {
        src: "/icons/road-collector-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/road-collector-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/road-collector-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
    shortcuts: [
      {
        name: "Report a road",
        short_name: "New report",
        description: "Take or upload a GPS-backed road photograph.",
        url: "/collect",
        icons: [{ src: "/icons/road-collector-192.png", sizes: "192x192" }],
      },
      {
        name: "Public dashboard",
        short_name: "Road reports",
        description: "View reported defects and repair progress.",
        url: "/reports",
        icons: [{ src: "/icons/road-collector-192.png", sizes: "192x192" }],
      },
    ],
  };
}
