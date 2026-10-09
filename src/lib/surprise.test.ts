import {describe, it, expect, vi, afterEach} from 'vitest';
import {advanceSurprise, recordSurpriseAttempt, markSurpriseShown} from './surprise';
afterEach(() => vi.unstubAllGlobals());
describe('one-time fifth-attempt video', () => {
  it('shows only on attempt five and never on later attempts', () => {
    let state = {attempts: 0, shown: false};
    for (let i = 1; i <= 30; i++) {
      const next = advanceSurprise(state);
      expect(next.show).toBe(i === 5);
      state = next.state;
      if (next.show) state = {...state, shown: true};
    }
  });
  it('persists the count and consumes only a successfully started video', () => {
    const data = new Map<string,string>();
    vi.stubGlobal('localStorage', {getItem: (key:string) => data.get(key) ?? null, setItem: (key:string, value:string) => data.set(key,value)});
    for (let i = 1; i <= 4; i++) expect(recordSurpriseAttempt()).toBe(false);
    expect(recordSurpriseAttempt()).toBe(true);
    expect(JSON.parse([...data.values()][0]).shown).toBe(false);
    // Simulate playback rejection: the next drawing can retry.
    expect(recordSurpriseAttempt()).toBe(true);
    markSurpriseShown();
    expect(JSON.parse([...data.values()][0]).shown).toBe(true);
    expect(recordSurpriseAttempt()).toBe(false);
  });
  it('restores a consumed marker and never repeats', () => {
    vi.stubGlobal('localStorage', {getItem: () => JSON.stringify({attempts: 5, shown: true}), setItem: () => {}});
    expect(recordSurpriseAttempt()).toBe(false);
  });
  it('restores a failed fifth attempt across reloads and retries it', () => {
    vi.stubGlobal('localStorage', {getItem: () => JSON.stringify({attempts: 5, shown: false}), setItem: () => {}});
    expect(recordSurpriseAttempt()).toBe(true);
  });
});
