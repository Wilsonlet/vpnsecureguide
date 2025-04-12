import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithRedirect,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { getFirebaseAuth, getCurrentUser, signInWithGoogle, getGoogleRedirectResult } from "@/lib/firebase";
import { useToast } from "./use-toast";
import { queryClient } from "@/lib/queryClient";

interface FirebaseAuthContextType {
  firebaseUser: FirebaseUser | null;
  isLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const FirebaseAuthContext = createContext<FirebaseAuthContextType | null>(null);

export function FirebaseAuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<Error | null>(null);
  const [redirectToSetup, setRedirectToSetup] = useState(false);
  const { toast } = useToast();

  // Check for Firebase configuration
  useEffect(() => {
    try {
      // Verify Firebase API key and config are available
      if (!import.meta.env.VITE_FIREBASE_API_KEY) {
        const error = new Error("Firebase API key is missing. Authentication might not work properly.");
        console.error(error);
        setAuthError(error);
        setIsLoading(false);
        
        toast({
          title: "Authentication Configuration Issue",
          description: "Firebase API key is missing. Please contact the administrator.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Firebase configuration error:", error);
      setAuthError(error);
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    // Skip if we already detected a configuration error
    if (authError) return;
    
    try {
      // Use the lazy-loaded Firebase auth instance
      const auth = getFirebaseAuth();
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        setFirebaseUser(user);
        setIsLoading(false);
  
        // If user changes, refresh the backend user data
        if (user) {
          queryClient.invalidateQueries({ queryKey: ["/api/user"] });
        }
      }, (error) => {
        console.error("Firebase auth state change error:", error);
        setAuthError(error);
        setIsLoading(false);
        
        toast({
          title: "Authentication Error",
          description: error.message || "There was a problem with the authentication service.",
          variant: "destructive",
        });
      });
  
      return () => unsubscribe();
    } catch (error: any) {
      console.error("Firebase auth initialization error:", error);
      setAuthError(error);
      setIsLoading(false);
      
      toast({
        title: "Authentication Setup Error",
        description: error.message || "Failed to initialize authentication service.",
        variant: "destructive",
      });
      
      return () => {}; // Empty cleanup function
    }
  }, [authError, toast]);

  // Check for redirect result on component mount
  useEffect(() => {
    // Skip if we already detected a configuration error
    if (authError) return;
    
    const checkRedirectResult = async () => {
      try {
        const user = await getGoogleRedirectResult();
        if (user) {
          toast({
            title: "Success!",
            description: "You have successfully signed in with Google.",
          });
        }
      } catch (error: any) {
        console.error("Error processing redirect result:", error);
        
        // Special handling for configuration errors
        if (error.code === 'auth/configuration-not-found') {
          toast({
            title: "Firebase Configuration Error",
            description: "Firebase authentication is not properly configured. Redirecting to setup guide...",
            variant: "destructive",
          });
          
          // Set a brief timeout to let the toast appear
          setTimeout(() => {
            setRedirectToSetup(true);
          }, 1500);
        } else {
          toast({
            title: "Authentication Error",
            description: error.message || "Failed to complete Google authentication.",
            variant: "destructive",
          });
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    checkRedirectResult();
  }, [authError, toast]);

  // Redirect to setup guide if Firebase is not configured properly
  useEffect(() => {
    if (redirectToSetup) {
      window.location.href = '/firebase-setup.html';
    }
  }, [redirectToSetup]);

  const handleSignInWithGoogle = async (): Promise<void> => {
    try {
      setIsLoading(true);
      // This will redirect to Google login page
      await signInWithGoogle();
      // The code below won't execute immediately due to redirect
      // Just to satisfy TypeScript, but this code won't run due to redirect
      return;
    } catch (error: any) {
      console.error("Error signing in with Google:", error);
      
      // Special handling for configuration errors
      if (error.code === 'auth/configuration-not-found') {
        toast({
          title: "Firebase Configuration Error",
          description: "Firebase authentication is not properly configured. Redirecting to setup guide...",
          variant: "destructive",
        });
        
        // Set a brief timeout to let the toast appear
        setTimeout(() => {
          setRedirectToSetup(true);
        }, 1500);
      } else {
        toast({
          title: "Authentication Error",
          description: error.message || "Failed to sign in with Google.",
          variant: "destructive",
        });
      }
      
      setIsLoading(false);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const auth = getFirebaseAuth();
      await signInWithEmailAndPassword(auth, email, password);
      toast({
        title: "Success!",
        description: "You have successfully signed in.",
      });
    } catch (error: any) {
      console.error("Error signing in with email:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to sign in.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signUpWithEmail = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const auth = getFirebaseAuth();
      await createUserWithEmailAndPassword(auth, email, password);
      toast({
        title: "Success!",
        description: "Your account has been created successfully.",
      });
    } catch (error: any) {
      console.error("Error signing up with email:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create account.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      const auth = getFirebaseAuth();
      await signOut(auth);
      // Clear the query cache for user data
      queryClient.setQueryData(["/api/user"], null);
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
    } catch (error: any) {
      console.error("Error signing out:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to log out.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <FirebaseAuthContext.Provider
      value={{
        firebaseUser,
        isLoading,
        signInWithGoogle: handleSignInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        logout,
      }}
    >
      {children}
    </FirebaseAuthContext.Provider>
  );
}

export function useFirebaseAuth() {
  const context = useContext(FirebaseAuthContext);
  if (!context) {
    throw new Error("useFirebaseAuth must be used within a FirebaseAuthProvider");
  }
  return context;
}