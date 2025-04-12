import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Info, CircleCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";

/**
 * Helper component that provides guidance on Firebase configuration
 * Displays clear instructions for resolving common Firebase auth issues in deployed environments
 */
export function FirebaseConfigHelper() {
  const [currentDomain, setCurrentDomain] = useState<string>("");
  const [firebaseConfig, setFirebaseConfig] = useState({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
  });
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentDomain(window.location.hostname);
    }
  }, []);
  
  const hasValidConfig = firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId;
  
  if (hasValidConfig) {
    return null; // Don't show if config looks valid
  }
  
  return (
    <div className="p-4 max-w-2xl mx-auto my-8">
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Firebase Configuration Required</AlertTitle>
        <AlertDescription>
          To enable login functionality, you need to properly configure Firebase authentication.
        </AlertDescription>
      </Alert>
      
      <div className="space-y-6 mt-6">
        <div>
          <h3 className="font-semibold mb-2 flex items-center">
            <Info className="h-4 w-4 mr-2" />
            Current Application Domain
          </h3>
          <div className="bg-muted text-muted-foreground rounded p-2 text-sm font-mono">
            {currentDomain || "Not available"}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            You'll need to add this domain to your Firebase project's authorized domains list.
          </p>
        </div>
        
        <Callout>
          <h3 className="font-semibold mb-2">Configuration Steps:</h3>
          <ol className="list-decimal pl-5 space-y-2">
            <li>Go to the <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline">Firebase Console</a></li>
            <li>Select or create your project</li>
            <li>Navigate to "Authentication" in the sidebar</li>
            <li>Go to the "Sign-in method" tab and ensure Google authentication is enabled</li>
            <li>Go to the "Settings" tab, then "Authorized domains"</li>
            <li>Add your application's domain: <strong>{currentDomain}</strong></li>
            <li>Set the required environment variables in your Replit project</li>
          </ol>
        </Callout>
        
        <div>
          <h3 className="font-semibold mb-2">Required Environment Variables:</h3>
          <div className="grid grid-cols-1 gap-2">
            <div className="flex items-start gap-2">
              {firebaseConfig.apiKey ? 
                <CircleCheck className="h-5 w-5 text-green-500 mt-0.5" /> : 
                <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
              }
              <div>
                <p className="font-mono text-sm">VITE_FIREBASE_API_KEY</p>
                <p className="text-xs text-muted-foreground">Firebase API key (starts with "AIza...")</p>
              </div>
            </div>
            
            <div className="flex items-start gap-2">
              {firebaseConfig.projectId ? 
                <CircleCheck className="h-5 w-5 text-green-500 mt-0.5" /> : 
                <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
              }
              <div>
                <p className="font-mono text-sm">VITE_FIREBASE_PROJECT_ID</p>
                <p className="text-xs text-muted-foreground">Your Firebase project ID</p>
              </div>
            </div>
            
            <div className="flex items-start gap-2">
              {firebaseConfig.appId ? 
                <CircleCheck className="h-5 w-5 text-green-500 mt-0.5" /> : 
                <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
              }
              <div>
                <p className="font-mono text-sm">VITE_FIREBASE_APP_ID</p>
                <p className="text-xs text-muted-foreground">Your Firebase application ID</p>
              </div>
            </div>
          </div>
        </div>
        
        <Button 
          onClick={() => window.location.reload()}
          className="w-full mt-4"
        >
          Reload after configuration
        </Button>
      </div>
    </div>
  );
}