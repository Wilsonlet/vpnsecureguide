import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { SubscriptionPlan, AppSetting, User, VpnServer } from '@shared/schema';
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
  Loader2, Save, User as UserIcon, Shield, Calendar, Mail, Search, 
  RefreshCw, CheckCircle, XCircle, Edit, Trash2, PlusCircle, 
  Settings, DollarSign, Users, Database, Server, CloudOff, Cpu
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLocation } from 'wouter';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast as toastNotify } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

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
  const [selectedServer, setSelectedServer] = useState<VpnServer | null>(null);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState<number | null>(null);
  const [isAddingPlan, setIsAddingPlan] = useState(false);
  const [showDeletePlanConfirm, setShowDeletePlanConfirm] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<number | null>(null);
  const [isModifyingPermissions, setIsModifyingPermissions] = useState(false);
  const [roleAssignments, setRoleAssignments] = useState<Record<number, string>>({});
  
  // App settings states
  const [appName, setAppName] = useState('SecureVPN');
  const [companyInfo, setCompanyInfo] = useState('Military-grade VPN service providing secure, private internet access worldwide.');
  const [contactEmail, setContactEmail] = useState('');
  const [isEditingAppSettings, setIsEditingAppSettings] = useState(false);
  const [logoData, setLogoData] = useState('');
  const [isUploading, setIsUploading] = useState(false);

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
  
  // Fetch app settings
  const { data: appNameSetting } = useQuery<AppSetting>({
    queryKey: ['/api/app-settings/app_name'],
    enabled: !!user && user.id === 1,
  });
  
  const { data: companyInfoSetting } = useQuery<AppSetting>({
    queryKey: ['/api/app-settings/company_info'],
    enabled: !!user && user.id === 1,
  });
  
  const { data: contactEmailSetting } = useQuery<AppSetting>({
    queryKey: ['/api/app-settings/contact_email'],
    enabled: !!user && user.id === 1,
  });
  
  const { data: socialLinksSetting } = useQuery<AppSetting>({
    queryKey: ['/api/app-settings/social_links'],
    enabled: !!user && user.id === 1,
  });
  
  const { data: logoSetting } = useQuery<AppSetting>({
    queryKey: ['/api/app-settings/app_logo'],
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
  
  // Initialize app settings states when settings are loaded
  useEffect(() => {
    if (appNameSetting) {
      setAppName(appNameSetting.value || 'SecureVPN');
    }
    if (companyInfoSetting) {
      setCompanyInfo(companyInfoSetting.value || 'Military-grade VPN service providing secure, private internet access worldwide.');
    }
    if (contactEmailSetting) {
      setContactEmail(contactEmailSetting.value || '');
    }
    if (logoSetting) {
      setLogoData(logoSetting.value || '');
    }
  }, [appNameSetting, companyInfoSetting, contactEmailSetting, logoSetting]);

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
        expiryDate // Server will convert this to subscriptionExpiryDate
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
              <TabsTrigger value="app">App Settings</TabsTrigger>
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
                  
                  <Button 
                    variant="default" 
                    className="flex items-center gap-1"
                    onClick={() => setIsAddingUser(true)}
                  >
                    <PlusCircle className="h-4 w-4" />
                    Add User
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="flex items-center gap-1"
                    onClick={() => setIsModifyingPermissions(true)}
                  >
                    <Shield className="h-4 w-4" />
                    Manage Permissions
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
                          {user.subscriptionExpiryDate ? new Date(user.subscriptionExpiryDate).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => setSelectedUserId(user.id)}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                            
                            {user.id !== 1 && ( // Don't allow deleting the admin user
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => {
                                  setUserToDelete(user.id);
                                  setShowDeleteConfirm(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete
                              </Button>
                            )}
                          </div>
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
              
              {/* Add User Dialog */}
              <Dialog open={isAddingUser} onOpenChange={(open) => !open && setIsAddingUser(false)}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New User</DialogTitle>
                    <DialogDescription>
                      Create a new user account
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4 py-2">
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input
                          id="username"
                          placeholder="Enter username"
                          className="w-full"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="email">Email (optional)</Label>
                        <Input
                          id="email"
                          placeholder="Enter email address"
                          type="email"
                          className="w-full"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                          id="password"
                          placeholder="Enter password"
                          type="password"
                          className="w-full"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="subscription">Subscription Plan</Label>
                        <Select defaultValue="free">
                          <SelectTrigger>
                            <SelectValue placeholder="Select subscription plan" />
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
                  
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddingUser(false)}>Cancel</Button>
                    <Button type="submit">Create User</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              
              {/* Delete User Confirmation Dialog */}
              <Dialog open={showDeleteConfirm} onOpenChange={(open) => !open && setShowDeleteConfirm(false)}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Confirm Delete</DialogTitle>
                    <DialogDescription>
                      Are you sure you want to delete this user? This action cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <DialogFooter>
                    <Button variant="outline" onClick={() => {
                      setShowDeleteConfirm(false);
                      setUserToDelete(null);
                    }}>
                      Cancel
                    </Button>
                    <Button 
                      variant="destructive" 
                      onClick={() => {
                        // Handle user deletion here
                        toast({
                          title: "User deleted",
                          description: "The user has been successfully deleted",
                        });
                        setShowDeleteConfirm(false);
                        setUserToDelete(null);
                        queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
                      }}
                    >
                      Delete
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              
              {/* Permissions Management Dialog */}
              <Dialog open={isModifyingPermissions} onOpenChange={(open) => !open && setIsModifyingPermissions(false)}>
                <DialogContent className="max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>Manage User Permissions</DialogTitle>
                    <DialogDescription>
                      Assign roles and permissions to users
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4 py-2">
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Username</TableHead>
                            <TableHead>Current Role</TableHead>
                            <TableHead>New Role</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {users?.map(user => (
                            <TableRow key={user.id}>
                              <TableCell className="font-medium">{user.username}</TableCell>
                              <TableCell>
                                <Badge variant={user.id === 1 ? 'default' : 'outline'}>
                                  {user.id === 1 ? 'Admin' : 'User'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Select
                                  defaultValue={user.id === 1 ? 'admin' : 'user'}
                                  onValueChange={(value) => {
                                    setRoleAssignments(prev => ({
                                      ...prev,
                                      [user.id]: value
                                    }));
                                  }}
                                  disabled={user.id === 1} // Cannot change admin role for main admin
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select role" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectGroup>
                                      <SelectItem value="user">User</SelectItem>
                                      <SelectItem value="support">Support</SelectItem>
                                      <SelectItem value="admin">Admin</SelectItem>
                                    </SelectGroup>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={!roleAssignments[user.id] || user.id === 1}
                                  onClick={() => {
                                    // Apply role change
                                    toast({
                                      title: "Role updated",
                                      description: `User ${user.username} is now a ${roleAssignments[user.id]}`
                                    });
                                  }}
                                >
                                  <Save className="h-4 w-4 mr-1" />
                                  Save
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    
                    <div className="border rounded-md p-4 bg-muted/20">
                      <h4 className="text-sm font-medium mb-2">Permission Levels:</h4>
                      <ul className="text-sm space-y-2">
                        <li className="flex items-start gap-2">
                          <Badge>User</Badge>
                          <span>Basic access to VPN services and account management.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Badge>Support</Badge>
                          <span>Can access user information and provide support, but cannot modify system settings.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Badge>Admin</Badge>
                          <span>Full access to all system settings, user management, and administration features.</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                  
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsModifyingPermissions(false)}>Close</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              
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
                                {selectedUser.subscriptionExpiryDate 
                                  ? new Date(selectedUser.subscriptionExpiryDate).toLocaleDateString() 
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
            
            <TabsContent value="app" className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">App Settings</h3>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="flex items-center gap-1"
                    onClick={() => {
                      queryClient.invalidateQueries({ queryKey: ['/api/app-settings/app_name'] });
                      queryClient.invalidateQueries({ queryKey: ['/api/app-settings/company_info'] });
                      queryClient.invalidateQueries({ queryKey: ['/api/app-settings/contact_email'] });
                      queryClient.invalidateQueries({ queryKey: ['/api/app-settings/social_links'] });
                    }}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </Button>
                  
                  <Button 
                    variant={isEditingAppSettings ? "secondary" : "default"}
                    className="flex items-center gap-1"
                    onClick={() => setIsEditingAppSettings(!isEditingAppSettings)}
                  >
                    {isEditingAppSettings ? (
                      <>
                        <XCircle className="h-4 w-4" />
                        Cancel
                      </>
                    ) : (
                      <>
                        <Edit className="h-4 w-4" />
                        Edit Settings
                      </>
                    )}
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* App Identity Settings */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">App Identity</CardTitle>
                    <CardDescription>
                      Basic information about your VPN service
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="app-name">App Name</Label>
                      <Input
                        id="app-name"
                        value={appName}
                        onChange={(e) => setAppName(e.target.value)}
                        disabled={!isEditingAppSettings}
                        placeholder="Enter app name"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="company-info">Company Information</Label>
                      <Input
                        id="company-info"
                        value={companyInfo}
                        onChange={(e) => setCompanyInfo(e.target.value)}
                        disabled={!isEditingAppSettings}
                        placeholder="Brief description of your VPN service"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="contact-email">Contact Email</Label>
                      <Input
                        id="contact-email"
                        type="email"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        disabled={!isEditingAppSettings}
                        placeholder="support@example.com"
                      />
                    </div>
                  </CardContent>
                  <CardFooter>
                    {isEditingAppSettings && (
                      <Button 
                        className="w-full"
                        onClick={async () => {
                          setIsSaving(true);
                          try {
                            // Batch update app settings
                            const response = await apiRequest('POST', '/api/admin/app-settings/batch', {
                              settings: [
                                {
                                  key: 'app_name',
                                  value: appName,
                                  description: 'Application name displayed throughout the UI'
                                },
                                {
                                  key: 'company_info',
                                  value: companyInfo,
                                  description: 'Brief company description for the footer'
                                },
                                {
                                  key: 'contact_email',
                                  value: contactEmail,
                                  description: 'Primary contact email for support'
                                }
                              ]
                            });
                            
                            if (!response.ok) {
                              throw new Error('Failed to update app settings');
                            }
                            
                            toast({
                              title: 'Success',
                              description: 'App settings have been updated',
                            });
                            
                            // Invalidate queries to refresh the data
                            queryClient.invalidateQueries({ queryKey: ['/api/app-settings/app_name'] });
                            queryClient.invalidateQueries({ queryKey: ['/api/app-settings/company_info'] });
                            queryClient.invalidateQueries({ queryKey: ['/api/app-settings/contact_email'] });
                            
                            setIsEditingAppSettings(false);
                          } catch (err: any) {
                            toast({
                              title: 'Error',
                              description: err.message || 'Failed to update app settings',
                              variant: 'destructive',
                            });
                          } finally {
                            setIsSaving(false);
                          }
                        }}
                        disabled={isSaving}
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Save Changes
                          </>
                        )}
                      </Button>
                    )}
                  </CardFooter>
                </Card>
                
                {/* Logo Upload & Social Links */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Logo & Social Media</CardTitle>
                    <CardDescription>
                      Upload your app logo and add social media links
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="logo-upload">App Logo</Label>
                      <div className="flex flex-col items-center gap-4 p-4 border-2 border-dashed rounded-md">
                        {logoData ? (
                          <div className="relative">
                            <img 
                              src={logoData} 
                              alt="App Logo" 
                              className="max-h-24 rounded-md" 
                            />
                            {isEditingAppSettings && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full"
                                onClick={() => setLogoData('')}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                            <Shield className="h-8 w-8 text-primary" />
                          </div>
                        )}
                        
                        {isEditingAppSettings && (
                          <div className="w-full">
                            <Input
                              id="logo-input"
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = (event) => {
                                    if (event.target?.result) {
                                      setLogoData(event.target.result as string);
                                    }
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                            <Button
                              variant="outline"
                              className="w-full"
                              onClick={() => document.getElementById('logo-input')?.click()}
                              disabled={isUploading}
                            >
                              {isUploading ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Uploading...
                                </>
                              ) : (
                                <>
                                  Select Image
                                </>
                              )}
                            </Button>
                            {logoData && (
                              <Button
                                variant="default"
                                className="w-full mt-2"
                                onClick={async () => {
                                  setIsUploading(true);
                                  try {
                                    const response = await apiRequest('POST', '/api/admin/app-logo', {
                                      logoData
                                    });
                                    
                                    if (!response.ok) {
                                      throw new Error('Failed to upload logo');
                                    }
                                    
                                    toast({
                                      title: 'Success',
                                      description: 'Logo has been uploaded successfully',
                                    });
                                  } catch (err: any) {
                                    toast({
                                      title: 'Error',
                                      description: err.message || 'Failed to upload logo',
                                      variant: 'destructive',
                                    });
                                  } finally {
                                    setIsUploading(false);
                                  }
                                }}
                                disabled={isUploading}
                              >
                                {isUploading ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Uploading...
                                  </>
                                ) : (
                                  <>
                                    Upload Logo
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="social-links">Social Media Links</Label>
                      {isEditingAppSettings ? (
                        <div className="space-y-2">
                          <Input
                            placeholder="Facebook URL"
                            className="mb-2"
                          />
                          <Input
                            placeholder="Twitter URL"
                            className="mb-2"
                          />
                          <Input
                            placeholder="Instagram URL"
                            className="mb-2"
                          />
                          <Input
                            placeholder="LinkedIn URL"
                            className="mb-2"
                          />
                          <Input
                            placeholder="GitHub URL"
                          />
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground p-2 border rounded-md">
                          No social media links configured yet.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}