import type { FigureSeed } from '../types.js';

/**
 * Wikipedia REST "summary" enrichment, shared by the seed, backfill and audit
 * scripts. Resilient to the API's rate limiting: 429/5xx and network errors are
 * retried with exponential backoff that honours any `Retry-After` header.
 */

const WIKI_API = 'https://en.wikipedia.org/api/rest_v1/page/summary/';
const USER_AGENT = 'Geobiograph.io/1.0 (educational guessing game; local dev seed)';

export interface WikiSummary {
  extract?: string;
  thumbnail?: { source?: string };
  originalimage?: { source?: string };
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function titleFromWikipediaUrl(url: string): string {
  const segment = url.split('/wiki/')[1] ?? url.split('/').pop() ?? '';
  return decodeURIComponent(segment);
}

export interface FetchResult {
  /** Parsed summary, or null if the page could not be fetched after retries. */
  summary: WikiSummary | null;
  /** Last HTTP status seen (0 for a network/abort error). */
  status: number;
}

/**
 * Fetch a page summary, retrying on rate limits (429), server errors (5xx) and
 * network failures. Returns the parsed summary plus the last status code.
 */
export async function fetchWikipedia(url: string, retries = 5): Promise<FetchResult> {
  const title = encodeURIComponent(titleFromWikipediaUrl(url));
  let lastStatus = 0;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(`${WIKI_API}${title}`, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: controller.signal,
      });
      lastStatus = res.status;

      if (res.status === 429 || res.status >= 500) {
        if (attempt === retries) return { summary: null, status: res.status };
        const retryAfter = Number(res.headers.get('retry-after'));
        const backoff = Math.min(1000 * 2 ** attempt, 15000);
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoff;
        await sleep(waitMs);
        continue;
      }

      if (!res.ok) return { summary: null, status: res.status }; // e.g. 404 — don't retry
      return { summary: (await res.json()) as WikiSummary, status: res.status };
    } catch {
      lastStatus = 0;
      if (attempt === retries) return { summary: null, status: 0 };
      await sleep(Math.min(1000 * 2 ** attempt, 15000));
    } finally {
      clearTimeout(timeout);
    }
  }

  return { summary: null, status: lastStatus };
}

const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

/** Resolve a figure's imageUrl/summary from Wikipedia, keeping existing values on failure. */
export async function enrich(figure: FigureSeed): Promise<FigureSeed> {
  const { summary } = await fetchWikipedia(figure.wikipediaUrl);
  if (!summary) return figure;
  const image = summary.thumbnail?.source ?? summary.originalimage?.source;
  return {
    ...figure,
    imageUrl: nonEmpty(image) ? image : figure.imageUrl,
    summary: nonEmpty(summary.extract) ? summary.extract : figure.summary,
  };
}
