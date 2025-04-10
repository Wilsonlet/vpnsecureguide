import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  subscription: text("subscription").default("free").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const vpnServers = pgTable("vpn_servers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  country: text("country").notNull(),
  city: text("city").notNull(),
  ip: text("ip").notNull(),
  latency: integer("latency").default(0),
  load: integer("load").default(0),
  online: boolean("online").default(true),
  premium: boolean("premium").default(false),
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

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
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

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type VpnServer = typeof vpnServers.$inferSelect;
export type VpnSession = typeof vpnSessions.$inferSelect;
export type VpnUserSettings = typeof vpnUserSettings.$inferSelect;
export type InsertVpnSession = z.infer<typeof insertVpnSessionSchema>;
export type InsertVpnUserSettings = z.infer<typeof insertVpnUserSettingsSchema>;
