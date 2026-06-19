import { v4 as uuid } from 'uuid';
import { env, GAME } from '../config/env.js';
import { getRedis } from '../db/redis.js';
import { analytics } from '../db/mongo.js';
import type { GameMode, GameSession, HistoricalFigure, Hint } from '../types.js';
import { getFigureById, getRandomFigure, guessMatchesFigure } from './figureService.js';
import { buildHint, buildHintsUpTo } from '../utils/hints.js';
import { computeScore } from '../utils/score.js';
import { normalize } from '../utils/normalize.js';

const sessionKey = (gameId: string) => `game:${gameId}`;

/** Public game state sent to the client (no answer leaked while in progress). */
export interface PublicGameState {
  gameId: string;
  mode: GameMode;
  date?: string;
  attempt: number; // number of guesses made
  wrongGuesses: number;
  maxAttempts: number;
  remainingAttempts: number;
  solved: boolean;
  over: boolean;
  birthCoordinates: { lat: number; lng: number };
  deathCoordinates: { lat: number; lng: number };
  revealedHints: Hint[];
  score?: number;
  answer?: HistoricalFigure;
}

export interface GuessResult {
  correct: boolean;
  attempt: number;
  wrongGuesses: number;
  remainingAttempts: number;
  over: boolean;
  solved: boolean;
  newHint?: Hint;
  score?: number;
  answer?: HistoricalFigure;
  duplicate?: boolean; // guess already tried; ignored (no attempt/hint consumed)
}

async function saveSession(session: GameSession): Promise<void> {
  await getRedis().set(sessionKey(session.gameId), JSON.stringify(session), 'EX', env.gameSessionTtl);
}

async function loadSession(gameId: string): Promise<GameSession | null> {
  const raw = await getRedis().get(sessionKey(gameId));
  return raw ? (JSON.parse(raw) as GameSession) : null;
}

function coords(figure: HistoricalFigure, kind: 'birth' | 'death') {
  return kind === 'birth'
    ? { lat: figure.birthLatitude, lng: figure.birthLongitude }
    : { lat: figure.deathLatitude, lng: figure.deathLongitude };
}

function toPublicState(session: GameSession, figure: HistoricalFigure): PublicGameState {
  const state: PublicGameState = {
    gameId: session.gameId,
    mode: session.mode,
    date: session.date,
    attempt: session.guesses.length,
    wrongGuesses: session.attempts,
    maxAttempts: GAME.maxAttempts,
    remainingAttempts: Math.max(0, GAME.maxAttempts - session.attempts),
    solved: session.solved,
    over: session.over,
    birthCoordinates: coords(figure, 'birth'),
    deathCoordinates: coords(figure, 'death'),
    revealedHints: buildHintsUpTo(figure, session.attempts),
    score: session.score,
  };
  if (session.over) state.answer = figure;
  return state;
}

/** Start a new game for the given figure and mode; returns the public state. */
export async function startGame(
  figure: HistoricalFigure,
  mode: GameMode,
  date?: string,
): Promise<PublicGameState> {
  const session: GameSession = {
    gameId: uuid(),
    figureId: figure.id,
    mode,
    attempts: 0,
    solved: false,
    over: false,
    guesses: [],
    startedAt: Date.now(),
    date,
  };
  await saveSession(session);
  return toPublicState(session, figure);
}

export async function startRandomGame(): Promise<PublicGameState> {
  return startGame(getRandomFigure(), 'random');
}

/** Fetch the current public state of an in-progress or finished game. */
export async function getGameState(gameId: string): Promise<PublicGameState | null> {
  const session = await loadSession(gameId);
  if (!session) return null;
  const figure = getFigureById(session.figureId);
  if (!figure) return null;
  return toPublicState(session, figure);
}

function recordAnalytics(session: GameSession): void {
  analytics()
    .insertOne({
      type: 'game_finished',
      mode: session.mode,
      figureId: session.figureId,
      attempts: session.attempts,
      solved: session.solved,
      score: session.score,
      createdAt: new Date(),
    })
    .catch(() => {
      /* analytics is best-effort */
    });
}

/** Submit a guess against an in-progress game. */
export async function submitGuess(gameId: string, guess: string): Promise<GuessResult | null> {
  const session = await loadSession(gameId);
  if (!session) return null;
  const figure = getFigureById(session.figureId);
  if (!figure) return null;

  const base = (): GuessResult => ({
    correct: session.solved,
    attempt: session.guesses.length,
    wrongGuesses: session.attempts,
    remainingAttempts: Math.max(0, GAME.maxAttempts - session.attempts),
    over: session.over,
    solved: session.solved,
    score: session.score,
  });

  // Game already finished: return terminal state with the answer.
  if (session.over) {
    return { ...base(), answer: figure };
  }

  // Reject repeats: the same name already guessed must not burn an attempt or hint.
  const normalizedGuess = normalize(guess);
  if (session.guesses.some((g) => normalize(g) === normalizedGuess)) {
    return { ...base(), duplicate: true };
  }

  session.guesses.push(guess);
  const correct = guessMatchesFigure(guess, figure);

  if (correct) {
    session.solved = true;
    session.over = true;
    session.finishedAt = Date.now();
    session.score = computeScore(session.attempts, true);
    await saveSession(session);
    recordAnalytics(session);
    return { ...base(), correct: true, answer: figure };
  }

  // Wrong guess: increment, reveal next hint (only up to the last hint level).
  session.attempts += 1;
  const newHint =
    session.attempts <= GAME.totalHints ? buildHint(figure, session.attempts) : undefined;

  if (session.attempts >= GAME.maxAttempts) {
    session.over = true;
    session.finishedAt = Date.now();
    session.score = computeScore(session.attempts, false); // 0
    await saveSession(session);
    recordAnalytics(session);
    return { ...base(), correct: false, newHint, answer: figure };
  }

  await saveSession(session);
  return { ...base(), correct: false, newHint };
}
