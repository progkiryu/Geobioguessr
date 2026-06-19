/** Normalize a name for matching: lowercase, strip accents/punctuation, collapse spaces. */
export function normalize(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritical marks
    .toLowerCase()
    .replace(/[._'`’-]/g, ' ') // punctuation & apostrophes -> space
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
