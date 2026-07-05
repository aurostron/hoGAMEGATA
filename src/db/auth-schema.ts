import { sqliteTable, text, integer, index, unique } from "drizzle-orm/sqlite-core";

// --- Better Auth Schema Tables ---

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "boolean" }).notNull(),
  image: text("image"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: integer("accessTokenExpiresAt", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refreshTokenExpiresAt", { mode: "timestamp" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }),
  updatedAt: integer("updatedAt", { mode: "timestamp" }),
});

// --- Backlog (User Data) Schema Tables ---

export const wishlist = sqliteTable("Wishlist", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
  gameId: text("gameId").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
}, (table) => [
  index("wishlist_user_game_idx").on(table.userId, table.gameId),
  unique("wishlist_user_game_uniq").on(table.userId, table.gameId),
]);

export const collection = sqliteTable("Collection", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
  gameId: text("gameId").notNull(),
  status: text("status").notNull(), // "OWNED", "PLAYING", "COMPLETED", "WANT_TO_PLAY"
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
}, (table) => [
  index("collection_user_game_idx").on(table.userId, table.gameId),
  unique("collection_user_game_uniq").on(table.userId, table.gameId),
]);

export const cartItem = sqliteTable("CartItem", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
  gameId: text("gameId").notNull(),
  storeName: text("storeName"),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
}, (table) => [
  index("cart_item_user_game_idx").on(table.userId, table.gameId),
  unique("cart_item_user_game_uniq").on(table.userId, table.gameId),
]);

export const searchClick = sqliteTable("SearchClick", {
  id: text("id").primaryKey(),
  query: text("query").notNull(),
  gameId: text("gameId").notNull(),
  position: integer("position").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export const waitlist = sqliteTable("Waitlist", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  token: text("token").notNull().unique(),
  status: text("status").notNull(), // "PENDING", "APPROVED", "SENT"
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export const referralClick = sqliteTable("ReferralClick", {
  id: text("id").primaryKey(),
  gameId: text("gameId").notNull(),
  storeName: text("storeName").notNull(),
  targetUrl: text("targetUrl").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export const systemConfig = sqliteTable("SystemConfig", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
