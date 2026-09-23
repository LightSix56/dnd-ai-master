"use client";

import React from "react";
import { PenTool } from "lucide-react";

export interface TypingUser {
  characterName: string;
  timestamp: number;
}

export function formatTypingMessage(typingUsers: Record<string, TypingUser>): string | null {
  const users = Object.values(typingUsers).filter(Boolean);
  if (users.length === 0) return null;

  const names = users.map((u) => u.characterName || "Герой");
  if (names.length === 1) {
    return `${names[0]} обдумывает действие...`;
  }
  if (names.length === 2) {
    return `${names[0]} и ${names[1]} обдумывают действия...`;
  }
  return `${names[0]}, ${names[1]} и ещё ${names.length - 2} пишут действия...`;
}

interface LiveTypingIndicatorProps {
  typingUsers: Record<string, TypingUser>;
  className?: string;
}

export function LiveTypingIndicator({ typingUsers, className = "" }: LiveTypingIndicatorProps) {
  const message = formatTypingMessage(typingUsers);
  if (!message) return null;

  return (
    <div
      className={`flex items-center gap-1.5 px-3 py-1 text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-full animate-pulse ${className}`}
      role="status"
      aria-live="polite"
    >
      <PenTool className="size-3 text-zinc-500 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
