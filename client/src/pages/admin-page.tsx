import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { SubscriptionPlan } from '@shared/schema';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Save } from 'lucide-react';
import { useLocation } from 'wouter';

export default function AdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [stripePriceIds, setStripePriceIds] = useState<Record<number, string>>({});
  const [isEditing, setIsEditing] = useState(false);
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
  const { data: plans, isLoading, error } = useQuery<SubscriptionPlan[]>({
    queryKey: ['/api/subscription-plans'],
  });

  // Initialize stripePriceIds state when plans are loaded
  useEffect(() => {
    if (plans) {
      const initialValues: Record<number, string> = {};
      plans.forEach(plan => {
        initialValues[plan.id] = plan.stripePriceId || '';
      });
      setStripePriceIds(initialValues);
    }
  }, [plans]);

  const handlePriceIdChange = (planId: number, value: string) => {
    setStripePriceIds(prev => ({
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

  if (!user || user.id !== 1) {
    return (
      <div className="container py-8">
        <p>Redirecting...</p>
      </div>
    ); // Redirect handled in useEffect
  }

  if (isLoading) {
    return (
      <div className="container py-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !plans) {
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
          <CardTitle>Admin Panel - Stripe Configuration</CardTitle>
          <CardDescription>
            Configure Stripe price IDs for subscription plans
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
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
          </div>
        </CardContent>
        {isEditing && (
          <CardFooter>
            <Button onClick={savePriceIds} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}