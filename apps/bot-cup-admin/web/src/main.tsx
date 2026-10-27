import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@web/shared/theme/reset.css";
import "@web/shared/theme/tokens.css";
import "@web/shared/theme/global.css";
import { applyTheme, initialTheme, getSystemPrefersDark } from "@web/shared/theme/theme";
import { DemoNav } from "@web/shared/demo-nav/DemoNav";
import { AdminApp } from "./AdminApp";
import { AdminApi } from "./api";

applyTheme(initialTheme(undefined, getSystemPrefersDark()));

const root = document.getElementById("root");
if (!root) throw new Error("admin root element is missing");
createRoot(root).render(
  <StrictMode>
    <AdminApp api={new AdminApi()} />
    <DemoNav />
  </StrictMode>,
);
