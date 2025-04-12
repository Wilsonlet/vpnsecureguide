import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { AppSetting } from '@shared/schema';
import { 
  Facebook, 
  Twitter, 
  Instagram, 
  Linkedin, 
  Github, 
  Mail,
  Shield,
  ExternalLink
} from 'lucide-react';
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

interface FooterProps {
  className?: string;
}

export function Footer({ className = '' }: FooterProps) {
  // Fetch app settings from the API
  const { data: appName } = useQuery<AppSetting>({
    queryKey: ['/api/app-settings/app_name'],
  });

  const { data: companyInfo } = useQuery<AppSetting>({
    queryKey: ['/api/app-settings/company_info'],
  });

  const { data: contactEmail } = useQuery<AppSetting>({
    queryKey: ['/api/app-settings/contact_email'],
  });

  const { data: socialLinks } = useQuery<AppSetting>({
    queryKey: ['/api/app-settings/social_links'],
  });

  // Parse social links if available
  const parsedSocialLinks = socialLinks?.value ? JSON.parse(socialLinks.value) : {};
  
  // Default app name if not set
  const displayName = appName?.value || 'SecureVPN';
  
  // Current year for copyright
  const currentYear = new Date().getFullYear();

  return (
    <footer className={`bg-background border-t ${className}`}>
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Column 1: App/Company Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary-foreground" />
              </div>
              <h3 className="text-lg font-bold">{displayName}</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {companyInfo?.value || 'Military-grade VPN service providing secure, private internet access worldwide.'}
            </p>
            <div className="flex space-x-4">
              {parsedSocialLinks.facebook && (
                <a 
                  href={parsedSocialLinks.facebook} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  <Facebook className="h-5 w-5" />
                </a>
              )}
              {parsedSocialLinks.twitter && (
                <a 
                  href={parsedSocialLinks.twitter} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  <Twitter className="h-5 w-5" />
                </a>
              )}
              {parsedSocialLinks.instagram && (
                <a 
                  href={parsedSocialLinks.instagram} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  <Instagram className="h-5 w-5" />
                </a>
              )}
              {parsedSocialLinks.linkedin && (
                <a 
                  href={parsedSocialLinks.linkedin} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  <Linkedin className="h-5 w-5" />
                </a>
              )}
              {parsedSocialLinks.github && (
                <a 
                  href={parsedSocialLinks.github} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  <Github className="h-5 w-5" />
                </a>
              )}
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div>
            <h3 className="font-medium mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="/settings" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Settings
                </Link>
              </li>
              <li>
                <Link href="/servers" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Servers
                </Link>
              </li>
              <li>
                <Link href="/subscription" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Subscription
                </Link>
              </li>
              <li>
                <Link href="/support" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Support
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Resources */}
          <div>
            <h3 className="font-medium mb-4">Resources</h3>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                  Security Guide
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                  Privacy Policy
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                  Terms of Service
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                  FAQ
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                  Blog
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: Contact */}
          <div>
            <h3 className="font-medium mb-4">Contact Us</h3>
            {contactEmail?.value && (
              <a 
                href={`mailto:${contactEmail.value}`}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-4"
              >
                <Mail className="h-4 w-4" />
                {contactEmail.value}
              </a>
            )}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Need help with your VPN connection?</p>
              <Button variant="outline" className="w-full">
                <Link href="/support" className="w-full">
                  Contact Support
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <Separator className="my-6" />
        
        {/* Copyright & Legal */}
        <div className="flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm text-muted-foreground mb-4 md:mb-0">
            © {currentYear} {displayName}. All rights reserved.
          </p>
          <div className="flex space-x-4">
            <a href="#" className="text-xs text-muted-foreground hover:text-primary transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="text-xs text-muted-foreground hover:text-primary transition-colors">
              Terms of Service
            </a>
            <a href="#" className="text-xs text-muted-foreground hover:text-primary transition-colors">
              Cookie Policy
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;