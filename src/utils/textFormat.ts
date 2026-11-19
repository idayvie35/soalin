const ARABIC_CHAR_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
const LATIN_LETTER_REGEX = /[A-Za-z\u00C0-\u024F]/;

/**
 * Strips Markdown formatting artifacts like *, **, ***, and leading # headings
 * while preserving legitimate numeric multiplication (e.g. 3 * 4).
 */
export function cleanAsterisks(input?: string | null): string {
  if (!input) return '';
  let text = String(input);
  // Protect multiplication between digits (e.g. 3 * 4 or 2*5)
  text = text.replace(/(\d\s*)\*(\s*\d)/g, '$1__MATH_MUL__$2');
  // Replace bullet list lines starting with * into clean bullet dot
  text = text.replace(/^\s*\*\s+/gm, '• ');
  // Remove all remaining markdown * characters (**, *, ***)
  text = text.replace(/\*/g, '');
  // Remove leading markdown header hashes (#, ##, ###)
  text = text.replace(/^\s*#{1,6}\s+/gm, '');
  // Remove inline backticks
  text = text.replace(/`/g, '');
  // Restore protected math multiplication
  text = text.replace(/__MATH_MUL__/g, '×');
  return text.replace(/[ \t]+\n/g, '\n').trim();
}

export function hasArabicText(text?: string | null): boolean {
  if (!text) return false;
  return ARABIC_CHAR_REGEX.test(text);
}

export function hasLatinText(text?: string | null): boolean {
  if (!text) return false;
  return LATIN_LETTER_REGEX.test(text);
}

/**
 * Returns true ONLY when the text contains Arabic script and NO Latin letters.
 * Pure Arabic blocks are separated from Indonesian text and must read from RIGHT (RTL).
 * Mixed blocks (containing both Arabic and Indonesian/Latin letters) follow Indonesian from LEFT (LTR).
 */
export function isPureArabicBlock(text?: string | null): boolean {
  if (!text) return false;
  return ARABIC_CHAR_REGEX.test(text) && !LATIN_LETTER_REGEX.test(text);
}

export function getTextDirection(text?: string | null): 'rtl' | 'ltr' {
  return isPureArabicBlock(text) ? 'rtl' : 'ltr';
}
