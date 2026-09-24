"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { validateCharacterForRoom } from "@/lib/room/validation";
import { getArchetypeAbilityScores } from "@/lib/dnd/import-character";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  User,
  Loader2,
  Shield,
  Heart,
  Sparkles,
  X,
  Check,
  Plus,
  Swords,
  Users,
} from "lucide-react";
import { toast } from "sonner";

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

export function formatCampaignCharacterForPicker(
  char: {
    id: string;
    name: string;
    race?: string;
    className?: string;
    class?: string;
    subclass?: string;
    level?: number;
    hpCurrent?: number;
    hpMax?: number;
    ac?: number;
    assignedTo?: { userId: string; characterName?: string } | null;
  },
  startingLevel: number,
  currentUserId?: string
): FormattedCharacterCard & { isAssigned: boolean; isOwnedByMe: boolean } {
  const name = (char.name || "Безымянный").trim();
  const level = char.level || startingLevel || 1;
  const className = char.className || char.class || "Приключенец";
  const race = char.race || "Гуманоид";
  const isAssigned = Boolean(char.assignedTo);
  const isOwnedByMe = Boolean(currentUserId && char.assignedTo?.userId === currentUserId);
  const isSelectable = !isAssigned || isOwnedByMe;

  return {
    id: char.id,
    name,
    level,
    className,
    race,
    subclass: char.subclass,
    portraitUrl: null,
    hpMax: char.hpMax,
    armorClass: char.ac,
    rawSnapshot: {
      id: char.id,
      name,
      level,
      className,
      race,
      subclass: char.subclass,
      hpMax: char.hpMax,
      hpCurrent: char.hpCurrent,
      armorClass: char.ac,
      str: (char as any).str,
      dex: (char as any).dex,
      con: (char as any).con,
      int: (char as any).int,
      wis: (char as any).wis,
      cha: (char as any).cha,
      speed: (char as any).speed,
      inventory: (char as any).inventory,
      spells: (char as any).spells,
      notes: (char as any).notes,
    },
    isSelectable,
    reason: isAssigned && !isOwnedByMe ? "Персонаж уже занят другим игроком" : undefined,
    isAssigned,
    isOwnedByMe,
  };
}

export interface CharacterPickerModalProps {
  isOpen: boolean;
  roomCode: string;
  startingLevel: number;
  campaignId?: string;
  onSelect: (selected: FormattedCharacterCard) => void;
  onClose: () => void;
}

const DND_CLASSES = [
  "Воин",
  "Волшебник",
  "Плут",
  "Жрец",
  "Варвар",
  "Следопыт",
  "Паладин",
  "Бард",
  "Друид",
  "Колдун",
  "Монах",
  "Чародей",
];

const DND_RACES = [
  "Человек",
  "Эльф",
  "Дварф",
  "Полурослик",
  "Тифлинг",
  "Драконорождённый",
  "Гном",
  "Полуэльф",
  "Полуорк",
];

function calculateBaseStats(className: string, level: number) {
  let hitDie = 8;
  let baseAc = 12;

  if (className === "Варвар") {
    hitDie = 12;
    baseAc = 14;
  } else if (["Воин", "Паладин", "Следопыт"].includes(className)) {
    hitDie = 10;
    baseAc = 16;
  } else if (["Волшебник", "Чародей"].includes(className)) {
    hitDie = 6;
    baseAc = 11;
  } else if (className === "Плут") {
    hitDie = 8;
    baseAc = 14;
  } else if (["Жрец", "Друид"].includes(className)) {
    hitDie = 8;
    baseAc = 15;
  }

  const scores = getArchetypeAbilityScores(className);
  const conMod = Math.floor((scores.con - 10) / 2);
  const hpMax = hitDie + conMod + Math.max(0, level - 1) * (Math.floor(hitDie / 2) + 1 + conMod);

  return { ...scores, hpMax, ac: baseAc };
}

