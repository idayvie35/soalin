import {
  cleanAsterisks,
  getTextDirection,
  hasLatinText,
  isPureArabicBlock,
} from './textFormat.ts';

const ARABIC_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;

export { cleanAsterisks, getTextDirection, hasLatinText, isPureArabicBlock };

export function hasArabicText(text?: string | null): boolean {
  if (!text) return false;
  return ARABIC_REGEX.test(text);
}

export function isPredominantlyArabic(text?: string | null): boolean {
  return isPureArabicBlock(text);
}

export function getDirection(text?: string | null, forceRTL?: boolean): 'rtl' | 'ltr' {
  if (forceRTL && isPureArabicBlock(text)) return 'rtl';
  return getTextDirection(text);
}

export function getArabicOptionLabels(): string[] {
  return ['أ', 'ب', 'ج', 'د', 'هـ'];
}

export function getLatinOptionLabels(): string[] {
  return ['A', 'B', 'C', 'D', 'E'];
}

const ARABIC_DIACRITIC_REGEX = /[\u064B-\u065F\u0670\u06D6-\u06ED]/;

/**
 * Splits an Arabic word into individual Hijaiyah letters while keeping
 * each letter's harakat/shadda/tanwin attached to its base letter.
 */
export function splitArabicWordToHijaiyah(word: string): string[] {
  const clusters: string[] = [];
  const chars = Array.from((word || '').trim());
  for (const ch of chars) {
    if (/\s/.test(ch)) continue;
    if (ARABIC_DIACRITIC_REGEX.test(ch) && clusters.length > 0) {
      clusters[clusters.length - 1] += ch;
    } else if (/[\u0621-\u064A\u0671-\u06D3]/.test(ch)) {
      clusters.push(ch);
    }
  }
  return clusters;
}

export function formatSeparatedHijaiyah(word: string): string {
  return splitArabicWordToHijaiyah(word).join(' - ');
}
