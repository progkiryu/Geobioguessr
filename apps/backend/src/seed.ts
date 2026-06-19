import { connectMongo, closeMongo, figures } from './db/mongo.js';
import { FIGURES } from './data/figures.js';
import type { FigureSeed } from './types.js';

const WIKI_API = 'https://en.wikipedia.org/api/rest_v1/page/summary/';
const USER_AGENT = 'Geobiograph.io/1.0 (educational guessing game; local dev seed)';

interface WikiSummary {
  extract?: string;
  thumbnail?: { source?: string };
  originalimage?: { source?: string };
}

function titleFromWikipediaUrl(url: string): string {
  const segment = url.split('/wiki/')[1] ?? url.split('/').pop() ?? '';
  return decodeURIComponent(segment);
}

async function fetchWikipedia(url: string): Promise<WikiSummary | null> {
  const title = encodeURIComponent(titleFromWikipediaUrl(url));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${WIKI_API}${title}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as WikiSummary;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function enrich(figure: FigureSeed): Promise<FigureSeed> {
  const summary = await fetchWikipedia(figure.wikipediaUrl);
  if (!summary) return figure;
  return {
    ...figure,
    imageUrl: summary.thumbnail?.source ?? summary.originalimage?.source ?? figure.imageUrl,
    summary: summary.extract ?? figure.summary,
  };
}

async function main() {
  const skipWiki = process.argv.includes('--no-wiki');
  console.log(`[seed] connecting to MongoDB...`);
  await connectMongo();

  console.log(`[seed] seeding ${FIGURES.length} figures${skipWiki ? ' (skipping Wikipedia enrichment)' : ''}...`);

  let enrichedCount = 0;
  for (const base of FIGURES) {
    const figure = skipWiki ? base : await enrich(base);
    if (figure.imageUrl) enrichedCount++;
    await figures().updateOne(
      { id: figure.id },
      { $set: figure },
      { upsert: true },
    );
    console.log(`  ✓ ${figure.name}${figure.imageUrl ? '  [image]' : ''}`);
  }

  const total = await figures().countDocuments();
  console.log(`[seed] done. ${total} figures in DB, ${enrichedCount} with portraits.`);
  await closeMongo();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('[seed] failed:', err);
  await closeMongo();
  process.exit(1);
});