export function CharacterPickerModal({
  isOpen,
  roomCode,
  startingLevel,
  campaignId: propCampaignId,
  onSelect,
  onClose,
}: CharacterPickerModalProps) {
  const { user, getAuthToken, signInAsGuest } = useSupabaseAuth();
  const [activeTab, setActiveTab] = useState<"campaign" | "account" | "create">("campaign");

  // Персонажи кампании (уже добавленные в отряд)
  const [campaignCharacters, setCampaignCharacters] = useState<
    (FormattedCharacterCard & { isAssigned: boolean; isOwnedByMe: boolean })[]
  >([]);
  const [resolvedCampaignId, setResolvedCampaignId] = useState<string | null>(propCampaignId || null);

  // Личные персонажи из Supabase
  const [accountCards, setAccountCards] = useState<FormattedCharacterCard[]>([]);

  const [loadingCampaign, setLoadingCampaign] = useState(false);
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  // Форма быстрого создания
  const [newName, setNewName] = useState("");
  const [newRace, setNewRace] = useState("Человек");
  const [newClass, setNewClass] = useState("Воин");
  const [creating, setCreating] = useState(false);

  // 1. Загрузка персонажей кампании из комнаты
  const fetchRoomData = useCallback(async () => {
    if (!roomCode) return;
    setLoadingCampaign(true);
    setError(null);
    try {
      const res = await fetch(`/api/room/${encodeURIComponent(roomCode)}`);
      if (res.ok) {
        const data = await res.json();
        const campId =
          data.room?.campaignId ||
          data.room?.campaignSettings?.campaignId ||
          data.room?.campaign_settings?.campaignId;
        if (campId) {
          setResolvedCampaignId(campId);
        }

        const rawChars = Array.isArray(data.campaignCharacters) ? data.campaignCharacters : [];
        const formatted = rawChars.map((c: any) =>
          formatCampaignCharacterForPicker(c, startingLevel, user?.id)
        );
        setCampaignCharacters(formatted);

        // Если в кампании есть готовые персонажи — открываем вкладку кампании
        if (formatted.length > 0) {
          setActiveTab("campaign");
        }
      }
    } catch (e: any) {
      console.warn("Не удалось загрузить персонажей кампании:", e);
    } finally {
      setLoadingCampaign(false);
    }
  }, [roomCode, startingLevel, user?.id]);

  // 2. Загрузка персонажей из аккаунта Supabase
  const fetchAccountCharacters = useCallback(async () => {
    if (!user) return;
    setLoadingAccount(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/room/user-characters?startingLevel=${startingLevel}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (res.ok) {
        const json = await res.json();
        const allRaw = [...(json.compliant || []), ...(json.nonCompliant || [])];
        const formatted = allRaw.map((raw) => formatCharacterCardForPicker(raw, startingLevel));
        setAccountCards(formatted);
      }
    } catch (err: any) {
      console.warn("Ошибка загрузки аккаунт-персонажей:", err);
    } finally {
      setLoadingAccount(false);
    }
  }, [user, getAuthToken, startingLevel]);

  useEffect(() => {
    if (isOpen) {
      fetchRoomData();
      if (user) {
        fetchAccountCharacters();
      }
    }
  }, [isOpen, user, fetchRoomData, fetchAccountCharacters]);

  if (!isOpen) return null;

  // Выбор персонажа (из кампании или из аккаунта)
  async function handleSelectCharacter(card: FormattedCharacterCard) {
    if (!card.isSelectable) return;
    setSubmittingId(card.id);
    setError(null);

    try {
      let token = getAuthToken();
      if (!token) {
        const guestRes = await signInAsGuest(card.name ? `Игрок (${card.name})` : undefined);
        if (guestRes.session?.access_token) {
          token = guestRes.session.access_token;
        } else {
          throw new Error("Не удалось пройти быструю авторизацию для подключения к комнате");
        }
      }

      const res = await fetch(`/api/room/${encodeURIComponent(roomCode)}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          characterId: card.id,
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

  // Быстрое создание нового персонажа
  async function handleCreateAndSelect(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) {
      setError("Укажите имя персонажа");
      return;
    }

    const campId = resolvedCampaignId || propCampaignId;
    if (!campId) {
      setError("Не найден идентификатор кампании комнаты");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const { hpMax, ac, str, dex, con, int, wis, cha } = calculateBaseStats(newClass, startingLevel);

      // 1. Создаем персонажа в кампании
      const createRes = await fetch("/api/character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: campId,
          name: trimmed,
          race: newRace,
          class: newClass,
          level: startingLevel,
          type: "player",
          hpMax,
          hpCurrent: hpMax,
          ac,
          str,
          dex,
          con,
          int,
          wis,
          cha,
        }),
      });

      if (!createRes.ok) {
        const createErr = await createRes.json().catch(() => ({}));
        throw new Error(createErr.error || "Не удалось создать персонажа");
      }

      const createData = await createRes.json();
      const char = createData.character;

      const formattedCard: FormattedCharacterCard = {
        id: char.id,
        name: char.name,
        level: char.level,
        className: char.class,
        race: char.race,
        hpMax: char.hpMax,
        armorClass: char.ac,
        rawSnapshot: {
          id: char.id,
          name: char.name,
          level: char.level,
          className: char.class,
          race: char.race,
          hpMax: char.hpMax,
          hpCurrent: char.hpCurrent,
          armorClass: char.ac,
          str: char.str || str,
          dex: char.dex || dex,
          con: char.con || con,
          int: char.int || int,
          wis: char.wis || wis,
          cha: char.cha || cha,
        },
        isSelectable: true,
      };

      // 2. Сразу присоединяемся к комнате с новым персонажем
      let token = getAuthToken();
      if (!token) {
        const guestRes = await signInAsGuest(trimmed ? `Игрок (${trimmed})` : undefined);
        if (guestRes.session?.access_token) {
          token = guestRes.session.access_token;
        }
      }

      const joinRes = await fetch(`/api/room/${encodeURIComponent(roomCode)}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          characterId: char.id,
          characterSnapshot: formattedCard.rawSnapshot,
        }),
      });

      if (!joinRes.ok) {
        const joinErr = await joinRes.json().catch(() => ({}));
        throw new Error(joinErr.error || "Персонаж создан, но не удалось привязать к комнате");
      }

      toast.success(`Герой ${trimmed} создан и выбран!`);
      onSelect(formattedCard);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Ошибка создания персонажа");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl text-zinc-950 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 font-sans">
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
              Выберите персонажа для игры
            </h3>
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Возьмите одного из подготовленных героев отряда, подключите своего персонажа или создайте нового под уровень стола ({startingLevel} ур.).
          </p>
        </div>

        {/* Ошибка */}
        {error && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Вкладки выбора */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as any)}
          className="flex flex-col flex-1 min-h-0"
        >
          <TabsList className="grid grid-cols-3 w-full mb-3">
            <TabsTrigger value="campaign" className="text-xs gap-1.5 cursor-pointer">
              <Swords className="size-3.5" />
              <span>Герои кампании</span>
              {campaignCharacters.length > 0 && (
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px] ml-0.5">
                  {campaignCharacters.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="account" className="text-xs gap-1.5 cursor-pointer">
              <Users className="size-3.5" />
              <span>Мои персонажи</span>
              {accountCards.length > 0 && (
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px] ml-0.5">
                  {accountCards.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="create" className="text-xs gap-1.5 cursor-pointer">
              <Plus className="size-3.5" />
              <span>Создать нового</span>
            </TabsTrigger>
          </TabsList>

          {/* Вкладка 1: Герои кампании */}
          <TabsContent value="campaign" className="flex-1 overflow-y-auto pr-1 mt-0">
            {loadingCampaign ? (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                <Loader2 className="size-6 animate-spin" />
                <span className="mt-2 text-xs">Загрузка героев кампании...</span>
              </div>
            ) : campaignCharacters.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/30 py-10 text-center px-4">
                <Swords className="size-8 text-zinc-400 mb-2" />
                <p className="font-medium text-zinc-900 dark:text-zinc-100 text-sm">
                  В этой кампании ещё нет добавленных персонажей
                </p>
                <p className="mt-1 text-xs text-zinc-500 max-w-sm">
                  Вы можете выбрать персонажа из своего аккаунта или создать нового героя во вкладках выше.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-4 text-xs gap-1.5"
                  onClick={() => setActiveTab("create")}
                >
                  <Plus className="size-3.5" />
                  Создать нового героя ({startingLevel} ур.)
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {campaignCharacters.map((card) => {
                  const isJoining = submittingId === card.id;

                  return (
                    <div
                      key={card.id}
                      className={`relative flex flex-col rounded-lg border p-3.5 transition-all ${
                        card.isOwnedByMe
                          ? "border-emerald-500/60 bg-emerald-50/30 dark:bg-emerald-950/20 shadow-xs"
                          : card.isSelectable
                          ? "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-400 dark:hover:border-zinc-600 shadow-xs"
                          : "border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-900/20 opacity-60"
                      }`}
                    >
                      {/* Верхняя строка статуса */}
                      <div className="flex items-center justify-between">
                        <span className="rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-2 py-0.5 text-[11px] font-medium">
                          {card.level} ур.
                        </span>

                        {card.isOwnedByMe ? (
                          <Badge
                            variant="outline"
                            className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 text-[11px] gap-1"
                          >
                            <Check className="size-3" />
                            Вы играете
                          </Badge>
                        ) : card.isAssigned ? (
                          <Badge
                            variant="outline"
                            className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 text-[11px]"
                          >
                            Занят игроком
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 text-[11px] gap-1"
                          >
                            <Check className="size-3" />
                            Свободен
                          </Badge>
                        )}
                      </div>

                      {/* Имя и класс */}
                      <div className="mt-2.5 flex items-start gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 shrink-0 font-bold">
                          {card.name.slice(0, 1).toUpperCase()}
                        </div>

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
                          <div className="flex items-center gap-1" title="Здоровье">
                            <Heart className="size-3.5 text-zinc-500" />
                            <span className="font-medium text-zinc-800 dark:text-zinc-200">
                              {card.hpMax} HP
                            </span>
                          </div>
                        )}
                        {card.armorClass !== undefined && (
                          <div className="flex items-center gap-1" title="Класс доспеха">
                            <Shield className="size-3.5 text-zinc-500" />
                            <span className="font-medium text-zinc-800 dark:text-zinc-200">
                              {card.armorClass} КД
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Кнопка действия */}
                      <div className="mt-3 pt-1">
                        <Button
                          type="button"
                          disabled={!card.isSelectable || isJoining}
                          onClick={() => handleSelectCharacter(card)}
                          className="w-full text-xs h-8 cursor-pointer"
                          variant={card.isOwnedByMe ? "outline" : "default"}
                        >
                          {isJoining ? (
                            <span className="flex items-center justify-center gap-1.5">
                              <Loader2 className="size-3 animate-spin" />
                              Подключение...
                            </span>
                          ) : card.isOwnedByMe ? (
                            "Выбран текущим героем ✓"
                          ) : card.isAssigned ? (
                            "Занят другим игроком"
                          ) : (
                            "Играть за этого героя"
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Вкладка 2: Персонажи из аккаунта Supabase */}
          <TabsContent value="account" className="flex-1 overflow-y-auto pr-1 mt-0">
            {loadingAccount ? (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                <Loader2 className="size-6 animate-spin" />
                <span className="mt-2 text-xs">Загрузка сохранённых персонажей...</span>
              </div>
            ) : accountCards.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/30 py-10 text-center px-4">
                <User className="size-8 text-zinc-400 mb-2" />
                <p className="font-medium text-zinc-900 dark:text-zinc-100 text-sm">
                  У вас пока нет сохранённых персонажей
                </p>
                <p className="mt-1 text-xs text-zinc-500 max-w-sm">
                  Вы можете быстро создать нового героя во вкладке «Создать нового» или выбрать свободного персонажа кампании.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-4 text-xs gap-1.5"
                  onClick={() => setActiveTab("create")}
                >
                  <Plus className="size-3.5" />
                  Создать нового героя ({startingLevel} ур.)
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {accountCards.map((card) => {
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
                          <span className="text-[11px] text-zinc-500">Не подходит</span>
                        )}
                      </div>

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

                      <div className="mt-3 flex items-center gap-4 text-xs text-zinc-600 dark:text-zinc-400 border-t border-zinc-100 dark:border-zinc-800 pt-2">
                        {card.hpMax !== undefined && (
                          <div className="flex items-center gap-1" title="Максимальное здоровье">
                            <Heart className="size-3.5 text-zinc-500" />
                            <span className="font-medium text-zinc-800 dark:text-zinc-200">
                              {card.hpMax} HP
                            </span>
                          </div>
                        )}
                        {card.armorClass !== undefined && (
                          <div className="flex items-center gap-1" title="Класс доспеха">
                            <Shield className="size-3.5 text-zinc-500" />
                            <span className="font-medium text-zinc-800 dark:text-zinc-200">
                              {card.armorClass} КД
                            </span>
                          </div>
                        )}
                      </div>

                      {!card.isSelectable && card.reason && (
                        <div className="mt-2 rounded bg-zinc-100 dark:bg-zinc-800/60 p-1.5 text-[11px] text-zinc-600 dark:text-zinc-400 leading-tight">
                          {card.reason}
                        </div>
                      )}

                      <div className="mt-3 pt-1">
                        <Button
                          type="button"
                          disabled={!card.isSelectable || isJoining}
                          onClick={() => handleSelectCharacter(card)}
                          className="w-full text-xs h-8 cursor-pointer"
                        >
                          {isJoining ? (
                            <span className="flex items-center justify-center gap-1.5">
                              <Loader2 className="size-3 animate-spin" />
                              Подключение...
                            </span>
                          ) : (
                            "Выбрать этого героя"
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Вкладка 3: Создать нового героя */}
          <TabsContent value="create" className="flex-1 overflow-y-auto pr-1 mt-0">
            <form onSubmit={handleCreateAndSelect} className="space-y-4 py-2">
              <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm">Быстрое создание персонажа</div>
                  <Badge variant="outline" className="text-xs">
                    {startingLevel} уровень
                  </Badge>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="char-name" className="text-xs">
                    Имя героя *
                  </Label>
                  <Input
                    id="char-name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Например: Торин, Лира, Эдвин..."
                    className="h-8 text-sm"
                    autoFocus
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="char-race" className="text-xs">
                      Раса
                    </Label>
                    <Select value={newRace} onValueChange={setNewRace}>
                      <SelectTrigger id="char-race" className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DND_RACES.map((r) => (
                          <SelectItem key={r} value={r} className="text-xs">
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="char-class" className="text-xs">
                      Класс
                    </Label>
                    <Select value={newClass} onValueChange={setNewClass}>
                      <SelectTrigger id="char-class" className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DND_CLASSES.map((c) => (
                          <SelectItem key={c} value={c} className="text-xs">
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Персонаж будет автоматически добавлен в кампанию со сбалансированными характеристиками D&D 5e под {startingLevel}-й уровень стола и сразу закреплен за вами.
                </p>
              </div>

              <Button
                type="submit"
                disabled={creating || !newName.trim()}
                className="w-full text-xs h-9 gap-1.5 cursor-pointer"
              >
                {creating ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="size-3.5 animate-spin" />
                    Создание и подключение...
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="size-3.5" />
                    Создать и играть за {newName.trim() || "героя"}
                  </span>
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        {/* Футер */}
        <div className="mt-4 flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 pt-3 text-xs text-zinc-500">
          <button
            type="button"
            onClick={() => {
              fetchRoomData();
              if (user) fetchAccountCharacters();
            }}
            disabled={loadingCampaign || loadingAccount}
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
            <span>Генератор персонажей ↗</span>
          </a>
        </div>
      </div>
    </div>
  );
}
