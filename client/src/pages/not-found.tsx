import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { SeoHead } from "@/components/seo";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <SeoHead 
        title="Page Not Found - SecureVPN"
        description="The page you are looking for cannot be found. Return to SecureVPN homepage for secure browsing with military-grade encryption."
        keywords="404, page not found, SecureVPN, missing page"
        canonicalUrl="https://securevpn.replit.app/404"
      />
      
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">404 Page Not Found</h1>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            The page you are looking for does not exist or has been moved.
          </p>
          
          <div className="mt-6 flex justify-center">
            <Link href="/">
              <Button className="bg-primary text-primary-foreground">
                Return to Homepage
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
