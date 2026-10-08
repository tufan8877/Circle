import { useLanguage } from '@/lib/i18n';
import { useEffect, useState } from "react";
import { RotateCcw, Share2, Sparkles } from "lucide-react";
import {
  getRatingLabel,
  getScoreColor,
} from "@/lib/circleAnalysis";
import { shareResult } from "@/lib/share";
import ResultParticles from "./ResultParticles";

interface ResultDisplayProps {
  score: number;
  isNewBest: boolean;
  onTryAgain: () => void;
  invalidReason?: string;
}

export default function ResultDisplay({
  score,
  isNewBest,
  onTryAgain,
  invalidReason,
}: ResultDisplayProps) {
  const {language, t, format} = useLanguage();
  const [displayScore, setDisplayScore] = useState(0);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const color = getScoreColor(score);
  const { label, subtitle } = getRatingLabel(score);

  // Animate the counter.
  useEffect(() => {
    if (score === 0 && invalidReason) {
      setDisplayScore(0);
      return;
    }
    setDisplayScore(0);
    const duration = 1200;
    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      // Ease out cubic.
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(score * eased);
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setDisplayScore(score);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score, invalidReason]);

  const handleShare = async () => {
    const result = await shareResult(score, language);
    setShareMessage(result.message);
    setTimeout(() => setShareMessage(null), 3000);
  };

  if (invalidReason) {
    return (
      <div className="flex flex-col items-center gap-4 animate-fade-in-up text-center px-4">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: "rgba(248,113,113,0.12)" }}
        >
          <span className="text-3xl">✕</span>
        </div>
        <div>
          <p className="text-lg font-semibold text-white/90">
            {t('Invalid attempt')}
          </p>
          <p className="text-sm text-white/50 mt-1">{t(invalidReason)}</p>
        </div>
        <button
          onClick={onTryAgain}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl
                     bg-white/10 hover:bg-white/15 active:scale-95
                     text-white font-medium transition-all duration-200
                     border border-white/10"
        >
          <RotateCcw className="w-4 h-4" />
          {t('Try Again')}
        </button>
      </div>
    );
  }

  const showParticles = score >= 90;
  const glowIntensity = Math.min(1, (score - 80) / 20);

  return (
    <div className="relative flex flex-col items-center gap-4 animate-fade-in-up text-center px-4">
      {showParticles && <ResultParticles score={score} active={showParticles} />}

      {/* Score number */}
      <div className="relative z-10">
        <div
          className="text-6xl sm:text-7xl font-bold tabular-nums tracking-tight"
          style={{
            color,
            textShadow:
              glowIntensity > 0
                ? `0 0 ${20 + glowIntensity * 30}px ${color}80`
                : "none",
            transition: "color 0.4s ease, text-shadow 0.4s ease",
          }}
        >
          {format(displayScore)}
          <span className="text-3xl sm:text-4xl ml-1">%</span>
        </div>
      </div>

      {/* Rating label */}
      <div className="relative z-10 flex flex-col items-center gap-1">
        <p
          className="text-xl sm:text-2xl font-semibold transition-colors duration-300"
          style={{ color }}
        >
          {t(label)}
        </p>
        <p className="text-sm text-white/50 max-w-xs">
          {t(subtitle(isNewBest))}
        </p>
      </div>

      {/* New best badge */}
      {isNewBest && score > 0 && (
        <div className="relative z-10 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-medium animate-fade-in-up">
          <Sparkles className="w-3.5 h-3.5" />
          {t('New personal best!')}
        </div>
      )}

      {/* Buttons */}
      <div className="relative z-10 flex flex-wrap items-center justify-center gap-3 mt-2">
        <button
          onClick={onTryAgain}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl
                     bg-white text-gray-900 hover:bg-white/90 active:scale-95
                     font-semibold transition-all duration-200
                     shadow-lg shadow-white/10"
        >
          <RotateCcw className="w-4 h-4" />
          {t('Try Again')}
        </button>
        <button
          onClick={handleShare}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl
                     bg-white/10 hover:bg-white/15 active:scale-95
                     text-white font-medium transition-all duration-200
                     border border-white/10"
        >
          <Share2 className="w-4 h-4" />
          {t('Share Result')}
        </button>
      </div>

      {/* Share feedback toast */}
      {shareMessage && (
        <p className="relative z-10 text-xs text-white/60 animate-fade-in-up">
          {t(shareMessage)}
        </p>
      )}
    </div>
  );
}
