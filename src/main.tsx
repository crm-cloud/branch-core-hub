import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initGlobalErrorLogging } from "./services/errorLogService";
import { ThemeProvider } from "./contexts/ThemeContext";

// Initialize global error capture before React renders
initGlobalErrorLogging();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
