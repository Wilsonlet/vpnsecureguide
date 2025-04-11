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
    
    // Define default subscription plans based on updated pricing and features
    const plans = [
      {
        name: subscriptionTiers.FREE,
        price: 0, // Free
        dataLimit: 500 * 1024 * 1024, // 500MB
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
        dataLimit: 0, // Unlimited data (0 means unlimited)
        dailyTimeLimit: 0, // Unlimited time
        serverAccess: 'standard',
        maxDevices: 2,
        doubleVpnAccess: false,
        obfuscationAccess: true, // New feature: Obfuscation
        adFree: true,
        priority: 1,
        stripePriceId: process.env.STRIPE_BASIC_PRICE_ID || null,
      },
      {
        name: subscriptionTiers.PREMIUM,
        price: 999, // $9.99
        dataLimit: 0, // Unlimited data
        dailyTimeLimit: 0, // Unlimited time
        serverAccess: 'premium',
        maxDevices: 5,
        doubleVpnAccess: true, // Double VPN feature
        obfuscationAccess: true, // Obfuscation feature
        adFree: true,
        priority: 2,
        stripePriceId: process.env.STRIPE_PREMIUM_PRICE_ID || null,
      },
      {
        name: subscriptionTiers.ULTIMATE,
        price: 1999, // $19.99 (high-end of range)
        dataLimit: 0, // Unlimited data
        dailyTimeLimit: 0, // Unlimited time
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
        name: 'Amsterdam #1',
        country: 'Netherlands',
        city: 'Amsterdam',
        ip: '198.51.100.1',
        latency: 42,
        load: 18,
        online: true,
        premium: false,
      },
      {
        name: 'London #1',
        country: 'UK',
        city: 'London',
        ip: '198.51.100.2',
        latency: 58,
        load: 25,
        online: true,
        premium: false,
      },
      {
        name: 'Frankfurt #1',
        country: 'Germany',
        city: 'Frankfurt',
        ip: '198.51.100.3',
        latency: 48,
        load: 12,
        online: true,
        premium: false,
      },
      // Premium servers (available to premium and ultimate subscribers)
      {
        name: 'New York #1',
        country: 'US',
        city: 'New York',
        ip: '198.51.100.4',
        latency: 120,
        load: 35,
        online: true,
        premium: true,
      },
      {
        name: 'Singapore #1',
        country: 'Singapore',
        city: 'Singapore',
        ip: '198.51.100.5',
        latency: 160,
        load: 22,
        online: true,
        premium: true,
      },
      {
        name: 'Lagos #1',
        country: 'Nigeria',
        city: 'Lagos',
        ip: '198.51.100.6',
        latency: 145,
        load: 10,
        online: true,
        premium: true,
      },
      {
        name: 'Cape Town #1',
        country: 'South Africa',
        city: 'Cape Town',
        ip: '198.51.100.7',
        latency: 180,
        load: 5,
        online: true,
        premium: true,
      },
      {
        name: 'Dubai #1',
        country: 'UAE',
        city: 'Dubai',
        ip: '198.51.100.8',
        latency: 130,
        load: 15,
        online: true,
        premium: true,
      },
      // Military Grade Encrypted Servers (new)
      {
        name: 'SecureNode Switzerland',
        country: 'Switzerland',
        city: 'Zurich',
        ip: '198.51.100.9',
        latency: 45,
        load: 8,
        online: true,
        premium: true,
      },
      {
        name: 'SecureNode Iceland',
        country: 'Iceland',
        city: 'Reykjavik',
        ip: '198.51.100.10',
        latency: 65,
        load: 3,
        online: true,
        premium: true,
      },
      {
        name: 'SecureNode Japan',
        country: 'Japan',
        city: 'Tokyo',
        ip: '198.51.100.11',
        latency: 170,
        load: 12,
        online: true,
        premium: true,
      },
      // Double-Hop Encrypted Servers (for Ultimate tier)
      {
        name: 'DoubleHop Finland-Sweden',
        country: 'Finland → Sweden',
        city: 'Helsinki → Stockholm',
        ip: '198.51.100.12',
        latency: 55,
        load: 7,
        online: true,
        premium: true,
      },
      {
        name: 'DoubleHop Canada-US',
        country: 'Canada → US',
        city: 'Toronto → Chicago',
        ip: '198.51.100.13',
        latency: 110,
        load: 14,
        online: true,
        premium: true,
      },
      // Obfuscated Servers (for Ultimate tier)
      {
        name: 'Obfuscated Romania',
        country: 'Romania',
        city: 'Bucharest',
        ip: '198.51.100.14',
        latency: 72,
        load: 9,
        online: true,
        premium: true,
      },
      {
        name: 'Obfuscated Hong Kong',
        country: 'Hong Kong',
        city: 'Central',
        ip: '198.51.100.15',
        latency: 135,
        load: 11,
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