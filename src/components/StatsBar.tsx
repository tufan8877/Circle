import { useLanguage } from '@/lib/i18n';
import { Trophy, Hash, Target, TrendingUp } from "lucide-react";
import type { HighscoreData } from "@/lib/highscore";

interface StatsBarProps {
  data: HighscoreData;
}

export default function StatsBar({ data }: StatsBarProps) {
  const {t, format} = useLanguage();
  const stats = [
    {
      icon: Trophy,
      label: "Personal Best",
      value: data.best > 0 ? `${format(data.best)}%` : "—",
      highlight: data.best >= 90,
    },
    {
      icon: Hash,
      label: "Attempts",
      value: String(data.attempts),
    },
    {
      icon: Target,
      label: "Last Score",
      value: data.lastScore > 0 ? `${format(data.lastScore)}%` : "—",
    },
    {
      icon: TrendingUp,
      label: "Average",
      value: data.attempts > 0 ? `${format(data.average)}%` : "—",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 w-full max-w-2xl">
      {stats.map((s) => (
        <div
          key={t(s.label)}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-2xl
                     bg-white/5 border border-white/5
                     transition-colors duration-200"
        >
          <s.icon
            className={`w-4 h-4 shrink-0 ${
              s.highlight ? "text-amber-400" : "text-white/40"
            }`}
          />
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] sm:text-xs text-white/40 font-medium uppercase tracking-wide leading-tight">
              {t(s.label)}
            </span>
            <span
              className={`text-sm sm:text-base font-semibold tabular-nums leading-tight ${
                s.highlight ? "text-amber-400" : "text-white/90"
              }`}
            >
              {s.value}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
