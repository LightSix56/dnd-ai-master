"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { validateCharacterForRoom } from "@/lib/room/validation";
import { User, Loader2, Shield, Heart, Sparkles, X, Check } from "lucide-react";

export interface FormattedCharacterCard {
  id: string;
  name: string;
  level: number;
  className: string;
  race: string;
  subclass?: string;
  portraitUrl?: string | null;
  hpMax?: number;
  armorClass?: number;
  rawSnapshot: Record<string, unknown>;
  isSelectable: boolean;
  reason?: string;
}

export function formatCharacterCardForPicker(
  raw: Record<string, any>,
  startingLevel: number
): FormattedCharacterCard {
  const data = typeof raw.data === "object" && raw.data !== null ? raw.data : {};
  const name = (raw.name || data.name || "Безымянный").trim();
  const level =
    typeof raw.level === "number"
      ? raw.level
      : typeof data.level === "number"
      ? data.level
      : 1;

  const className = data.class || data.className || raw.class || "Приключенец";
  const race = data.race || raw.race || "Гуманоид";
  const subclass = data.subclass || raw.subclass;
  const portraitUrl = raw.portrait_url || data.portraitUrl || null;
  const hpMax = data.hpMax ?? data.maxHp;
  const armorClass = data.armorClass ?? data.calculatedAC ?? data.ac;

  const validation = validateCharacterForRoom({ name, level }, startingLevel);

  return {
    id: raw.id || `char-${Math.random()}`,
    name,
    level,
    className,
    race,
    subclass,
    portraitUrl,
    hpMax,
    armorClass,
    rawSnapshot: {
      id: raw.id,
      name,
      level,
      className,
      race,
      subclass,
      portraitUrl,
      hpMax,
      armorClass,
      data,
    },
    isSelectable: validation.valid,
    reason: validation.error,
  };
}

interface CharacterPickerModalProps {
  isOpen: boolean;
  roomCode: string;
  startingLevel: number;
  onSelect: (selected: FormattedCharacterCard) => void;
  onClose: () => void;
}

