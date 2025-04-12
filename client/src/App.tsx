import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { lazy, Suspense } from "react";
import { ProtectedRoute } from "./lib/protected-route";
import { AuthProvider } from "./hooks/use-auth";
import { FirebaseAuthProvider } from "./hooks/use-firebase-auth";
import { VpnStateProvider } from "./lib/vpn-service";
import { AdSenseScript } from "./components/ads/adsense-script";
import { ThirdPartyErrorHandler, UrlErrorHandler } from "./components/analytics/error-handlers";

// Lazy load all pages to improve initial load time
const NotFound = lazy(() => import("@/pages/not-found"));
const AuthPage = lazy(() => import("@/pages/auth-page"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const SubscriptionPage = lazy(() => import("@/pages/subscription-page"));
const CheckoutPage = lazy(() => import("@/pages/checkout"));
const PaystackCheckoutPage = lazy(() => import("@/pages/paystack-checkout"));
const AccountPage = lazy(() => import("@/pages/account-page"));
const AdminPage = lazy(() => import("@/pages/admin-page"));
const ServersPage = lazy(() => import("@/pages/servers-page"));
const ClientsPage = lazy(() => import("@/pages/clients-page"));
const SettingsPage = lazy(() => import("@/pages/settings-page"));
const SupportPage = lazy(() => import("@/pages/support-page"));

// Loading skeleton component
const LoadingSkeleton = () => (
  <div className="h-screen flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
      <p className="text-muted-foreground">Loading SecureShield VPN...</p>
    </div>
  </div>
);

function Router() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <Switch>
        <ProtectedRoute path="/" component={Dashboard} />
        <ProtectedRoute path="/dashboard" component={Dashboard} />
        <ProtectedRoute path="/subscription" component={SubscriptionPage} />
        <ProtectedRoute path="/checkout" component={CheckoutPage} />
        <ProtectedRoute path="/paystack-checkout" component={PaystackCheckoutPage} />
        <ProtectedRoute path="/account" component={AccountPage} />
        <ProtectedRoute path="/admin" component={AdminPage} />
        <ProtectedRoute path="/servers" component={ServersPage} />
        <ProtectedRoute path="/clients" component={ClientsPage} />
        <ProtectedRoute path="/settings" component={SettingsPage} />
        <ProtectedRoute path="/support" component={SupportPage} />
        <Route path="/auth" component={AuthPage} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Error handlers - must be at the top level */}
      <ThirdPartyErrorHandler />
      <UrlErrorHandler />
      
      <FirebaseAuthProvider>
        <AuthProvider>
          <VpnStateProvider>
            <Router />
            <Toaster />
            <AdSenseScript />
          </VpnStateProvider>
        </AuthProvider>
      </FirebaseAuthProvider>
    </QueryClientProvider>
  );
}

export default App;
