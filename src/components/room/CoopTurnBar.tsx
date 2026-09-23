"use client";

import React, { useState, useEffect, useRef, useTransition } from "react";
import type { RoomParticipant, RoomTurn } from "@/lib/room/types";
import { calculateTurnReadiness } from "@/lib/room/turn-batcher";
import { LiveTypingIndicator, type TypingUser } from "./LiveTypingIndicator";
import { Dices, PenLine, Swords, Loader2 } from "lucide-react";

export interface CoopTurnBarProps {
  roomCode: string;
  activeTurn: RoomTurn | null;
  participants: RoomParticipant[];
  currentParticipant: RoomParticipant | null;
  isHost: boolean;
  typingUsers: Record<string, TypingUser>;
  onSendTyping: (isTyping: boolean) => void;
  onSubmitAction: (actionText: string) => Promise<boolean>;
  onResolveTurn: (gmWhisperDirective?: string, afkCharacters?: string[]) => Promise<any>;
  className?: string;
}

export function validatePlayerAction(actionText: string): { isValid: boolean; error?: string } {
  const trimmed = (actionText || "").trim();
  if (!trimmed) {
    return { isValid: false, error: "Действие не может быть пустым" };
  }
  if (trimmed.length > 2000) {
    return { isValid: false, error: "Действие слишком длинное (макс. 2000 символов)" };
  }
  return { isValid: true };
}

export function canSubmitPlayerTurn(turnStatus?: string, isSubmitting?: boolean): boolean {
  if (isSubmitting) return false;
  if (turnStatus === "resolving" || turnStatus === "completed") return false;
  return true;
}

