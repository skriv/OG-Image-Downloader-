import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider } from "./i18n.jsx";
import App from "./App.jsx";
import "../styles/globals.css";

function dismissBootLoader() {
  const el = document.getElementById("boot-loader");
  if (!el) return;
  el.classList.add("boot-loader--hide");
  window.setTimeout(() => el.remove(), 180);
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>
);

requestAnimationFrame(() => {
  requestAnimationFrame(dismissBootLoader);
});
