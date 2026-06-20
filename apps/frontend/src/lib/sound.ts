/**
 * Game sound effects. Files live in `public/`, so Vite serves them from root.
 *
 * A fresh `Audio` instance is created per play so rapid repeats (e.g. several
 * wrong guesses in a row) don't cut each other off, and playback failures
 * (autoplay policy, missing file) are swallowed — sound is non-essential.
 */
export type GameSound = 'win' | 'wrong' | 'failure'

export function playSound(sound: GameSound): void {
  try {
    const audio = new Audio(`/${sound}.mp3`)
    void audio.play().catch(() => {
      /* autoplay blocked or no user gesture yet — ignore */
    })
  } catch {
    /* Audio unsupported — ignore */
  }
}
