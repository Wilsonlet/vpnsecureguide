import { useState, useEffect } from "react";
import { useStripe, useElements, PaymentElement } from "@stripe/react-stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle, ExternalLink } from "lucide-react";
import { SubscriptionPlan } from "@shared/schema";

// Make sure to call loadStripe outside of a component's render to avoid
// recreating the Stripe object on every render.
// We'll check if the key is available to provide better error messages
const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
const stripePromise = stripePublicKey ? loadStripe(stripePublicKey) : null;

interface Props {
  plan: SubscriptionPlan;
  onSuccess?: () => void;
  onCancel?: () => void;
}

function SubscribeForm({ plan, onSuccess, onCancel }: Props) {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      // Stripe.js hasn't yet loaded.
      // Make sure to disable form submission until Stripe.js has loaded.
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin + "/dashboard",
      },
      redirect: "if_required",
    });

    if (error) {
      setErrorMessage(error.message || "An unknown error occurred");
      toast({
        title: "Payment failed",
        description: error.message || "An unknown error occurred",
        variant: "destructive",
      });
    } else {
      // Success
      toast({
        title: "Payment successful",
        description: `You are now subscribed to the ${plan.name} plan!`,
      });
      if (onSuccess) onSuccess();
    }

    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      {errorMessage && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
      <PaymentElement className="mb-6" />
      <div className="flex justify-between">
        <Button variant="outline" type="button" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={!stripe || isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Subscribe Now - ${(plan.price / 100).toFixed(2)}/month
        </Button>
      </div>
    </form>
  );
}

export default function SubscribeCard({ plan, onSuccess, onCancel }: Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configIssue, setConfigIssue] = useState<'price_id' | 'stripe_keys' | null>(null);
  const { toast } = useToast();

  // Check for configuration issues on mount
  useEffect(() => {
    if (!plan.stripePriceId) {
      setConfigIssue('price_id');
    } else if (!stripePublicKey) {
      setConfigIssue('stripe_keys');
    }
  }, [plan]);

  const handleSubscribe = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Check if the plan has a Stripe price ID
      if (!plan.stripePriceId) {
        throw new Error("This subscription plan is not available for purchase at this time. The plan does not have a valid Stripe price ID configured.");
      }

      // Check if Stripe is properly configured
      if (!stripePublicKey) {
        throw new Error("Stripe payment is not properly configured. Please contact the administrator.");
      }
      
      const response = await apiRequest("POST", "/api/create-subscription", { planName: plan.name });
      
      // Handle common HTTP errors
      if (response.status === 401) {
        throw new Error("You need to log in to subscribe to this plan.");
      } else if (response.status === 403) {
        throw new Error("You don't have permission to subscribe to this plan.");
      } else if (response.status === 500) {
        throw new Error("The server encountered an error. The payment gateway may not be properly configured.");
      }
      
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to create subscription");
      }

      setClientSecret(data.clientSecret);
    } catch (err: any) {
      setError(err.message || "An error occurred while setting up the payment");
      toast({
        title: "Subscription error",
        description: err.message || "An error occurred while setting up the payment",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">{plan.name} Plan</CardTitle>
        <CardDescription>
          ${(plan.price / 100).toFixed(2)}/month
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Show configuration issues with helpful explanations */}
        {configIssue === 'price_id' && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4 mr-2" />
            <AlertTitle>Plan Not Available</AlertTitle>
            <AlertDescription className="mt-2">
              <p>This subscription plan is not available for purchase at this time.</p>
              <p className="mt-2 text-sm">The administrator needs to configure the Stripe price ID for this plan in the admin panel.</p>
            </AlertDescription>
          </Alert>
        )}
        
        {configIssue === 'stripe_keys' && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4 mr-2" />
            <AlertTitle>Payment Not Configured</AlertTitle>
            <AlertDescription className="mt-2">
              <p>The Stripe payment system is not properly configured.</p>
              <p className="mt-2 text-sm">The administrator needs to set up Stripe API keys for the application.</p>
            </AlertDescription>
          </Alert>
        )}
        
        {error && !configIssue && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4 mr-2" />
            <AlertTitle>Subscription Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {!clientSecret ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">Data Limit:</span>
                <span>{(plan.dataLimit / (1024 * 1024 * 1024)).toFixed(0)} GB</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Daily Time Limit:</span>
                <span>{plan.dailyTimeLimit} minutes</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Max Devices:</span>
                <span>{plan.maxDevices}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Premium Features:</span>
                <span>
                  {plan.doubleVpnAccess ? "Double VPN, " : ""}
                  {plan.obfuscationAccess ? "Obfuscation, " : ""}
                  {plan.adFree ? "Ad-Free" : ""}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <SubscribeForm plan={plan} onSuccess={onSuccess} onCancel={() => setClientSecret(null)} />
          </Elements>
        )}
      </CardContent>

      {!clientSecret && (
        <CardFooter>
          <Button 
            onClick={handleSubscribe} 
            className="w-full" 
            disabled={isLoading || configIssue !== null}
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {configIssue ? "Currently Unavailable" : "Subscribe Now"}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}