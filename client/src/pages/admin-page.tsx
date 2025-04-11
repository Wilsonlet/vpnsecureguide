import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { SubscriptionPlan, AppSetting } from '@shared/schema';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Save } from 'lucide-react';
import { useLocation } from 'wouter';

export default function AdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState('stripe');
  const [stripePriceIds, setStripePriceIds] = useState<Record<number, string>>({});
  const [paystackPlanCodes, setPaystackPlanCodes] = useState<Record<number, string>>({});
  const [adsenseId, setAdsenseId] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingPaystack, setIsEditingPaystack] = useState(false);
  const [isEditingAdsense, setIsEditingAdsense] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Only admins should access this page
  useEffect(() => {
    // For demo purposes, consider first user as admin
    // In a real app, you would check for admin role
    if (user && user.id !== 1) {
      setLocation('/');
      toast({
        title: 'Access Denied',
        description: 'You do not have permission to access this page',
        variant: 'destructive',
      });
    }
  }, [user, setLocation, toast]);

  // Fetch subscription plans
  const { data: plans, isLoading: isLoadingPlans, error: plansError } = useQuery<SubscriptionPlan[]>({
    queryKey: ['/api/subscription-plans'],
  });
  
  // Fetch AdSense settings
  const { data: adsenseSetting, isLoading: isLoadingAdsense, error: adsenseError } = useQuery<AppSetting>({
    queryKey: ['/api/app-settings/google_adsense_id'],
  });

  // Initialize stripePriceIds and paystackPlanCodes state when plans are loaded
  useEffect(() => {
    if (plans) {
      const initialStripeValues: Record<number, string> = {};
      const initialPaystackValues: Record<number, string> = {};
      plans.forEach(plan => {
        initialStripeValues[plan.id] = plan.stripePriceId || '';
        initialPaystackValues[plan.id] = plan.paystackPlanCode || '';
      });
      setStripePriceIds(initialStripeValues);
      setPaystackPlanCodes(initialPaystackValues);
    }
  }, [plans]);
  
  // Initialize adsenseId state when adsenseSetting is loaded
  useEffect(() => {
    if (adsenseSetting) {
      setAdsenseId(adsenseSetting.value || '');
    }
  }, [adsenseSetting]);

  const handlePriceIdChange = (planId: number, value: string) => {
    setStripePriceIds(prev => ({
      ...prev,
      [planId]: value,
    }));
  };
  
  const handlePaystackPlanCodeChange = (planId: number, value: string) => {
    setPaystackPlanCodes(prev => ({
      ...prev,
      [planId]: value,
    }));
  };

  const savePriceIds = async () => {
    setIsSaving(true);
    try {
      const response = await apiRequest('POST', '/api/admin/update-price-ids', { stripePriceIds });
      
      if (!response.ok) {
        throw new Error('Failed to update price IDs');
      }
      
      toast({
        title: 'Success',
        description: 'Stripe price IDs have been updated',
      });
      
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['/api/subscription-plans'] });
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to update price IDs',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  const savePaystackPlanCodes = async () => {
    setIsSaving(true);
    try {
      const response = await apiRequest('POST', '/api/admin/update-paystack-plan-codes', { paystackPlanCodes });
      
      if (!response.ok) {
        throw new Error('Failed to update Paystack plan codes');
      }
      
      toast({
        title: 'Success',
        description: 'Paystack plan codes have been updated',
      });
      
      setIsEditingPaystack(false);
      queryClient.invalidateQueries({ queryKey: ['/api/subscription-plans'] });
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to update Paystack plan codes',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const saveAdsenseId = async () => {
    setIsSaving(true);
    try {
      const response = await apiRequest('POST', '/api/admin/app-settings', { 
        key: 'google_adsense_id',
        value: adsenseId,
        description: 'Google AdSense Publisher ID for displaying ads to free tier users'
      });
      
      if (!response.ok) {
        throw new Error('Failed to update Google AdSense ID');
      }
      
      toast({
        title: 'Success',
        description: 'Google AdSense ID has been updated',
      });
      
      setIsEditingAdsense(false);
      queryClient.invalidateQueries({ queryKey: ['/api/app-settings/google_adsense_id'] });
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to update Google AdSense ID',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!user || user.id !== 1) {
    return (
      <div className="container py-8">
        <p>Redirecting...</p>
      </div>
    ); // Redirect handled in useEffect
  }

  if (isLoadingPlans || isLoadingAdsense) {
    return (
      <div className="container py-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (plansError || !plans) {
    return (
      <div className="container py-8">
        <Alert variant="destructive">
          <AlertDescription>Failed to load subscription plans</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <Card>
        <CardHeader>
          <CardTitle>Admin Panel</CardTitle>
          <CardDescription>
            Configure settings for your VPN service
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="stripe">Stripe Payment</TabsTrigger>
              <TabsTrigger value="paystack">Paystack Payment</TabsTrigger>
              <TabsTrigger value="adsense">Google AdSense</TabsTrigger>
            </TabsList>
            
            <TabsContent value="stripe" className="space-y-6">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(!isEditing)}
                  disabled={isSaving}
                >
                  {isEditing ? 'Cancel' : 'Edit Price IDs'}
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plan Name</TableHead>
                    <TableHead>Price ($/month)</TableHead>
                    <TableHead>Stripe Price ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map(plan => (
                    <TableRow key={plan.id}>
                      <TableCell className="font-medium">{plan.name}</TableCell>
                      <TableCell>${(plan.price / 100).toFixed(2)}</TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={stripePriceIds[plan.id] || ''}
                            onChange={e => handlePriceIdChange(plan.id, e.target.value)}
                            placeholder="Enter Stripe price ID (e.g., price_1234...)"
                            className="max-w-md"
                            disabled={plan.price === 0} // Free plan doesn't need a price ID
                          />
                        ) : (
                          <span className="text-sm font-mono">
                            {plan.stripePriceId || (plan.price === 0 ? '(not required)' : 'Not set')}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="text-sm text-gray-500 mt-4 space-y-2">
                <p>
                  <strong>Note:</strong> Stripe Price IDs can be found in your{' '}
                  <a
                    href="https://dashboard.stripe.com/products"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    Stripe Dashboard
                  </a>
                </p>
                <p>
                  1. Go to Products in your Stripe Dashboard
                </p>
                <p>
                  2. Create a product for each subscription plan
                </p>
                <p>
                  3. Copy the Price ID (starts with "price_") for each plan
                </p>
              </div>
              
              {isEditing && (
                <div className="mt-4">
                  <Button onClick={savePriceIds} disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="paystack" className="space-y-6">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => setIsEditingPaystack(!isEditingPaystack)}
                  disabled={isSaving}
                >
                  {isEditingPaystack ? 'Cancel' : 'Edit Plan Codes'}
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plan Name</TableHead>
                    <TableHead>Price ($/month)</TableHead>
                    <TableHead>Paystack Plan Code</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map(plan => (
                    <TableRow key={plan.id}>
                      <TableCell className="font-medium">{plan.name}</TableCell>
                      <TableCell>${(plan.price / 100).toFixed(2)}</TableCell>
                      <TableCell>
                        {isEditingPaystack ? (
                          <Input
                            value={paystackPlanCodes[plan.id] || ''}
                            onChange={e => handlePaystackPlanCodeChange(plan.id, e.target.value)}
                            placeholder="Enter Paystack Plan Code (e.g., PLN_xxxx...)"
                            className="max-w-md"
                            disabled={plan.price === 0} // Free plan doesn't need a plan code
                          />
                        ) : (
                          <span className="text-sm font-mono">
                            {plan.paystackPlanCode || (plan.price === 0 ? '(not required)' : 'Not set')}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="text-sm text-gray-500 mt-4 space-y-2">
                <p>
                  <strong>Note:</strong> Paystack Plan Codes can be found in your{' '}
                  <a
                    href="https://dashboard.paystack.com/#/plans"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    Paystack Dashboard
                  </a>
                </p>
                <p>
                  1. Log in to your Paystack Dashboard and go to Products → Plans
                </p>
                <p>
                  2. Create a plan for each subscription tier with the appropriate pricing
                </p>
                <p>
                  3. Copy the Plan Code (starts with "PLN_") for each plan
                </p>
              </div>
              
              {isEditingPaystack && (
                <div className="mt-4">
                  <Button onClick={savePaystackPlanCodes} disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                  </Button>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="adsense" className="space-y-6">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => setIsEditingAdsense(!isEditingAdsense)}
                  disabled={isSaving}
                >
                  {isEditingAdsense ? 'Cancel' : 'Edit AdSense ID'}
                </Button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium">Google AdSense Publisher ID</h3>
                  <p className="text-sm text-muted-foreground">
                    Configure your Google AdSense publisher ID to display ads for free tier users
                  </p>
                </div>
                
                <div>
                  {isEditingAdsense ? (
                    <div className="space-y-2">
                      <Input
                        value={adsenseId}
                        onChange={e => setAdsenseId(e.target.value)}
                        placeholder="Enter Google AdSense Publisher ID (e.g., ca-pub-1234567890123456)"
                        className="max-w-md"
                      />
                      <p className="text-xs text-muted-foreground">
                        Enter your AdSense publisher ID starting with 'ca-pub-'
                      </p>
                    </div>
                  ) : (
                    <div className="text-sm font-mono">
                      {adsenseId || 'Not set'}
                    </div>
                  )}
                </div>
                
                <div className="text-sm text-gray-500 mt-4 space-y-2">
                  <p>
                    <strong>Note:</strong> Your Google AdSense publisher ID can be found in your{' '}
                    <a
                      href="https://www.google.com/adsense"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      AdSense Dashboard
                    </a>
                  </p>
                  <p>
                    1. Log in to your Google AdSense account
                  </p>
                  <p>
                    2. Go to Account &rarr; Account information
                  </p>
                  <p>
                    3. Look for "Publisher ID" which starts with "ca-pub-"
                  </p>
                </div>
                
                {isEditingAdsense && (
                  <div className="mt-4">
                    <Button onClick={saveAdsenseId} disabled={isSaving}>
                      {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save Changes
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}