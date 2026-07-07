import { createRoot } from "react-dom/client";
import "@/ui/theme.css";
import { OverlayApp } from "./OverlayApp";

document.body.classList.add("overlay");
createRoot(document.getElementById("root")!).render(<OverlayApp />);
