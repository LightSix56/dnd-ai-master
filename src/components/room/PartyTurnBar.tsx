"use client";

import React from "react";
import type { RoomParticipant, RoomTurn } from "@/lib/room/types";
import { calculateTurnReadiness } from "@/lib/room/turn-batcher";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Swords,
  CheckCircle2,
  Clock,
  Sparkles,
  Zap,
  Loader2,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface PartyTurnBarProps {
  roomTurn: RoomTurn | null;
  participants: RoomParticipant[];
  currentUserId?: string;
  isHost: boolean;
  resolving: boolean;
  onForceResolve?: () => void;
  className?: string;
}

export function PartyTurnBar({
  roomTurn,
  participants,
  currentUserId,
  isHost,
  resolving,
  onForceResolve,
  className,
}: PartyTurnBarProps) {
  const readiness = calculateTurnReadiness(
    participants,
    roomTurn?.playerInputs || {}
  );
  const { readyCount, totalCount, isAllReady } = readiness;
  const roundNumber = roomTurn?.roundNumber || 1;

  // Участники с созданным персонажем
  const activeParticipants = participants.filter(
    (p) => Boolean(p.characterSnapshot?.name || p.characterSnapshot)
  );

  const canForceResolve =
    isHost && readyCount > 0 && !isAllReady && !resolving;

  return (
    <Card
      className={cn(
        "bg-white border-zinc-200 shadow-xs dark:bg-zinc-950 dark:border-zinc-800 gap-0 py-0 overflow-hidden",
        className
      )}
    >
      {/* Заголовок панели */}
      <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0 border-b border-border/50 bg-zinc-50/50 dark:bg-zinc-900/50">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Swords className="size-4" />
          </div>
          <span className="font-semibold text-sm text-foreground">
            Раунд {roundNumber} • Заявки отряда ({readyCount}/{totalCount})
          </span>
        </div>

        {canForceResolve && (
          <Button
            variant="outline"
            size="sm"
            onClick={onForceResolve}
            className="text-xs h-7 border-amber-500/40 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40 font-medium"
          >
            <Zap className="size-3.5 mr-1 text-amber-500" />
            Отправить ход сейчас
          </Button>
        )}
      </CardHeader>

      <CardContent className="p-4 flex flex-col gap-3">
        {/* Баннер разрешения хода Мастером */}
        {resolving && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200/80 px-3.5 py-2.5 text-xs font-medium text-amber-800 dark:bg-amber-950/30 dark:border-amber-900/50 dark:text-amber-300">
            <Loader2 className="size-4 animate-spin text-amber-600 dark:text-amber-400 shrink-0" />
            <Sparkles className="size-4 text-amber-500 shrink-0" />
            <span>✨ Мастер оценивает действия отряда и описывает события мира...</span>
          </div>
        )}

        {/* Сетка участников */}
        {activeParticipants.length === 0 ? (
          <div className="py-4 text-center text-xs text-muted-foreground">
            В отряде пока нет активных персонажей
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeParticipants.map((p) => {
              const char = p.characterSnapshot;
              const characterName = char?.name || "Герой";
              const classLevelParts = [
                char?.race,
                char?.className,
                char?.level ? `${char.level} ур.` : undefined,
              ].filter(Boolean);
              const subtitle =
                classLevelParts.length > 0
                  ? classLevelParts.join(" • ")
                  : "Искатель приключений";

              const playerInput = roomTurn?.playerInputs?.[p.userId];
              const hasSubmitted = Boolean(playerInput?.actionText?.trim());
              const isCurrentUser = p.userId === currentUserId;

              return (
                <div
                  key={p.id || p.userId}
                  className={cn(
                    "flex flex-col justify-between rounded-lg border p-3 transition-colors bg-card",
                    isCurrentUser
                      ? "border-primary/30 ring-1 ring-primary/10"
                      : "border-border/60"
                  )}
                >
                  {/* Верхняя строка участника: аватар + инфо + бейдж */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar className="size-8 rounded-md border border-border/60 shrink-0">
                        {char?.portraitUrl ? (
                          <AvatarImage
                            src={char.portraitUrl}
                            alt={characterName}
                          />
                        ) : null}
                        <AvatarFallback className="rounded-md bg-muted text-[11px] font-semibold text-muted-foreground">
                          {characterName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-xs text-foreground truncate">
                            {characterName}
                          </span>
                          {p.isHost && (
                            <span
                              title="Ведущий комнаты"
                              className="inline-flex items-center text-amber-600 dark:text-amber-400"
                            >
                              <Shield className="size-3" />
                            </span>
                          )}
                          {isCurrentUser && (
                            <span className="text-[10px] text-muted-foreground">
                              (Вы)
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {subtitle}
                        </p>
                      </div>
                    </div>

                    {/* Бейдж готовности */}
                    <div className="shrink-0">
                      {hasSubmitted ? (
                        <Badge
                          variant="outline"
                          className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 text-[11px] gap-1 font-medium"
                        >
                          <CheckCircle2 className="size-3 text-emerald-600" />
                          Готов
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="bg-zinc-100 text-zinc-600 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700 text-[11px] gap-1"
                        >
                          <Clock className="size-3 text-zinc-500" />
                          Обдумывает...
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Цитата действия или ожидание */}
                  <div className="mt-2.5">
                    {hasSubmitted && playerInput ? (
                      <div className="bg-muted/40 text-xs italic text-foreground/90 p-2 rounded-md border border-border/50 break-words">
                        «{playerInput.actionText}»
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground italic px-1">
                        Ожидает хода игрока...
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
