import { turso } from './turso';
import { userReputation } from '../db/schema';
import { eq } from 'drizzle-orm';

export const LOW_RISK_FIELDS = new Set([
  'trailerUrl',
  'websiteUrl',
  'redditUrl',
  'esrbRating',
  'pegiRating',
]);

export interface ReputationInfo {
  userId: string;
  totalSubmitted: number;
  totalApproved: number;
  totalRejected: number;
  accuracyScore: number;
  tier: 'tier_0_new' | 'tier_1_trusted' | 'tier_2_moderator';
  badges: string[];
}

export async function getUserReputation(userId: string | null | undefined): Promise<ReputationInfo | null> {
  if (!userId) return null;

  try {
    const [row] = await turso
      .select()
      .from(userReputation)
      .where(eq(userReputation.userId, userId))
      .limit(1);

    if (!row) {
      return {
        userId,
        totalSubmitted: 0,
        totalApproved: 0,
        totalRejected: 0,
        accuracyScore: 1.0,
        tier: 'tier_0_new',
        badges: [],
      };
    }

    let badges: string[] = [];
    try {
      badges = JSON.parse(row.badgesJson);
    } catch (e) {
      badges = [];
    }

    return {
      userId: row.userId,
      totalSubmitted: row.totalSubmitted,
      totalApproved: row.totalApproved,
      totalRejected: row.totalRejected,
      accuracyScore: row.accuracyScore,
      tier: (row.tier as any) || 'tier_0_new',
      badges,
    };
  } catch (err) {
    console.warn('⚠️ Error fetching user reputation:', err);
    return null;
  }
}

export async function recordEditApproval(userId: string | null | undefined) {
  if (!userId) return;

  try {
    const current = await getUserReputation(userId);
    const newApproved = (current?.totalApproved || 0) + 1;
    const newTotal = (current?.totalSubmitted || 0) + 1;
    const newRejected = current?.totalRejected || 0;
    const newAccuracy = Number((newApproved / Math.max(1, newApproved + newRejected)).toFixed(2));

    let newTier = current?.tier || 'tier_0_new';
    const badges = new Set(current?.badges || []);

    if (newApproved >= 10 && newAccuracy >= 0.85 && newTier === 'tier_0_new') {
      newTier = 'tier_1_trusted';
      badges.add('Trusted Editor');
    }

    if (newApproved >= 25) {
      badges.add('Metadata Curation Expert');
    }

    await turso
      .insert(userReputation)
      .values({
        userId,
        totalSubmitted: newTotal,
        totalApproved: newApproved,
        totalRejected: newRejected,
        accuracyScore: newAccuracy,
        tier: newTier,
        badgesJson: JSON.stringify(Array.from(badges)),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userReputation.userId,
        set: {
          totalSubmitted: newTotal,
          totalApproved: newApproved,
          accuracyScore: newAccuracy,
          tier: newTier,
          badgesJson: JSON.stringify(Array.from(badges)),
          updatedAt: new Date(),
        },
      });
  } catch (err) {
    console.warn('⚠️ Error recording edit approval reputation:', err);
  }
}

export async function recordEditRejection(userId: string | null | undefined) {
  if (!userId) return;

  try {
    const current = await getUserReputation(userId);
    const newRejected = (current?.totalRejected || 0) + 1;
    const totalApproved = current?.totalApproved || 0;
    const newTotal = (current?.totalSubmitted || 0) + 1;
    const newAccuracy = Number((totalApproved / Math.max(1, totalApproved + newRejected)).toFixed(2));

    await turso
      .insert(userReputation)
      .values({
        userId,
        totalSubmitted: newTotal,
        totalApproved: totalApproved,
        totalRejected: newRejected,
        accuracyScore: newAccuracy,
        tier: current?.tier || 'tier_0_new',
        badgesJson: JSON.stringify(current?.badges || []),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userReputation.userId,
        set: {
          totalSubmitted: newTotal,
          totalRejected: newRejected,
          accuracyScore: newAccuracy,
          updatedAt: new Date(),
        },
      });
  } catch (err) {
    console.warn('⚠️ Error recording edit rejection reputation:', err);
  }
}
