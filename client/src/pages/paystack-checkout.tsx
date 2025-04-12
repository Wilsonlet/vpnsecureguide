import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, CheckCircle, CreditCard, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { apiRequest } from '@/lib/queryClient';

// Form validation schema
const billingSchema = z.object({
  cardName: z.string().min(3, "Cardholder name is required"),
  cardNumber: z.string().regex(/^\d{16}$/, "Card number must be 16 digits"),
  expiryDate: z.string()
    .min(4, "Expiry date is required")
    .refine(
      (val) => {
        // Basic pattern check
        if (!/^\d{2}\d{2}$/.test(val.replace(/\D/g, ''))) return false;
        
        // Extract month and year
        const digitsOnly = val.replace(/\D/g, '');
        const month = parseInt(digitsOnly.substring(0, 2), 10);
        const year = parseInt(digitsOnly.substring(2, 4), 10);
        
        // Check month is valid (1-12)
        if (month < 1 || month > 12) return false;
        
        // Get current date for year validation
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear() % 100; // Get last 2 digits of year
        
        // Check if expiry date is in the future
        if (year < currentYear) return false;
        if (year === currentYear && month < (currentDate.getMonth() + 1)) return false;
        
        return true;
      },
      "Invalid expiry date. Use a future date in MM/YY format"
    ),
  cvv: z.string().regex(/^\d{3,4}$/, "CVV must be 3 or 4 digits"),
  address: z.string().min(5, "Address is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State/Province is required"),
  zipCode: z.string().min(3, "ZIP/Postal code is required"),
  country: z.string().min(2, "Country is required"),
});

type BillingFormData = z.infer<typeof billingSchema>;