export function CoopTurnBar({
  roomCode: _roomCode,
  activeTurn,
  participants,
  currentParticipant,
  isHost,
  typingUsers,
  onSendTyping,
  onSubmitAction,
  onResolveTurn,
  className = "",
}: CoopTurnBarProps) {
  const currentUserId = currentParticipant?.userId;
  const existingInput = currentUserId && activeTurn?.playerInputs ? activeTurn.playerInputs[currentUserId] : null;

  const [actionText, setActionText] = useState(existingInput?.actionText || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWhisper, setShowWhisper] = useState(false);
  const [gmWhisper, setGmWhisper] = useState("");
  const [, startTransition] = useTransition();

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Синхронизация текста, если инпут изменился извне
  useEffect(() => {
    if (existingInput?.actionText && !actionText) {
      startTransition(() => {
        setActionText(existingInput.actionText);
      });
    }
  }, [existingInput?.actionText, actionText]);

  // Обработка набора текста с debounce для broadcast
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setActionText(val);
    setError(null);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    onSendTyping(true);
    typingTimeoutRef.current = setTimeout(() => {
      onSendTyping(false);
    }, 2500);
  };

  const handleBlur = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    onSendTyping(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validatePlayerAction(actionText);
    if (!validation.isValid) {
      setError(validation.error || "Ошибка валидации");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const ok = await onSubmitAction(actionText.trim());
      if (!ok) {
        setError("Не удалось отправить действие");
      }
    } catch (err: any) {
      setError(err?.message || "Ошибка отправки действия");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolve = async () => {
    setIsResolving(true);
    setError(null);
    try {
      await onResolveTurn(gmWhisper.trim() || undefined);
      setGmWhisper("");
      setShowWhisper(false);
    } catch (err: any) {
      setError(err?.message || "Ошибка разрешения хода");
    } finally {
      setIsResolving(false);
    }
  };

  const readiness = calculateTurnReadiness(participants, activeTurn?.playerInputs || {});
  const hasSubmitted = Boolean(existingInput);
  const roundNum = activeTurn?.roundNumber || 1;
  const isResolvingTurn = activeTurn?.status === "resolving" || isResolving;

  return (
    <div
      className={`border-t border-zinc-200 bg-white/95 dark:border-zinc-800 dark:bg-zinc-950/95 px-4 py-3 text-zinc-900 dark:text-zinc-100 shadow-md backdrop-blur-xs font-sans ${className}`}
    >
      {/* Верхняя строка: Раунд, готовность игроков и индикатор набора */}
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-md bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
            <Dices className="size-3.5" />
            <span>РАУНД {roundNum}</span>
          </div>

          <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Готовность:{" "}
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {readiness.readyCount} / {readiness.totalCount}
            </span>
          </div>

          {/* Бейджи участников */}
          <div className="flex flex-wrap items-center gap-1.5">
            {participants.map((p) => {
              const ready = Boolean(activeTurn?.playerInputs?.[p.userId]);
              const charName = p.characterSnapshot?.name || "Герой";
              return (
                <span
                  key={p.id}
                  className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs ${
                    ready
                      ? "border border-emerald-500/30 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 font-medium"
                      : "border border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
                  }`}
                  title={ready ? "Действие готово" : "Ожидает ввода"}
                >
                  <span>{ready ? "✓" : "⏳"}</span>
                  <span className="truncate max-w-[100px]">{charName}</span>
                </span>
              );
            })}
          </div>
        </div>

        {/* Индикатор печатающих игроков */}
        <LiveTypingIndicator typingUsers={typingUsers} />
      </div>

      {/* Ошибка */}
      {error && (
        <div className="mb-2 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Форма ввода действия игрока */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <div className="relative flex-1">
            <textarea
              value={actionText}
              onChange={handleTextChange}
              onBlur={handleBlur}
              disabled={!canSubmitPlayerTurn(activeTurn?.status, isSubmitting) || isResolvingTurn}
              rows={2}
              placeholder="Опишите действие вашего героя (атака, заклинание, тактическое передвижение, слова)..."
              className="w-full resize-none rounded-md border border-zinc-300 bg-white p-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-hidden focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 disabled:opacity-50"
            />
            {hasSubmitted && (
              <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                ✓ Принято
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={!canSubmitPlayerTurn(activeTurn?.status, isSubmitting) || isResolvingTurn}
            className="flex shrink-0 items-center gap-1.5 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors cursor-pointer shadow-xs"
          >
            <Swords className="size-4" />
            <span>{isSubmitting ? "Запись..." : hasSubmitted ? "Обновить" : "Готово"}</span>
          </button>
        </div>
      </form>

      {/* Панель Мастера (Host Controls) */}
      {isHost && (
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 dark:border-zinc-800 pt-2 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowWhisper((v) => !v)}
              className="flex items-center gap-1 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <PenLine className="size-3" />
              <span>{showWhisper ? "Скрыть шёпот ДМ" : "Шёпот ДМ (Тайная директива)"}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {!readiness.isAllReady && (
              <span className="text-[11px] text-zinc-500">
                Не все готовы (
                {participants
                  .filter((p) => readiness.pendingUserIds.includes(p.userId))
                  .map((p) => p.characterSnapshot?.name || "Герой")
                  .join(", ")}
                )
              </span>
            )}

            <button
              type="button"
              onClick={handleResolve}
              disabled={isResolvingTurn}
              className="flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors cursor-pointer shadow-xs"
            >
              {isResolvingTurn ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Dices className="size-3.5" />
              )}
              <span>
                {isResolvingTurn
                  ? "ИИ-Мастер думает..."
                  : readiness.isAllReady
                  ? "Завершить раунд (ИИ-Мастер)"
                  : "Принудительный ход"}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Раскрывающийся блок Тайного указания Мастера (GM Whisper) */}
      {isHost && showWhisper && (
        <div className="mt-2 rounded-md border border-zinc-200 bg-zinc-50 p-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-1.5 flex items-center gap-1 font-medium text-zinc-800 dark:text-zinc-200">
            <PenLine className="size-3.5 text-zinc-500" />
            <span>Тайная директива для ИИ-Мастера (не видна игрокам):</span>
          </div>
          <input
            type="text"
            value={gmWhisper}
            onChange={(e) => setGmWhisper(e.target.value)}
            placeholder="Например: Внезапно рушится свод пещеры; главарь разбойников предлагает перемирие..."
            className="w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </div>
      )}
    </div>
  );
}
