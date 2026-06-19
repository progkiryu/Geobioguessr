const SKIP = new Set(['of', 'the', 'van', 'da', 'di', 'ibn'])

/** First letters of significant name words, e.g. "Marie Curie" -> "M.C." */
export function initialsOf(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w) && !SKIP.has(w.toLowerCase()))
    .map((w) => w[0].toUpperCase())
  return letters.length ? letters.join('.') + '.' : '?'
}
