/**
 * Cleans and sanitizes raw HTML or scraped description text.
 * Strips raw widgets (iframes, buttons, scripts, styles) and cleans attributes
 * so that raw HTML code tags never appear as literal text on screen.
 */
export function cleanHtml(raw: string | null | undefined): string {
  if (!raw) return '';

  let text = raw.trim();
  if (!text) return '';

  // Unescape HTML entities if double/single escaped
  text = text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');

  // Strip embed widgets, buttons, scripts, styles, forms, and SVGs completely
  text = text
    .replace(/<(iframe|button|script|style|svg|form|input)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(iframe|button|script|style|svg|form|input)[^>]*\/?>/gi, '');

  // Strip inline event attributes (onclick, onload, etc.) and dangerous attributes
  text = text.replace(/\s*on[a-z]+\s*=\s*(("[^"]*")|('[^']*')|([^\s>]+))/gi, '');

  // Clean inline style, class, id, width, height, frameborder from elements to preserve dark theme
  text = text.replace(/\s*(style|class|id|width|height|frameborder|loading|aria-label|itchio)\s*=\s*(("[^"]*")|('[^']*')|([^\s>]+))/gi, '');

  // Remove empty paragraphs, empty divs, or trailing br tags inside p
  text = text
    .replace(/<p>\s*(<br\s*\/?>)?\s*<\/p>/gi, '')
    .replace(/<div>\s*<\/div>/gi, '')
    .replace(/(<br\s*\/?>\s*){3,}/gi, '<br/><br/>');

  return text.trim();
}
