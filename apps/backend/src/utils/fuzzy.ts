import { normalize } from './normalize.js';

/** Classic Levenshtein edit distance between two strings. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/** Similarity ratio in [0, 1] derived from edit distance. */
export function similarity(a: string, b: string): number {
  const an = normalize(a);
  const bn = normalize(b);
  if (!an && !bn) return 1;
  const maxLen = Math.max(an.length, bn.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(an, bn) / maxLen;
}
