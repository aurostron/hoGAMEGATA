-- Analytics tables migration
-- analyticsEvents: upsert-per-day event tracking (game views, link clicks, searches)
CREATE TABLE IF NOT EXISTS "AnalyticsEvent" (
  "id" TEXT PRIMARY KEY,
  "type" TEXT NOT NULL,
  "refId" TEXT NOT NULL,
  "refTitle" TEXT,
  "date" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS "analytics_unique_event_idx" ON "AnalyticsEvent" ("type", "refId", "date");
CREATE INDEX IF NOT EXISTS "analytics_type_refid_date_idx" ON "AnalyticsEvent" ("type", "refId", "date");
CREATE INDEX IF NOT EXISTS "analytics_date_idx" ON "AnalyticsEvent" ("date");
CREATE INDEX IF NOT EXISTS "analytics_type_date_idx" ON "AnalyticsEvent" ("type", "date");

-- analyticsDaily: permanent daily aggregate totals
CREATE TABLE IF NOT EXISTS "AnalyticsDaily" (
  "date" TEXT PRIMARY KEY,
  "totalViews" INTEGER NOT NULL DEFAULT 0,
  "totalClicks" INTEGER NOT NULL DEFAULT 0,
  "totalSearches" INTEGER NOT NULL DEFAULT 0
);
