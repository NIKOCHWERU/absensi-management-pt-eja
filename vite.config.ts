import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.png", "logo_elok_buah.jpg"],
      manifest: {
        name: "Absensi PT EJA",
        short_name: "Absensi EJA",
        description: "Aplikasi Manajemen Absensi PT Elok Jaya Abadhi",
        theme_color: "#1a1a1a",
        background_color: "#ffffff",
        display: "standalone",
        icons: [
          {
            src: "/logo_elok_buah.jpg",
            sizes: "192x192",
            type: "image/jpeg",
          },
          {
            src: "/logo_elok_buah.jpg",
            sizes: "512x512",
            type: "image/jpeg",
          },
          {
            src: "/logo_elok_buah.jpg",
            sizes: "512x512",
            type: "image/jpeg",
            purpose: "any maskable",
          }
        ],
      },
    }),
    ...(process.env.NODE_ENV !== "production" &&
      process.env.REPL_ID !== undefined
      ? [
        await import("@replit/vite-plugin-cartographer").then((m) =>
          m.cartographer(),
        ),
        await import("@replit/vite-plugin-dev-banner").then((m) =>
          m.devBanner(),
        ),
      ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "client", "src"),
      "@shared": path.resolve(process.cwd(), "shared"),
      "@assets": path.resolve(process.cwd(), "attached_assets"),
    },
  },
  root: path.resolve(process.cwd(), "client"),
  build: {
    outDir: path.resolve(process.cwd(), "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
