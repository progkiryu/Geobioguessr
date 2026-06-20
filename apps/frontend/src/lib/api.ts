import type { DailyStats, GameState, GuessResult, SearchResult } from '@/types'

const BASE = import.meta.env.VITE_API_URL || '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const body = (await res.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      /* ignore parse errors */
    }
    throw new Error(message)
  }
  return res.json() as Promise<T>
}

export const api = {
  startRandom: () => request<GameState>('/game/random'),
  startDaily: () => request<GameState>('/game/daily'),
  getGame: (gameId: string) => request<GameState>(`/game/${gameId}`),

  submitGuess: (gameId: string, guess: string) =>
    request<GuessResult>('/game/guess', {
      method: 'POST',
      body: JSON.stringify({ gameId, guess }),
    }),

  search: (q: string, limit = 8) =>
    request<SearchResult[]>(`/search?q=${encodeURIComponent(q)}&limit=${limit}`),

  getDailyStats: (date?: string) =>
    request<DailyStats>(`/stats/daily${date ? `?date=${encodeURIComponent(date)}` : ''}`),
}
