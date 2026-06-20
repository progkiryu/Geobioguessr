import { Router } from 'express';
import { getDailyStats } from '../services/statsService.js';
import { todayKey } from '../services/dailyService.js';

export const statsRouter = Router();

// GET /api/stats/daily?date=2026-06-18 — score distribution for a day's Daily.
statsRouter.get('/daily', async (req, res, next) => {
  try {
    const date = typeof req.query.date === 'string' ? req.query.date : todayKey();
    const stats = await getDailyStats(date);
    res.json(stats);
  } catch (err) {
    next(err);
  }
});
