import Sidebar from '@/components/layout/sidebar';
import MobileNav from '@/components/layout/mobile-nav';
import Header from '@/components/layout/header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';

export default function SupportPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!subject.trim() || !message.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please provide both a subject and message.',
        variant: 'destructive'
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // This would normally send to a support API endpoint
      const res = await apiRequest('POST', '/api/support', {
        subject,
        message,
        email: user?.email || ''
      });
      
      if (res.ok) {
        toast({
          title: 'Support Request Submitted',
          description: 'We have received your request and will respond soon.',
        });
        
        // Clear the form
        setSubject('');
        setMessage('');
      } else {
        throw new Error('Failed to submit support request');
      }
    } catch (error) {
      console.error('Support submission error:', error);
      toast({
        title: 'Submission Error',
        description: 'There was a problem submitting your request. Please try again later.',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar for desktop */}
      <Sidebar />
      
      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        {/* Top header */}
        <Header username={user?.username || ''} />
        
        {/* Support content */}
        <div className="p-4 md:p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Contact Support */}
            <Card className="border border-gray-800 shadow-lg bg-gray-950">
              <CardHeader className="border-b border-gray-800">
                <h3 className="text-lg font-medium">Contact Support</h3>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label htmlFor="subject" className="text-sm font-medium">Subject</label>
                    <Input
                      id="subject"
                      placeholder="Brief description of your issue"
                      className="bg-gray-800 border-gray-700"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="message" className="text-sm font-medium">Message</label>
                    <Textarea
                      id="message"
                      placeholder="Please describe your issue in detail..."
                      className="bg-gray-800 border-gray-700 min-h-[150px]"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div>
                    <Button 
                      type="submit" 
                      className="w-full bg-primary hover:bg-primary/90"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit Request'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
            
            {/* FAQ */}
            <Card className="border border-gray-800 shadow-lg bg-gray-950">
              <CardHeader className="border-b border-gray-800">
                <h3 className="text-lg font-medium">Frequently Asked Questions</h3>
              </CardHeader>
              <CardContent className="p-6">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="item-1">
                    <AccordionTrigger className="text-left font-medium">
                      What is a VPN and why do I need one?
                    </AccordionTrigger>
                    <AccordionContent className="text-gray-300">
                      A VPN (Virtual Private Network) encrypts your internet connection and routes it through secure servers, protecting your online privacy, securing your data, and allowing you to bypass geo-restrictions. It's essential for maintaining privacy on public Wi-Fi, preventing ISP tracking, and accessing region-restricted content.
                    </AccordionContent>
                  </AccordionItem>
                  
                  <AccordionItem value="item-2">
                    <AccordionTrigger className="text-left font-medium">
                      Which VPN protocol should I use?
                    </AccordionTrigger>
                    <AccordionContent className="text-gray-300">
                      For most users, WireGuard offers the best balance of speed and security. OpenVPN is highly secure and works well for bypassing firewalls, while IKEv2 is excellent for mobile devices due to its ability to reconnect quickly when switching networks. If you're unsure, the auto-select option will choose the best protocol for your current network conditions.
                    </AccordionContent>
                  </AccordionItem>
                  
                  <AccordionItem value="item-3">
                    <AccordionTrigger className="text-left font-medium">
                      Why is my connection slow?
                    </AccordionTrigger>
                    <AccordionContent className="text-gray-300">
                      VPN speed can be affected by several factors: distance to the VPN server, server load, your base internet speed, the protocol used, and network congestion. Try connecting to a closer server, switching protocols (WireGuard is generally fastest), or checking if your base internet connection is stable.
                    </AccordionContent>
                  </AccordionItem>
                  
                  <AccordionItem value="item-4">
                    <AccordionTrigger className="text-left font-medium">
                      What is a Kill Switch?
                    </AccordionTrigger>
                    <AccordionContent className="text-gray-300">
                      A Kill Switch is a security feature that automatically disconnects your device from the internet if your VPN connection drops. This prevents accidental exposure of your real IP address and ensures your traffic is always protected. It's especially important when using public Wi-Fi or handling sensitive information.
                    </AccordionContent>
                  </AccordionItem>
                  
                  <AccordionItem value="item-5">
                    <AccordionTrigger className="text-left font-medium">
                      What's the difference between free and premium plans?
                    </AccordionTrigger>
                    <AccordionContent className="text-gray-300">
                      The free plan offers basic VPN protection with limited data, speeds, and server choices. Premium plans provide unlimited data, faster speeds, access to all servers worldwide, advanced features like Double VPN and Obfuscation, support for more devices, and priority customer support.
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </div>
          
          {/* Quick Help */}
          <Card className="border border-gray-800 shadow-lg bg-gray-950">
            <CardHeader className="border-b border-gray-800">
              <h3 className="text-lg font-medium">Quick Help</h3>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-800">
                <div className="p-6">
                  <h4 className="font-medium mb-2">Troubleshooting</h4>
                  <ul className="space-y-2 text-sm text-gray-300">
                    <li>
                      <a href="#" className="text-primary hover:underline">Connection issues</a>
                    </li>
                    <li>
                      <a href="#" className="text-primary hover:underline">Speed optimization</a>
                    </li>
                    <li>
                      <a href="#" className="text-primary hover:underline">App crashes or errors</a>
                    </li>
                    <li>
                      <a href="#" className="text-primary hover:underline">Billing and subscription</a>
                    </li>
                  </ul>
                </div>
                
                <div className="p-6">
                  <h4 className="font-medium mb-2">Guides</h4>
                  <ul className="space-y-2 text-sm text-gray-300">
                    <li>
                      <a href="#" className="text-primary hover:underline">Getting started</a>
                    </li>
                    <li>
                      <a href="#" className="text-primary hover:underline">Choosing the right server</a>
                    </li>
                    <li>
                      <a href="#" className="text-primary hover:underline">Optimizing settings</a>
                    </li>
                    <li>
                      <a href="#" className="text-primary hover:underline">Mobile setup guide</a>
                    </li>
                  </ul>
                </div>
                
                <div className="p-6">
                  <h4 className="font-medium mb-2">Contact Options</h4>
                  <ul className="space-y-4 text-sm text-gray-300">
                    <li className="flex items-start">
                      <span className="font-medium w-20">Email:</span>
                      <a href="mailto:support@securevpn.com" className="text-primary hover:underline">support@securevpn.com</a>
                    </li>
                    <li className="flex items-start">
                      <span className="font-medium w-20">Chat:</span>
                      <span>Available 24/7 for premium users</span>
                    </li>
                    <li className="flex items-start">
                      <span className="font-medium w-20">Phone:</span>
                      <span>+1 (555) 123-4567<br />(9am-5pm EST)</span>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      
      {/* Mobile navigation */}
      <MobileNav />
    </div>
  );
}