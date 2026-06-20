import { connectMongo, closeMongo, figures } from '../db/mongo.js';
import { fetchWikipedia } from '../lib/wikipedia.js';
import type { HistoricalFigure } from '../types.js';

/**
 * Audits every historical figure stored in MongoDB:
 *  - presence of a portrait (imageUrl) and a summary,
 *  - basic structural validity (required fields, year/coordinate sanity),
 *  - that the wikipediaUrl still resolves, and — for any figure missing a
 *    photo/summary — whether the live Wikipedia page actually offers one
 *    (so we can tell a fixable enrichment gap from "no image exists").
 *
 * Read-only: it never writes to the DB. Pass --offline to skip network checks.
 */

const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const inRange = (n: number, lo: number, hi: number) => Number.isFinite(n) && n >= lo && n <= hi;

function structuralIssues(f: HistoricalFigure): string[] {
  const issues: string[] = [];
  if (!nonEmpty(f.id)) issues.push('missing id');
  if (!nonEmpty(f.name)) issues.push('missing name');
  if (!Array.isArray(f.aliases)) issues.push('aliases not an array');
  if (!nonEmpty(f.wikipediaUrl) || !/^https?:\/\//.test(f.wikipediaUrl))
    issues.push('invalid wikipediaUrl');
  if (!Array.isArray(f.occupation) || f.occupation.length === 0) issues.push('empty occupation');
  if (!Array.isArray(f.industry) || f.industry.length === 0) issues.push('empty industry');
  if (!nonEmpty(f.notableContribution)) issues.push('missing notableContribution');
  if (!nonEmpty(f.notableFact)) issues.push('missing notableFact');
  if (!['easy', 'medium', 'hard'].includes(f.difficulty)) issues.push(`bad difficulty "${f.difficulty}"`);
  if (!Number.isFinite(f.birthYear) || !Number.isFinite(f.deathYear)) {
    issues.push('non-numeric birth/death year');
  } else if (f.birthYear > f.deathYear) {
    issues.push(`birthYear ${f.birthYear} > deathYear ${f.deathYear}`);
  }
  if (!inRange(f.birthLatitude, -90, 90) || !inRange(f.deathLatitude, -90, 90))
    issues.push('latitude out of range');
  if (!inRange(f.birthLongitude, -180, 180) || !inRange(f.deathLongitude, -180, 180))
    issues.push('longitude out of range');
  return issues;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function main() {
  const offline = process.argv.includes('--offline');
  await connectMongo();
  const all = await figures().find({}).sort({ id: 1 }).toArray();
  console.log(`\n[verify] auditing ${all.length} figures in the database${offline ? ' (offline: no Wikipedia checks)' : ''}...\n`);

  const noImage: HistoricalFigure[] = [];
  const noSummary: HistoricalFigure[] = [];
  const structural: { f: HistoricalFigure; issues: string[] }[] = [];
  const dupIds = new Map<string, number>();

  for (const f of all) {
    dupIds.set(f.id, (dupIds.get(f.id) ?? 0) + 1);
    if (!nonEmpty(f.imageUrl)) noImage.push(f);
    if (!nonEmpty(f.summary)) noSummary.push(f);
    const issues = structuralIssues(f);
    if (issues.length) structural.push({ f, issues });
  }

  // Network pass: confirm every URL resolves, and learn whether the source
  // actually offers an image / extract (focused detail for the gaps).
  const brokenUrls: { f: HistoricalFigure; status: number }[] = [];
  const fixableImage: HistoricalFigure[] = []; // DB has no image but Wikipedia does
  const trulyNoImage: HistoricalFigure[] = []; // neither DB nor Wikipedia has an image
  const fixableSummary: HistoricalFigure[] = [];

  if (!offline) {
    const wiki = await mapLimit(all, 4, async (f) => ({ f, res: await fetchWikipedia(f.wikipediaUrl) }));
    for (const { f, res } of wiki) {
      if (!res.summary) {
        brokenUrls.push({ f, status: res.status });
        continue;
      }
      const srcImage = res.summary.thumbnail?.source ?? res.summary.originalimage?.source;
      if (!nonEmpty(f.imageUrl)) (nonEmpty(srcImage) ? fixableImage : trulyNoImage).push(f);
      if (!nonEmpty(f.summary) && nonEmpty(res.summary.extract)) fixableSummary.push(f);
    }
  }

  const line = (f: HistoricalFigure) => `   - ${f.name}  (${f.id})`;

  console.log('================ FIGURE AUDIT ================');
  console.log(`Total figures:            ${all.length}`);
  console.log(`With portrait (image):    ${all.length - noImage.length}`);
  console.log(`With summary:             ${all.length - noSummary.length}`);
  console.log(`Structural issues:        ${structural.length}`);
  if (!offline) {
    console.log(`Broken Wikipedia URLs:    ${brokenUrls.length}`);
  }

  const duplicates = [...dupIds.entries()].filter(([, n]) => n > 1);
  if (duplicates.length) {
    console.log(`\n⚠ Duplicate ids (${duplicates.length}):`);
    duplicates.forEach(([id, n]) => console.log(`   - ${id} ×${n}`));
  }

  if (structural.length) {
    console.log(`\n⚠ Structural issues (${structural.length}):`);
    structural.forEach(({ f, issues }) => console.log(`   - ${f.name} (${f.id}): ${issues.join('; ')}`));
  }

  if (!offline && brokenUrls.length) {
    console.log(`\n⚠ Wikipedia URL did not resolve (${brokenUrls.length}) — image/summary cannot be fetched:`);
    brokenUrls.forEach(({ f, status }) => console.log(`   - ${f.name} (${f.id}) [HTTP ${status}]  ${f.wikipediaUrl}`));
  }

  if (noSummary.length) {
    console.log(`\n⚠ Missing summary (${noSummary.length}):`);
    noSummary.forEach((f) => console.log(line(f)));
    if (!offline && fixableSummary.length) {
      console.log(`   → ${fixableSummary.length} of these HAVE an extract on Wikipedia (re-seed will fix).`);
    }
  } else {
    console.log('\n✓ Every figure has a summary.');
  }

  if (noImage.length) {
    console.log(`\nℹ Missing portrait (${noImage.length}) — acceptable when Wikipedia has none:`);
    if (!offline) {
      if (fixableImage.length) {
        console.log(`   ✗ Wikipedia HAS an image for these — re-seed will fix (${fixableImage.length}):`);
        fixableImage.forEach((f) => console.log(line(f)));
      }
      if (trulyNoImage.length) {
        console.log(`   ✓ No image exists on Wikipedia for these — left as-is (${trulyNoImage.length}):`);
        trulyNoImage.forEach((f) => console.log(line(f)));
      }
    } else {
      noImage.forEach((f) => console.log(line(f)));
    }
  } else {
    console.log('\n✓ Every figure has a portrait.');
  }

  console.log('\n=============================================\n');
  await closeMongo();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('[verify] failed:', err);
  await closeMongo();
  process.exit(1);
});
