import React, { useEffect, useState } from 'react';
import { useLocation, useRoute, useParams } from 'wouter';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, CheckCircle, CreditCard, Lock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { apiRequest } from '@/lib/queryClient';
import { countries } from '@/lib/countries';
import { formatCardNumber, formatExpiryDate, validateCard, getCardType, CardType } from '@/lib/card-validator';

// Form validation schema
const billingSchema = z.object({
  cardName: z.string().min(3, "Cardholder name is required"),
  cardNumber: z.string()
    .min(13, "Card number must be between 13-19 digits")
    .max(19, "Card number must be between 13-19 digits")
    .refine(
      (val) => {
        const result = validateCard(val);
        return result.valid;
      },
      "Invalid card number. Please check and try again."
    ),
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
  cvv: z.string()
    .min(3, "CVV must be 3 or 4 digits")
    .max(4, "CVV must be 3 or 4 digits")
    .refine(
      (val) => /^\d{3,4}$/.test(val),
      "CVV must be 3 or 4 digits"
    ),
  address: z.string().min(5, "Address is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State/Province is required"),
  zipCode: z.string().min(3, "ZIP/Postal code is required"),
  country: z.string().min(2, "Country code is required"),
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
  const [detectedCardType, setDetectedCardType] = useState<CardType | undefined>();

  // Initialize form with Paystack test card details
  const form = useForm<BillingFormData>({
    resolver: zodResolver(billingSchema),
    defaultValues: {
      cardName: 'Test User',
      cardNumber: '4084084084084081', // Paystack test card
      expiryDate: '1225',  // December 2025
      cvv: '408',
      address: '123 Test Address',
      city: 'Test City',
      state: 'Test State',
      zipCode: '12345',
      country: 'NG',
    },
  });

  // State for plan price
  const [planPrice, setPlanPrice] = useState<number>(0);
  const [planDetails, setPlanDetails] = useState<any>(null);
  
  // Get path parameters using Wouter's useRoute
  // Match the "/checkout/paystack/:plan/:ref" pattern
  const [matched, params] = useRoute('/checkout/paystack/:plan/:ref');
  
  // Parse URL parameters and fetch plan price
  useEffect(() => {
    // Get URL parameters from path
    const urlParams = new URLSearchParams(window.location.search);
    // Get price from query parameter
    const price = urlParams.get('price');
    
    // Use the URL path parameters instead of query parameters
    const plan = params?.plan;
    const ref = params?.ref;
    
    if (!plan || !ref) {
      setError('Invalid payment information. Please try again.');
      return;
    }
    
    setPlanName(plan);
    setPlanRef(ref);
    
    // Get the plan price and details
    const fetchPlanData = async () => {
      try {
        // First, try to get price from URL parameter
        if (price) {
          setPlanPrice(parseFloat(price));
        } else {
          // If not in URL, fetch from API
          const response = await fetch(`/api/subscription-plans`);
          if (!response.ok) {
            throw new Error('Failed to fetch subscription plans');
          }
          
          const plans = await response.json();
          const planData = plans.find((p: any) => p.name === plan);
          
          if (planData) {
            setPlanDetails(planData);
            // Convert price from cents to dollars for display
            setPlanPrice(planData.price / 100);
          } else {
            throw new Error('Plan not found');
          }
        }
      } catch (error) {
        console.error('Error fetching plan data:', error);
        setError('Could not fetch plan price. Please try again.');
      }
    };
    
    fetchPlanData();
  }, [params]);

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
        expiryYear: data.expiryDate.substring(2, 4),
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
      const response = await apiRequest('POST', '/api/confirm-subscription', {
        reference: planRef,
        plan: planName,
        cardDetails // Send card details to the server
      });
      
      // Check if the response is valid JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server returned non-JSON response. Please try again.");
      }
      
      let result;
      try {
        result = await response.json();
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        throw new Error("Failed to parse server response. Please try again.");
      }
      
      // Check if the result is valid
      if (!result || typeof result !== 'object') {
        throw new Error("Invalid response format from server");
      }
      
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
                <h3 className="text-lg font-medium mb-2">Card Information</h3>
                
                <Alert className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    For testing, the form is pre-filled with Paystack test card details.
                  </AlertDescription>
                </Alert>
                
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
                    render={({ field }) => {
                      // Detect card type on field value change
                      const cardType = getCardType(field.value);
                      const validation = validateCard(field.value);
                      
                      // Update the detected card type state
                      useEffect(() => {
                        setDetectedCardType(cardType);
                      }, [cardType]);
                      
                      return (
                        <FormItem>
                          <FormLabel className="flex justify-between">
                            <span>Card Number</span>
                            {cardType && (
                              <span className="text-sm font-normal text-muted-foreground">
                                {cardType.name}
                              </span>
                            )}
                          </FormLabel>
                          <div className="relative">
                            <FormControl>
                              <Input
                                placeholder="4111 1111 1111 1111"
                                {...field}
                                value={formatCardNumber(field.value)}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/\s/g, '');
                                  field.onChange(value);
                                }}
                                className={field.value.length > 0 ? 
                                  (validation.valid ? "border-green-500 focus-visible:ring-green-500" : "") : ""}
                                maxLength={19}
                                disabled={isProcessing}
                              />
                            </FormControl>
                            {field.value.length > 0 && validation.valid && (
                              <div className="absolute top-1/2 right-3 transform -translate-y-1/2 text-green-500">
                                <CheckCircle className="h-4 w-4" />
                              </div>
                            )}
                          </div>
                          <FormMessage />
                          {field.value.length > 0 && cardType && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {cardType.name} • {cardType.length.join('/')} digits
                            </div>
                          )}
                        </FormItem>
                      );
                    }}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="expiryDate"
                      render={({ field }) => {
                        // Check if the expiry date is valid
                        const expiryValid = field.value.length >= 4 && (() => {
                          // Extract month and year
                          const month = parseInt(field.value.substring(0, 2), 10);
                          const year = parseInt(field.value.substring(2, 4), 10);
                          
                          // Current date
                          const currentDate = new Date();
                          const currentYear = currentDate.getFullYear() % 100;
                          
                          // Check validity
                          if (month < 1 || month > 12) return false;
                          if (year < currentYear) return false;
                          if (year === currentYear && month < (currentDate.getMonth() + 1)) return false;
                          
                          return true;
                        })();
                        
                        return (
                          <FormItem>
                            <FormLabel>Expiry Date</FormLabel>
                            <div className="relative">
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
                                  className={field.value.length === 4 ? 
                                    (expiryValid ? "border-green-500 focus-visible:ring-green-500" : "") : ""}
                                  maxLength={5}
                                  disabled={isProcessing}
                                />
                              </FormControl>
                              {field.value.length === 4 && expiryValid && (
                                <div className="absolute top-1/2 right-3 transform -translate-y-1/2 text-green-500">
                                  <CheckCircle className="h-4 w-4" />
                                </div>
                              )}
                            </div>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />
                    
                    <FormField
                      control={form.control}
                      name="cvv"
                      render={({ field }) => {
                        // Check if CVV is valid based on detected card type
                        const isValidCvv = field.value.length > 0 && (() => {
                          if (field.value.length < 3) return false;
                          if (field.value.length > 4) return false;
                          
                          // Check if CVV matches expected length for card type
                          if (detectedCardType) {
                            return detectedCardType.cvvLength.includes(field.value.length);
                          }
                          
                          // Default check for common CVV lengths
                          return field.value.length >= 3 && field.value.length <= 4;
                        })();
                        
                        return (
                          <FormItem>
                            <FormLabel className="flex justify-between">
                              <span>CVV</span>
                              {detectedCardType && (
                                <span className="text-xs text-muted-foreground">
                                  {detectedCardType.cvvLength.length === 1 ? 
                                    `${detectedCardType.cvvLength[0]} digits` : 
                                    `${detectedCardType.cvvLength.join(' or ')} digits`}
                                </span>
                              )}
                            </FormLabel>
                            <div className="relative">
                              <FormControl>
                                <Input
                                  placeholder="123"
                                  type="password"
                                  {...field}
                                  onChange={(e) => {
                                    const value = e.target.value.replace(/[^0-9]/g, '');
                                    field.onChange(value);
                                  }}
                                  className={field.value.length > 0 ? 
                                    (isValidCvv ? "border-green-500 focus-visible:ring-green-500" : "") : ""}
                                  maxLength={4}
                                  disabled={isProcessing}
                                />
                              </FormControl>
                              {isValidCvv && (
                                <div className="absolute top-1/2 right-3 transform -translate-y-1/2 text-green-500">
                                  <CheckCircle className="h-4 w-4" />
                                </div>
                              )}
                            </div>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
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
                          <Select
                            disabled={isProcessing}
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select your country" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {countries.map((country) => (
                                <SelectItem key={country.code} value={country.code}>
                                  {country.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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