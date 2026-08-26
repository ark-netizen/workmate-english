import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import "./index.css";
import "./intro-solar-highlight.css";
import "./game-mode-workspace.css";
import "./intro-mobile.css";
import "./intro-mobile-hotfix.css";
import "./mobile-responsive-v2.css";
import "./mobile-trial-preview.css";
import "./mobile-trial-preview-v2.css";
import "./mobile-trial-fidelity.css";
import "./mobile-spacing-pass.css";
import "./mobile-rank-otters.css";
import "./intro-nav-responsive.css";
import "./intro-scroll-enhance.css";
import "./intro-business-process-layout.css";
import "./intro-game-process-layout.css";
import "./intro-game-flutter.css";
import "./intro-progress-mode.css";
import "./intro-scroll-qa.css";
import "./mobile-device-resilience.css";
import "./mobile-vertical-density.css";
import "./intro-scroll-enhance";
import "./intro-game-flutter";
import "./intro-copy-polish";
import "./enable-mobile-intro-trial";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
