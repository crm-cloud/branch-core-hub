import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { drAssets } from "./vite-plugins/dr-assets";

const SUPABASE_URL = "https://iyqqpbvnszyrrgerniog.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5cXFwYnZuc3p5cnJnZXJuaW9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyMzE1NjIsImV4cCI6MjA4MTgwNzU2Mn0.EAmMC21oRiyV8sgixS8eQE3-b17_-Y9kn2-os8fv0Eo";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "0.0.0.0",
    port: 5000,
    allowedHosts: true as const,
  },
  plugins: [
    react(),
    drAssets({
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: SUPABASE_ANON_KEY,
      env: process.env.VITE_APP_ENV ?? "primary",
      version: process.env.VITE_BUILD_SHA,
      supportEmail: "support@theincline.in",
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // Isolate heavy 3D libs so the public landing only loads them when
        // Scene3D is actually mounted (lazy + IO-gated).
        manualChunks: {
          three: ['three', '@react-three/fiber', '@react-three/drei'],
        },
      },
    },
  },
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(SUPABASE_URL),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(SUPABASE_ANON_KEY),
    "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify("iyqqpbvnszyrrgerniog"),
    "import.meta.env.VITE_APP_ENV": JSON.stringify(process.env.VITE_APP_ENV ?? "primary"),
    "import.meta.env.VITE_BUILD_SHA": JSON.stringify(process.env.VITE_BUILD_SHA ?? "dev"),
  },
}));
