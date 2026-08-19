import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./i18n"; // Initializes i18next
import { A11yProvider } from "./services/accessibility";
import "leaflet/dist/leaflet.css";
import "./styles.css";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    if (import.meta.env.DEV) {
      void navigator.serviceWorker.getRegistrations().then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister()))
      );
      return;
    }
    void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <A11yProvider>
      <App />
    </A11yProvider>
  </React.StrictMode>
);
