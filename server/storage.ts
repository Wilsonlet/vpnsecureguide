import { 
  User, InsertUser, VpnServer, VpnSession, VpnUserSettings, SubscriptionPlan,
  InsertVpnSession, InsertVpnUserSettings, subscriptionTiers,
  users, vpnServers, vpnSessions, vpnUserSettings, subscriptionPlans
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import connectPg from "connect-pg-simple";
import { eq, and, isNull, gte, desc, count } from "drizzle-orm";
import { db, pool } from "./db";

// Define the storage interface with all needed CRUD operations
export interface IStorage {
  sessionStore: session.Store;
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserSubscription(userId: number, subscription: string, expiryDate?: Date): Promise<User>;
  updateStripeCustomerId(userId: number, stripeCustomerId: string): Promise<User>;
  updateStripeSubscriptionId(userId: number, stripeSubscriptionId: string): Promise<User>;
  updateUserEmail(userId: number, email: string): Promise<User>;
  
  // Server methods
  getAllServers(): Promise<VpnServer[]>;
  getServerById(id: number): Promise<VpnServer | undefined>;
  getAccessibleServers(userId: number): Promise<VpnServer[]>;
  
  // Settings methods
  getUserSettings(userId: number): Promise<VpnUserSettings | undefined>;
  createUserSettings(settings: InsertVpnUserSettings): Promise<VpnUserSettings>;
  updateUserSettings(settings: InsertVpnUserSettings): Promise<VpnUserSettings>;
  
  // Session methods
  getUserSessions(userId: number): Promise<VpnSession[]>;
  getCurrentSession(userId: number): Promise<VpnSession | undefined>;
  createSession(session: InsertVpnSession): Promise<VpnSession>;
  endCurrentSession(userId: number): Promise<VpnSession | undefined>;
  
  // Stats methods
  getUserUsageStats(userId: number, period: string): Promise<any>;
  checkUserLimits(userId: number): Promise<{
    dataUsed: number;
    dataLimit: number;
    timeUsedToday: number;
    timeLimit: number;
    isDataLimitReached: boolean;
    isTimeLimitReached: boolean;
  }>;
  
  // Subscription methods
  getAllSubscriptionPlans(): Promise<SubscriptionPlan[]>;
  getSubscriptionPlan(id: number): Promise<SubscriptionPlan | undefined>;
  getSubscriptionPlanByName(name: string): Promise<SubscriptionPlan | undefined>;
}

export class DatabaseStorage implements IStorage {
  public sessionStore: session.Store;

  constructor() {
    // Initialize session store with PostgreSQL
    const PostgresSessionStore = connectPg(session);
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true
    });

    // Check if servers exist and seed initial data if needed
    this.initializeServersIfNeeded().catch(console.error);
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const currentDate = new Date();
    const [user] = await db.insert(users)
      .values({
        ...insertUser,
        subscription: subscriptionTiers.FREE,
        dataLimit: 1073741824, // 1GB
        dailyTimeLimit: 60, // 60 minutes
        createdAt: currentDate
      })
      .returning();
    return user;
  }
  
  async updateUserSubscription(userId: number, subscription: string, expiryDate?: Date): Promise<User> {
    const [user] = await db.update(users)
      .set({
        subscription,
        subscriptionExpiryDate: expiryDate
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }
  
  async updateStripeCustomerId(userId: number, stripeCustomerId: string): Promise<User> {
    const [user] = await db.update(users)
      .set({ stripeCustomerId })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }
  
  async updateStripeSubscriptionId(userId: number, stripeSubscriptionId: string): Promise<User> {
    const [user] = await db.update(users)
      .set({ stripeSubscriptionId })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }
  
  async updateUserEmail(userId: number, email: string): Promise<User> {
    const [user] = await db.update(users)
      .set({ email })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  // Server methods
  async getAllServers(): Promise<VpnServer[]> {
    return await db.select().from(vpnServers);
  }

  async getServerById(id: number): Promise<VpnServer | undefined> {
    const [server] = await db.select().from(vpnServers).where(eq(vpnServers.id, id));
    return server;
  }
  
  async getAccessibleServers(userId: number): Promise<VpnServer[]> {
    // Get user's subscription tier
    const user = await this.getUser(userId);
    if (!user) return [];
    
    // Get all servers first
    const allServers = await this.getAllServers();
    
    // Filter based on subscription tier
    if (user.subscription === subscriptionTiers.FREE || user.subscription === subscriptionTiers.BASIC) {
      // Free and basic users can only access standard servers (not premium)
      return allServers.filter(server => !server.premium);
    } else if (user.subscription === subscriptionTiers.PREMIUM) {
      // Premium users can access all servers
      return allServers;
    }
    
    // Ultimate users get all servers
    return allServers;
  }

  // User settings methods
  async getUserSettings(userId: number): Promise<VpnUserSettings | undefined> {
    const [settings] = await db.select().from(vpnUserSettings).where(eq(vpnUserSettings.userId, userId));
    return settings;
  }

  async createUserSettings(settings: InsertVpnUserSettings): Promise<VpnUserSettings> {
    const [userSettings] = await db.insert(vpnUserSettings)
      .values(settings)
      .returning();
    return userSettings;
  }

  async updateUserSettings(settings: InsertVpnUserSettings): Promise<VpnUserSettings> {
    const { userId } = settings;
    const existing = await this.getUserSettings(userId);
    
    if (existing) {
      // Ensure all nullable fields have explicit null values instead of undefined
      const updatedSettings = {
        ...settings,
        killSwitch: settings.killSwitch ?? existing.killSwitch,
        dnsLeakProtection: settings.dnsLeakProtection ?? existing.dnsLeakProtection,
        doubleVpn: settings.doubleVpn ?? existing.doubleVpn,
        obfuscation: settings.obfuscation ?? existing.obfuscation,
        preferredProtocol: settings.preferredProtocol ?? existing.preferredProtocol,
        preferredEncryption: settings.preferredEncryption ?? existing.preferredEncryption
      };
      
      const [updated] = await db.update(vpnUserSettings)
        .set(updatedSettings)
        .where(eq(vpnUserSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      // For new settings, ensure that null values are provided for all nullable fields
      const newSettings = {
        ...settings,
        killSwitch: settings.killSwitch ?? false,
        dnsLeakProtection: settings.dnsLeakProtection ?? false,
        doubleVpn: settings.doubleVpn ?? false,
        obfuscation: settings.obfuscation ?? false,
        preferredProtocol: settings.preferredProtocol ?? "openvpn",
        preferredEncryption: settings.preferredEncryption ?? "aes-256-gcm"
      };
      return this.createUserSettings(newSettings);
    }
  }

  // Session methods
  async getUserSessions(userId: number): Promise<VpnSession[]> {
    return await db.select()
      .from(vpnSessions)
      .where(eq(vpnSessions.userId, userId))
      .orderBy(desc(vpnSessions.startTime));
  }

  async getCurrentSession(userId: number): Promise<VpnSession | undefined> {
    const [session] = await db.select()
      .from(vpnSessions)
      .where(and(
        eq(vpnSessions.userId, userId),
        isNull(vpnSessions.endTime)
      ));
    return session;
  }

  async createSession(session: InsertVpnSession): Promise<VpnSession> {
    const startTime = new Date();
    const [newSession] = await db.insert(vpnSessions)
      .values({
        ...session,
        startTime,
        endTime: null,
        dataUploaded: 0,
        dataDownloaded: 0
      })
      .returning();
    return newSession;
  }

  async endCurrentSession(userId: number): Promise<VpnSession | undefined> {
    const currentSession = await this.getCurrentSession(userId);
    
    if (currentSession) {
      const endTime = new Date();
      // Generate random upload/download data for the session (for demo purposes)
      const duration = endTime.getTime() - new Date(currentSession.startTime).getTime();
      const dataUploaded = Math.floor(Math.random() * 500) * 1024 * 1024; // Random MB in bytes
      const dataDownloaded = Math.floor(Math.random() * 750) * 1024 * 1024; // Random MB in bytes
      
      const [updatedSession] = await db.update(vpnSessions)
        .set({
          endTime,
          dataUploaded,
          dataDownloaded
        })
        .where(eq(vpnSessions.id, currentSession.id))
        .returning();
      
      return updatedSession;
    }
    
    return undefined;
  }

  // Usage statistics
  async getUserUsageStats(userId: number, period: string): Promise<any> {
    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case "30days":
        startDate = new Date(now.setDate(now.getDate() - 30));
        break;
      case "month":
        startDate = new Date(now.setDate(1)); // First day of current month
        break;
      case "7days":
      default:
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
    }
    
    // Get sessions within the date range
    const sessions = await db.select()
      .from(vpnSessions)
      .where(and(
        eq(vpnSessions.userId, userId),
        gte(vpnSessions.startTime, startDate)
      ))
      .orderBy(vpnSessions.startTime);
    
    let totalUploaded = 0;
    let totalDownloaded = 0;
    
    // Initialize daily data
    const dailyData: {
      date: string;
      uploaded: number;
      downloaded: number;
    }[] = [];
    
    // Create a map for the date range
    const dates = new Map<string, { uploaded: number; downloaded: number }>();
    
    for (let i = 0; i < (period === "7days" ? 7 : 30); i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split('T')[0];
      dates.set(dateString, { uploaded: 0, downloaded: 0 });
    }
    
    // Calculate totals and daily data
    sessions.forEach(session => {
      if (session.dataUploaded && session.dataDownloaded) {
        totalUploaded += session.dataUploaded;
        totalDownloaded += session.dataDownloaded;
        
        // Add to daily data
        const dateString = new Date(session.startTime).toISOString().split('T')[0];
        const day = dates.get(dateString);
        
        if (day) {
          day.uploaded += session.dataUploaded;
          day.downloaded += session.dataDownloaded;
          dates.set(dateString, day);
        }
      }
    });
    
    // Convert the map to the dailyData array
    dates.forEach((value, key) => {
      dailyData.push({
        date: key,
        uploaded: value.uploaded,
        downloaded: value.downloaded
      });
    });
    
    // Sort by date
    dailyData.sort((a, b) => a.date.localeCompare(b.date));
    
    return {
      totalUploaded,
      totalDownloaded,
      totalData: totalUploaded + totalDownloaded,
      dailyData
    };
  }
  
  async checkUserLimits(userId: number): Promise<{
    dataUsed: number;
    dataLimit: number;
    timeUsedToday: number;
    timeLimit: number;
    isDataLimitReached: boolean;
    isTimeLimitReached: boolean;
  }> {
    // Get user's data limit from their user record
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    // Get today's sessions
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const sessions = await db.select()
      .from(vpnSessions)
      .where(and(
        eq(vpnSessions.userId, userId),
        gte(vpnSessions.startTime, today)
      ));
    
    // Calculate data used
    let dataUsed = 0;
    let timeUsedToday = 0; // in minutes
    
    for (const session of sessions) {
      // Add data usage
      if (session.dataUploaded) dataUsed += session.dataUploaded;
      if (session.dataDownloaded) dataUsed += session.dataDownloaded;
      
      // Calculate session duration
      const startTime = new Date(session.startTime);
      const endTime = session.endTime ? new Date(session.endTime) : new Date();
      const durationMs = endTime.getTime() - startTime.getTime();
      const durationMinutes = Math.floor(durationMs / (1000 * 60));
      
      timeUsedToday += durationMinutes;
    }
    
    return {
      dataUsed,
      dataLimit: user.dataLimit || 1073741824, // 1GB default
      timeUsedToday,
      timeLimit: user.dailyTimeLimit || 60, // 60 minutes default
      isDataLimitReached: dataUsed >= (user.dataLimit || 1073741824),
      isTimeLimitReached: timeUsedToday >= (user.dailyTimeLimit || 60)
    };
  }
  
  // Subscription plan methods
  async getAllSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    return await db.select().from(subscriptionPlans).orderBy(subscriptionPlans.priority);
  }
  
  async getSubscriptionPlan(id: number): Promise<SubscriptionPlan | undefined> {
    const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id));
    return plan;
  }
  
  async getSubscriptionPlanByName(name: string): Promise<SubscriptionPlan | undefined> {
    const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.name, name));
    return plan;
  }

  // Initialize server data if not already present
  private async initializeServersIfNeeded() {
    // Check if servers exist
    const serverCount = await db.select({ count: count() }).from(vpnServers);
    
    if (serverCount.length > 0 && serverCount[0].count > 0) {
      return; // Servers already exist
    }
    
    // Initialize with default server data
    const initialServers = [
      {
        name: "Amsterdam #1",
        country: "Netherlands",
        city: "Amsterdam",
        ip: "198.51.100.1",
        latency: 42,
        load: 18,
        online: true,
        premium: false
      },
      {
        name: "London #1",
        country: "UK",
        city: "London",
        ip: "198.51.100.2",
        latency: 58,
        load: 25,
        online: true,
        premium: false
      },
      {
        name: "Frankfurt #1",
        country: "Germany",
        city: "Frankfurt",
        ip: "198.51.100.3",
        latency: 48,
        load: 12,
        online: true,
        premium: false
      },
      {
        name: "New York #1",
        country: "US",
        city: "New York",
        ip: "198.51.100.4",
        latency: 120,
        load: 35,
        online: true,
        premium: true
      },
      {
        name: "Singapore #1",
        country: "Singapore",
        city: "Singapore",
        ip: "198.51.100.5",
        latency: 160,
        load: 22,
        online: true,
        premium: true
      },
      {
        name: "Lagos #1",
        country: "Nigeria",
        city: "Lagos",
        ip: "198.51.100.6",
        latency: 145,
        load: 10,
        online: true,
        premium: true
      },
      {
        name: "Cape Town #1",
        country: "South Africa",
        city: "Cape Town",
        ip: "198.51.100.7",
        latency: 180,
        load: 5,
        online: true,
        premium: true
      },
      {
        name: "Dubai #1",
        country: "UAE",
        city: "Dubai",
        ip: "198.51.100.8",
        latency: 130,
        load: 15,
        online: true,
        premium: true
      }
    ];

    // Insert all servers
    await db.insert(vpnServers).values(initialServers);
  }
}

export const storage = new DatabaseStorage();
