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
import { useFirebaseAuth } from "@/hooks/use-firebase-auth";
import { useLocation } from "wouter";
import { Shield, ShieldCheck, Lock, Globe, Zap, Mail, LucideGithub } from "lucide-react";
import { SeoHead } from "@/components/seo";

// Extended schema with validation rules
const authSchema = insertUserSchema.extend({
  password: z.string().min(8, {
    message: "Password must be at least 8 characters.",
  }),
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
});

// Login schema - doesn't require email
const loginSchema = authSchema.pick({
  username: true,
  password: true,
});

type AuthFormData = z.infer<typeof authSchema>;
type LoginFormData = z.infer<typeof loginSchema>;

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState<string>("login");
  const { user, loginMutation, registerMutation } = useAuth();
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, isLoading: firebaseLoading } = useFirebaseAuth();
  const [location, setLocation] = useLocation();

  // Login form
  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
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
      email: "",
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

  const onLoginSubmit = (data: LoginFormData) => {
    loginMutation.mutate(data);
  };

  const onRegisterSubmit = (data: AuthFormData) => {
    registerMutation.mutate(data);
  };
  
  const handleEmailLogin = async () => {
    try {
      const email = loginForm.getValues("username") + "@securevpn.com";
      const password = loginForm.getValues("password");
      if (!email || !password) {
        loginForm.setError("username", { message: "Username is required" });
        loginForm.setError("password", { message: "Password is required" });
        return;
      }
      await signInWithEmail(email, password);
    } catch (error) {
      console.error("Firebase email login error:", error);
    }
  };
  
  const handleEmailSignUp = async () => {
    try {
      const email = registerForm.getValues("email");
      const password = registerForm.getValues("password");
      if (!email || !password) {
        registerForm.setError("email", { message: "Email is required" });
        registerForm.setError("password", { message: "Password is required" });
        return;
      }
      await signUpWithEmail(email, password);
    } catch (error) {
      console.error("Firebase email signup error:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      {/* SEO Head */}
      <SeoHead 
        title="SecureVPN Login - Access Your Secure Connection"
        description="Login or sign up for SecureVPN to access military-grade encryption and secure browsing. Protect your online privacy with our global VPN network."
        keywords="VPN login, secure VPN, VPN sign up, online privacy, internet security, encryption"
        canonicalUrl="https://securevpn.replit.app/auth"
        ogType="website"
      />
      
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
                        disabled={loginMutation.isPending || firebaseLoading}
                      >
                        {loginMutation.isPending || firebaseLoading ? (
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
                      
                      <div className="relative my-4">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-gray-700" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-background px-2 text-muted-foreground">
                            Or continue with
                          </span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-2">
                        <Button 
                          type="button" 
                          variant="outline" 
                          className="flex items-center justify-center gap-2"
                          onClick={() => signInWithGoogle()}
                          disabled={firebaseLoading}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-5 w-5">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                          </svg>
                          Sign in with Google
                        </Button>
                      </div>
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
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="Enter your email address" {...field} />
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
                        disabled={registerMutation.isPending || firebaseLoading}
                      >
                        {registerMutation.isPending || firebaseLoading ? (
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
                      
                      <div className="relative my-4">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-gray-700" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-background px-2 text-muted-foreground">
                            Or continue with
                          </span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-2">
                        <Button 
                          type="button" 
                          variant="outline" 
                          className="flex items-center justify-center gap-2"
                          onClick={() => signInWithGoogle()}
                          disabled={firebaseLoading}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-5 w-5">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                          </svg>
                          Sign up with Google
                        </Button>
                      </div>
                    </form>
                  </Form>
                </TabsContent>
              </Tabs>
            </CardContent>
            <CardFooter className="flex flex-col space-y-3">
              <p className="text-center text-sm text-muted-foreground w-full">
                By continuing, you agree to SecureVPN's Terms of Service and Privacy Policy
              </p>
              <div className="text-center text-xs text-muted-foreground mt-2 border-t pt-2 border-gray-800">
                <span>Having trouble with Google Sign-in? </span>
                <a href="/firebase-setup.html" className="text-primary hover:underline">
                  View Firebase Setup Guide
                </a>
              </div>
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
