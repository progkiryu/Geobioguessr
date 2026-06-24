import { Router } from 'express';
import { getGameState, startRandomGame, submitGuess } from '../services/gameService.js';
import { getDailyFigure, resolveDailyDate, startDailyGame } from '../services/dailyService.js';

export const gameRouter = Router();

// GET /api/game/random — start a new random game (never today's daily figure)
gameRouter.get('/random', async (_req, res, next) => {
  try {
    // Keep the Play page distinct from the Daily challenge. Best-effort: if the
    // daily figure can't be resolved, just start an unrestricted random game.
    let excludeId: string | undefined;
    try {
      excludeId = (await getDailyFigure()).id;
    } catch {
      /* ignore — random selection will use the full pool */
    }
    const state = await startRandomGame(excludeId);
    res.json(state);
  } catch (err) {
    next(err);
  }
});

// GET /api/game/daily?date=YYYY-MM-DD — start the daily challenge for the
// caller's local day (defaults to the server's UTC day if no/invalid date).
gameRouter.get('/daily', async (req, res, next) => {
  try {
    const dateKey = resolveDailyDate(req.query.date);
    const state = await startDailyGame(dateKey);
    res.json({ ...state, date: state.date ?? dateKey });
  } catch (err) {
    next(err);
  }
});

// POST /api/game/guess — submit a guess { gameId, guess }
gameRouter.post('/guess', async (req, res, next) => {
  try {
    const { gameId, guess } = req.body ?? {};
    if (typeof gameId !== 'string' || typeof guess !== 'string') {
      return res.status(400).json({ error: 'gameId and guess are required strings.' });
    }
    if (guess.trim().length === 0) {
      return res.status(400).json({ error: 'guess cannot be empty.' });
    }
    const result = await submitGuess(gameId, guess);
    if (!result) return res.status(404).json({ error: 'Game not found or expired.' });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/game/:gameId — current state of a game
gameRouter.get('/:gameId', async (req, res, next) => {
  try {
    const state = await getGameState(req.params.gameId);
    if (!state) return res.status(404).json({ error: 'Game not found or expired.' });
    res.json(state);
  } catch (err) {
    next(err);
  }
});
