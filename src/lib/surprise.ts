const KEY = 'justonedraw-surprise-v1';
interface SurpriseState {attempts: number; shown: boolean}
let memoryState: SurpriseState = {attempts: 0, shown: false};
export function advanceSurprise(state: SurpriseState): {state: SurpriseState; show: boolean} {
  if (state.shown) return {state, show: false};
  const attempts = Math.min(5, state.attempts + 1);
  const show = attempts === 5;
  return {state: {attempts, shown: show}, show};
}
/** Separate from historical highscores: count completed strokes from this feature's launch. */
export function recordSurpriseAttempt(): boolean {
  let state = memoryState;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (saved && Number.isInteger(saved.attempts) && saved.attempts >= 0 && saved.attempts <= 5 && typeof saved.shown === 'boolean') state = saved;
  } catch { /* In-memory fallback if storage is unavailable. */ }
  const next = advanceSurprise(state);
  memoryState = next.state;
  // Mark consumed before displaying, so closing/reloading cannot retrigger it.
  try {localStorage.setItem(KEY, JSON.stringify(next.state));} catch { /* Memory still prevents repeats this session. */ }
  return next.show;
}
