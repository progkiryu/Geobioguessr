import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { pingRedis } from './db/redis.js';
import { getAllFigures } from './services/figureService.js';
import { gameRouter } from './routes/game.js';
import { searchRouter } from './routes/search.js';
import { leaderboardRouter } from './routes/leaderboard.js';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.clientOrigin === '*' ? true : env.clientOrigin.split(','),
    }),
  );
  app.use(express.json());

  app.get('/api/health', async (_req, res) => {
    const redisOk = await pingRedis();
    res.json({
      status: 'ok',
      figures: getAllFigures().length,
      redis: redisOk ? 'up' : 'down',
      time: new Date().toISOString(),
    });
  });

  app.use('/api/game', gameRouter);
  app.use('/api/search', searchRouter);
  app.use('/api/leaderboard', leaderboardRouter);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found.' });
  });

  // Centralized error handler.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[error]', err);
    res.status(500).json({ error: 'Internal server error.' });
  });

  return app;
}
