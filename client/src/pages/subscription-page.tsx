import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import PlanCard from '@/components/subscription/plan-card';
import { PaymentMethodSelector, PaymentMethod } from '@/components/subscription/payment-method-selector';
import { SubscriptionPlan } from '@shared/schema';
import { apiRequest, queryClient } from '@/lib/queryClient';

export default function SubscriptionPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [processingPlanId, setProcessingPlanId] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('stripe');
  
  const { data: plans, isLoading: plansLoading, error: plansError } = useQuery({
    queryKey: ['/api/subscription-plans'],
    queryFn: () => fetch('/api/subscription-plans').then(res => res.json()),
  });
  
  const { data: currentSubscription, isLoading: subscriptionLoading } = useQuery({
    queryKey: ['/api/subscription'],
    queryFn: () => fetch('/api/subscription').then(res => res.json()),
    enabled: !!user,
  });
  
  const subscriptionMutation = useMutation({
    mutationFn: async (plan: SubscriptionPlan) => {
      const response = await apiRequest('POST', '/api/initialize-payment', { 
        planName: plan.name,
        paymentMethod
      });
      return response.json();
    },
    onSuccess: (data) => {
      console.log('Payment initialization successful:', data);
      
      if (data.success) {
        if (data.paymentProvider === 'stripe' && data.url) {
          // Redirect to Stripe hosted checkout
          window.location.href = data.url;
        } else if (data.paymentProvider === 'paystack' && data.authorizationUrl) {
          // Redirect to our Paystack checkout page
          const selectedPlan = plans.find((p: SubscriptionPlan) => p.name === data.planName);
          const planPrice = selectedPlan ? (selectedPlan.price / 100) : 0; // Convert from cents to dollars
          
          // Extract reference from authorizationUrl
          const ref = data.reference || data.authorizationUrl.split('ref=')[1]?.split('&')[0];
          
          // Use new URL path format to avoid query parameter issues
          const checkoutUrl = `/checkout/paystack/${data.planName}/${ref}?price=${planPrice}`;
          window.location.href = checkoutUrl;
        } else if (data.redirectUrl) {
          // Free plan or other non-payment scenario with redirect
          window.location.href = data.redirectUrl;
        } else {
          // Free plan without redirect
          toast({
            title: 'Subscription Updated',
            description: data.message || 'Your subscription has been updated successfully.',
            variant: 'default',
          });
          
          // Refresh the subscription data
          queryClient.invalidateQueries({ queryKey: ['/api/subscription'] });
          queryClient.invalidateQueries({ queryKey: ['/api/user'] });
          
          // For free plan, stay on the subscription page
          setProcessingPlanId(null);
        }
      } else {
        // Handle non-success response
        toast({
          title: 'Subscription Error',
          description: data.message || 'Failed to initialize payment.',
          variant: 'destructive',
        });
        setProcessingPlanId(null);
      }
    },
    onError: (error: Error) => {
      console.error('Payment initialization error:', error);
      toast({
        title: 'Subscription Error',
        description: `Failed to update subscription: ${error.message}`,
        variant: 'destructive',
      });
      setProcessingPlanId(null);
    },
  });
  
  const handleSelectPlan = (plan: SubscriptionPlan) => {
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'Please log in to subscribe to a plan.',
        variant: 'destructive',
      });
      return;
    }
    
    // Don't select if it's the current plan
    if (currentSubscription && currentSubscription.subscription === plan.name) {
      toast({
        title: 'Already Subscribed',
        description: 'You are already subscribed to this plan.',
        variant: 'default',
      });
      return;
    }
    
    setProcessingPlanId(plan.id);
    subscriptionMutation.mutate(plan);
  };
  
  if (plansLoading || subscriptionLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (plansError) {
    return (
      <div className="container py-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load subscription plans. Please try again later.
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  // Sort plans by priority
  const sortedPlans = [...plans].sort((a, b) => a.priority - b.priority);
  
  return (
    <div className="container py-8">
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
            Select Your VPN Plan
          </h1>
          <p className="text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
            Choose the perfect plan to protect your online privacy and security
          </p>
        </div>
        
        {currentSubscription && (
          <div className="mb-6">
            <Alert className="bg-muted">
              <Shield className="h-4 w-4" />
              <AlertTitle>Current Subscription</AlertTitle>
              <AlertDescription>
                You are currently on the <strong className="capitalize">{currentSubscription.subscription}</strong> plan
                {currentSubscription.expiryDate && (
                  <> until {new Date(currentSubscription.expiryDate).toLocaleDateString()}</>
                )}
              </AlertDescription>
            </Alert>
          </div>
        )}
        
        {/* Payment Method Selection Section - moved to top */}
        <div className="bg-muted p-4 sm:p-6 rounded-lg mb-6">
          <h2 className="text-xl font-semibold mb-2">Payment Method</h2>
          <p className="text-muted-foreground mb-4">
            Choose your preferred payment method for your subscription
          </p>
          <PaymentMethodSelector
            selectedMethod={paymentMethod}
            onChange={setPaymentMethod}
          />
        </div>
        
        <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-4">
          {sortedPlans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrentPlan={currentSubscription?.subscription === plan.name}
              onSelect={handleSelectPlan}
              className={processingPlanId === plan.id ? 'opacity-70 pointer-events-none' : ''}
            />
          ))}
        </div>
        
        <div className="text-center mt-8 sm:mt-10">
          <div className="inline-flex items-center justify-center rounded-full border bg-muted px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium transition-colors">
            <CheckCircle className="mr-1 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500" />
            <span>Secure payment processing with multiple options</span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-2 px-1">
            All plans include our no-logs policy, military-grade encryption, and automatic kill switch.
          </p>
        </div>
        
        <div className="bg-muted rounded-lg p-4 sm:p-6 mt-8 sm:mt-10">
          <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="p-3 sm:p-4 pb-1 sm:pb-2">
                <CardTitle className="text-base sm:text-lg">Global Network</CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 pt-0">
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Access to servers in 90+ countries with unlimited server switching
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="p-3 sm:p-4 pb-1 sm:pb-2">
                <CardTitle className="text-base sm:text-lg">Device Compatibility</CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 pt-0">
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Works on all major platforms including Windows, macOS, iOS, Android, and Linux
                </p>
              </CardContent>
            </Card>
            <Card className="md:col-span-2 lg:col-span-1">
              <CardHeader className="p-3 sm:p-4 pb-1 sm:pb-2">
                <CardTitle className="text-base sm:text-lg">24/7 Support</CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 pt-0">
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Live chat and email support available around the clock
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}