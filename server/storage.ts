import { 
  User, InsertUser, VpnServer, VpnSession, VpnUserSettings, 
  InsertVpnSession, InsertVpnUserSettings,
  users, vpnServers, vpnSessions, vpnUserSettings
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import connectPg from "connect-pg-simple";
import { eq, and, isNull, gte, desc, count } from "drizzle-orm";
import { db, pool } from "./db";

// Define the storage interface with all needed CRUD operations
export interface IStorage {
  sessionStore: session.Store;
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllServers(): Promise<VpnServer[]>;
  getServerById(id: number): Promise<VpnServer | undefined>;
  getUserSettings(userId: number): Promise<VpnUserSettings | undefined>;
  createUserSettings(settings: InsertVpnUserSettings): Promise<VpnUserSettings>;
  updateUserSettings(settings: InsertVpnUserSettings): Promise<VpnUserSettings>;
  getUserSessions(userId: number): Promise<VpnSession[]>;
  getCurrentSession(userId: number): Promise<VpnSession | undefined>;
  createSession(session: InsertVpnSession): Promise<VpnSession>;
  endCurrentSession(userId: number): Promise<VpnSession | undefined>;
  getUserUsageStats(userId: number, period: string): Promise<any>;
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
        subscription: "free",
        createdAt: currentDate
      })
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
