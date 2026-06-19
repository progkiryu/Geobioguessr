import { Collection, Db, MongoClient } from 'mongodb';
import { env } from '../config/env.js';
import type { HistoricalFigure, LeaderboardEntry } from '../types.js';

interface DailyChallengeDoc {
  date: string; // UTC YYYY-MM-DD
  figureId: string;
  createdAt: Date;
}

interface AnalyticsEvent {
  type: string;
  mode?: string;
  figureId?: string;
  attempts?: number;
  solved?: boolean;
  score?: number;
  createdAt: Date;
}

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectMongo(): Promise<Db> {
  if (db) return db;
  client = new MongoClient(env.mongoUrl, { serverSelectionTimeoutMS: 8000 });
  await client.connect();
  db = client.db(env.mongoDb);
  await ensureIndexes(db);
  return db;
}

export function getDb(): Db {
  if (!db) throw new Error('MongoDB not connected. Call connectMongo() first.');
  return db;
}

export function figures(): Collection<HistoricalFigure> {
  return getDb().collection<HistoricalFigure>('historical_figures');
}

export function dailyChallenges(): Collection<DailyChallengeDoc> {
  return getDb().collection<DailyChallengeDoc>('daily_challenges');
}

export function leaderboards(): Collection<LeaderboardEntry> {
  return getDb().collection<LeaderboardEntry>('leaderboards');
}

export function analytics(): Collection<AnalyticsEvent> {
  return getDb().collection<AnalyticsEvent>('analytics');
}

async function ensureIndexes(database: Db): Promise<void> {
  await database
    .collection('historical_figures')
    .createIndex({ id: 1 }, { unique: true });
  await database.collection('daily_challenges').createIndex({ date: 1 }, { unique: true });
  await database.collection('leaderboards').createIndex({ mode: 1, date: 1, score: -1 });
  await database.collection('analytics').createIndex({ createdAt: -1 });
}

export async function closeMongo(): Promise<void> {
  await client?.close();
  client = null;
  db = null;
}

export type { DailyChallengeDoc, AnalyticsEvent };
