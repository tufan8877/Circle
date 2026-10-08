import {describe, it, expect, vi, afterEach} from 'vitest';
import {detectLanguage, initialLanguage, translate, formatScore, shareText} from './i18n';
afterEach(() => vi.unstubAllGlobals());
describe('language selection', () => {
  it('uses the preferred browser language for Germany and Austria', () => {
    expect(detectLanguage(['de-DE', 'en-US'])).toBe('de');
    expect(detectLanguage(['de-AT'])).toBe('de');
    expect(detectLanguage(['DE-ch'])).toBe('de');
  });
  it('falls back to English for other preferred languages', () => {
    expect(detectLanguage(['en-US', 'de'])).toBe('en');
    expect(detectLanguage(['fr-FR'])).toBe('en');
    expect(detectLanguage([])).toBe('en');
  });
  it('restores the explicit saved choice before browser preference', () => {
    vi.stubGlobal('localStorage', {getItem: () => 'en'});
    vi.stubGlobal('navigator', {languages: ['de-AT']});
    expect(initialLanguage()).toBe('en');
  });
  it('works with disabled storage and rejects invalid saved values', () => {
    vi.stubGlobal('navigator', {languages: ['de-AT']});
    vi.stubGlobal('localStorage', {getItem: () => {throw new Error('blocked');}});
    expect(initialLanguage()).toBe('de');
    vi.stubGlobal('localStorage', {getItem: () => 'invalid'});
    expect(initialLanguage()).toBe('de');
  });
  it('formats scores and sharing in the selected language', () => {
    expect(formatScore(95.2, 'de')).toBe('95,2');
    expect(formatScore(95.2, 'en')).toBe('95.2');
    expect(shareText(95.2, 'de')).toContain('95,2 % bei JustOneDraw');
    expect(translate('Try Again', 'de')).toBe('Noch einmal');
    expect(translate('Try Again', 'en')).toBe('Try Again');
  });
});