export function CharacterPickerModal({
  isOpen,
  roomCode,
  startingLevel,
  onSelect,
  onClose,
}: CharacterPickerModalProps) {
  const { user, getAuthToken } = useSupabaseAuth();
  const [cards, setCards] = useState<FormattedCharacterCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const fetchCharacters = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/room/user-characters?startingLevel=${startingLevel}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Не удалось загрузить персонажей");
      }

      const json = await res.json();
      const allRaw = [...(json.compliant || []), ...(json.nonCompliant || [])];
      const formatted = allRaw.map((raw) => formatCharacterCardForPicker(raw, startingLevel));
      setCards(formatted);
    } catch (err: any) {
      setError(err?.message || "Ошибка загрузки списка персонажей");
    } finally {
      setLoading(false);
    }
  }, [user, getAuthToken, startingLevel]);

  useEffect(() => {
    if (isOpen && user) {
      fetchCharacters();
    }
  }, [isOpen, user, fetchCharacters]);

  if (!isOpen) return null;

  async function handleSelectCharacter(card: FormattedCharacterCard) {
    if (!card.isSelectable) return;
    setSubmittingId(card.id);
    setError(null);

    try {
      const token = getAuthToken();
      const res = await fetch(`/api/room/${encodeURIComponent(roomCode)}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          characterSnapshot: card.rawSnapshot,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Не удалось присоединиться к комнате");
      }

      onSelect(card);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Ошибка при входе в комнату");
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl text-zinc-950 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 font-sans">
        {/* Кнопка закрытия */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 transition-colors cursor-pointer"
          title="Закрыть"
        >
          <X className="size-4" />
        </button>

        {/* Заголовок */}
        <div className="mb-4 pr-8">
          <div className="flex items-center gap-2">
            <User className="size-5 text-zinc-700 dark:text-zinc-300" />
            <h3 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Выберите персонажа для кампании
            </h3>
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Для этой кампании требуется герой ровно{" "}
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{startingLevel}-го уровня</span>.
          </p>
        </div>

        {/* Ошибка */}
        {error && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Содержимое / Сетка карточек */}
        <div className="flex-1 overflow-y-auto pr-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
              <Loader2 className="size-6 animate-spin" />
              <span className="mt-2 text-xs">Загрузка сохранённых персонажей...</span>
            </div>
          ) : cards.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/30 py-10 text-center">
              <User className="size-8 text-zinc-400 mb-2" />
              <p className="font-medium text-zinc-900 dark:text-zinc-100 text-sm">У вас пока нет сохранённых персонажей</p>
              <p className="mt-1 text-xs text-zinc-500 max-w-sm">
                Создайте персонажа {startingLevel}-го уровня на сайте с листом персонажа, и он появится здесь.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {cards.map((card) => {
                const isJoining = submittingId === card.id;

                return (
                  <div
                    key={card.id}
                    className={`relative flex flex-col rounded-lg border p-3.5 transition-all ${
                      card.isSelectable
                        ? "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-400 dark:hover:border-zinc-600 shadow-xs"
                        : "border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-900/20 opacity-60"
                    }`}
                  >
                    {/* Бейдж уровня */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                          card.isSelectable
                            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        {card.level} ур.
                      </span>

                      {card.isSelectable ? (
                        <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <Check className="size-3" />
                          Подходит
                        </span>
                      ) : (
                        <span className="text-[11px] text-zinc-500">
                          Не подходит
                        </span>
                      )}
                    </div>

                    {/* Имя и класс */}
                    <div className="mt-2.5 flex items-start gap-3">
                      {card.portraitUrl ? (
                        <img
                          src={card.portraitUrl}
                          alt={card.name}
                          className="h-11 w-11 rounded-full border border-zinc-200 dark:border-zinc-700 object-cover shrink-0"
                        />
                      ) : (
                        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 shrink-0">
                          <User className="size-5" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <h4 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {card.name}
                        </h4>
                        <p className="text-xs text-zinc-500 truncate mt-0.5">
                          {card.race} • {card.className}
                          {card.subclass ? ` (${card.subclass})` : ""}
                        </p>
                      </div>
                    </div>

                    {/* Характеристики (ХП, КД) */}
                    <div className="mt-3 flex items-center gap-4 text-xs text-zinc-600 dark:text-zinc-400 border-t border-zinc-100 dark:border-zinc-800 pt-2">
                      {card.hpMax !== undefined && (
                        <div className="flex items-center gap-1" title="Максимальное здоровье">
                          <Heart className="size-3.5 text-zinc-500" />
                          <span className="font-medium text-zinc-800 dark:text-zinc-200">{card.hpMax} HP</span>
                        </div>
                      )}
                      {card.armorClass !== undefined && (
                        <div className="flex items-center gap-1" title="Класс доспеха">
                          <Shield className="size-3.5 text-zinc-500" />
                          <span className="font-medium text-zinc-800 dark:text-zinc-200">{card.armorClass} КД</span>
                        </div>
                      )}
                    </div>

                    {/* Причина недоступности */}
                    {!card.isSelectable && card.reason && (
                      <div className="mt-2 rounded bg-zinc-100 dark:bg-zinc-800/60 p-1.5 text-[11px] text-zinc-600 dark:text-zinc-400 leading-tight">
                        {card.reason}
                      </div>
                    )}

                    {/* Кнопка выбора */}
                    <div className="mt-3 pt-1">
                      <button
                        type="button"
                        disabled={!card.isSelectable || isJoining}
                        onClick={() => handleSelectCharacter(card)}
                        className={`w-full rounded-md border px-3 py-1.5 text-xs font-medium transition-all ${
                          card.isSelectable
                            ? "border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800 active:scale-[0.99] cursor-pointer shadow-xs dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                            : "border-zinc-200 bg-zinc-100 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-500 cursor-not-allowed"
                        }`}
                      >
                        {isJoining ? (
                          <span className="flex items-center justify-center gap-1.5">
                            <Loader2 className="size-3 animate-spin" />
                            Присоединение...
                          </span>
                        ) : (
                          "Выбрать этого героя"
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Футер */}
        <div className="mt-4 flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 pt-3 text-xs text-zinc-500">
          <button
            type="button"
            onClick={fetchCharacters}
            disabled={loading}
            className="hover:text-zinc-900 dark:hover:text-zinc-100 underline cursor-pointer"
          >
            Обновить список
          </button>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 font-medium text-zinc-900 dark:text-zinc-100 hover:underline"
          >
            <Sparkles className="size-3.5" />
            <span>Создать нового персонажа ↗</span>
          </a>
        </div>
      </div>
    </div>
  );
}
