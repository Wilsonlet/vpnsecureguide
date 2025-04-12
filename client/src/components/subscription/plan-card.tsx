import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ShieldCheck, Zap, Globe } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SubscriptionPlan } from '@shared/schema';

// Helper function to get a consistent value badge for each plan
const getPlanValueBadge = (planName: string): string => {
  switch (planName) {
    case 'free':
      return 'Basic Security';
    case 'basic':
      return 'Popular Choice';
    case 'premium':
      return 'Best Value';
    case 'ultimate':
      return 'Maximum Protection';
    default:
      return 'Security & Privacy';
  }
};

// Helper function to get descriptive text for each plan
const getPlanDescription = (planName: string): string => {
  switch (planName) {
    case 'free':
      return 'Essential protection for casual browsing';
    case 'basic':
      return 'Solid protection with improved speeds';
    case 'premium':
      return 'Advanced features for serious privacy needs';
    case 'ultimate':
      return 'Complete privacy and security solution';
    default:
      return 'VPN protection plan';
  }
};

// Format data limit for display
const formatDataLimit = (bytes: number): string => {
  if (bytes < 0) return 'Unlimited';
  if (bytes === 0) return '0 MB';
  
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(0)} ${sizes[i]}`;
};

interface PlanCardProps {
  plan: SubscriptionPlan;
  isCurrentPlan: boolean;
  onSelect: (plan: SubscriptionPlan) => void;
  className?: string;
}

export default function PlanCard({ plan, isCurrentPlan, onSelect, className = '' }: PlanCardProps) {
  // Format price for display
  const formattedPrice = (plan.price / 100).toFixed(2);

  // Get feature list from the plan features string or build it
  const getFeatureList = () => {
    if (plan.features) {
      return plan.features.split(',').map(f => f.trim());
    }
    
    // Core features always displayed first with value proposition
    const features = [
      plan.dataLimit < 0 
        ? 'Unlimited data transfer' 
        : `${formatDataLimit(plan.dataLimit)}/month data transfer`,
      
      `Connect up to ${plan.maxDevices} device${plan.maxDevices !== 1 ? 's' : ''} simultaneously`,
      
      plan.serverAccess === 'all' 
        ? 'Full access to all server types worldwide' 
        : plan.serverAccess === 'premium' 
          ? 'Premium Servers with higher speeds' 
          : 'Standard Servers with stable connection',
    ];
    
    // Add additional value features based on plan capabilities
    if (plan.obfuscationAccess) features.push('Obfuscation technology to bypass restrictions');
    if (plan.doubleVpnAccess) features.push('Double VPN routing for enhanced privacy');
    if (plan.adFree) features.push('Ad-Free experience across all platforms');
    
    // Add plan-specific value propositions
    switch(plan.name) {
      case 'free':
        features.push('Basic protection for everyday browsing');
        features.push('Access to essential VPN features');
        break;
      case 'basic':
        features.push('Great for streaming and general use');
        features.push('No speed throttling');
        break;
      case 'premium':
        features.push('Optimized for streaming services');
        features.push('Priority customer support');
        features.push('Connect from restricted locations');
        break;
      case 'ultimate':
        features.push('Highest level of security and privacy');
        features.push('Priority bandwidth on all servers');
        features.push('Advanced features for power users');
        features.push('24/7 dedicated support');
        break;
    }
    
    return features;
  };

  // Get the right variant based on the plan
  const getVariant = () => {
    switch (plan.name) {
      case 'free':
        return {
          bg: 'bg-gray-900', 
          border: 'border-gray-700',
          hover: 'hover:border-gray-600',
          badge: 'bg-gray-700 text-white',
          btn: 'bg-gray-700 hover:bg-gray-600 text-white',
          icon: <Globe className="h-6 w-6 mb-1 text-gray-400" />
        };
      case 'basic':
        return {
          bg: 'bg-blue-900', 
          border: 'border-blue-700',
          hover: 'hover:border-blue-500',
          badge: 'bg-blue-700 text-white',
          btn: 'bg-blue-600 hover:bg-blue-500 text-white',
          icon: <ShieldCheck className="h-6 w-6 mb-1 text-blue-400" />
        };
      case 'premium':
        return {
          bg: 'bg-purple-900',
          border: 'border-purple-700',
          hover: 'hover:border-purple-500',
          badge: 'bg-purple-700 text-white',
          btn: 'bg-purple-600 hover:bg-purple-500 text-white',
          icon: <Zap className="h-6 w-6 mb-1 text-purple-400" />
        };
      case 'ultimate':
        return {
          bg: 'bg-gradient-to-br from-indigo-900 to-violet-900',
          border: 'border-violet-600',
          hover: 'hover:border-violet-400',
          badge: 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white',
          btn: 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white',
          icon: <ShieldCheck className="h-6 w-6 mb-1 text-indigo-300" />
        };
      default:
        return {
          bg: 'bg-gray-900',
          border: 'border-gray-700',
          hover: 'hover:border-gray-600',
          badge: 'bg-gray-700 text-white',
          btn: 'bg-gray-700 hover:bg-gray-600 text-white',
          icon: <Globe className="h-6 w-6 mb-1 text-gray-400" />
        };
    }
  };

  const variant = getVariant();
  const features = getFeatureList();

  return (
    <Card className={`relative h-full overflow-hidden ${variant.bg} ${variant.border} border ${variant.hover} transition-all ${className}`}>
      {/* Background effect */}
      <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none"></div>
      {isCurrentPlan && (
        <div className="absolute top-0 right-0 z-10">
          <Badge variant="outline" className="m-2 border-green-500 text-green-400 bg-green-950/50">
            Current Plan
          </Badge>
        </div>
      )}

      <CardHeader className="p-3 sm:p-4 pb-1 sm:pb-2">
        <div className="flex justify-center mb-1 sm:mb-2">
          {variant.icon}
        </div>
        <CardTitle className="text-center text-lg sm:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-300">
          {plan.name.charAt(0).toUpperCase() + plan.name.slice(1)}
        </CardTitle>
        <div className="text-center">
          <span className="text-2xl sm:text-3xl font-bold">${formattedPrice}</span>
          <span className="text-gray-400">/month</span>
        </div>
        <CardDescription className="text-center text-gray-400 mt-1 sm:mt-2 pb-1 sm:pb-2 text-xs sm:text-sm">
          {plan.description || getPlanDescription(plan.name)}
        </CardDescription>
        
        {/* Value Badge - highlight the main value proposition */}
        <div className="flex justify-center mt-1 sm:mt-2">
          <Badge className={`${variant.badge} text-xs px-2 py-1 sm:px-3`}>
            {getPlanValueBadge(plan.name)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-3 sm:p-4 pb-2 sm:pb-4">
        {/* Category: Core Features */}
        <div className="mb-2 sm:mb-3">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 sm:mb-2">
            Included Features
          </h4>
          <ul className="space-y-1 sm:space-y-2">
            {features.slice(0, 3).map((feature, index) => (
              <li key={index} className="flex items-start">
                <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 mr-1.5 sm:mr-2 text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-xs sm:text-sm text-gray-300">{feature}</span>
              </li>
            ))}
          </ul>
        </div>
        
        {/* Category: Additional Benefits */}
        {features.length > 3 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 sm:mb-2">
              Additional Benefits
            </h4>
            <ul className="space-y-1 sm:space-y-2">
              {features.slice(3).map((feature, index) => (
                <li key={index} className="flex items-start">
                  <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 mr-1.5 sm:mr-2 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-xs sm:text-sm text-gray-300">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>

      <CardFooter className="p-3 sm:p-4 pt-1 sm:pt-2">
        <Button 
          className={`w-full text-sm ${variant.btn}`}
          disabled={isCurrentPlan}
          onClick={() => onSelect(plan)}
        >
          {isCurrentPlan ? 'Current Plan' : 'Select Plan'}
        </Button>
      </CardFooter>
    </Card>
  );
}