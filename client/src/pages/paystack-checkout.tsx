import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, CheckCircle, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

export default function PaystackCheckout() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isCompleted, setIsCompleted] = useState(false);
  const [planName, setPlanName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Parse URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const plan = urlParams.get('plan');
    const ref = urlParams.get('ref');
    
    if (!plan || !ref) {
      setError('Invalid payment information. Please try again.');
      setIsLoading(false);
      return;
    }
    
    setPlanName(plan);
    
    // Simulate Paystack payment process
    const timer = setTimeout(() => {
      setIsLoading(false);
      setIsCompleted(true);
      
      // After "successful" payment, refresh subscription data
      queryClient.invalidateQueries({ queryKey: ['/api/subscription'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      
      toast({
        title: 'Payment Successful',
        description: `Your ${plan} subscription is now active!`,
        variant: 'default',
      });
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [toast]);

  const handleBackToDashboard = () => {
    setLocation('/dashboard');
  };

  if (error) {
    return (
      <div className="container py-10">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Payment Error</CardTitle>
            <CardDescription>There was a problem with your payment</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">{error}</p>
          </CardContent>
          <CardFooter>
            <Button onClick={() => setLocation('/subscription')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Return to Subscription Page
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-10">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>
            {isLoading ? 'Processing Payment' : 'Payment Complete'}
          </CardTitle>
          <CardDescription>
            {isLoading 
              ? 'Please wait while we process your payment' 
              : `Your ${planName} subscription is now active`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-10">
          {isLoading ? (
            <div className="text-center">
              <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-4" />
              <p>Connecting to payment gateway...</p>
            </div>
          ) : (
            <div className="text-center">
              <div className="bg-primary/10 p-3 rounded-full inline-block mb-4">
                <CheckCircle className="h-16 w-16 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Payment Successful</h3>
              <p className="text-muted-foreground mb-6">
                Thank you for subscribing to our {planName} plan!
              </p>
              <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
                <CreditCard className="h-4 w-4" />
                <span>Secured by Paystack</span>
              </div>
            </div>
          )}
        </CardContent>
        {!isLoading && (
          <CardFooter>
            <Button onClick={handleBackToDashboard} className="w-full">
              Go to Dashboard
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}