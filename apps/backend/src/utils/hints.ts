import type { HistoricalFigure, Hint } from '../types.js';

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

interface ParsedDate {
  month?: number;
  day?: number;
}

/** Extract month/day (if present) from a human-readable display date string. */
function parseMonthDay(display: string): ParsedDate {
  const lower = display.toLowerCase();
  const result: ParsedDate = {};
  for (const [name, idx] of Object.entries(MONTHS)) {
    if (lower.includes(name)) {
      result.month = idx;
      break;
    }
  }
  // A leading day number, e.g. "7 November 1867" -> day 7.
  const dayMatch = lower.match(/^(?:c\.\s*)?(\d{1,2})\s+[a-z]/);
  if (dayMatch) result.day = Number(dayMatch[1]);
  return result;
}

/** Compute age at death, refining the year difference with month/day when known. */
export function computeAge(figure: HistoricalFigure): number {
  const base = figure.deathYear - figure.birthYear;
  const birth = parseMonthDay(figure.birthDate);
  const death = parseMonthDay(figure.deathDate);
  if (birth.month && death.month) {
    const hadBirthday =
      death.month > birth.month ||
      (death.month === birth.month && (death.day ?? 31) >= (birth.day ?? 1));
    return hadBirthday ? base : base - 1;
  }
  return base;
}

/** First letters of each significant word in the name, e.g. "M.C." */
export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter((w) => /^[A-Za-z]/.test(w) && w.toLowerCase() !== 'of' && w.toLowerCase() !== 'the' && w.toLowerCase() !== 'van' && w.toLowerCase() !== 'da' && w.toLowerCase() !== 'di')
      .map((w) => w[0].toUpperCase())
      .join('.') + '.'
  );
}

/** Build the hint revealed for a given level (1-6). */
export function buildHint(figure: HistoricalFigure, level: number): Hint {
  switch (level) {
    case 1:
      return {
        level: 1,
        title: 'Lifespan',
        data: {
          born: figure.birthDate,
          died: figure.deathDate,
          age: computeAge(figure),
        },
      };
    case 2:
      return {
        level: 2,
        title: 'Identity',
        data: {
          ethnicity: figure.ethnicity,
          nationality: figure.nationality,
          gender: figure.gender,
        },
      };
    case 3:
      return {
        level: 3,
        title: 'Occupation',
        data: {
          industry: figure.industry,
          occupation: figure.occupation,
        },
      };
    case 4:
      return {
        level: 4,
        title: 'Historical Significance',
        data: { contribution: figure.notableContribution },
      };
    case 5:
      return {
        level: 5,
        title: 'Unique Characteristic',
        data: { fact: figure.notableFact },
      };
    case 6:
      return {
        level: 6,
        title: 'Visual Identification',
        data: { imageUrl: figure.imageUrl, initials: initials(figure.name) },
      };
    default:
      throw new Error(`Invalid hint level: ${level}`);
  }
}

/** Build all hints up to and including `count` (used when revealing game-over state). */
export function buildHintsUpTo(figure: HistoricalFigure, count: number): Hint[] {
  const hints: Hint[] = [];
  for (let level = 1; level <= Math.min(count, 6); level++) {
    hints.push(buildHint(figure, level));
  }
  return hints;
}
