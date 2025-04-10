import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { VpnStateProvider } from "./lib/vpn-service.tsx";

document.title = "SecureVPN - Secure and Private Internet Access";

createRoot(document.getElementById("root")!).render(
  <VpnStateProvider>
    <App />
  </VpnStateProvider>
);
