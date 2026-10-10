"use client";

import React, { useState } from "react";
import type { Room, RoomParticipant } from "@/lib/room/types";
import { CheckCircle2, X, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CampaignSetupPanel, partySetupDescription } from "@/components/campaign/CampaignSetupPanel";
import {
  defaultCampaignSetup,
  validateCampaignSetupInput,
  type CampaignSetupValues,
} from "@/lib/campaign/setup-params";

// Значения окна ведущего — те же, что у соло-настройки (см. setup-params.ts)
export type CampaignSetupFormValues = CampaignSetupValues;
export { validateCampaignSetupInput };

interface RoomCampaignSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room;
  participants: RoomParticipant[];
  onStartCampaign: (values: CampaignSetupFormValues) => Promise<void>;
  isGenerating?: boolean;
}

export function RoomCampaignSetupModal({
  isOpen,
  onClose,
  room,
  participants,
  onStartCampaign,
  isGenerating = false,
}: RoomCampaignSetupModalProps) {
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const readyParticipants = participants.filter((p) => p.isReady && p.character);

  const partySlot = (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="flex items-center justify-between text-xs text-zinc-700 dark:text-zinc-300 mb-2 font-medium">
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
          Готовый состав отряда ({readyParticipants.length} из {participants.length}):
        </span>
        <span className="text-[11px] text-zinc-500">
          Стартовый уровень: {room.startingLevel}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {participants.map((p) => {
          const snap = p.character as Record<string, any> | null;
          const name = snap?.name || "Персонаж";
          const cls = snap?.className || snap?.race || "";
          return (
            <span
              key={p.id}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium border ${
                p.isReady
                  ? "bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                  : "bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 opacity-60"
              }`}
            >
              {p.isReady ? "✓" : "⏳"} {name} {cls ? `(${cls})` : ""}
            </span>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[350] flex items-start justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-2xl my-8">
        {/* Форма не размонтируется на время генерации: иначе после ошибки выбор ведущего сбросится */}
        <div className={isGenerating ? "hidden" : undefined}>
          <CampaignSetupPanel
            mode="network"
            description={partySetupDescription(readyParticipants.length)}
            headerAction={
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                aria-label="Закрыть"
              >
                <X className="size-4" />
              </button>
            }
            initialTitle={room.name}
            initialValues={defaultCampaignSetup(room.startingLevel)}
            startingLevel={room.startingLevel}
            isGenerating={isGenerating}
            error={error}
            onCancel={onClose}
            partySlot={partySlot}
            onSubmit={async (values) => {
              setError(null);
              try {
                await onStartCampaign(values);
              } catch (err: any) {
                setError(err?.message || "Ошибка при генерации сюжета");
              }
            }}
          />
        </div>

        {isGenerating && (
          <Card className="border-border bg-card/60">
            <CardContent className="py-12 flex flex-col items-center justify-center text-center">
              <Loader2 className="size-8 animate-spin text-amber-500 mb-4" />
              <h3 className="text-lg font-semibold">Сотворение Акта 1 приключения...</h3>
              <p className="mt-2 text-xs text-muted-foreground max-w-md leading-relaxed">
                ИИ вплетает предыстории и особенности ваших персонажей в первый акт,
                рассчитывает баланс боев и расставляет ключевые вехи.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
