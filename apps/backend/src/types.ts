export type Difficulty = 'easy' | 'medium' | 'hard';

/**
 * The canonical historical figure record (matches the spec's HistoricalFigure
 * interface). Dates are stored both as human-readable display strings and as
 * numeric years so that BC figures (negative years) can be handled cleanly.
 */
export interface HistoricalFigure {
  id: string;
  name: string;
  aliases: string[];

  birthDate: string; // display, e.g. "7 November 1867" or "69 BC"
  deathDate: string;
  birthYear: number; // negative for BC
  deathYear: number;

  birthPlace: string;
  deathPlace: string;

  birthLatitude: number;
  birthLongitude: number;
  deathLatitude: number;
  deathLongitude: number;

  ethnicity?: string;
  nationality?: string;
  gender?: string;

  occupation: string[];
  industry: string[];

  notableContribution: string;
  notableFact: string;

  imageUrl?: string;
  summary?: string;

  wikipediaUrl: string;
  wikidataId: string;

  difficulty: Difficulty;
}

/** A figure as seeded (image/summary are resolved at seed time). */
export type FigureSeed = Omit<HistoricalFigure, 'imageUrl' | 'summary'> & {
  imageUrl?: string;
  summary?: string;
};

export type GameMode = 'random' | 'daily';

export interface Coordinates {
  lat: number;
  lng: number;
}

/** Progressive hints, revealed one per incorrect guess. */
export type Hint =
  | { level: 1; title: 'Lifespan'; data: { born: string; died: string; age: number } }
  | {
      level: 2;
      title: 'Identity';
      data: { ethnicity?: string; nationality?: string; gender?: string };
    }
  | { level: 3; title: 'Occupation'; data: { industry: string[]; occupation: string[] } }
  | { level: 4; title: 'Historical Significance'; data: { contribution: string } }
  | { level: 5; title: 'Unique Characteristic'; data: { fact: string } }
  | { level: 6; title: 'Visual Identification'; data: { imageUrl?: string; initials: string } };

/** Game session persisted in Redis. */
export interface GameSession {
  gameId: string;
  figureId: string;
  mode: GameMode;
  attempts: number; // count of wrong guesses so far
  solved: boolean;
  over: boolean;
  guesses: string[];
  startedAt: number;
  finishedAt?: number;
  score?: number;
  date?: string; // for daily mode (UTC YYYY-MM-DD)
}

export interface SearchResult {
  id: string;
  name: string;
}

export interface LeaderboardEntry {
  mode: GameMode;
  date?: string;
  name: string;
  score: number;
  attempts: number;
  figureId: string;
  figureName: string;
  createdAt: Date;
}
