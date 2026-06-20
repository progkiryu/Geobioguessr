/**
 * End-to-end API smoke test. Requires the server running on PORT (default 4000)
 * and a seeded database. Run with: pnpm exec tsx src/scripts/smoke.ts
 */
const BASE = `http://localhost:${process.env.PORT ?? 4000}/api`;

async function get(path: string): Promise<any> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return res.json();
}

async function post(path: string, body: unknown): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

let failures = 0;
function check(label: string, cond: boolean, detail?: unknown) {
  console.log(`${cond ? '  ✓' : '  ✗'} ${label}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log('     got:', JSON.stringify(detail));
  }
}

async function main() {
  console.log('Health:');
  const health = await get('/health');
  check('status ok', health.status === 'ok', health);
  check('figures loaded', health.figures > 0, health);

  console.log('Search (fuzzy):');
  const fuzzy = await get('/search?q=Issac+Newten');
  check('typo resolves to Isaac Newton', fuzzy[0]?.id === 'isaac-newton', fuzzy);

  console.log('Failure path (6 wrong guesses on a daily game):');
  const daily = await get('/game/daily');
  check('starts with no hints', daily.revealedHints.length === 0, daily.revealedHints);
  check('coordinates present', !!daily.birthCoordinates && !!daily.deathCoordinates);
  check('no answer leaked at start', daily.answer === undefined);

  let lastAttempt;
  for (let i = 1; i <= 6; i++) {
    lastAttempt = await post('/game/guess', { gameId: daily.gameId, guess: `wrong-${i}` });
    check(`wrong guess #${i}: attempt=${i}, hint level ${i} revealed`,
      lastAttempt.correct === false && lastAttempt.wrongGuesses === i && lastAttempt.newHint?.level === i,
      lastAttempt);
  }
  check('game over after 6 wrong', lastAttempt.over === true);
  check('answer revealed on failure', !!lastAttempt.answer?.name, lastAttempt.answer);
  check('score is 0 on failure', lastAttempt.score === 0, lastAttempt.score);
  const answerName: string = lastAttempt.answer.name;
  console.log(`     (answer was: ${answerName})`);

  console.log('Success path (first-guess on same daily figure):');
  const daily2 = await get('/game/daily');
  const firstTry = await post('/game/guess', { gameId: daily2.gameId, guess: answerName });
  check('correct on first guess', firstTry.correct === true, firstTry);
  check('first-guess bonus => score 1500', firstTry.score === 1500, firstTry.score);
  check('answer included', firstTry.answer?.id === lastAttempt.answer.id);

  console.log('Success path (correct on 3rd attempt => 700):');
  // The daily figure is deterministic, so we know its name from the failure path.
  const d3 = await get('/game/daily');
  await post('/game/guess', { gameId: d3.gameId, guess: 'nope one' });
  await post('/game/guess', { gameId: d3.gameId, guess: 'nope two' });
  const third = await post('/game/guess', { gameId: d3.gameId, guess: answerName });
  check('correct on 3rd attempt => score 700', third.correct === true && third.score === 700, third.score);

  console.log('Daily statistics:');
  const stats = await get(`/stats/daily?date=${daily.date}`);
  check('distribution has score buckets', Array.isArray(stats.distribution) && stats.distribution.length > 0, stats);
  check('counts the finished daily games', stats.total >= 3, stats);
  check('1500 bucket has the first-guess solve', stats.distribution.find((b: any) => b.score === 1500)?.count >= 1, stats.distribution);

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED ✅' : `${failures} CHECK(S) FAILED ❌`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('smoke test crashed:', err);
  process.exit(1);
});
