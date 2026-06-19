import { GAME } from '../config/env.js';

/**
 * Score a finished game.
 * - Start at 1000 points.
 * - Subtract 150 for each wrong guess.
 * - Add a 500 bonus when solved on the very first guess (no wrong guesses).
 * - Clamp to a minimum of 0. A failed game scores 0.
 *
 * @param wrongGuesses number of incorrect guesses before solving
 * @param solved       whether the figure was correctly identified
 */
export function computeScore(wrongGuesses: number, solved: boolean): number {
  if (!solved) return GAME.minScore;
  let score = GAME.baseScore - GAME.penaltyPerWrongGuess * wrongGuesses;
  if (wrongGuesses === 0) score += GAME.firstGuessBonus;
  return Math.max(GAME.minScore, score);
}
