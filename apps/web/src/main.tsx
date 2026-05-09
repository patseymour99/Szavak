import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./i18n";
import "./index.css";
import App from "./App";

// Tell the inline diagnostic in index.html that the module ran far enough
// to start React. The diagnostic also checks whether #root still contains
// the fallback marker, so we can tell apart "bundle never ran" from
// "bundle ran but React render silently crashed".
document.documentElement.dataset.appMounted = "starting";

try {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>,
  );
  document.documentElement.dataset.appMounted = "yes";
} catch (err) {
  document.documentElement.dataset.appMounted = "error";
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = "";
    const pre = document.createElement("pre");
    pre.style.cssText =
      "padding:24px;color:#b91c1c;white-space:pre-wrap;font:13px ui-monospace,monospace";
    pre.textContent =
      "React mount threw:\n" +
      ((err as Error)?.stack || (err as Error)?.message || String(err));
    root.appendChild(pre);
  }
  throw err;
}
