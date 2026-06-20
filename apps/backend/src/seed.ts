import { connectMongo, closeMongo, figures } from './db/mongo.js';
import { FIGURES } from './data/figures.js';
import { enrich, sleep } from './lib/wikipedia.js';

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
    // Throttle between requests to stay under Wikipedia's rate limit.
    if (!skipWiki) await sleep(150);
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
