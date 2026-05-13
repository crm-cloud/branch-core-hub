import React from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { initGlobalErrorLogging } from "./services/errorLogService";
import { ThemeProvider } from "./contexts/ThemeContext";

// Initialize global error capture before React renders
initGlobalErrorLogging();

// Recover from stale code-split chunks after a redeploy. Vite emits the
// 'vite:preloadError' event when an `import()` fails because the hashed
// chunk no longer exists on the server. Reload once per session so the
// user gets the new bundle instead of a "Failed to fetch dynamically
// imported module" error toast.
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', () => {
    if (sessionStorage.getItem('__vite_preload_reloaded') === '1') return;
    sessionStorage.setItem('__vite_preload_reloaded', '1');
    window.location.reload();
  });
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HelmetProvider>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </HelmetProvider>
  </React.StrictMode>
);
