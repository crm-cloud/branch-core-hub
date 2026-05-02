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
    // Raised after vendor split lands. Charts/data vendors legitimately
    // approach 600 KB; anything above that is a regression worth investigating.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Vendor-aware manual chunks. Each route only pays for what it imports;
        // shared vendors are split into focused groups so a single page refresh
        // doesn't redownload everything.
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined;

          // 3D landing page (heaviest, IO-gated)
          if (
            id.includes('/three/') ||
            id.includes('@react-three/fiber') ||
            id.includes('@react-three/drei')
          ) return 'three';

          // PDF / spreadsheet / QR — only loaded by routes that build documents
          if (
            id.includes('/jspdf/') ||
            id.includes('jspdf-autotable') ||
            id.includes('/qrcode/') ||
            id.includes('/html2canvas/') ||
            id.includes('/xlsx/')
          ) return 'docs-vendor';

          // Charts (recharts + d3 dependencies)
          if (id.includes('/recharts/') || id.includes('/d3-')) return 'charts-vendor';

          // Drag & drop, carousels
          if (
            id.includes('@hello-pangea/dnd') ||
            id.includes('embla-carousel')
          ) return 'motion-vendor';

          // Date utilities
          if (id.includes('/date-fns/') || id.includes('react-day-picker')) return 'date-vendor';

          // Form stack
          if (
            id.includes('react-hook-form') ||
            id.includes('@hookform') ||
            id.includes('/zod/')
          ) return 'forms-vendor';

          // Data layer
          if (
            id.includes('@tanstack/react-query') ||
            id.includes('@supabase/supabase-js')
          ) return 'data-vendor';

          // Radix primitives (one chunk for all radix packages)
          if (id.includes('@radix-ui/')) return 'radix-vendor';

          // Misc UI utilities frequently shared
          if (
            id.includes('lucide-react') ||
            id.includes('/sonner/') ||
            id.includes('/cmdk/') ||
            id.includes('/vaul/') ||
            id.includes('class-variance-authority') ||
            id.includes('tailwind-merge') ||
            id.includes('/clsx/')
          ) return 'ui-vendor';

          // React core
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('react-router-dom') ||
            id.includes('react-helmet-async')
          ) return 'react-vendor';

          return undefined;
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
