import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Language = 'de' | 'en';
const STORAGE_KEY = 'justonedraw-language';
export function detectLanguage(languages: readonly string[]): Language {
  return languages[0]?.toLowerCase().split('-')[0] === 'de' ? 'de' : 'en';
}
export function initialLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'de' || saved === 'en') return saved;
  } catch { /* Storage can be disabled. */ }
  return typeof navigator === 'undefined' ? 'en' : detectLanguage(navigator.languages?.length ? navigator.languages : [navigator.language]);
}
const german: Record<string, string> = {
  'How perfect is your circle?': 'Wie perfekt ist dein Kreis?',
  'Draw a circle. Test your precision. Beat your record.': 'Zeichne einen Kreis. Teste deine Präzision. Schlage deinen Rekord.',
  'Draw one smooth, closed circle. Release to analyze.': 'Zeichne einen gleichmäßigen, geschlossenen Kreis. Lass los für die Auswertung.',
  'Analyzing…': 'Wird ausgewertet…',
  'Draw a circle here': 'Zeichne hier einen Kreis',
  'Personal Best': 'Dein Rekord',
  'Attempts': 'Versuche',
  'Last Score': 'Letztes Ergebnis',
  'Average': 'Durchschnitt',
  'Invalid attempt': 'Ungültiger Versuch',
  'Try Again': 'Noch einmal',
  'Share Result': 'Ergebnis teilen',
  'New personal best!': 'Neuer persönlicher Rekord!',
  'Perfect circle!': 'Perfekter Kreis!',
  'Almost perfect': 'Fast perfekt',
  'Amazing': 'Beeindruckend',
  'Great circle': 'Sehr guter Kreis',
  'Good circle': 'Guter Kreis',
  'Not bad': 'Nicht schlecht',
  'Keep practicing': 'Weiter üben',
  'You drew a mathematically perfect circle. Inhuman.': 'Du hast einen mathematisch perfekten Kreis gezeichnet. Unglaublich!',
  'Your circle is better than your previous attempt!': 'Du hast deinen persönlichen Rekord verbessert!',
  'Incredibly precise — just a hair off perfection.': 'Unglaublich präzise – fast perfekt.',
  'Outstanding control — barely any wobble.': 'Hervorragende Kontrolle – kaum Abweichungen.',
  'A strong, confident circle.': 'Ein gleichmäßiger, sicher gezeichneter Kreis.',
  'A solid attempt with room to improve.': 'Ein ordentlicher Versuch mit Luft nach oben.',
  'Getting there — try to close the circle more evenly.': 'Du bist auf dem richtigen Weg – versuche, den Kreis gleichmäßiger zu schließen.',
  'Every great circle starts with a wobbly one.': 'Übung macht den Kreis runder.',
  'Too few points to analyse.': 'Zu wenige Zeichenpunkte. Zeichne einen vollständigen Kreis.',
  'Drawing is too small.': 'Die Zeichnung ist zu klein.',
  'Drawing is too linear.': 'Die Zeichnung ist zu gerade. Zeichne einen Kreis.',
  'Could not fit a circle.': 'Es konnte kein Kreis erkannt werden.',
  "The drawing doesn't complete a full circle.": 'Die Zeichnung bildet keinen vollständigen Kreis.',
  'Too many rotations detected.': 'Zu viele Umrundungen erkannt. Zeichne den Kreis nur einmal.',
  'This shape has straight sides and corners. Draw a round circle.': 'Diese Form hat gerade Seiten und Ecken. Zeichne einen runden Kreis.',
  'Shared!': 'Geteilt!',
  'Result copied to clipboard!': 'Ergebnis in die Zwischenablage kopiert!',
  'Could not share or copy the result.': 'Das Ergebnis konnte nicht geteilt oder kopiert werden.',
};
export function translate(text: string, language: Language): string {
  return language === 'de' ? german[text] ?? text : text;
}
export function formatScore(score: number, language: Language): string {
  return score.toLocaleString(language === 'de' ? 'de-DE' : 'en-US', {minimumFractionDigits: 1, maximumFractionDigits: 1});
}
export function shareText(score: number, language: Language): string {
  const value = formatScore(score, language);
  return language === 'de' ? `Ich habe ${value} % bei JustOneDraw erreicht! Kannst du meinen Rekord schlagen?` : `I scored ${value}% on JustOneDraw! Can you beat my score?`;
}
const LanguageContext = createContext<{language: Language; setLanguage: (value: Language) => void}>({language: 'en', setLanguage: () => {}});
export function LanguageProvider({children}: {children: ReactNode}) {
  const [language, updateLanguage] = useState<Language>(initialLanguage);
  const setLanguage = (value: Language) => {
    updateLanguage(value);
    try { localStorage.setItem(STORAGE_KEY, value); } catch { /* Keep the in-memory selection. */ }
  };
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = language === 'de' ? 'JustOneDraw — Teste deine Zeichenpräzision' : 'JustOneDraw — Test your drawing precision';
    const description = translate('Draw a circle. Test your precision. Beat your record.', language);
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', description);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', document.title);
  }, [language]);
  return <LanguageContext.Provider value={{language, setLanguage}}>{children}</LanguageContext.Provider>;
}
export function useLanguage() {
  const context = useContext(LanguageContext);
  return {...context, t: (text: string) => translate(text, context.language), format: (score: number) => formatScore(score, context.language)};
}
