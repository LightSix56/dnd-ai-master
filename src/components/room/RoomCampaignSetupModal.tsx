"use client";

import React, { useState } from "react";
import type { Room, RoomParticipant } from "@/lib/room/types";
import type { StartingSituation } from "@/lib/ai/party-arc-generator";
import { Crown, Sparkles, CheckCircle2, X, BookOpen, Loader2 } from "lucide-react";

export interface CampaignSetupFormValues {
  title: string;
  setting: string;
  tone: string;
  difficulty: "easy" | "normal" | "hard" | "brutal";
  startingSituation: StartingSituation;
  levelTo?: number;
  customDmNotes?: string;
}

export function validateCampaignSetupInput(input: Partial<CampaignSetupFormValues>): {
  isValid: boolean;
  error?: string;
} {
  if (!input.title || !input.title.trim()) {
    return { isValid: false, error: "Укажите название кампании" };
  }
  if (!input.setting || !input.setting.trim()) {
    return { isValid: false, error: "Укажите сеттинг или жанр приключения" };
  }
  return { isValid: true };
}

interface RoomCampaignSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room;
  participants: RoomParticipant[];
  onStartCampaign: (values: CampaignSetupFormValues) => Promise<void>;
  isGenerating?: boolean;
}

const SETTING_PRESETS = [
  "Тёмное фэнтези",
  "Высокое фэнтези",
  "Готический хоррор",
  "Подземелья и древние руины",
  "Морские приключения",
  "Городские интриги и детектив",
];

const DIFFICULTY_OPTIONS: Array<{
  key: "easy" | "normal" | "hard" | "brutal";
  label: string;
  dist: string;
  desc: string;
}> = [
  {
    key: "easy",
    label: "Легкая",
    dist: "60% Easy / 30% Med / 10% Hard",
    desc: "Бои прощают ошибки, герои чувствуют силу",
  },
  {
    key: "normal",
    label: "Сбалансированная",
    dist: "50% Med / 30% Hard / 20% Deadly",
    desc: "Каноничные правила D&D 5e (DMG p. 82)",
  },
  {
    key: "hard",
    label: "Сложная",
    dist: "40% Hard / 40% Deadly / 20% Med",
    desc: "Высокий риск гибели, упор на тактику и ресурсы",
  },
  {
    key: "brutal",
    label: "Хардкор / Брутальная",
    dist: "60% Deadly / 30% Hard / 10% Med",
    desc: "Каждый бой смертелен, боссы с легендарными действиями",
  },
];

const SITUATION_OPTIONS: Array<{
  key: StartingSituation;
  label: string;
  desc: string;
}> = [
  {
    key: "strangers",
    label: "Незнакомцы в беде",
    desc: "Герои не знакомы, общий кризис заставляет их объединиться",
  },
  {
    key: "established_party",
    label: "Слаженный отряд со стажем",
    desc: "Герои уже доверяют друг другу и имеют общее боевое прошлое",
  },
  {
    key: "captives_or_survivors",
    label: "Узники / Выжившие",
    desc: "Старт в плену, в темнице или сразу после катастрофы",
  },
  {
    key: "patron_contract",
    label: "Контракт гильдии или лорда",
    desc: "Отряд нанят влиятельным покровителем для опасного дела",
  },
];

