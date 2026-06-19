import { Router } from 'express';
import { getGameState } from '../services/gameService.js';
import { getLeaderboard, submitScore } from '../services/leaderboardService.js';

export const leaderboardRouter = Router();

// GET /api/leaderboard?mode=daily&date=2026-06-18&limit=20
leaderboardRouter.get('/', async (req, res, next) => {
  try {
    const mode = req.query.mode === 'random' ? 'random' : 'daily';
    const date = typeof req.query.date === 'string' ? req.query.date : undefined;
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const entries = await getLeaderboard(mode, date, limit);
    res.json(entries);
  } catch (err) {
    next(err);
  }
});

// POST /api/leaderboard — submit a finished game's score { gameId, name }
leaderboardRouter.post('/', async (req, res, next) => {
  try {
    const { gameId, name } = req.body ?? {};
    if (typeof gameId !== 'string') {
      return res.status(400).json({ error: 'gameId is required.' });
    }
    const state = await getGameState(gameId);
    if (!state) return res.status(404).json({ error: 'Game not found or expired.' });
    // `answer` is populated only once the game is over.
    const figure = state.answer;
    if (!figure) return res.status(400).json({ error: 'Game is not finished.' });

    const result = await submitScore(gameId, typeof name === 'string' ? name : 'Anonymous', figure);
    if (!result.ok) return res.status(400).json({ error: result.reason });
    res.json({ rank: result.rank, entry: result.entry });
  } catch (err) {
    next(err);
  }
});
