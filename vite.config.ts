import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";

// Static site: everything runs in the browser, there is no server code.
// `npm run build` writes the site to dist/client, ready for any static host
// (Cloudflare Pages, Netlify, GitHub Pages...).
export default defineConfig({
  server: { port: 8080 },
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // Every page is pre-generated as static HTML. /404 becomes 404.html,
      // which static hosts serve automatically for unknown addresses.
      prerender: { enabled: true, crawlLinks: true },
      pages: [{ path: "/404", prerender: { enabled: true, outputPath: "/404.html" } }],
    }),
    viteReact(),
  ],
});