export function RoomCampaignSetupModal({
  isOpen,
  onClose,
  room,
  participants,
  onStartCampaign,
  isGenerating = false,
}: RoomCampaignSetupModalProps) {
  const [title, setTitle] = useState(`${room.name}: Легенда`);
  const [setting, setSetting] = useState("Тёмное фэнтези");
  const [tone, setTone] = useState("Мрачный и напряженный");
  const [difficulty, setDifficulty] = useState<"easy" | "normal" | "hard" | "brutal">("normal");
  const [startingSituation, setStartingSituation] = useState<StartingSituation>("strangers");
  const [levelTo, setLevelTo] = useState<number>(Math.max(room.startingLevel + 4, 10));
  const [customDmNotes, setCustomDmNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validation = validateCampaignSetupInput({
      title,
      setting,
      difficulty,
      startingSituation,
      levelTo,
    });

    if (!validation.isValid) {
      setError(validation.error || "Проверьте правильность заполнения полей");
      return;
    }

    try {
      await onStartCampaign({
        title: title.trim(),
        setting: setting.trim(),
        tone,
        difficulty,
        startingSituation,
        levelTo,
        customDmNotes: customDmNotes.trim() || undefined,
      });
    } catch (err: any) {
      setError(err?.message || "Ошибка при генерации сюжета");
    }
  };

  const readyParticipants = participants.filter((p) => p.isReady && p.characterSnapshot);

  return (
    <div className="fixed inset-0 z-[350] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto font-sans">
      <div className="w-full max-w-2xl rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl text-zinc-950 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 my-8">
        {/* Шапка */}
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-100 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
              <Crown className="size-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                Настройка приключения (Ведущий)
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Генерация Акта 1 с учетом собравшегося состава героев
              </p>
            </div>
          </div>
          {!isGenerating && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 transition-colors cursor-pointer"
              aria-label="Закрыть"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300 flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {isGenerating ? (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <div className="animate-spin text-zinc-800 dark:text-zinc-200 mb-4">
              <Loader2 className="size-8" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Сотворение Акта 1 приключения...</h3>
            <p className="mt-2 text-xs text-zinc-500 max-w-md leading-relaxed">
              ИИ вплетает предыстории и особенности ваших персонажей в первый акт,
              рассчитывает баланс боев и расставляет ключевые вехи.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-sm">
            {/* Готовые герои */}
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-3">
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
                  const snap = p.characterSnapshot as Record<string, any> | null;
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

            {/* Название */}
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Название кампании / Модуля
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="например: Тени над Забытым Храмом"
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-hidden focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                required
              />
            </div>

            {/* Жанр / Сеттинг */}
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Сеттинг и жанр мира
              </label>
              <input
                type="text"
                value={setting}
                onChange={(e) => setSetting(e.target.value)}
                placeholder="Сеттинг или жанр"
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-hidden focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 mb-2"
                required
              />
              <div className="flex flex-wrap gap-1.5">
                {SETTING_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setSetting(preset)}
                    className={`rounded-md border px-2.5 py-1 text-xs transition cursor-pointer ${
                      setting === preset
                        ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 font-medium"
                        : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Сложность боёв */}
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Сложность тактических боев (DMG p. 82)
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {DIFFICULTY_OPTIONS.map((opt) => (
                  <label
                    key={opt.key}
                    className={`flex cursor-pointer flex-col rounded-lg border p-2.5 transition ${
                      difficulty === opt.key
                        ? "border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-900 shadow-xs"
                        : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/50 hover:bg-zinc-50/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="difficulty"
                          value={opt.key}
                          checked={difficulty === opt.key}
                          onChange={() => setDifficulty(opt.key)}
                          className="accent-zinc-900 dark:accent-zinc-100"
                        />
                        <span className="font-medium text-xs text-zinc-900 dark:text-zinc-100">
                          {opt.label}
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-500 font-medium">
                        {opt.dist}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-500 pl-5 leading-tight">{opt.desc}</p>
                  </label>
                ))}
              </div>
            </div>

            {/* Начальная связь отряда */}
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Начальная связь между героями
              </label>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {SITUATION_OPTIONS.map((sit) => (
                  <label
                    key={sit.key}
                    className={`flex cursor-pointer flex-col rounded-lg border p-2 transition text-xs ${
                      startingSituation === sit.key
                        ? "border-zinc-900 bg-zinc-50 font-medium text-zinc-900 dark:border-zinc-100 dark:bg-zinc-900 dark:text-zinc-100"
                        : "border-zinc-200 bg-white text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-300 hover:bg-zinc-50/50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="situation"
                        value={sit.key}
                        checked={startingSituation === sit.key}
                        onChange={() => setStartingSituation(sit.key)}
                        className="accent-zinc-900 dark:accent-zinc-100"
                      />
                      <span>{sit.label}</span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-zinc-500 font-normal pl-5">
                      {sit.desc}
                    </p>
                  </label>
                ))}
              </div>
            </div>

            {/* Тон и максимальный уровень */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Тон истории
                </label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  <option value="Мрачный и напряженный">Мрачный и напряженный</option>
                  <option value="Героический и эпический">Героический и эпический</option>
                  <option value="Мистический детектив">Мистический детектив</option>
                  <option value="Классический D&D">Классический D&D</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Финальный уровень кампании
                </label>
                <select
                  value={levelTo}
                  onChange={(e) => setLevelTo(Number(e.target.value))}
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  <option value={Math.max(room.startingLevel + 2, 3)}>
                    До {Math.max(room.startingLevel + 2, 3)} ур. (Короткий модуль)
                  </option>
                  <option value={Math.max(room.startingLevel + 4, 5)}>
                    До {Math.max(room.startingLevel + 4, 5)} ур. (Стандартный модуль)
                  </option>
                  <option value={10}>До 10 ур. (Эпическое путешествие)</option>
                  <option value={20}>До 20 ур. (Грандиозная кампания)</option>
                </select>
              </div>
            </div>

            {/* Авторские пожелания Человека-ДМа */}
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Авторские заметки и пожелания Ведущего (необязательно)
              </label>
              <textarea
                value={customDmNotes}
                onChange={(e) => setCustomDmNotes(e.target.value)}
                placeholder="Например: хочу встретить старого знакомого жреца в таверне, а в конце акта сделать бой с некромантом в склепе..."
                rows={2}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-hidden focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>

            {/* Кнопки */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="rounded-md bg-zinc-900 px-5 py-2 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <BookOpen className="size-4" />
                <span>Сотворить Акт 1 приключения</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
