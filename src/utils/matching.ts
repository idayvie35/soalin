import { MatchingPair } from '../types';

export interface SynchronizedMatchingRightOption {
  letter: string;
  text: string;
  originalIndex: number;
}

export interface SynchronizedMatchingRow {
  number: number;
  left: string;
  correctLetter: string;
  correctRight: string;
}

export interface SynchronizedMatchingData {
  rows: SynchronizedMatchingRow[];
  rightOptions: SynchronizedMatchingRightOption[];
  answerKey: string;
}

/**
 * Deterministic derangement order for N items so no item stays at its original index (when N >= 2).
 * For N=4: [1, 3, 0, 2] -> A=orig[1], B=orig[3], C=orig[0], D=orig[2].
 */
export function getDeterministicDerangement(count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [0];
  if (count === 4) return [1, 3, 0, 2];
  const order: number[] = [];
  for (let i = 0; i < count; i++) {
    order.push((i + 1) % count);
  }
  return order;
}

export function getSynchronizedMatching(pairs?: MatchingPair[]): SynchronizedMatchingData {
  if (!pairs || pairs.length === 0) {
    return { rows: [], rightOptions: [], answerKey: '' };
  }

  const order = getDeterministicDerangement(pairs.length);
  const rightOptions: SynchronizedMatchingRightOption[] = order.map((origIdx, dispIdx) => ({
    letter: String.fromCharCode(65 + dispIdx),
    text: pairs[origIdx]?.right || '',
    originalIndex: origIdx,
  }));

  const rows: SynchronizedMatchingRow[] = pairs.map((pair, idx) => {
    const matchedOpt = rightOptions.find((opt) => opt.originalIndex === idx);
    return {
      number: idx + 1,
      left: pair.left || '',
      correctLetter: matchedOpt?.letter || String.fromCharCode(65 + idx),
      correctRight: pair.right || '',
    };
  });

  const answerKey = rows
    .map((r) => `${r.number} → ${r.correctLetter} (${r.correctRight})`)
    .join('; ');

  return { rows, rightOptions, answerKey };
}
