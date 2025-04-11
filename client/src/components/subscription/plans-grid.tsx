import { useQuery } from "@tanstack/react-query";
import { SubscriptionPlan } from "@shared/schema";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, Check, X, Wifi, Clock } from "lucide-react";
import { formatBytes } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import SubscribeCard from "./subscribe-card";

export default function PlansGrid() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);

  const { data: plans, isLoading, error } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/subscription-plans"],
  });

  // Define interface for subscription response
  interface SubscriptionResponse {
    subscription: string;
    expiryDate: string | null;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
  }

  const { data: currentSubscription } = useQuery<SubscriptionResponse>({
    queryKey: ["/api/subscription"],
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error || !plans) {
    return (
      <div className="p-6 text-center">
        <h3 className="text-lg font-medium mb-2">Error loading subscription plans</h3>
        <p className="text-muted-foreground">Please try again later</p>
      </div>
    );
  }

  // Sort plans by priority
  const sortedPlans = [...plans].sort((a, b) => a.priority - b.priority);

  const handleSelectPlan = (plan: SubscriptionPlan) => {
    // For free plan, just update the subscription directly
    if (plan.price === 0) {
      toast({
        title: "Processing...",
        description: "Updating your subscription plan"
      });
      
      // Call the API to update the subscription
      apiRequest("POST", "/api/update-free-subscription", { planName: plan.name })
        .then(response => {
          if (!response.ok) {
            throw new Error("Failed to update subscription");
          }
          return response.json();
        })
        .then(() => {
          toast({
            title: "Success!",
            description: "Your subscription has been updated to the Free plan",
          });
          // Invalidate the subscription query to refresh the data
          queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
        })
        .catch(err => {
          toast({
            title: "Error",
            description: err.message || "Failed to update subscription",
            variant: "destructive",
          });
        });
      return;
    }
    
    // For paid plans, check if Stripe price ID exists
    if (!plan.stripePriceId) {
      toast({
        title: "Subscription unavailable",
        description: "This subscription plan is not available for purchase at this time",
        variant: "destructive",
      });
      return;
    }
    
    // Check if user has email
    if (!user?.email) {
      toast({
        title: "Email required",
        description: "Please update your profile to add an email address before subscribing",
        variant: "destructive",
      });
      return;
    }
    
    setSelectedPlan(plan);
  };

  if (selectedPlan) {
    return (
      <div className="flex justify-center my-8">
        <SubscribeCard 
          plan={selectedPlan} 
          onSuccess={() => setSelectedPlan(null)}
          onCancel={() => setSelectedPlan(null)}
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 my-8">
      {sortedPlans.map((plan) => (
        <Card key={plan.id} className={plan.name === "Premium" ? "border-primary shadow-md" : ""}>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                <CardDescription className="mt-1">
                  {plan.price === 0 ? (
                    "Free"
                  ) : (
                    <span className="text-lg font-medium">
                      ${(plan.price / 100).toFixed(2)}/month
                    </span>
                  )}
                </CardDescription>
              </div>
              {plan.name === "Premium" && (
                <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Wifi className="h-5 w-5 text-primary" />
                <span>
                  {plan.serverAccess === "all" 
                    ? "All Server Types" 
                    : plan.serverAccess === "premium" 
                      ? "Premium Servers" 
                      : "Standard Servers"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <span>
                  {plan.dataLimit === 0
                    ? "Unlimited Data"
                    : plan.name === "free"
                      ? "500 MB/month"
                      : formatBytes(plan.dataLimit)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <span>
                  {plan.dailyTimeLimit === 0
                    ? "Unlimited Usage Time"
                    : `${plan.dailyTimeLimit} minutes/day`}
                </span>
              </div>
            </div>
            
            <div className="pt-2 space-y-2">
              {/* Standard features for all plans */}
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>{plan.maxDevices} {plan.maxDevices === 1 ? "Device" : "Devices"}</span>
              </div>
              
              {/* Features that vary by plan */}
              <div className="flex items-center gap-2">
                {plan.doubleVpnAccess ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <X className="h-4 w-4 text-gray-400" />
                )}
                <span>Double VPN</span>
              </div>
              <div className="flex items-center gap-2">
                {plan.obfuscationAccess ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <X className="h-4 w-4 text-gray-400" />
                )}
                <span>Obfuscation (Anti-censorship)</span>
              </div>
              <div className="flex items-center gap-2">
                {plan.adFree ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <X className="h-4 w-4 text-gray-400" />
                )}
                <span>Ad-Free Experience</span>
              </div>
              
              {/* Ultimate plan specific features */}
              {plan.name === "ultimate" && (
                <>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>Streaming & P2P Optimized</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>Kill Switch</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>Split Tunneling</span>
                  </div>
                </>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              className="w-full" 
              variant={currentSubscription && plan.name === currentSubscription.subscription ? "outline" : "default"}
              disabled={currentSubscription && plan.name === currentSubscription.subscription}
              onClick={() => handleSelectPlan(plan)}
            >
              {currentSubscription && plan.name === currentSubscription.subscription
                ? "Current Plan"
                : plan.price === 0
                ? "Select Free Plan"
                : "Subscribe Now"}
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}