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
import SettingsPage from "@/pages/settings-page";
import SupportPage from "@/pages/support-page";
import { ProtectedRoute } from "./lib/protected-route";
import { AuthProvider } from "./hooks/use-auth";
import { withVpnState } from "./lib/vpn-service";

// Wrap each component with the VPN state provider
const DashboardWithVpnState = withVpnState(Dashboard);
const ServersPageWithVpnState = withVpnState(ServersPage);
const SettingsPageWithVpnState = withVpnState(SettingsPage);

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={DashboardWithVpnState} />
      <ProtectedRoute path="/dashboard" component={DashboardWithVpnState} />
      <ProtectedRoute path="/subscription" component={SubscriptionPage} />
      <ProtectedRoute path="/account" component={AccountPage} />
      <ProtectedRoute path="/admin" component={AdminPage} />
      <ProtectedRoute path="/servers" component={ServersPageWithVpnState} />
      <ProtectedRoute path="/settings" component={SettingsPageWithVpnState} />
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
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
