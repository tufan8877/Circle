const KEY = 'justonedraw-surprise-v1';
interface SurpriseState {attempts: number; shown: boolean}
let memoryState: SurpriseState = {attempts: 0, shown: false};
export function advanceSurprise(state: SurpriseState): {state: SurpriseState; show: boolean} {
  if (state.shown) return {state, show: false};
  const attempts = Math.min(5, state.attempts + 1);
  const show = attempts === 5;
  return {state: {attempts, shown: false}, show};
}
/** Separate from historical highscores: count completed strokes from this feature's launch. */
function loadState(): SurpriseState {
  let state = memoryState;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (saved && Number.isInteger(saved.attempts) && saved.attempts >= 0 && saved.attempts <= 5 && typeof saved.shown === 'boolean') state = saved;
  } catch { /* In-memory fallback if storage is unavailable. */ }
  return state;
}
function saveState(state: SurpriseState) {
  memoryState = state;
  try {localStorage.setItem(KEY, JSON.stringify(state));} catch { /* In-memory fallback. */ }
}
export function recordSurpriseAttempt(): boolean {
  const next = advanceSurprise(loadState());
  // A failed start must not consume the only showing. Retry on the next drawing.
  saveState(next.state);
  return next.show;
}
export function markSurpriseShown() {
  saveState({...loadState(), attempts: 5, shown: true});
}
