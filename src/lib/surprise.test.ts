import {describe, it, expect, vi, afterEach} from 'vitest';
import {advanceSurprise, recordSurpriseAttempt} from './surprise';
afterEach(() => vi.unstubAllGlobals());
describe('one-time fifth-attempt video', () => {
  it('shows only on attempt five and never on later attempts', () => {
    let state = {attempts: 0, shown: false};
    for (let i = 1; i <= 30; i++) {
      const next = advanceSurprise(state);
      expect(next.show).toBe(i === 5);
      state = next.state;
    }
  });
  it('persists the count across calls and records consumed state before showing', () => {
    const data = new Map<string,string>();
    vi.stubGlobal('localStorage', {getItem: (key:string) => data.get(key) ?? null, setItem: (key:string, value:string) => data.set(key,value)});
    for (let i = 1; i <= 4; i++) expect(recordSurpriseAttempt()).toBe(false);
    expect(recordSurpriseAttempt()).toBe(true);
    expect(JSON.parse([...data.values()][0]).shown).toBe(true);
    expect(recordSurpriseAttempt()).toBe(false);
  });
  it('restores a consumed marker and never repeats', () => {
    vi.stubGlobal('localStorage', {getItem: () => JSON.stringify({attempts: 5, shown: true}), setItem: () => {}});
    expect(recordSurpriseAttempt()).toBe(false);
  });
});
