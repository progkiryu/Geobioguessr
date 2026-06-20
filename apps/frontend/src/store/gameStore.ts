import { create } from 'zustand'
import { api } from '@/lib/api'
import { playSound } from '@/lib/sound'
import type { GameMode, GameState, Hint } from '@/types'

export interface GuessRecord {
  text: string
  correct: boolean
}

type Status = 'idle' | 'loading' | 'playing' | 'finished' | 'error'

// The active game id is remembered per mode so a tab refresh (or revisiting the
// Daily page) resumes the same figure instead of shuffling a new one.
const storageKey = (mode: GameMode) => `geobio:game:${mode}`

function rememberGameId(mode: GameMode, gameId: string) {
  try {
    localStorage.setItem(storageKey(mode), gameId)
  } catch {
    /* storage may be unavailable (private mode, etc.) */
  }
}
function recallGameId(mode: GameMode): string | null {
  try {
    return localStorage.getItem(storageKey(mode))
  } catch {
    return null
  }
}

/** UTC day key — matches the backend's daily rollover. */
function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

/** A persisted game is still usable if it's the right mode and (for daily) today's. */
function isResumable(game: GameState, mode: GameMode): boolean {
  return game.mode === mode && (mode !== 'daily' || game.date === todayKey())
}

interface GameStore {
  status: Status
  error: string | null
  notice: string | null
  mode: GameMode
  game: GameState | null
  guesses: GuessRecord[]
  submitting: boolean

  ensureGame: (mode: GameMode) => Promise<void>
  startGame: (mode: GameMode) => Promise<void>
  submitGuess: (name: string) => Promise<void>
  reset: () => void
}

export const useGameStore = create<GameStore>((set, get) => ({
  status: 'idle',
  error: null,
  notice: null,
  mode: 'random',
  game: null,
  guesses: [],
  submitting: false,

  // Resume the in-progress game for this mode if we still have one (in-memory
  // from navigation, or persisted across a refresh); otherwise start fresh.
  ensureGame: async (mode) => {
    const current = get().game
    if (current && isResumable(current, mode)) {
      set({ mode })
      return
    }

    const savedId = recallGameId(mode)
    if (savedId) {
      set({ status: 'loading', error: null, notice: null, mode, game: null, guesses: [] })
      try {
        const game = await api.getGame(savedId)
        if (isResumable(game, mode)) {
          set({
            game,
            guesses: game.guesses ?? [],
            status: game.over ? 'finished' : 'playing',
          })
          return
        }
      } catch {
        /* stale/expired session — fall through to a fresh game */
      }
    }
    await get().startGame(mode)
  },

  startGame: async (mode) => {
    set({ status: 'loading', error: null, notice: null, mode, game: null, guesses: [] })
    try {
      const game = mode === 'daily' ? await api.startDaily() : await api.startRandom()
      rememberGameId(mode, game.gameId)
      set({ game, guesses: game.guesses ?? [], status: game.over ? 'finished' : 'playing' })
    } catch (err) {
      set({ status: 'error', error: (err as Error).message })
    }
  },

  submitGuess: async (name) => {
    const { game, submitting, guesses } = get()
    if (!game || game.over || submitting) return
    const text = name.trim()
    if (!text) return

    // Block re-using a guess already made (case/diacritic-insensitive).
    const norm = (s: string) =>
      s
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[._'`’-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    if (guesses.some((g) => norm(g.text) === norm(text))) {
      set({ notice: `You already guessed "${text}".` })
      return
    }

    set({ submitting: true, error: null, notice: null })
    try {
      const result = await api.submitGuess(game.gameId, text)

      // Server also guards against repeats (e.g. an alias of a prior guess).
      if (result.duplicate) {
        set({ submitting: false, notice: `You already guessed "${text}".` })
        return
      }

      const revealedHints: Hint[] = result.newHint
        ? [...game.revealedHints, result.newHint]
        : game.revealedHints

      const updated: GameState = {
        ...game,
        attempt: result.attempt,
        wrongGuesses: result.wrongGuesses,
        remainingAttempts: result.remainingAttempts,
        over: result.over,
        solved: result.solved,
        score: result.score,
        answer: result.answer ?? game.answer,
        revealedHints,
      }

      // Win on a correct guess; failure once the last attempt is used up
      // without solving; otherwise a plain wrong guess.
      if (result.correct) {
        playSound('win')
      } else if (result.over) {
        playSound('failure')
      } else {
        playSound('wrong')
      }

      set({
        game: updated,
        guesses: [...get().guesses, { text, correct: result.correct }],
        status: result.over ? 'finished' : 'playing',
        submitting: false,
      })
    } catch (err) {
      set({ submitting: false, error: (err as Error).message })
    }
  },

  reset: () =>
    set({ status: 'idle', error: null, notice: null, game: null, guesses: [], submitting: false }),
}))
