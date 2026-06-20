export type GameMode = 'random' | 'daily'
export type Difficulty = 'easy' | 'medium' | 'hard'

export interface Coordinates {
  lat: number
  lng: number
}

export interface HistoricalFigure {
  id: string
  name: string
  aliases: string[]
  birthDate: string
  deathDate: string
  birthYear: number
  deathYear: number
  birthPlace: string
  deathPlace: string
  birthLatitude: number
  birthLongitude: number
  deathLatitude: number
  deathLongitude: number
  ethnicity?: string
  nationality?: string
  gender?: string
  occupation: string[]
  industry: string[]
  notableContribution: string
  notableFact: string
  imageUrl?: string
  summary?: string
  wikipediaUrl: string
  wikidataId: string
  difficulty: Difficulty
}

export type Hint =
  | { level: 1; title: 'Lifespan'; data: { born: string; died: string; age: number } }
  | {
      level: 2
      title: 'Identity'
      data: { ethnicity?: string; nationality?: string; gender?: string }
    }
  | { level: 3; title: 'Occupation'; data: { industry: string[]; occupation: string[] } }
  | { level: 4; title: 'Historical Significance'; data: { contribution: string } }
  | { level: 5; title: 'Unique Characteristic'; data: { fact: string } }
  | { level: 6; title: 'Visual Identification'; data: { imageUrl?: string; initials: string } }

export interface GameState {
  gameId: string
  mode: GameMode
  date?: string
  attempt: number
  wrongGuesses: number
  maxAttempts: number
  remainingAttempts: number
  solved: boolean
  over: boolean
  birthCoordinates: Coordinates
  deathCoordinates: Coordinates
  revealedHints: Hint[]
  /** Prior guesses (with correctness), so an in-progress game can be resumed. */
  guesses?: { text: string; correct: boolean }[]
  score?: number
  answer?: HistoricalFigure
}

export interface GuessResult {
  correct: boolean
  attempt: number
  wrongGuesses: number
  remainingAttempts: number
  over: boolean
  solved: boolean
  newHint?: Hint
  score?: number
  answer?: HistoricalFigure
  duplicate?: boolean
}

export interface SearchResult {
  id: string
  name: string
}

export interface ScoreBucket {
  score: number
  count: number
}

export interface DailyStats {
  date: string
  total: number
  solved: number
  distribution: ScoreBucket[]
}
