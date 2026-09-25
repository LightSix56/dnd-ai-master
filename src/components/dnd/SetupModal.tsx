"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Globe, Search, Loader2 } from "lucide-react";

export interface SetupModalProps {
  apiKey: string;
  baseURL: string;
  model: string;
  cheapModel: string;
  storyModel: string;
  authMode: "bearer" | "x-api-key" | "raw";
  modelsList: Array<{
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
  }>;
  loadingModels: boolean;
  onApiKey: (v: string) => void;
  onBaseURL: (v: string) => void;
  onModel: (v: string) => void;
  onCheapModel: (v: string) => void;
  onStoryModel: (v: string) => void;
  onAuthMode: (v: "bearer" | "x-api-key" | "raw") => void;
  onReloadModels: () => void;
  onOpenModelPicker: (role: "dm" | "cheap" | "story") => void;
  onClose: () => void;
  testingKey: boolean;
  testResult: { valid: boolean; message: string } | null;
  onTestKey: () => void;
}

export function SetupModal({
  apiKey,
  baseURL,
  model,
  cheapModel,
  storyModel,
  authMode,
  modelsList,
  loadingModels,
  onApiKey,
  onBaseURL,
  onModel: _onModel,
  onCheapModel: _onCheapModel,
  onStoryModel: _onStoryModel,
  onAuthMode,
  onReloadModels,
  onOpenModelPicker,
  onClose,
  testingKey,
  testResult,
  onTestKey,
}: SetupModalProps) {
  const renderModelCard = (
    roleId: "dm" | "cheap" | "story",
    title: string,
    badgeText: string,
    currentModelId: string,
    description: string,
    recommendation: string
  ) => {
    const currentModel = modelsList.find((m) => m.id === currentModelId);
    const ctx = currentModel?.context_length
      ? currentModel.context_length >= 1000000
        ? "1M"
        : `${Math.round(currentModel.context_length / 1000)}k`
      : null;
    const promptPrice =
      currentModel?.pricing?.prompt ??
      (currentModel?.pricing?.input != null ? `${currentModel.pricing.input} ₽` : null);
    const compPrice =
      currentModel?.pricing?.completion ??
      (currentModel?.pricing?.output != null ? `${currentModel.pricing.output} ₽` : null);

    return (
      <div className="space-y-2 p-3 rounded-lg border bg-card/60">
        <div className="flex items-center justify-between">
          <Label className="font-semibold text-sm">{title}</Label>
          <Badge variant="secondary" className="text-[10px]">
            {badgeText}
          </Badge>
        </div>
        <div className="flex items-center justify-between gap-3 p-2.5 rounded-md border bg-background/60">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-xs truncate text-foreground">
                {currentModel?.name || currentModelId}
              </span>
              {currentModel?.supports_tools && (
                <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 font-normal">
                  tools
                </Badge>
              )}
              {ctx && (
                <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5 font-normal">
                  {ctx}
                </Badge>
              )}
            </div>
            <div className="text-[11px] font-mono text-muted-foreground truncate mt-0.5">
              {currentModelId}
              {promptPrice && compPrice && (
                <span className="ml-2 text-amber-600 dark:text-amber-400">
                  ({promptPrice} / {compPrice})
                </span>
              )}
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs shrink-0 gap-1"
            onClick={() => onOpenModelPicker(roleId)}
          >
            <Search className="size-3" />
            Выбрать...
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground leading-normal">
          {description} <strong>Рекомендуется:</strong> {recommendation}
        </p>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Настройки AI (API и Модели)</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={onReloadModels}
              disabled={loadingModels}
              title="Обновить каталог моделей с провайдера"
            >
              {loadingModels ? <Loader2 className="size-3 mr-1 animate-spin" /> : null}
              Обновить модели
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Base URL (Кастомный API провайдера / прокси) */}
          <div className="space-y-1.5 p-3 rounded-lg border bg-card/60">
            <div className="flex items-center justify-between">
              <Label htmlFor="base-url" className="font-semibold text-sm flex items-center gap-1.5">
                <Globe className="size-3.5 text-amber-500" />
                API Base URL (Провайдер / Прокси / Зеркало)
              </Label>
              {baseURL !== "https://polza.ai/api/v1" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={() => onBaseURL("https://polza.ai/api/v1")}
                >
                  Сбросить на Polza.ai
                </Button>
              )}
            </div>
            <Input
              id="base-url"
              value={baseURL}
              onChange={(e) => onBaseURL(e.target.value)}
              placeholder="https://polza.ai/api/v1"
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Стандартный: <code>https://polza.ai/api/v1</code>. Поддерживает любые OpenAI-совместимые API, прокси или локальные серверы (LiteLLM, Ollama, OpenRouter).
            </p>
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key (Токен авторизации)</Label>
            <Input
              id="api-key"
              type="password"
              value={apiKey}
              onChange={(e) => onApiKey(e.target.value)}
              placeholder="Вставьте ваш API-токен"
            />
            <p className="text-xs text-muted-foreground">
              Получите ключ на{" "}
              <a
                href="https://polza.ai"
                target="_blank"
                rel="noreferrer"
                className="underline text-amber-600 dark:text-amber-400"
              >
                polza.ai
              </a>{" "}
              (или у вашего провайдера). Ключ сохраняется локально в браузере.
            </p>
          </div>

          {/* Режим авторизации */}
          <div className="space-y-2">
            <Label htmlFor="auth-mode">Режим авторизации</Label>
            <Select
              value={authMode}
              onValueChange={(v) => onAuthMode(v as "bearer" | "x-api-key" | "raw")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bearer">Bearer (стандартный для Polza.ai / OpenAI)</SelectItem>
                <SelectItem value="x-api-key">x-api-key (Anthropic-стиль)</SelectItem>
                <SelectItem value="raw">Raw (без префикса)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 1. Основной ДМ */}
          {renderModelCard(
            "dm",
            "1. Основной ДМ (Ведущий игры)",
            "Нарратив и бои",
            model,
            "Ведёт рассказ, отыгрывает NPC, принимает решения и ведёт тактический бой.",
            "DeepSeek V4.1 Flash (1M контекст, 16.5₽/49.4₽, кеш 0.49₽)."
          )}

          {/* 2. Служебная модель */}
          {renderModelCard(
            "cheap",
            "2. Служебный помощник (Бухгалтерия)",
            "Экономия до 95%",
            cheapModel,
            "Запись памяти (record), обновление состояний NPC и сжатие старой истории.",
            "DeepSeek V4 Flash (4.18₽/8.37₽)."
          )}

          {/* 3. Генератор историй */}
          {renderModelCard(
            "story",
            "3. Генератор сюжета (Арки и главы)",
            "Just-in-Time сюжет",
            storyModel,
            "Генерация скелета кампании, злодеев и адаптивных новых глав по ходу игры.",
            "DeepSeek V4.1 Flash."
          )}

          {/* Тест ключа */}
          <Button
            variant="secondary"
            className="w-full"
            onClick={onTestKey}
            disabled={testingKey || !apiKey.trim()}
          >
            {testingKey ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Проверка подключения к API...
              </>
            ) : (
              "Проверить ключ и подключение"
            )}
          </Button>

          {testResult && (
            <div
              className={`text-sm rounded-md p-3 border ${
                testResult.valid
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                  : "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300"
              }`}
            >
              {testResult.message}
            </div>
          )}

          <div className="rounded-md bg-muted/50 p-3 text-xs space-y-1">
            <div className="font-medium text-foreground">Параметры подключения:</div>
            <div>
              • Эндпоинт: <code className="text-[10px]">{baseURL}</code>
            </div>
            <div>
              • Кеширование:{" "}
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                97% скидка на повторные токены контекста
              </span>
            </div>
            <div>
              • Формат запросов: OpenAI-compatible <code>/chat/completions</code>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={onClose}>Сохранить</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
