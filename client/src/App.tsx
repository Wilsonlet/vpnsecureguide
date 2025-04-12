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
import { SeoHead } from "@/components/seo";

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
const SettingsStandalone = lazy(() => import("@/pages/settings-standalone"));
const SupportPage = lazy(() => import("@/pages/support-page"));
const FirebaseSetupGuide = lazy(() => import("@/pages/firebase-setup-guide"));

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
        <Route path="/checkout/paystack" component={PaystackCheckoutPage} />
        <Route path="/checkout/paystack/:plan/:ref" component={PaystackCheckoutPage} />
        <ProtectedRoute path="/account" component={AccountPage} />
        <ProtectedRoute path="/admin" component={AdminPage} />
        <ProtectedRoute path="/servers" component={ServersPage} />
        <ProtectedRoute path="/clients" component={ClientsPage} />
        <ProtectedRoute path="/settings" component={SettingsPage} />
        <ProtectedRoute path="/settings-standalone" component={SettingsStandalone} />
        <ProtectedRoute path="/support" component={SupportPage} />
        <Route path="/auth" component={AuthPage} />
        <Route path="/firebase-setup-guide" component={FirebaseSetupGuide} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

// Error boundary component to catch and display auth-related errors
function ErrorFallback({ error, resetErrorBoundary }: { error: Error, resetErrorBoundary: () => void }) {
  return (
    <div className="p-6 flex flex-col items-center justify-center min-h-screen">
      <div className="bg-destructive/10 p-4 rounded-lg border border-destructive max-w-lg w-full">
        <h2 className="text-xl font-semibold mb-2">Authentication Error</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {error.message || 'An error occurred with the authentication system'}
        </p>
        <button 
          onClick={resetErrorBoundary}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Default SEO component for the entire app */}
      <SeoHead />
      
      {/* Error handlers - must be at the top level */}
      <ThirdPartyErrorHandler />
      <UrlErrorHandler />
      
      {/* We're changing the provider order to improve error isolation */}
      <Suspense fallback={<LoadingSkeleton />}>
        <VpnStateProvider>
          <FirebaseAuthProvider>
            <AuthProvider>
              <Router />
              <Toaster />
              <AdSenseScript />
            </AuthProvider>
          </FirebaseAuthProvider>
        </VpnStateProvider>
      </Suspense>
    </QueryClientProvider>
  );
}

export default App;
