import { createRoot } from "react-dom/client";
import { Suspense } from "react";
import App from "./App";
import "./index.css";

document.title = "SecureShield VPN - Military-Grade Encryption for Your Security";

// Loading fallback for entire application
const AppLoadingFallback = () => (
  <div className="h-screen flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-4">
      <div className="w-16 h-16 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
      <p className="text-xl font-semibold text-primary">SecureShield VPN</p>
      <p className="text-muted-foreground">Initializing secure environment...</p>
    </div>
  </div>
);

// Wrap the entire app in a suspense boundary
createRoot(document.getElementById("root")!).render(
  <Suspense fallback={<AppLoadingFallback />}>
    <App />
  </Suspense>
);
