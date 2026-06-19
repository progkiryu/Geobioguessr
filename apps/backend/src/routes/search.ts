import { Router } from 'express';
import { getSearchSuggestions } from '../services/searchService.js';

export const searchRouter = Router();

// GET /api/search?q=ein&limit=8 — fuzzy search suggestions
searchRouter.get('/', async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 8));
    const results = await getSearchSuggestions(q, limit);
    res.json(results);
  } catch (err) {
    next(err);
  }
});
