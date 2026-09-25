"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export interface CreateCampaignModalProps {
  name: string;
  startingLevel: number;
  creating: boolean;
  onName: (v: string) => void;
  onStartingLevel: (v: number) => void;
  onCreate: () => void;
  onClose: () => void;
}

export function CreateCampaignModal({
  name,
  startingLevel,
  creating,
  onName,
  onStartingLevel,
  onCreate,
  onClose,
}: CreateCampaignModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <Card className="max-w-md w-full shadow-xl border-border bg-card">
        <CardHeader>
          <CardTitle>Новая кампания</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={creating}>
              Отмена
            </Button>
            <Button onClick={onCreate} disabled={!name.trim() || creating}>
              {creating ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Создаю...
                </>
              ) : (
                "Создать кампанию"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
