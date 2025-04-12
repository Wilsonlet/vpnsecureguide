import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle, CreditCard, Shield } from 'lucide-react';
import { queryClient } from '@/lib/queryClient';

// Make sure to call `loadStripe` outside of a component's render to avoid
// recreating the `Stripe` object on every render.
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

// This component handles the Stripe payment form
function CheckoutForm() {
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      // Stripe.js has not yet loaded.
      return;
    }

    setProcessing(true);
    setError(null);

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin,
      },
      redirect: 'if_required',
    });

    if (result.error) {
      setError(result.error.message || 'An error occurred during payment');
      setProcessing(false);
    } else {
      // Payment succeeded or requires additional action like 3D Secure
      if (result.paymentIntent && result.paymentIntent.status === 'succeeded') {
        setSucceeded(true);
        toast({
          title: 'Payment Successful',
          description: 'Your subscription has been updated successfully!',
          variant: 'default',
        });
        
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ['/api/subscription'] });
        queryClient.invalidateQueries({ queryKey: ['/api/user'] });
        
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          setLocation('/dashboard');
        }, 2000);
      } else {
        // The payment requires additional steps, like 3D Secure
        // The customer will be redirected to complete the payment
        toast({
          title: 'Payment Processing',
          description: 'Your payment is being processed. Please complete any additional steps required by your bank.',
          variant: 'default',
        });
      }
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-6">
        <PaymentElement />
        
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Payment Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {succeeded && (
          <Alert variant="default" className="bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <AlertTitle>Payment Successful</AlertTitle>
            <AlertDescription>Your subscription has been updated successfully!</AlertDescription>
          </Alert>
        )}
        
        <Button 
          disabled={!stripe || processing || succeeded} 
          className="w-full" 
          size="lg"
          type="submit"
        >
          {processing ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
          ) : succeeded ? (
            <><CheckCircle className="mr-2 h-4 w-4" /> Payment Successful</>
          ) : (
            'Complete Payment'
          )}
        </Button>
        
        <div className="text-center mt-4">
          <div className="inline-flex items-center justify-center gap-1.5 rounded-full border bg-background/50 px-3 py-1 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5" /> Secure Payment
          </div>
        </div>
      </div>
    </form>
  );
}

export default function Checkout() {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  
  // Extract the client_secret from URL parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const secret = params.get('client_secret');
    
    if (secret) {
      setClientSecret(secret);
    } else {
      setError("Payment information not found. Please try subscribing again.");
    }
    
    setLoading(false);
  }, []);
  
  // Handle back button
  const handleBack = () => {
    setLocation('/subscription');
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (error || !clientSecret) {
    return (
      <div className="container max-w-md mx-auto py-10">
        <Card>
          <CardHeader>
            <CardTitle>Payment Error</CardTitle>
            <CardDescription>There was a problem with your payment</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error || "Payment information not found"}</AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Button onClick={handleBack} className="w-full">Return to Subscription Page</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container max-w-xl mx-auto py-10">
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> Complete Your Subscription
          </CardTitle>
          <CardDescription>
            Finalize your secure VPN subscription payment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <CheckoutForm />
          </Elements>
        </CardContent>
      </Card>
    </div>
  );
}