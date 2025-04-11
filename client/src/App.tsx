import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import SubscriptionPage from "@/pages/subscription-page";
import AccountPage from "@/pages/account-page";
import AdminPage from "@/pages/admin-page";
import ServersPage from "@/pages/servers-page";
import ClientsPage from "@/pages/clients-page";
import SettingsPage from "@/pages/settings-page";
import SupportPage from "@/pages/support-page";
import { ProtectedRoute } from "./lib/protected-route";
import { AuthProvider } from "./hooks/use-auth";
import { VpnStateProvider } from "./lib/vpn-service";
import { AdSenseScript } from "./components/ads/adsense-script";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/dashboard" component={Dashboard} />
      <ProtectedRoute path="/subscription" component={SubscriptionPage} />
      <ProtectedRoute path="/account" component={AccountPage} />
      <ProtectedRoute path="/admin" component={AdminPage} />
      <ProtectedRoute path="/servers" component={ServersPage} />
      <ProtectedRoute path="/clients" component={ClientsPage} />
      <ProtectedRoute path="/settings" component={SettingsPage} />
      <ProtectedRoute path="/support" component={SupportPage} />
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <VpnStateProvider>
          <Router />
          <Toaster />
          <AdSenseScript />
        </VpnStateProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
