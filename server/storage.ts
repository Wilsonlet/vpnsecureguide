import { 
  User, InsertUser, VpnServer, VpnSession, VpnUserSettings, 
  InsertVpnSession, InsertVpnUserSettings 
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

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

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private servers: Map<number, VpnServer>;
  private sessions: Map<number, VpnSession>;
  private userSettings: Map<number, VpnUserSettings>;
  private currentId: Record<string, number>;
  public sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.servers = new Map();
    this.sessions = new Map();
    this.userSettings = new Map();
    this.currentId = {
      users: 1,
      servers: 1,
      sessions: 1,
      userSettings: 1
    };

    // Initialize session store
    const MemoryStore = createMemoryStore(session);
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    });

    // Initialize with some server data
    this.initializeServers();
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId.users++;
    const createdAt = new Date();
    const user: User = { 
      ...insertUser, 
      id, 
      subscription: "free",
      createdAt
    };
    this.users.set(id, user);
    return user;
  }

  // Server methods
  async getAllServers(): Promise<VpnServer[]> {
    return Array.from(this.servers.values());
  }

  async getServerById(id: number): Promise<VpnServer | undefined> {
    return this.servers.get(id);
  }

  // User settings methods
  async getUserSettings(userId: number): Promise<VpnUserSettings | undefined> {
    return Array.from(this.userSettings.values()).find(
      (settings) => settings.userId === userId
    );
  }

  async createUserSettings(settings: InsertVpnUserSettings): Promise<VpnUserSettings> {
    const id = this.currentId.userSettings++;
    const userSettings: VpnUserSettings = { ...settings, id };
    this.userSettings.set(id, userSettings);
    return userSettings;
  }

  async updateUserSettings(settings: InsertVpnUserSettings): Promise<VpnUserSettings> {
    const existing = await this.getUserSettings(settings.userId);
    
    if (existing) {
      const updated: VpnUserSettings = { ...existing, ...settings };
      this.userSettings.set(existing.id, updated);
      return updated;
    } else {
      return this.createUserSettings(settings);
    }
  }

  // Session methods
  async getUserSessions(userId: number): Promise<VpnSession[]> {
    return Array.from(this.sessions.values())
      .filter(session => session.userId === userId)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }

  async getCurrentSession(userId: number): Promise<VpnSession | undefined> {
    return Array.from(this.sessions.values()).find(
      session => session.userId === userId && !session.endTime
    );
  }

  async createSession(session: InsertVpnSession): Promise<VpnSession> {
    const id = this.currentId.sessions++;
    const startTime = new Date();
    const newSession: VpnSession = { 
      ...session, 
      id, 
      startTime,
      endTime: null,
      dataUploaded: 0,
      dataDownloaded: 0
    };
    this.sessions.set(id, newSession);
    return newSession;
  }

  async endCurrentSession(userId: number): Promise<VpnSession | undefined> {
    const currentSession = await this.getCurrentSession(userId);
    
    if (currentSession) {
      const endTime = new Date();
      // Generate random upload/download data for the session
      const duration = endTime.getTime() - new Date(currentSession.startTime).getTime();
      const dataUploaded = Math.floor(Math.random() * 500) * 1024 * 1024; // Random MB in bytes
      const dataDownloaded = Math.floor(Math.random() * 750) * 1024 * 1024; // Random MB in bytes
      
      const updatedSession: VpnSession = {
        ...currentSession,
        endTime,
        dataUploaded,
        dataDownloaded
      };
      
      this.sessions.set(currentSession.id, updatedSession);
      return updatedSession;
    }
    
    return undefined;
  }

  // Usage statistics
  async getUserUsageStats(userId: number, period: string): Promise<any> {
    const sessions = await this.getUserSessions(userId);
    
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
    
    // Filter and process session data
    const filteredSessions = sessions.filter(session => {
      const sessionDate = new Date(session.startTime);
      return sessionDate >= startDate;
    });
    
    let totalUploaded = 0;
    let totalDownloaded = 0;
    
    // Initialize daily data
    const dailyData: {
      date: string;
      uploaded: number;
      downloaded: number;
    }[] = [];
    
    // Create a map for the last 7 days
    const dates = new Map<string, { uploaded: number; downloaded: number }>();
    
    for (let i = 0; i < (period === "7days" ? 7 : 30); i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split('T')[0];
      dates.set(dateString, { uploaded: 0, downloaded: 0 });
    }
    
    // Calculate totals and daily data
    filteredSessions.forEach(session => {
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

  // Initialize servers with realistic data
  private initializeServers() {
    const initialServers: Omit<VpnServer, "id">[] = [
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

    initialServers.forEach(server => {
      const id = this.currentId.servers++;
      this.servers.set(id, { ...server, id });
    });
  }
}

export const storage = new MemStorage();
