import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const subscriptionTiers = {
  FREE: "free",
  BASIC: "basic",
  PREMIUM: "premium",
  ULTIMATE: "ultimate"
} as const;

export type SubscriptionTier = typeof subscriptionTiers[keyof typeof subscriptionTiers];

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email"),
  firebaseId: text("firebase_id").unique(), // Add Firebase UID for authentication
  subscription: text("subscription").default(subscriptionTiers.FREE).notNull(),
  subscriptionExpiryDate: timestamp("subscription_expiry_date"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  dataLimit: integer("data_limit").default(1024 * 1024 * 1024), // 1GB for free tier
  dailyTimeLimit: integer("daily_time_limit").default(60), // 60 minutes for free tier
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const serverRegions = {
  EUROPE: "Europe",
  NORTH_AMERICA: "North America",
  ASIA_PACIFIC: "Asia Pacific",
  AFRICA: "Africa",
  MIDDLE_EAST: "Middle East",
} as const;

export type ServerRegion = typeof serverRegions[keyof typeof serverRegions];

export const vpnServers = pgTable("vpn_servers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  country: text("country").notNull(),
  city: text("city").notNull(),
  ip: text("ip").notNull(),
  region: text("region").notNull().default(serverRegions.EUROPE),
  latency: integer("latency").default(0),
  load: integer("load").default(0),
  online: boolean("online").default(true),
  premium: boolean("premium").default(false),
  obfuscated: boolean("obfuscated").default(false),
  double_hop: boolean("double_hop").default(false),
});

export const vpnSessions = pgTable("vpn_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  serverId: integer("server_id").notNull(),
  protocol: text("protocol").notNull(),
  encryption: text("encryption").notNull(),
  startTime: timestamp("start_time").defaultNow().notNull(),
  endTime: timestamp("end_time"),
  dataUploaded: integer("data_uploaded").default(0),
  dataDownloaded: integer("data_downloaded").default(0),
});

export const vpnUserSettings = pgTable("vpn_user_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  killSwitch: boolean("kill_switch").default(true),
  dnsLeakProtection: boolean("dns_leak_protection").default(true),
  doubleVpn: boolean("double_vpn").default(false),
  obfuscation: boolean("obfuscation").default(false),
  preferredProtocol: text("preferred_protocol").default("openvpn_tcp"),
  preferredEncryption: text("preferred_encryption").default("aes_256_gcm"),
});

export const subscriptionPlans = pgTable("subscription_plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  price: integer("price").notNull(), // Price in cents
  dataLimit: integer("data_limit").notNull(), // Data limit in bytes
  dailyTimeLimit: integer("daily_time_limit").notNull(), // Daily time limit in minutes
  serverAccess: text("server_access").default("standard").notNull(), // standard, premium, all
  maxDevices: integer("max_devices").default(1).notNull(),
  doubleVpnAccess: boolean("double_vpn_access").default(false),
  obfuscationAccess: boolean("obfuscation_access").default(false),
  adFree: boolean("ad_free").default(false),
  priority: integer("priority").default(0).notNull(), // For display order
  stripePriceId: text("stripe_price_id"), // For Stripe integration
  paystackPlanCode: text("paystack_plan_code"), // For Paystack integration
});

export const appSettings = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value"),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  firebaseId: true,
}).extend({
  email: z.string().email().optional(),
  firebaseId: z.string().optional()
});

export const insertVpnServerSchema = createInsertSchema(vpnServers);
export const insertVpnSessionSchema = createInsertSchema(vpnSessions).omit({
  id: true,
  endTime: true,
  dataUploaded: true, 
  dataDownloaded: true,
});
export const insertVpnUserSettingsSchema = createInsertSchema(vpnUserSettings).omit({
  id: true,
});

export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans).omit({
  id: true,
});

export const insertAppSettingSchema = createInsertSchema(appSettings).omit({
  id: true,
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type VpnServer = typeof vpnServers.$inferSelect;
export type VpnSession = typeof vpnSessions.$inferSelect;
export type VpnUserSettings = typeof vpnUserSettings.$inferSelect;
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type AppSetting = typeof appSettings.$inferSelect;
export type InsertVpnSession = z.infer<typeof insertVpnSessionSchema>;
export type InsertVpnUserSettings = z.infer<typeof insertVpnUserSettingsSchema>;
export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;
export type InsertAppSetting = z.infer<typeof insertAppSettingSchema>;
