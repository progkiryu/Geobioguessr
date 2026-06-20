import { connectMongo, closeMongo, figures } from '../db/mongo.js';
import { fetchWikipedia, sleep } from '../lib/wikipedia.js';

/**
 * Re-fetches Wikipedia portraits/summaries for figures already in the database
 * that are missing one or both. Useful when an initial seed was partially
 * throttled (HTTP 429). Gentler than a full re-seed: only the gaps are touched,
 * each request is throttled and retried with backoff.
 */

const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

async function main() {
  await connectMongo();
  const all = await figures().find({}).sort({ id: 1 }).toArray();
  const missing = all.filter((f) => !nonEmpty(f.imageUrl) || !nonEmpty(f.summary));

  console.log(`\n[backfill] ${missing.length} of ${all.length} figures missing a photo or summary.\n`);

  let fixedImage = 0;
  let fixedSummary = 0;
  let unreachable = 0;
  let noneAvailable = 0;

  for (const f of missing) {
    const { summary, status } = await fetchWikipedia(f.wikipediaUrl);
    if (!summary) {
      console.log(`  ✗ ${f.name} — could not fetch (HTTP ${status})`);
      unreachable++;
      await sleep(200);
      continue;
    }

    const image = summary.thumbnail?.source ?? summary.originalimage?.source;
    const set: { imageUrl?: string; summary?: string } = {};
    if (!nonEmpty(f.imageUrl) && nonEmpty(image)) {
      set.imageUrl = image;
      fixedImage++;
    }
    if (!nonEmpty(f.summary) && nonEmpty(summary.extract)) {
      set.summary = summary.extract;
      fixedSummary++;
    }

    if (Object.keys(set).length > 0) {
      await figures().updateOne({ id: f.id }, { $set: set });
      console.log(`  ✓ ${f.name}${set.imageUrl ? ' [image]' : ''}${set.summary ? ' [summary]' : ''}`);
    } else {
      console.log(`  – ${f.name} — no portrait/extract available on Wikipedia (left as-is)`);
      noneAvailable++;
    }
    await sleep(200);
  }

  console.log(
    `\n[backfill] done. +${fixedImage} portraits, +${fixedSummary} summaries, ` +
      `${noneAvailable} genuinely have none, ${unreachable} still unreachable.\n`,
  );
  await closeMongo();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('[backfill] failed:', err);
  await closeMongo();
  process.exit(1);
});
