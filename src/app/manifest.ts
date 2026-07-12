import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Devan Family Meals",
    short_name: "Meals",
    description:
      "Weekly meal planning, groceries, and lunchboxes for the Devan household",
    start_url: "/",
    display: "standalone",
    background_color: "#faf5ee",
    theme_color: "#d97706",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
