"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Coins, Zap, RotateCcw, ShieldCheck, Sparkles } from "lucide-react";
import { formatRubles, formatTokens, type CampaignAiStats } from "@/lib/ai/cost";

interface CostStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: CampaignAiStats;
  onResetStats: () => void;
  activeDmModel: string;
  activeCheapModel: string;
  activeStoryModel: string;
  campaignName?: string;
}

export function CostStatsModal({
  isOpen,
  onClose,
  stats,
  onResetStats,
  activeDmModel,
  activeCheapModel,
  activeStoryModel,
  campaignName,
}: CostStatsModalProps) {
  const cachedPercent =
    stats.inputTokens > 0
      ? Math.round((stats.cachedTokens / stats.inputTokens) * 100)
      : 0;

  const handleReset = () => {
    if (window.confirm("Сбросить счётчик затрат и токенов для этой кампании?")) {
      onResetStats();
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-5 flex flex-col gap-4">
        <DialogHeader className="pb-1 border-b">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Coins className="size-5 text-amber-500" />
            <span>Статистика трат и токенов</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5">
            {campaignName ? `Кампания: «${campaignName}»` : "Текущая кампания и сессия"}
          </DialogDescription>
        </DialogHeader>

        {/* Главная цифра расходов */}
        <div className="p-4 rounded-xl border bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Всего израсходовано
            </div>
            <div className="text-3xl font-bold font-mono text-foreground mt-1">
              {formatRubles(stats.totalCostRub)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              За {stats.turnsCount} ответов Мастера
            </div>
          </div>
          <div className="text-right">
            <Badge variant="outline" className="text-xs font-mono px-2 py-1 bg-background/80">
              {formatTokens(stats.totalTokens)} токенов
            </Badge>
          </div>
        </div>

        {/* Детализация токенов */}
        <div className="space-y-2 text-xs">
          <div className="font-semibold text-foreground flex items-center gap-1.5">
            <Zap className="size-3.5 text-amber-500" />
            <span>Детализация расхода токенов:</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-lg border bg-muted/30">
              <div className="text-muted-foreground text-[11px]">Входящие (Prompt):</div>
              <div className="font-mono font-semibold text-sm mt-0.5">
                {formatTokens(stats.inputTokens)}
              </div>
            </div>

            <div className="p-2.5 rounded-lg border bg-muted/30">
              <div className="text-muted-foreground text-[11px]">Исходящие (Ответы):</div>
              <div className="font-mono font-semibold text-sm mt-0.5">
                {formatTokens(stats.outputTokens)}
              </div>
            </div>
          </div>

          {/* Плашка кеширования */}
          <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold flex items-center gap-1">
                <ShieldCheck className="size-3.5" />
                Кешированный контекст:
              </span>
              <span className="font-mono font-bold">
                {formatTokens(stats.cachedTokens)} ({cachedPercent}%)
              </span>
            </div>
            <p className="text-[11px] leading-tight text-emerald-700/90 dark:text-emerald-300/90">
              На Polza.ai кешированные токены системного промпта и лора тарифицируются со скидкой до 97% (всего ~0.49 ₽ / 1M).
            </p>
          </div>
        </div>

        <Separator />

        {/* Активные модели */}
        <div className="space-y-1.5 text-xs">
          <div className="font-semibold text-foreground flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-amber-500" />
            <span>Используемые модели:</span>
          </div>
          <div className="space-y-1 font-mono text-[11px] bg-muted/40 p-2.5 rounded-lg border">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Ведущий ДМ:</span>
              <span className="font-semibold truncate max-w-[200px]" title={activeDmModel}>
                {activeDmModel.split("/").pop()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Бухгалтерия:</span>
              <span className="font-semibold truncate max-w-[200px]" title={activeCheapModel}>
                {activeCheapModel.split("/").pop()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Сюжет / Арки:</span>
              <span className="font-semibold truncate max-w-[200px]" title={activeStoryModel}>
                {activeStoryModel.split("/").pop()}
              </span>
            </div>
          </div>
        </div>

        {/* Действия */}
        <div className="pt-2 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-red-600 gap-1 h-8"
            onClick={handleReset}
          >
            <RotateCcw className="size-3" />
            Сбросить счётчик
          </Button>
          <Button size="sm" onClick={onClose} className="h-8">
            Закрыть
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
