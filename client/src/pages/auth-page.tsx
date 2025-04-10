import { useState, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Shield, ShieldCheck, Lock, Globe, Zap } from "lucide-react";

// Extended schema with validation rules
const authSchema = insertUserSchema.extend({
  password: z.string().min(8, {
    message: "Password must be at least 8 characters.",
  }),
});

type AuthFormData = z.infer<typeof authSchema>;

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState<string>("login");
  const { user, loginMutation, registerMutation } = useAuth();
  const [location, setLocation] = useLocation();

  // Login form
  const loginForm = useForm<AuthFormData>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  // Register form
  const registerForm = useForm<AuthFormData>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);
  
  if (user) {
    return null;
  }

  const onLoginSubmit = (data: AuthFormData) => {
    loginMutation.mutate(data);
  };

  const onRegisterSubmit = (data: AuthFormData) => {
    registerMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid md:grid-cols-2 gap-8 items-center">
        <div className="order-2 md:order-1">
          <Card className="shadow-xl border-gray-800">
            <CardHeader className="space-y-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                  <Shield className="w-6 h-6 text-primary-foreground" />
                </div>
                <h2 className="text-2xl font-bold">SecureVPN</h2>
              </div>
              <CardTitle className="text-xl">Welcome</CardTitle>
              <CardDescription>
                Enter your credentials to access your secure VPN services
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="login" value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="login">Login</TabsTrigger>
                  <TabsTrigger value="register">Register</TabsTrigger>
                </TabsList>
                
                <TabsContent value="login">
                  <Form {...loginForm}>
                    <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                      <FormField
                        control={loginForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter your username" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={loginForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="••••••••" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button 
                        type="submit" 
                        className="w-full" 
                        disabled={loginMutation.isPending}
                      >
                        {loginMutation.isPending ? (
                          <>
                            <span className="animate-spin mr-2">
                              <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            </span>
                            Logging in...
                          </>
                        ) : (
                          "Sign In"
                        )}
                      </Button>
                    </form>
                  </Form>
                </TabsContent>
                
                <TabsContent value="register">
                  <Form {...registerForm}>
                    <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                      <FormField
                        control={registerForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <Input placeholder="Create a username" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="Create a secure password" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button 
                        type="submit" 
                        className="w-full" 
                        disabled={registerMutation.isPending}
                      >
                        {registerMutation.isPending ? (
                          <>
                            <span className="animate-spin mr-2">
                              <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            </span>
                            Creating account...
                          </>
                        ) : (
                          "Create Account"
                        )}
                      </Button>
                    </form>
                  </Form>
                </TabsContent>
              </Tabs>
            </CardContent>
            <CardFooter>
              <p className="text-center text-sm text-muted-foreground w-full">
                By continuing, you agree to SecureVPN's Terms of Service and Privacy Policy
              </p>
            </CardFooter>
          </Card>
        </div>
        
        <div className="text-white order-1 md:order-2">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            Military-Grade VPN for Ultimate Privacy
          </h1>
          <p className="text-gray-300 mb-6">
            SecureVPN provides top-tier encryption and security features to keep your online activities private and protected.
          </p>
          
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="mt-1 p-2 bg-primary/20 rounded-full">
                <ShieldCheck className="w-5 h-5 text-primary-300" />
              </div>
              <div>
                <h3 className="font-semibold">AES-256 Encryption</h3>
                <p className="text-sm text-gray-400">Industry-leading security that's virtually impenetrable</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="mt-1 p-2 bg-primary/20 rounded-full">
                <Globe className="w-5 h-5 text-primary-300" />
              </div>
              <div>
                <h3 className="font-semibold">Global Server Network</h3>
                <p className="text-sm text-gray-400">Access content from around the world with servers in 8+ countries</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="mt-1 p-2 bg-primary/20 rounded-full">
                <Lock className="w-5 h-5 text-primary-300" />
              </div>
              <div>
                <h3 className="font-semibold">Kill Switch & DNS Protection</h3>
                <p className="text-sm text-gray-400">Prevents data leaks even if your connection drops</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="mt-1 p-2 bg-primary/20 rounded-full">
                <Zap className="w-5 h-5 text-primary-300" />
              </div>
              <div>
                <h3 className="font-semibold">Multiple VPN Protocols</h3>
                <p className="text-sm text-gray-400">OpenVPN, WireGuard, and more for optimal performance</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
