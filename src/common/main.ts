import "./css/tailwind.css";
import "./css/nav-enhancements.css";
import "./css/base.css";
import "./css/card-glow.css";
import "./css/floating-dock.css";
import "./css/toc.css";
import "./css/navigation.css";

import Alpine from "alpinejs";
import { initializeAll } from "./js/alpine-modules.js";
import { startNavigation } from "./navigation.js";

window.Alpine = Alpine;
initializeAll();

void startNavigation(Alpine, import.meta.url);
