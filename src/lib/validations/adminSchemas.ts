import { z } from 'astro/zod';

/**
 * Strict validation schema for updating game metadata.
 * Strips/rejects unexpected injection fields to prevent mass-assignment attacks.
 */
export const adminGamePatchSchema = z.object({
  title: z.string().min(1, "Title is required").max(300),
  status: z.string().max(50).nullable().optional(),
  releaseDate: z.string().nullable().optional(),
  coverUrl: z.string().max(1000).nullable().optional(),
  trailerUrl: z.string().max(1000).nullable().optional(),
  summary: z.string().max(10000).nullable().optional(),
  storyline: z.string().max(20000).nullable().optional(),
  scareRating: z.union([z.number().min(0).max(10), z.string()]).nullable().optional(),
  scareProfile: z.record(z.any()).nullable().optional(),
  developerId: z.string().nullable().optional(),
  platformIds: z.array(z.string()).optional(),
  screenshots: z.array(z.string().max(1000)).optional(),
  isTrending: z.boolean().optional(),
}).strict();

export type AdminGamePatchInput = z.infer<typeof adminGamePatchSchema>;

/**
 * Strict validation schema for developer entity updates.
 */
export const adminDeveloperPatchSchema = z.object({
  name: z.string().min(1, "Developer name is required").max(200),
  description: z.string().max(5000).nullable().optional(),
  websiteUrl: z.string().max(1000).nullable().optional(),
  logoUrl: z.string().max(1000).nullable().optional(),
}).strict();

export type AdminDeveloperPatchInput = z.infer<typeof adminDeveloperPatchSchema>;

/**
 * Strict validation schema for announcements.
 */
export const adminAnnouncementSchema = z.object({
  title: z.string().min(1).max(300),
  message: z.string().min(1).max(5000),
  type: z.enum(["info", "warning", "alert", "update", "maintenance"]).optional().default("info"),
  isActive: z.boolean().optional().default(true),
  linkUrl: z.string().max(1000).nullable().optional(),
}).strict();

/**
 * Strict validation schema for community edit suggestions.
 */
export const editSuggestSchema = z.object({
  gameId: z.string().min(1),
  fieldName: z.string().min(1).max(100),
  fieldLabel: z.string().max(100).optional(),
  oldValue: z.string().nullable().optional(),
  newValue: z.string().min(1).max(10000),
  note: z.string().max(2000).nullable().optional(),
  userId: z.string().nullable().optional(),
}).strict();
