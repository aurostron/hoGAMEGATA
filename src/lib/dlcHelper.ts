/**
 * Identifies whether a title or category represents a DLC, bundle, pack, or extra content.
 * Used across client search workers and server API endpoints to filter out non-base games.
 */
export function isDlcOrExtra(title?: string | null, category?: number | null): boolean {
  if (category != null && [1, 2, 3, 10, 13].includes(category)) return true;
  if (!title) return false;
  const t = title.toLowerCase().trim();

  // 1. Explicit multi-word phrases or distinct DLC terms anywhere
  if (/\b(dlc|soundtrack|artbook|season pass|expansion pass|expansion pack|starter pack|booster pack|skin pack|costume pack|weapon pack|character pack|item pack|texture pack|resource pack|music pack|sound track|bonus content|deluxe upgrade|content pack|supporter pack|anniversary pack|collection upgrade|soundtrack edition|wallpaper pack|outfit pack|founder'?s? pack)\b/i.test(t)) {
    return true;
  }

  // 2. Trailing pack/bundle/upgrade/addon/ost preceded by space or punctuation
  if (/[\s:\-\(\[\/](pack|bundle|upgrade|bonus content|add-on|addon|ost)\s*(\)|\])?$/i.test(t)) {
    return true;
  }

  // 3. Subtitle with pack/expansion/addon/dlc/bundle/upgrade after colon, dash, or bracket
  if (/[:\-\(\[\/]\s*(pack|expansion|add-on|addon|dlc|bundle|upgrade)\b/i.test(t)) {
    return true;
  }

  // 4. Subtitle ending with 'expansion' (e.g. 'Resident Evil Village: Winters\' Expansion')
  if (/[:\-\(\[\/][^:\-\(\[\/]*\bexpansion\s*(\)|\])?$/i.test(t)) {
    return true;
  }

  // 5. Outlast specific DLCs/seasonal episodic releases
  if (/^the outlast trials:\s*project\b/i.test(t) || /^outlast:\s*whistleblower\b/i.test(t)) {
    return true;
  }

  return false;
}
