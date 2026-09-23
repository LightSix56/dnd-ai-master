"use client";

import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Sparkles, Check, Wrench, Zap, ExternalLink } from "lucide-react";

export interface ModelOption {
  id: string;
  name: string;
  supports_tools?: boolean;
  context_length?: number;
  pricing?: {
    input?: number;
    output?: number;
    cache_read?: number;
    prompt?: string;
    completion?: string;
    cache?: string;
  };
}

interface ModelPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedModelId: string;
  onSelectModel: (modelId: string) => void;
  modelsList: ModelOption[];
  title?: string;
  roleBadge?: string;
  description?: string;
}

type CategoryFilter = "all" | "flash" | "deepseek" | "claude" | "openai" | "tools";

export function ModelPickerModal({
  isOpen,
  onClose,
  selectedModelId,
  onSelectModel,
  modelsList,
  title = "Выбор модели",
  roleBadge,
  description,
}: ModelPickerModalProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");

  const filteredModels = useMemo(() => {
    const q = search.trim().toLowerCase();

    return modelsList.filter((m) => {
      // 1. Поиск по тексту
      const matchesSearch =
        !q ||
        m.id.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      // 2. Фильтр по категории
      if (category === "all") return true;
      if (category === "flash") {
        return /flash|mini|lite|budget/i.test(m.id) || /flash|mini|lite/i.test(m.name);
      }
      if (category === "deepseek") {
        return /deepseek/i.test(m.id);
      }
      if (category === "claude") {
        return /claude|anthropic/i.test(m.id);
      }
      if (category === "openai") {
        return /gpt|openai|o1|o3/i.test(m.id);
      }
      if (category === "tools") {
        return Boolean(m.supports_tools);
      }
      return true;
    });
  }, [modelsList, search, category]);

  const exactMatchExists = modelsList.some(
    (m) => m.id.toLowerCase() === search.trim().toLowerCase()
  );

  const handleSelect = (id: string) => {
    onSelectModel(id);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-5 gap-4">
        <DialogHeader className="pb-1 border-b">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="size-4 text-amber-500" />
              <span>{title}</span>
            </DialogTitle>
            {roleBadge && (
              <Badge variant="secondary" className="text-xs">
                {roleBadge}
              </Badge>
            )}
          </div>
          {description && (
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Поиск */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию или ID (например, deepseek, flash, claude)..."
            className="pl-9 text-sm"
            autoFocus
          />
        </div>

        {/* Фильтры по категориям */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <Button
            type="button"
            variant={category === "all" ? "default" : "outline"}
            size="sm"
            className="h-7 px-2.5 text-xs"
            onClick={() => setCategory("all")}
          >
            Все ({modelsList.length})
          </Button>
          <Button
            type="button"
            variant={category === "flash" ? "default" : "outline"}
            size="sm"
            className="h-7 px-2.5 text-xs gap-1"
            onClick={() => setCategory("flash")}
          >
            <Zap className="size-3 text-amber-500" />
            Flash / Эконом
          </Button>
          <Button
            type="button"
            variant={category === "deepseek" ? "default" : "outline"}
            size="sm"
            className="h-7 px-2.5 text-xs"
            onClick={() => setCategory("deepseek")}
          >
            DeepSeek
          </Button>
          <Button
            type="button"
            variant={category === "claude" ? "default" : "outline"}
            size="sm"
            className="h-7 px-2.5 text-xs"
            onClick={() => setCategory("claude")}
          >
            Claude
          </Button>
          <Button
            type="button"
            variant={category === "openai" ? "default" : "outline"}
            size="sm"
            className="h-7 px-2.5 text-xs"
            onClick={() => setCategory("openai")}
          >
            OpenAI / GPT
          </Button>
          <Button
            type="button"
            variant={category === "tools" ? "default" : "outline"}
            size="sm"
            className="h-7 px-2.5 text-xs gap-1"
            onClick={() => setCategory("tools")}
          >
            <Wrench className="size-3" />
            Tools (вызовы)
          </Button>
        </div>

        {/* Кастомный ID модели, если введён неизвестный */}
        {search.trim() && !exactMatchExists && (
          <div className="p-2.5 rounded-md border border-dashed border-amber-500/40 bg-amber-500/5 flex items-center justify-between gap-2 text-xs">
            <div className="truncate">
              <span className="text-muted-foreground">Использовать введённый ID: </span>
              <code className="font-mono font-semibold text-foreground">{search.trim()}</code>
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-xs shrink-0"
              onClick={() => handleSelect(search.trim())}
            >
              Выбрать эту
            </Button>
          </div>
        )}

        {/* Список моделей */}
        <ScrollArea className="flex-1 max-h-[50vh] pr-2">
          <div className="space-y-1.5">
            {filteredModels.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Модели не найдены по запросу &laquo;{search}&raquo;
              </div>
            ) : (
              filteredModels.map((m) => {
                const isSelected = m.id === selectedModelId;
                const ctx = m.context_length
                  ? m.context_length >= 1000000
                    ? `${(m.context_length / 1000000).toFixed(0)}M`
                    : `${Math.round(m.context_length / 1000)}k`
                  : null;

                const inputPrice = m.pricing?.input != null ? `${m.pricing.input} ₽` : null;
                const outputPrice = m.pricing?.output != null ? `${m.pricing.output} ₽` : null;
                const cachePrice = m.pricing?.cache_read != null ? `${m.pricing.cache_read} ₽` : null;

                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleSelect(m.id)}
                    className={`w-full text-left p-3 rounded-lg border transition flex flex-col gap-1.5 cursor-pointer ${
                      isSelected
                        ? "border-amber-500 bg-amber-500/10 dark:bg-amber-500/15"
                        : "border-border/60 hover:border-amber-500/50 hover:bg-muted/50 bg-card"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-sm truncate text-foreground">
                          {m.name}
                        </span>
                        {m.supports_tools && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal gap-0.5 shrink-0">
                            <Wrench className="size-2.5" />
                            tools
                          </Badge>
                        )}
                        {ctx && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal shrink-0">
                            {ctx} конт.
                          </Badge>
                        )}
                      </div>
                      {isSelected && (
                        <div className="flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400 shrink-0">
                          <Check className="size-4" />
                          <span>Выбрана</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground flex-wrap">
                      <code className="text-[11px] font-mono text-muted-foreground/80 truncate max-w-xs">
                        {m.id}
                      </code>
                      {(inputPrice || outputPrice) && (
                        <div className="flex items-center gap-2 text-[11px] font-mono shrink-0">
                          <span>
                            Вход: <strong className="text-foreground">{inputPrice}</strong>/1M
                          </span>
                          <span>•</span>
                          <span>
                            Выход: <strong className="text-foreground">{outputPrice}</strong>/1M
                          </span>
                          {cachePrice && (
                            <>
                              <span>•</span>
                              <span className="text-emerald-600 dark:text-emerald-400">
                                Кеш: <strong>{cachePrice}</strong>
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>

        {/* Футер с пояснением */}
        <div className="pt-2 border-t flex items-center justify-between text-xs text-muted-foreground">
          <span>Показано: {filteredModels.length} из {modelsList.length}</span>
          <a
            href="https://polza.ai/models"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 hover:underline text-amber-600 dark:text-amber-400"
          >
            Тарифы на Polza.ai <ExternalLink className="size-3" />
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
