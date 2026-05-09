import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Strip `crossorigin` from the built index.html and swap `type="module"`
// for `defer` so the bundle loads as a deferred classic <script>. iPad
// WebKit's module loader silently rejects same-origin module fetches
// ("Importing a module script failed"), and a plain non-deferred script
// runs before <body> exists, which crashes createRoot. Deferred classic
// matches module semantics (executes after HTML parse) without going
// through the broken module path.
const buildAsClassicScript = {
  name: "build-as-classic-script",
  enforce: "post" as const,
  transformIndexHtml(html: string) {
    return html
      .replace(/\s+crossorigin(=["'][^"']*["'])?/g, "")
      .replace(/\s+type="module"/g, " defer");
  },
};

export default defineConfig({
  plugins: [react(), buildAsClassicScript],
  build: {
    // Single-file IIFE output. Vite's default ESM output with code
    // splitting produces <script type="module"> + chunk imports, which
    // is what triggers the WebKit failure. IIFE bundles everything into
    // one classic script.
    rollupOptions: {
      output: {
        format: "iife",
        inlineDynamicImports: true,
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        secure: false,
      },
      "/socket.io": {
        target: "http://localhost:3001",
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
