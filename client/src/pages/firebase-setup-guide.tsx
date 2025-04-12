import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InfoIcon, CopyIcon, ExternalLinkIcon, HomeIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

export default function FirebaseSetupGuide() {
  const { toast } = useToast();
  const currentDomain = typeof window !== 'undefined' ? window.location.hostname : '';
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "Text has been copied to your clipboard.",
    });
  };
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-primary">Firebase Authentication Setup Guide</h1>
        <Link href="/">
          <Button variant="outline" className="flex items-center gap-2">
            <HomeIcon size={16} />
            Return to Home
          </Button>
        </Link>
      </div>
      
      <Alert className="mb-6 bg-amber-50 border-amber-200">
        <InfoIcon className="h-5 w-5 text-amber-600" />
        <AlertTitle className="text-amber-700">Authentication Error Detected</AlertTitle>
        <AlertDescription className="text-amber-700">
          Your application is having trouble authenticating with Firebase. Follow the steps below to resolve this issue.
        </AlertDescription>
      </Alert>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Step 1: Add Your Replit Domain to Firebase</CardTitle>
          <CardDescription>
            For Firebase authentication to work, you need to add your application's domain to the authorized domains list in the Firebase console.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-1">Your current domain:</p>
            <div className="flex">
              <Input value={currentDomain} readOnly className="flex-1" />
              <Button 
                variant="outline" 
                className="ml-2" 
                onClick={() => copyToClipboard(currentDomain)}
              >
                <CopyIcon className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Copy this domain and add it to Firebase authorized domains list.
            </p>
          </div>
          
          <ol className="list-decimal pl-5 space-y-2">
            <li>Go to the <a 
              href="https://console.firebase.google.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center"
            >
              Firebase Console <ExternalLinkIcon className="h-3 w-3 ml-1" />
            </a></li>
            <li>Select your project</li>
            <li>In the left sidebar, click on "Authentication"</li>
            <li>Go to the "Settings" tab</li>
            <li>Scroll down to "Authorized domains"</li>
            <li>Click "Add domain" and paste your Replit domain</li>
            <li>Click "Add"</li>
          </ol>
        </CardContent>
      </Card>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Step 2: Verify Google Authentication is Enabled</CardTitle>
          <CardDescription>
            Make sure Google Sign-in method is enabled in your Firebase project.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-decimal pl-5 space-y-2">
            <li>In the Firebase Console, go to "Authentication"</li>
            <li>Click on the "Sign-in method" tab</li>
            <li>Find "Google" in the list of providers</li>
            <li>Make sure it's enabled (toggle switch is on)</li>
            <li>If it's disabled, click on it and enable it</li>
            <li>Save your changes</li>
          </ol>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Step 3: After Configuring Firebase</CardTitle>
          <CardDescription>
            Once you've completed the steps above, reload your application to verify authentication is working.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>
            After making changes in the Firebase console, it may take a few minutes for the changes to propagate.
            If authentication still doesn't work after 5 minutes, double-check the steps above and ensure
            all configurations are correct.
          </p>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={() => window.location.reload()}>
            Reload Application
          </Button>
          <Link href="/auth">
            <Button>
              Try Authentication
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}