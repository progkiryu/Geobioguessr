import Fuse from 'fuse.js';
import { figures } from '../db/mongo.js';
import type { HistoricalFigure } from '../types.js';
import { normalize } from '../utils/normalize.js';
import { similarity } from '../utils/fuzzy.js';

let cache: HistoricalFigure[] = [];
let fuse: Fuse<HistoricalFigure> | null = null;

/** Load all figures from MongoDB into memory and (re)build the search index. */
export async function loadFigures(): Promise<number> {
  cache = await figures().find({}, { projection: { _id: 0 } }).toArray();
  fuse = new Fuse(cache, {
    keys: [
      { name: 'name', weight: 0.7 },
      { name: 'aliases', weight: 0.3 },
    ],
    includeScore: true,
    threshold: 0.45, // fairly lenient to support typos/fuzzy matching
    ignoreLocation: true,
    minMatchCharLength: 1,
  });
  return cache.length;
}

export function getAllFigures(): HistoricalFigure[] {
  return cache;
}

export function getFigureById(id: string): HistoricalFigure | undefined {
  return cache.find((f) => f.id === id);
}

/** A random figure, optionally excluding one id (e.g. today's daily challenge). */
export function getRandomFigure(excludeId?: string): HistoricalFigure {
  if (cache.length === 0) throw new Error('No figures loaded.');
  const pool = excludeId ? cache.filter((f) => f.id !== excludeId) : cache;
  // Fall back to the full set if exclusion would leave nothing to pick from.
  const list = pool.length > 0 ? pool : cache;
  const index = Math.floor(Math.random() * list.length);
  return list[index];
}

/** Fuzzy search over names + aliases. Returns up to `limit` matches. */
export function searchFigures(query: string, limit = 8): HistoricalFigure[] {
  const q = query.trim();
  if (!q || !fuse) return [];
  return fuse.search(q, { limit }).map((r) => r.item);
}

/**
 * Decide whether a free-text guess identifies the given figure.
 * Accepts exact/normalized matches against the name or any alias, plus
 * close fuzzy matches (to tolerate typos like "Issac Newten").
 */
export function guessMatchesFigure(guess: string, figure: HistoricalFigure): boolean {
  const g = normalize(guess);
  if (!g) return false;

  const candidates = [figure.name, ...figure.aliases];
  for (const candidate of candidates) {
    const c = normalize(candidate);
    if (!c) continue;
    if (g === c) return true;
    // Partial: the guess contains the full candidate or vice-versa (>= 4 chars).
    if (c.length >= 4 && (g.includes(c) || c.includes(g)) && Math.abs(g.length - c.length) <= 4) {
      return true;
    }
    // Fuzzy: tolerate small typos.
    if (similarity(g, c) >= 0.82) return true;
  }

  // Guard against false positives: a typo'd guess should still resolve to THIS
  // figure as its best overall match, not merely be near one alias.
  const best = searchFigures(guess, 1)[0];
  if (best && best.id === figure.id && similarity(guess, figure.name) >= 0.7) {
    return true;
  }
  return false;
}
