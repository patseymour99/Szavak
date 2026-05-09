import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./i18n";
import "./index.css";
import App from "./App";

// Tell the inline diagnostic in index.html that the module ran far enough
// to start React. If this flag never gets set, the diagnostic surfaces the
// module URL/status so we can tell *why* it didn't run.
document.documentElement.dataset.appMounted = "yes";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
