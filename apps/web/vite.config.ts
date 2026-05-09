import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite stamps `crossorigin` onto every <script type="module"> and
// <link rel="stylesheet"> in the built index.html. That forces the
// browser into CORS mode for the request, which on iPad WebKit causes
// the bundle to be downloaded but silently never executed (no error
// event, no console — just a blank page) when ACAO headers aren't
// returned. We have no SRI or CDN here, so the attribute is pure
// downside; strip it.
const stripCrossorigin = {
  name: "strip-crossorigin",
  transformIndexHtml(html: string) {
    return html.replace(/\s+crossorigin(=["'][^"']*["'])?/g, "");
  },
};

export default defineConfig({
  plugins: [react(), stripCrossorigin],
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
