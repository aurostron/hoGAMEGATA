import { games } from '../db/schema';
import { eq } from 'drizzle-orm';

export function getCatboxFilename(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("catbox.moe")) {
      const parts = u.pathname.split("/");
      return parts[parts.length - 1] || null;
    }
  } catch (e) {}
  return null;
}

export async function syncCatboxAlbum(
  tx: any,
  gameId: string,
  gameTitle: string,
  developerName: string | null,
  screenshotUrls: string[],
  existingAlbumId: string | null,
  userhash: string | null
) {
  if (!userhash) {
    console.log("No CATBOX_USERHASH configured, skipping album sync.");
    return existingAlbumId;
  }

  // Extract filenames for Catbox files
  const filenames = screenshotUrls
    .map(getCatboxFilename)
    .filter((name): name is string => name !== null);

  if (filenames.length === 0) {
    return existingAlbumId;
  }

  const albumTitle = developerName ? `${developerName} - ${gameTitle}` : gameTitle;
  const albumDesc = `Screenshots of ${gameTitle} on hoGAMEGATA`;

  try {
    if (existingAlbumId) {
      // Edit existing album
      console.log(`Syncing Catbox album ${existingAlbumId} with files:`, filenames);
      const formData = new FormData();
      formData.append("reqtype", "editalbum");
      formData.append("userhash", userhash);
      formData.append("short", existingAlbumId);
      formData.append("files", filenames.join(","));

      const response = await fetch("https://catbox.moe/user/api.php", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Catbox editalbum failed with status ${response.status}`);
      }
      return existingAlbumId;
    } else {
      // Create new album
      console.log(`Creating Catbox album "${albumTitle}" with files:`, filenames);
      const formData = new FormData();
      formData.append("reqtype", "createalbum");
      formData.append("userhash", userhash);
      formData.append("title", albumTitle);
      formData.append("desc", albumDesc);
      formData.append("files", filenames.join(","));

      const response = await fetch("https://catbox.moe/user/api.php", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Catbox createalbum failed with status ${response.status}`);
      }

      const albumShortCode = await response.text();
      const trimmedCode = albumShortCode.trim();
      console.log(`Created Catbox album: ${trimmedCode}`);

      // Save to database
      await tx
        .update(games)
        .set({ catboxAlbumId: trimmedCode })
        .where(eq(games.id, gameId));

      return trimmedCode;
    }
  } catch (err) {
    console.error("❌ Failed to sync Catbox album:", err);
    return existingAlbumId;
  }
}
