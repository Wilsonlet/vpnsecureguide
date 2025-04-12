import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ShieldCheck, Zap, Globe } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SubscriptionPlan } from '@shared/schema';

interface PlanCardProps {
  plan: SubscriptionPlan;
  isCurrentPlan: boolean;
  onSelect: (plan: SubscriptionPlan) => void;
  className?: string;
}

export default function PlanCard({ plan, isCurrentPlan, onSelect, className = '' }: PlanCardProps) {
  // Format price for display
  const formattedPrice = (plan.price / 100).toFixed(2);
  
  // Format data limit for display
  const formatDataLimit = (bytes: number) => {
    if (bytes < 0) return 'Unlimited';
    if (bytes === 0) return '0 MB';
    
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(0)} ${sizes[i]}`;
  };

  // Get feature list from the plan features string or build it
  const getFeatureList = () => {
    if (plan.features) {
      return plan.features.split(',').map(f => f.trim());
    }
    
    const features = [
      plan.dataLimit < 0 ? 'Unlimited data' : `${formatDataLimit(plan.dataLimit)}/month`,
      `${plan.maxDevices} device${plan.maxDevices !== 1 ? 's' : ''}`,
      plan.serverAccess === 'all' 
        ? 'All server types' 
        : plan.serverAccess === 'premium' 
          ? 'Premium Servers' 
          : 'Standard Servers',
    ];
    
    if (plan.obfuscationAccess) features.push('Obfuscation');
    if (plan.doubleVpnAccess) features.push('Double VPN');
    if (plan.adFree) features.push('Ad-Free');
    
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

      <CardHeader className="pb-2">
        <div className="flex justify-center mb-2">
          {variant.icon}
        </div>
        <CardTitle className="text-center text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-300">
          {plan.name.charAt(0).toUpperCase() + plan.name.slice(1)}
        </CardTitle>
        <div className="text-center">
          <span className="text-3xl font-bold">${formattedPrice}</span>
          <span className="text-gray-400">/month</span>
        </div>
        <CardDescription className="text-center text-gray-400 mt-1">
          {plan.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="pb-4">
        <ul className="space-y-2">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start">
              <CheckCircle2 className="h-5 w-5 mr-2 text-green-500 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-gray-300">{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter>
        <Button 
          className={`w-full ${variant.btn}`}
          disabled={isCurrentPlan}
          onClick={() => onSelect(plan)}
        >
          {isCurrentPlan ? 'Current Plan' : 'Select Plan'}
        </Button>
      </CardFooter>
    </Card>
  );
}