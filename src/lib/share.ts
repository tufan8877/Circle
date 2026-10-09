import { shareText, type Language } from './i18n';
/**
 * Share functionality — uses the native Web Share API when available,
 * falls back to clipboard copy.
 */

export async function shareResult(score: number, language: Language = 'en'): Promise<{
  shared: boolean;
  copied: boolean;
  message: string;
}> {
  const text = shareText(score, language);
  // Share the public game, without owner repair/test flags or tracking parameters.
  const url = typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}` : "";
  const shareData = { title: "JustOneDraw", text, url };

  // Try Web Share API.
  if (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function"
  ) {
    try {
      await navigator.share(shareData);
      return { shared: true, copied: false, message: "Shared!" };
    } catch {
      // User cancelled or share failed — fall through to clipboard.
    }
  }

  // Fallback: copy to clipboard.
  const fullText = `${text} ${url}`.trim();
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    try {
      await navigator.clipboard.writeText(fullText);
      return {
        shared: false,
        copied: true,
        message: "Result copied to clipboard!",
      };
    } catch {
      // fall through
    }
  }

  // Last resort: legacy execCommand.
  try {
    const textarea = document.createElement("textarea");
    textarea.value = fullText;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    return {
      shared: false,
      copied: true,
      message: "Result copied to clipboard!",
    };
  } catch {
    return {
      shared: false,
      copied: false,
      message: "Could not share or copy the result.",
    };
  }
}
