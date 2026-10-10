"use client";

import React, { type ReactNode } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export interface CreateCampaignModalProps {
  /** Окно одно на соло и сеть: режим меняет только пояснение под заголовком */
  mode: "solo" | "network";
  name: string;
  startingLevel: number;
  creating: boolean;
  error?: string | null;
  /** Блок над кнопками (например, просьба войти в аккаунт) */
  notice?: ReactNode;
  /** Подпись кнопки, если действие требует входа */
  submitLabel?: string;
  onName: (v: string) => void;
  onStartingLevel: (v: number) => void;
  onCreate: () => void;
  onClose: () => void;
}

const MODE_DESCRIPTION: Record<CreateCampaignModalProps["mode"], string> = {
  solo: "Дальше вы настроите мир и сюжет и добавите героя.",
  network: "Дальше вы настроите мир и сюжет, а друзья подключатся к вам по ссылке.",
};

export function CreateCampaignModal({
  mode,
  name,
  startingLevel,
  creating,
  error,
  notice,
  submitLabel = "Создать кампанию",
  onName,
  onStartingLevel,
  onCreate,
  onClose,
}: CreateCampaignModalProps) {
  return (
    <div
      data-mode={mode}
      className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-[360]"
    >
      <Card className="max-w-md w-full shadow-xl border-border bg-card">
        <CardHeader>
          <CardTitle>Новая кампания</CardTitle>
          <CardDescription className="text-xs">{MODE_DESCRIPTION[mode]}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              onCreate();
            }}
          >
            {error && (
              <div
                role="alert"
                className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300"
              >
                ⚠️ {error}
              </div>
            )}

            {/* Название */}
            <div className="space-y-2">
              <Label htmlFor="campaign-name">Название кампании *</Label>
              <Input
                id="campaign-name"
                value={name}
                onChange={(e) => onName(e.target.value)}
                placeholder="Например: Забытые Королевства"
                autoFocus
              />
            </div>

            {/* Стартовый уровень */}
            <div className="space-y-2">
              <Label htmlFor="starting-level">Стартовый уровень (1–20)</Label>
              <Input
                id="starting-level"
                type="number"
                min={1}
                max={20}
                value={startingLevel}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val)) {
                    onStartingLevel(Math.min(20, Math.max(1, val)));
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Все персонажи в этой кампании должны соответствовать текущему уровню отряда (на старте: {startingLevel} ур.).
              </p>
            </div>

            {notice}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={creating}>
                Отмена
              </Button>
              <Button type="submit" disabled={!name.trim() || creating}>
                {creating ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Создаю...
                  </>
                ) : (
                  submitLabel
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
