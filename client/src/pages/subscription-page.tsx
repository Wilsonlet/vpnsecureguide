import PlansGrid from "@/components/subscription/plans-grid";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CalendarClock, Zap } from "lucide-react";
import { formatBytes } from "@/lib/utils";

// Define types for API responses
interface SubscriptionResponse {
  subscription: string;
  expiryDate: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

interface LimitsResponse {
  dataUsed: number;
  dataLimit: number;
  timeUsedToday: number;
  timeLimit: number;
  isDataLimitReached: boolean;
  isTimeLimitReached: boolean;
}

export default function SubscriptionPage() {
  const { user } = useAuth();

  const { data: subscription } = useQuery<SubscriptionResponse>({
    queryKey: ["/api/subscription"],
    enabled: !!user,
  });

  const { data: limits } = useQuery<LimitsResponse>({
    queryKey: ["/api/limits"],
    enabled: !!user,
  });

  return (
    <div className="container py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Subscription Plans</h1>
        <p className="text-muted-foreground mb-6">
          Choose the plan that works best for you. All plans include military-grade encryption and our no-log policy.
        </p>

        {user && subscription && (
          <div className="bg-muted p-4 rounded-lg mb-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-lg font-medium flex items-center gap-2">
                  Current Plan: 
                  <Badge variant="outline" className="ml-2 text-sm font-normal">
                    {subscription.subscription}
                  </Badge>
                </h3>
                {subscription.expiryDate && (
                  <p className="text-sm text-muted-foreground flex items-center mt-1">
                    <CalendarClock className="mr-1 h-4 w-4" /> 
                    Expires: {new Date(subscription.expiryDate).toLocaleDateString()}
                  </p>
                )}
              </div>

              {limits && (
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Data Used</p>
                    <p className="font-medium flex items-center">
                      <Zap className="mr-1 h-4 w-4 text-primary" />
                      {formatBytes(limits.dataUsed)} / {formatBytes(limits.dataLimit)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <Separator className="my-6" />

        <PlansGrid />
      </div>
    </div>
  );
}