import { LanguageProvider, useLanguage } from '@/lib/i18n';
import { useState, useCallback, useEffect } from "react";
import { Pencil } from "lucide-react";
import DrawCanvas from "@/components/DrawCanvas";
import ResultDisplay from "@/components/ResultDisplay";
import StatsBar from "@/components/StatsBar";
import { analyseCircle, getScoreColor } from "@/lib/circleAnalysis";
import type { Point } from "@/lib/circleAnalysis";
import {
  loadHighscore,
  recordAttempt,
} from "@/lib/highscore";
import type { HighscoreData } from "@/lib/highscore";

type Phase = "idle" | "drawing" | "analyzing" | "result";

export default function App() {
  return <LanguageProvider><Game /></LanguageProvider>;
}

function Game() {
  const {language, setLanguage, t} = useLanguage();
  const [phase, setPhase] = useState<Phase>("idle");
  const [resetSignal, setResetSignal] = useState(0);
  const [result, setResult] = useState<{
    score: number;
    isNewBest: boolean;
    invalidReason?: string;
  } | null>(null);
  const [highscore, setHighscore] = useState<HighscoreData>(() =>
    loadHighscore(),
  );

  const reducedMotion = usePrefersReducedMotion();

  const handleDrawComplete = useCallback((points: Point[]) => {
    setPhase("analyzing");

    // Small delay for the "analyzing" feel.
    setTimeout(() => {
      const analysis = analyseCircle(points);
      if (!analysis.valid) {
        setResult({
          score: 0,
          isNewBest: false,
          invalidReason: analysis.invalidReason,
        });
        setPhase("result");
        return;
      }

      const { data, isNewBest } = recordAttempt(analysis.score);
      setHighscore(data);
      setResult({
        score: analysis.score,
        isNewBest,
      });
      setPhase("result");
    }, 350);
  }, []);

  const handleTryAgain = useCallback(() => {
    setResult(null);
    setPhase("idle");
    setResetSignal((s) => s + 1);
  }, []);

  const lineColor = result
    ? getScoreColor(result.score)
    : "#e2e8f0";

  return (
    <div
      className="min-h-[100dvh] w-full overflow-x-hidden flex flex-col items-center"
      style={{
        background:
          "radial-gradient(ellipse at 50% 0%, #131a2e 0%, #0B0F19 55%)",
      }}
    >
      {/* Safe area padding */}
      <div
        className="w-full flex flex-col items-center"
        style={{
          paddingTop: "max(1.5rem, env(safe-area-inset-top))",
          paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
          paddingLeft: "max(1rem, env(safe-area-inset-left))",
          paddingRight: "max(1rem, env(safe-area-inset-right))",
        }}
      >
        <div className="flex justify-end w-full max-w-2xl mb-3" role="group" aria-label={language === 'de' ? 'Sprache wählen' : 'Choose language'}>
          {(['de', 'en'] as const).map(value => (
            <button key={value} type="button" lang={value} aria-label={value === 'de' ? 'Deutsch' : 'English'} aria-pressed={language === value} onClick={() => setLanguage(value)} className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${language === value ? 'bg-cyan-400/15 text-cyan-300' : 'text-white/50 hover:text-white'}`}>
              {value.toUpperCase()}
            </button>
          ))}
        </div>
        {/* Header */}
        <header
          className={`flex flex-col items-center text-center mb-4 sm:mb-6 ${
            reducedMotion ? "" : "animate-fade-in"
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <Pencil className="w-5 h-5 shrink-0 text-cyan-400" aria-hidden="true" />
            <h1 className="text-xl sm:text-2xl font-bold tracking-[0.2em] text-white/90">
              JustOneDraw
            </h1>
          </div>
          <p className="text-base sm:text-lg text-white/60 font-medium">
            {t('How perfect is your circle?')}
          </p>
          <p className="text-xs sm:text-sm text-white/30 mt-1">
            {t('Draw a circle. Test your precision. Beat your record.')}
          </p>
        </header>

        {/* Stats bar */}
        <div
          className={`mb-4 sm:mb-6 ${
            reducedMotion ? "" : "animate-fade-in"
          }`}
          style={{ animationDelay: "0.1s" }}
        >
          <StatsBar data={highscore} />
        </div>

        {/* Canvas area */}
        <div className="relative w-full max-w-2xl flex-1 flex flex-col items-center justify-center">
          <div
            className="relative w-full aspect-square rounded-3xl border border-white/8
                       bg-black/20 overflow-hidden"
            style={{
              boxShadow:
                "0 8px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            <DrawCanvas
              onDrawStart={() => setPhase("drawing")}
              onDrawComplete={handleDrawComplete}
              isAnalyzing={phase === "analyzing"}
              hasResult={phase === "result" && result !== null}
              resetSignal={resetSignal}
              lineColor={lineColor}
            />

            {phase === "result" && result && (
              <div className="absolute inset-0 z-10 flex items-center justify-center p-3 pointer-events-none" role="status" aria-live="polite">
                <ResultDisplay
                  score={result.score}
                  isNewBest={result.isNewBest}
                  onTryAgain={handleTryAgain}
                  invalidReason={result.invalidReason}
                />
              </div>
            )}

            {/* Analyzing overlay */}
            {phase === "analyzing" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-3xl animate-fade-in">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-cyan-400 animate-spin" />
                  <span className="text-sm text-white/60 font-medium">
                    {t('Analyzing…')}
                  </span>
                </div>
              </div>
            )}
          </div>


        </div>

        {/* Footer */}
        <footer
          className={`mt-6 sm:mt-8 text-center ${
            reducedMotion ? "" : "animate-fade-in"
          }`}
          style={{ animationDelay: "0.2s" }}
        >
          <p className="text-xs text-white/20">
            {t('Draw one smooth, closed circle. Release to analyze.')}
          </p>
        </footer>
      </div>
    </div>
  );
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}
