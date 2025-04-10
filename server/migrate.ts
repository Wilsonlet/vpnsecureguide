import { db } from './db';
import { subscriptionPlans, subscriptionTiers, vpnServers } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Initialize database with default data
 */
async function seed() {
  console.log('Starting database seed...');

  // Seed subscription plans if they don't exist
  const existingPlans = await db.select().from(subscriptionPlans);
  
  if (existingPlans.length === 0) {
    console.log('Seeding subscription plans...');
    
    // Define default subscription plans
    const plans = [
      {
        name: subscriptionTiers.FREE,
        price: 0, // Free
        dataLimit: 1 * 1024 * 1024 * 1024, // 1GB
        dailyTimeLimit: 60, // 60 minutes
        serverAccess: 'standard',
        maxDevices: 1,
        doubleVpnAccess: false,
        obfuscationAccess: false,
        adFree: false,
        priority: 0,
        stripePriceId: null,
      },
      {
        name: subscriptionTiers.BASIC,
        price: 499, // $4.99
        dataLimit: 50 * 1024 * 1024 * 1024, // 50GB
        dailyTimeLimit: 120, // 2 hours
        serverAccess: 'standard',
        maxDevices: 2,
        doubleVpnAccess: false,
        obfuscationAccess: false,
        adFree: true,
        priority: 1,
        stripePriceId: process.env.STRIPE_BASIC_PRICE_ID || null,
      },
      {
        name: subscriptionTiers.PREMIUM,
        price: 999, // $9.99
        dataLimit: 200 * 1024 * 1024 * 1024, // 200GB
        dailyTimeLimit: 0, // Unlimited
        serverAccess: 'premium',
        maxDevices: 5,
        doubleVpnAccess: true,
        obfuscationAccess: false,
        adFree: true,
        priority: 2,
        stripePriceId: process.env.STRIPE_PREMIUM_PRICE_ID || null,
      },
      {
        name: subscriptionTiers.ULTIMATE,
        price: 1499, // $14.99
        dataLimit: 500 * 1024 * 1024 * 1024, // 500GB
        dailyTimeLimit: 0, // Unlimited
        serverAccess: 'all',
        maxDevices: 10,
        doubleVpnAccess: true,
        obfuscationAccess: true,
        adFree: true,
        priority: 3,
        stripePriceId: process.env.STRIPE_ULTIMATE_PRICE_ID || null,
      },
    ];
    
    // Insert plans
    await db.insert(subscriptionPlans).values(plans);
    console.log('Added subscription plans:', plans.map(p => p.name).join(', '));
  } else {
    console.log('Subscription plans already exist, skipping...');
  }

  // Seed VPN servers if they don't exist
  const existingServers = await db.select().from(vpnServers);
  
  if (existingServers.length === 0) {
    console.log('Seeding VPN servers...');
    
    // Define default VPN servers in different regions
    const servers = [
      // Standard servers (available to all users)
      {
        name: 'US East',
        country: 'United States',
        city: 'New York',
        ip: '102.54.11.1',
        latency: 45,
        load: 30,
        online: true,
        premium: false,
      },
      {
        name: 'Germany',
        country: 'Germany',
        city: 'Frankfurt',
        ip: '134.23.67.2',
        latency: 75,
        load: 25,
        online: true,
        premium: false,
      },
      {
        name: 'Singapore',
        country: 'Singapore',
        city: 'Singapore',
        ip: '165.32.87.4',
        latency: 120,
        load: 20,
        online: true,
        premium: false,
      },
      // Premium servers (available to premium and ultimate subscribers)
      {
        name: 'UK London',
        country: 'United Kingdom',
        city: 'London',
        ip: '173.45.12.8',
        latency: 65,
        load: 40,
        online: true,
        premium: true,
      },
      {
        name: 'US West',
        country: 'United States',
        city: 'San Francisco',
        ip: '117.65.34.6',
        latency: 55,
        load: 45,
        online: true,
        premium: true,
      },
      {
        name: 'Netherlands',
        country: 'Netherlands',
        city: 'Amsterdam',
        ip: '154.78.23.9',
        latency: 70,
        load: 35,
        online: true,
        premium: true,
      },
      {
        name: 'South Africa',
        country: 'South Africa',
        city: 'Cape Town',
        ip: '185.34.56.7',
        latency: 150,
        load: 15,
        online: true,
        premium: true,
      },
      {
        name: 'UAE',
        country: 'United Arab Emirates',
        city: 'Dubai',
        ip: '172.46.89.5',
        latency: 130,
        load: 25,
        online: true,
        premium: true,
      },
      {
        name: 'Nigeria',
        country: 'Nigeria',
        city: 'Lagos',
        ip: '196.54.37.8',
        latency: 145,
        load: 20,
        online: true,
        premium: true,
      },
    ];
    
    // Insert servers
    await db.insert(vpnServers).values(servers);
    console.log('Added VPN servers:', servers.map(s => s.name).join(', '));
  } else {
    console.log('VPN servers already exist, skipping...');
  }

  console.log('Database seed completed!');
}

// Run the seed function and handle errors
seed()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });