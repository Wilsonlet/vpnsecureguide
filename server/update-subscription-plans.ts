import { db } from './db';
import { subscriptionPlans, subscriptionTiers } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Updates or inserts subscription plans in the database
 */
export async function updateSubscriptionPlans() {
  console.log('Updating subscription plans...');

  // Define the plans based on requirements
  const plans = [
    {
      name: subscriptionTiers.FREE,
      price: 0, // Free
      dataLimit: 500 * 1024 * 1024, // 500 MB (in bytes)
      dailyTimeLimit: 240, // 4 hours (in minutes)
      serverAccess: 'standard',
      maxDevices: 1,
      doubleVpnAccess: false,
      obfuscationAccess: false,
      adFree: false,
      priority: 1, // Display order
      description: "Limited data, standard servers, 1 device",
      features: "500 MB/month, 1 device, Standard Servers, Ad-supported"
    },
    {
      name: subscriptionTiers.BASIC,
      price: 499, // $4.99 (in cents)
      dataLimit: -1, // Unlimited
      dailyTimeLimit: -1, // Unlimited
      serverAccess: 'standard',
      maxDevices: 2,
      doubleVpnAccess: false,
      obfuscationAccess: true,
      adFree: false,
      priority: 2,
      description: "Unlimited data, standard servers, 2 devices",
      features: "Unlimited data, 2 devices, Standard Servers, Obfuscation"
    },
    {
      name: subscriptionTiers.PREMIUM,
      price: 999, // $9.99 (in cents)
      dataLimit: -1, // Unlimited
      dailyTimeLimit: -1, // Unlimited
      serverAccess: 'premium',
      maxDevices: 5,
      doubleVpnAccess: true,
      obfuscationAccess: true,
      adFree: true,
      priority: 3,
      description: "Unlimited data, premium servers, 5 devices",
      features: "Unlimited data, 5 devices, Premium Servers, Double VPN, Obfuscation, Ad-Free"
    },
    {
      name: subscriptionTiers.ULTIMATE,
      price: 1999, // $19.99 (in cents)
      dataLimit: -1, // Unlimited
      dailyTimeLimit: -1, // Unlimited
      serverAccess: 'all',
      maxDevices: 10,
      doubleVpnAccess: true,
      obfuscationAccess: true,
      adFree: true,
      priority: 4,
      description: "Unlimited data, all servers, 10 devices, full features",
      features: "Unlimited data, 10 devices, All server types, Streaming & P2P optimized, Kill Switch, Split Tunneling"
    }
  ];

  // Upsert each plan
  for (const plan of plans) {
    const existingPlan = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.name, plan.name));
    
    if (existingPlan.length > 0) {
      // Update existing plan
      await db.update(subscriptionPlans)
        .set({
          price: plan.price,
          dataLimit: plan.dataLimit,
          dailyTimeLimit: plan.dailyTimeLimit,
          serverAccess: plan.serverAccess,
          maxDevices: plan.maxDevices,
          doubleVpnAccess: plan.doubleVpnAccess,
          obfuscationAccess: plan.obfuscationAccess,
          adFree: plan.adFree,
          priority: plan.priority,
          description: plan.description,
          features: plan.features
        })
        .where(eq(subscriptionPlans.name, plan.name));
      
      console.log(`Updated subscription plan: ${plan.name}`);
    } else {
      // Insert new plan
      await db.insert(subscriptionPlans).values(plan);
      console.log(`Created subscription plan: ${plan.name}`);
    }
  }

  console.log('Subscription plans updated successfully');
}

// Execute the function when imported
// We don't need to check for direct execution in ES modules
// The function will be executed when imported by routes.ts