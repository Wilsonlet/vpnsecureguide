import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

document.title = "SecureVPN - Secure and Private Internet Access";

createRoot(document.getElementById("root")!).render(
  <App />
);