export default function PaystackCheckout() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [planName, setPlanName] = useState<string>('');
  const [planRef, setPlanRef] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Initialize form
  const form = useForm<BillingFormData>({
    resolver: zodResolver(billingSchema),
    defaultValues: {
      cardName: '',
      cardNumber: '',
      expiryDate: '',
      cvv: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      country: '',
    },
  });

  // State for plan price
  const [planPrice, setPlanPrice] = useState<number>(0);
  
  // Parse URL parameters and fetch plan price
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const plan = urlParams.get('plan');
    const ref = urlParams.get('ref');
    
    if (!plan || !ref) {
      setError('Invalid payment information. Please try again.');
      return;
    }
    
    setPlanName(plan);
    setPlanRef(ref);
    
    // Get the plan price from the subscription plans in the database
    const fetchPlanPrice = async () => {
      try {
        // In a real app, we would fetch the price from the server
        // For demo purposes, we'll use hardcoded prices based on the plan name
        let price = 0;
        switch (plan) {
          case 'basic':
            price = 4.99;
            break;
          case 'premium':
            price = 9.99;
            break;
          case 'ultimate':
            price = 14.99;
            break;
          default:
            price = 0;
        }
        
        setPlanPrice(price);
      } catch (error) {
        console.error('Error fetching plan price:', error);
        setError('Could not fetch plan price. Please try again.');
      }
    };
    
    fetchPlanPrice();
  }, []);

  const handleBackToSubscription = () => {
    setLocation('/subscription');
  };

  const handleBackToDashboard = () => {
    setLocation('/dashboard');
  };

  const handleSubmitBilling = async (data: BillingFormData) => {
    setIsProcessing(true);
    
    try {
      // In a real implementation, this would send data to Paystack API
      // For demo purposes, we'll simulate the API call
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Prepare card details for the API
      const cardDetails = {
        number: data.cardNumber,
        name: data.cardName,
        expiryMonth: data.expiryDate.substring(0, 2),
        expiryYear: `20${data.expiryDate.substring(2, 4)}`,
        cvv: data.cvv,
        billing: {
          address: data.address,
          city: data.city,
          state: data.state,
          zipCode: data.zipCode,
          country: data.country
        }
      };
      
      // After "successful" payment, update subscription status
      // In a real implementation, this would verify payment status with Paystack
      const response = await apiRequest('POST', '/api/confirm-subscription', {
        reference: planRef,
        plan: planName,
        cardDetails // Send card details to the server
      });
      
      const result = await response.json();
      
      // Update subscription data in UI
      queryClient.invalidateQueries({ queryKey: ['/api/subscription'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      
      // Show success message
      toast({
        title: 'Payment Successful',
        description: result.message || `Your ${planName} subscription is now active!`,
        variant: 'default',
      });
      
      setIsCompleted(true);
      setIsProcessing(false);
    } catch (err: any) {
      console.error('Payment error:', err);
      toast({
        title: 'Payment Failed',
        description: err.message || 'There was a problem processing your payment.',
        variant: 'destructive',
      });
      setIsProcessing(false);
    }
  };

  // Format card number with spaces
  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length) {
      return parts.join(' ');
    } else {
      return value;
    }
  };

  // Format expiry date
  const formatExpiryDate = (value: string) => {
    // Remove any non-digits and slashes first
    const v = value.replace(/[^\d\/]/g, '');
    
    // If there's already a slash, handle differently
    if (v.includes('/')) {
      const [month, year] = v.split('/');
      // Return just the first 2 digits of month and year
      return `${month.substring(0, 2)}/${year.substring(0, 2)}`;
    }
    
    // No slash - format as MM/YY
    const digits = v.replace(/\D/g, '');
    
    if (digits.length === 0) return '';
    if (digits.length <= 2) return digits;
    
    // Auto-format XX/ if user types a number > 1 for first digit
    if (digits.length === 2 && parseInt(digits.charAt(0), 10) > 1) {
      // If month might be invalid (>12), adjust to valid month
      const month = parseInt(digits.substring(0, 2), 10);
      if (month > 12) return `0${digits.charAt(0)}/${digits.charAt(1)}`;
    }
    
    return `${digits.substring(0, 2)}/${digits.substring(2, 4)}`;
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
            <Button onClick={handleBackToSubscription}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Return to Subscription Page
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div className="container py-10">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Payment Complete</CardTitle>
            <CardDescription>Your {planName} subscription is now active</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <div className="text-center">
              <div className="bg-primary/10 p-3 rounded-full inline-block mb-4">
                <CheckCircle className="h-16 w-16 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Payment Successful</h3>
              <p className="text-muted-foreground mb-6">
                Thank you for subscribing to our {planName} plan!
              </p>
              <div className="bg-muted/50 p-3 rounded-md mb-4 text-left">
                <p className="text-sm mb-1"><span className="font-semibold">Amount:</span> ${planPrice.toFixed(2)}</p>
                <p className="text-sm mb-1"><span className="font-semibold">Plan:</span> {planName}</p>
                <p className="text-sm mb-1"><span className="font-semibold">Reference:</span> <span className="font-mono text-xs">{planRef}</span></p>
                <p className="text-sm"><span className="font-semibold">Next Billing Date:</span> {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
                <CreditCard className="h-4 w-4" />
                <span>Secured by Paystack</span>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleBackToDashboard} className="w-full">
              Go to Dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-10">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Lock className="mr-2 h-5 w-5" />
            Secure Payment via Paystack
          </CardTitle>
          <CardDescription>
            Complete your {planName} subscription payment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmitBilling)} className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-4">Card Information</h3>
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="cardName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cardholder Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="John Smith"
                            {...field}
                            disabled={isProcessing}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="cardNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Card Number</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="4111 1111 1111 1111"
                            {...field}
                            value={formatCardNumber(field.value)}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\s/g, '');
                              field.onChange(value);
                            }}
                            maxLength={19}
                            disabled={isProcessing}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="expiryDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Expiry Date</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="MM/YY"
                              {...field}
                              value={formatExpiryDate(field.value)}
                              onChange={(e) => {
                                // Keep the formatted value for display, but store just the digits
                                const inputValue = e.target.value;
                                const digitsOnly = inputValue.replace(/\D/g, '');
                                field.onChange(digitsOnly);
                              }}
                              maxLength={5}
                              disabled={isProcessing}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="cvv"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CVV</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="123"
                              type="password"
                              {...field}
                              onChange={(e) => {
                                const value = e.target.value.replace(/[^0-9]/g, '');
                                field.onChange(value);
                              }}
                              maxLength={4}
                              disabled={isProcessing}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-medium mb-4">Billing Address</h3>
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="123 Main St"
                            {...field}
                            disabled={isProcessing}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="New York"
                              {...field}
                              disabled={isProcessing}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State/Province</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="NY"
                              {...field}
                              disabled={isProcessing}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="zipCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ZIP/Postal Code</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="10001"
                              {...field}
                              disabled={isProcessing}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="country"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Country</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="United States"
                              {...field}
                              disabled={isProcessing}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <div className="rounded-md bg-muted p-4 mb-4">
                  <div className="flex justify-between mb-2">
                    <span>Plan</span>
                    <span className="font-medium capitalize">{planName}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span>Price</span>
                    <span className="font-medium">${planPrice.toFixed(2)}/month</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Reference</span>
                    <span className="font-mono text-xs">{planRef}</span>
                  </div>
                  <Separator className="my-3" />
                  <div className="flex justify-between font-semibold pt-2">
                    <span>Total</span>
                    <span>${planPrice.toFixed(2)}</span>
                  </div>
                </div>
                
                <div className="flex justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBackToSubscription}
                    disabled={isProcessing}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  
                  <Button 
                    type="submit" 
                    disabled={isProcessing}
                    className="min-w-[150px]"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      'Complete Payment'
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex-col space-y-4">
          <div className="w-full flex items-center justify-center space-x-2 text-xs text-muted-foreground border-t pt-4">
            <Lock className="h-3 w-3" />
            <span>All transactions are secure and encrypted</span>
          </div>
          <div className="flex items-center justify-center">
            <CreditCard className="h-4 w-4 mr-2 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Secured by Paystack</span>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}