const KEY = 'justonedraw-surprise-v1';
// Explicit owner test link: fresh counter per page load, no changes to real records.
const TEST_MODE = typeof window !== 'undefined' &&
  new URLSearchParams(window.location?.search ?? '').get('video-test') === '1';
const REPAIR_MODE = typeof window !== 'undefined' &&
  new URLSearchParams(window.location?.search ?? '').get('video-repair') === '1';
interface SurpriseState {attempts: number; shown: boolean; repaired?: boolean}
let memoryState: SurpriseState = {attempts: 0, shown: false};
export function advanceSurprise(state: SurpriseState): {state: SurpriseState; show: boolean} {
  if (state.shown) return {state, show: false};
  const attempts = Math.min(5, state.attempts + 1);
  const show = attempts === 5;
  return {state: {...state, attempts, shown: false}, show};
}
/** Separate from historical highscores: count completed strokes from this feature's launch. */
function loadState(): SurpriseState {
  if (TEST_MODE) return memoryState;
  let state = memoryState;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (saved && Number.isInteger(saved.attempts) && saved.attempts >= 0 && saved.attempts <= 5 && typeof saved.shown === 'boolean') state = saved;
  } catch { /* In-memory fallback if storage is unavailable. */ }
  // Opt-in recovery for the owner's old failed/consumed record. Apply only once,
  // persist through the fifth showing and never reset other visitors.
  if (REPAIR_MODE && !state.repaired) {
    state = {attempts: 0, shown: false, repaired: true};
    saveState(state);
  }
  return state;
}
function saveState(state: SurpriseState) {
  memoryState = state;
  if (TEST_MODE) return;
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
