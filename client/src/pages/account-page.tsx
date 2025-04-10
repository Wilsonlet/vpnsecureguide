import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';

const profileSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function AccountPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      email: user?.email || '',
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: ProfileFormValues) => {
      const response = await apiRequest('POST', '/api/user/update-profile', data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update profile');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      toast({
        title: 'Profile updated',
        description: 'Your profile has been updated successfully.',
      });
      setIsEditing(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error updating profile',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  function onSubmit(data: ProfileFormValues) {
    updateMutation.mutate(data);
  }

  return (
    <div className="container py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Account Settings</h1>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>Manage your account details and email preferences</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="your.email@example.com" 
                            {...field} 
                            disabled={!isEditing || updateMutation.isPending}
                          />
                        </FormControl>
                        <FormDescription>
                          Your email is required for subscription and recovery.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {isEditing ? (
                  <div className="flex gap-4">
                    <Button 
                      type="submit" 
                      disabled={updateMutation.isPending || !form.formState.isDirty}
                    >
                      {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save Changes
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        setIsEditing(false);
                        form.reset({
                          email: user?.email || '',
                        });
                      }}
                      disabled={updateMutation.isPending}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsEditing(true)}
                  >
                    Edit Profile
                  </Button>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>Your account details and current subscription plan</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium">Username</h3>
                <p className="text-gray-600">{user?.username}</p>
              </div>
              <div>
                <h3 className="text-lg font-medium">Current Plan</h3>
                <p className="text-gray-600">{user?.subscription || 'Free'}</p>
              </div>
              {user?.subscriptionExpiryDate && (
                <div>
                  <h3 className="text-lg font-medium">Subscription Expires</h3>
                  <p className="text-gray-600">
                    {new Date(user.subscriptionExpiryDate).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full" asChild>
              <a href="/subscription">Manage Subscription</a>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}