import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Копирует текст в буфер обмена с безопасным фоллбэком.
 * Поддерживает:
 * 1. navigator.clipboard (HTTPS, Localhost)
 * 2. document.execCommand('copy') fallback для незащищённых HTTP контекстов (LAN 192.168.*, Radmin 26.*)
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof window === "undefined" || !text) return false;

  // 1. Попытка через современный Clipboard API (доступен в Secure Context: HTTPS и localhost)
  if (typeof navigator !== "undefined" && navigator?.clipboard && typeof navigator.clipboard.writeText === "function") {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Игнорируем ошибку и переходим к запасному варианту
    }
  }

  // 2. Универсальный fallback через скрытый textarea и execCommand('copy') для LAN / HTTP
  try {
    if (typeof document === "undefined") return false;
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.top = "-9999px";
    textArea.style.left = "-9999px";
    textArea.style.opacity = "0";
    textArea.setAttribute("readonly", "");
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    return Boolean(successful);
  } catch (err) {
    console.warn("[copyToClipboard] fallback error:", err);
    return false;
  }
}

