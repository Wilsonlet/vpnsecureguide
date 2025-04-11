import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { SubscriptionPlan, AppSetting, User } from '@shared/schema';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Loader2, Save, User as UserIcon, Shield, Calendar, 
  Mail, Search, RefreshCw, CheckCircle, XCircle, Edit
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLocation } from 'wouter';

export default function AdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState('users');
  const [stripePriceIds, setStripePriceIds] = useState<Record<number, string>>({});
  const [paystackPlanCodes, setPaystackPlanCodes] = useState<Record<number, string>>({});
  const [adsenseId, setAdsenseId] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingPaystack, setIsEditingPaystack] = useState(false);
  const [isEditingAdsense, setIsEditingAdsense] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

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
  
  // Fetch all users for the admin panel
  const { data: users, isLoading: isLoadingUsers, error: usersError } = useQuery<User[]>({
    queryKey: ['/api/admin/users'],
    enabled: !!user && user.id === 1,
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

  // Update user subscription plan function
  const updateUserSubscription = async (userId: number, subscription: string, expiryDate?: string) => {
    setIsSaving(true);
    try {
      const response = await apiRequest('POST', '/api/admin/update-user-subscription', { 
        userId, 
        subscription,
        expiryDate
      });
      
      if (!response.ok) {
        throw new Error('Failed to update user subscription');
      }
      
      toast({
        title: 'Success',
        description: 'User subscription has been updated',
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setSelectedUserId(null);
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to update user subscription',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingPlans || isLoadingAdsense || isLoadingUsers) {
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
          <AlertTitle>Error Loading Plans</AlertTitle>
          <AlertDescription>Failed to load subscription plans</AlertDescription>
        </Alert>
      </div>
    );
  }
  
  if (usersError) {
    return (
      <div className="container py-8">
        <Alert variant="destructive">
          <AlertTitle>Error Loading Users</AlertTitle>
          <AlertDescription>Failed to load user data</AlertDescription>
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
              <TabsTrigger value="users">User Management</TabsTrigger>
              <TabsTrigger value="stripe">Stripe Payment</TabsTrigger>
              <TabsTrigger value="paystack">Paystack Payment</TabsTrigger>
              <TabsTrigger value="adsense">Google AdSense</TabsTrigger>
            </TabsList>
            
            <TabsContent value="users" className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Manage Users</h3>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="flex items-center gap-1"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] })}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </Button>
                </div>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Subscription</TableHead>
                      <TableHead>Expiry Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users?.map(user => (
                      <TableRow key={user.id}>
                        <TableCell>{user.id}</TableCell>
                        <TableCell className="font-medium">{user.username}</TableCell>
                        <TableCell>{user.email || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={user.subscription === 'free' ? 'outline' : 'default'}>
                            {user.subscription}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.expiryDate ? new Date(user.expiryDate).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setSelectedUserId(user.id)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {users?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                          No users found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              
              {/* User Edit Dialog */}
              {selectedUserId !== null && users && (
                <Dialog open={selectedUserId !== null} onOpenChange={(open) => !open && setSelectedUserId(null)}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit User</DialogTitle>
                      <DialogDescription>
                        Update subscription details for this user
                      </DialogDescription>
                    </DialogHeader>
                    
                    {(() => {
                      const selectedUser = users.find(u => u.id === selectedUserId);
                      if (!selectedUser) return null;
                      
                      return (
                        <div className="space-y-4 py-2">
                          <div className="space-y-2">
                            <h4 className="font-medium">User Information</h4>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div className="font-medium">Username:</div>
                              <div>{selectedUser.username}</div>
                              
                              <div className="font-medium">Email:</div>
                              <div>{selectedUser.email || '-'}</div>
                              
                              <div className="font-medium">Current Plan:</div>
                              <div>
                                <Badge variant={selectedUser.subscription === 'free' ? 'outline' : 'default'}>
                                  {selectedUser.subscription}
                                </Badge>
                              </div>
                              
                              <div className="font-medium">Expiry Date:</div>
                              <div>
                                {selectedUser.expiryDate 
                                  ? new Date(selectedUser.expiryDate).toLocaleDateString() 
                                  : '-'}
                              </div>
                            </div>
                          </div>
                          
                          <Separator />
                          
                          <div className="space-y-3">
                            <h4 className="font-medium">Update Subscription</h4>
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <label htmlFor="plan" className="text-sm font-medium">Subscription Plan</label>
                                  <Select
                                    defaultValue={selectedUser.subscription || 'free'}
                                    onValueChange={(value) => {
                                      const nextWeek = new Date();
                                      nextWeek.setDate(nextWeek.getDate() + 30);
                                      
                                      if (value === 'free') {
                                        updateUserSubscription(selectedUser.id, value);
                                      } else {
                                        updateUserSubscription(
                                          selectedUser.id, 
                                          value, 
                                          nextWeek.toISOString()
                                        );
                                      }
                                    }}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select plan" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectGroup>
                                        <SelectItem value="free">Free</SelectItem>
                                        <SelectItem value="standard">Standard</SelectItem>
                                        <SelectItem value="premium">Premium</SelectItem>
                                        <SelectItem value="ultimate">Ultimate</SelectItem>
                                      </SelectGroup>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                    
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setSelectedUserId(null)}>Cancel</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </TabsContent>
            
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