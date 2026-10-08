/**
 * Highscore management via localStorage.
 * Stores: best score, total valid attempts, last score, average score.
 */

export interface HighscoreData {
  best: number;
  attempts: number;
  lastScore: number;
  average: number;
}

const STORAGE_KEY = "perfect-circle-highscore";

const DEFAULT: HighscoreData = {
  best: 0,
  attempts: 0,
  lastScore: 0,
  average: 0,
};

export function loadHighscore(): HighscoreData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw);
    return {
      best: parsed.best ?? 0,
      attempts: parsed.attempts ?? 0,
      lastScore: parsed.lastScore ?? 0,
      average: parsed.average ?? 0,
    };
  } catch {
    return { ...DEFAULT };
  }
}

/**
 * Records a valid attempt. Returns the updated data and whether
 * this was a new personal best.
 */
export function recordAttempt(score: number): {
  data: HighscoreData;
  isNewBest: boolean;
} {
  const current = loadHighscore();
  const isNewBest = score > current.best;
  const newAttempts = current.attempts + 1;
  const newAverage =
    (current.average * current.attempts + score) / newAttempts;

  const updated: HighscoreData = {
    best: Math.max(current.best, score),
    attempts: newAttempts,
    lastScore: score,
    average: newAverage,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Storage might be full or unavailable — fail silently.
  }

  return { data: updated, isNewBest };
}

export function resetHighscore(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
