"use client";

import React, { type ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { CampaignSetupForm, type CampaignSetupFormProps } from "@/components/campaign/CampaignSetupForm";

export interface CampaignSetupPanelProps extends CampaignSetupFormProps {
  description: ReactNode;
  /** Кнопка справа в шапке (например, «Назад к готовому сюжету») */
  headerAction?: ReactNode;
}

function heroesWord(count: number): string {
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod100 >= 11 && mod100 <= 14) return "героев";
  if (mod10 === 1) return "герой";
  if (mod10 >= 2 && mod10 <= 4) return "героя";
  return "героев";
}

/** Одно и то же пояснение под заголовком в соло и в сети */
export function partySetupDescription(heroCount: number): string {
  return `Настройте мир и атмосферу приключения для вашего отряда (${heroCount} ${heroesWord(heroCount)}).`;
}

// Карточка «Параметры сюжета и мира»: одна и та же в соло-странице и в окне ведущего комнаты
export function CampaignSetupPanel({ description, headerAction, ...formProps }: CampaignSetupPanelProps) {
  return (
    <Card className="border-border bg-card/60" data-mode={formProps.mode}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="size-4 text-amber-500" />
              Параметры сюжета и мира
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">{description}</CardDescription>
          </div>
          {headerAction}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <CampaignSetupForm {...formProps} />
      </CardContent>
    </Card>
  );
}
