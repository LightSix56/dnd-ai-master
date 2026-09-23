"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Package,
  FlaskConical,
  Shield,
  Heart,
  Plus,
  Loader2,
  Sparkles,
  Info,
  Clock,
  Coins,
} from "lucide-react";
import type { Character } from "@/lib/store";
import { useDnDStore } from "@/lib/store";
import { rollDice } from "@/lib/dnd/dice";
import { toast } from "sonner";

export interface InventoryPotion {
  id: string;
  name: string;
  nameEn?: string;
  type: "heal" | "buff" | "utility";
  rarity?: "обычное" | "необычное" | "редкое" | "очень редкое" | "легендарное" | "артефакт" | string;
  quantity: number;
  formula?: string;
  tempHp?: number;
  buffApplied?: string;
  effectSummary: string;
  description?: string;
  actionCost?: string;
}

export interface InventoryGear {
  id: string;
  name: string;
  quantity: number;
  unit?: string;
  description?: string;
}

export interface CharacterInventoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  character: Character;
  onCharacterUpdated?: (updated: Character) => void;
}

export const POPULAR_POTIONS: Array<Omit<InventoryPotion, "quantity"> & { cost?: string }> = [
  {
    id: "potion-healing",
    name: "Зелье лечения",
    nameEn: "Potion of Healing",
    type: "heal",
    rarity: "обычное",
    formula: "2d4+2",
    effectSummary: "Восстанавливает 2d4+2 хитов",
    description: "Мерцающая красная жидкость. Выпив это зелье, вы восстанавливаете 2d4 + 2 хитов.",
    cost: "50 зм",
    actionCost: "bonus_action",
  },
  {
    id: "potion-greater-healing",
    name: "Большее зелье лечения",
    nameEn: "Potion of Greater Healing",
    type: "heal",
    rarity: "необычное",
    formula: "4d4+4",
    effectSummary: "Восстанавливает 4d4+4 хитов",
    description: "Выпив это зелье, вы восстанавливаете 4d4 + 4 хитов.",
    cost: "150 зм",
    actionCost: "bonus_action",
  },
  {
    id: "potion-heroism",
    name: "Зелье героизма",
    nameEn: "Potion of Heroism",
    type: "buff",
    rarity: "редкое",
    tempHp: 10,
    buffApplied: "Героизм (+10 темп HP + Благословение)",
    effectSummary: "+10 временных HP и эффект заклинания «Благословение» на 1 час",
    description: "Вы получаете 10 временных хитов на 1 час и преимущество заклинания «Благословение» (не требует концентрации).",
    cost: "500 зм",
    actionCost: "bonus_action",
  },
  {
    id: "potion-speed",
    name: "Зелье скорости",
    nameEn: "Potion of Speed",
    type: "buff",
    rarity: "очень редкое",
    buffApplied: "Ускорение (Haste)",
    effectSummary: "Эффект заклинания «Ускорение» (Haste) на 1 минуту без концентрации",
    description: "Жёлтая жидкость с прожилками света постоянно бурлит. Дает эффект заклинания «Ускорение» на 1 минуту без концентрации.",
    cost: "2500 зм",
    actionCost: "bonus_action",
  },
  {
    id: "potion-superior-healing",
    name: "Отличное зелье лечения",
    nameEn: "Potion of Superior Healing",
    type: "heal",
    rarity: "редкое",
    formula: "8d4+8",
    effectSummary: "Восстанавливает 8d4+8 хитов",
    description: "Выпив это зелье, вы восстанавливаете 8d4 + 8 хитов.",
    cost: "450 зм",
    actionCost: "bonus_action",
  },
  {
    id: "potion-supreme-healing",
    name: "Превосходное зелье лечения",
    nameEn: "Potion of Supreme Healing",
    type: "heal",
    rarity: "очень редкое",
    formula: "10d4+20",
    effectSummary: "Восстанавливает 10d4+20 хитов",
    description: "Выпив это зелье, вы восстанавливаете 10d4 + 20 хитов.",
    cost: "1350 зм",
    actionCost: "bonus_action",
  },
  {
    id: "potion-invisibility",
    name: "Зелье невидимости",
    nameEn: "Potion of Invisibility",
    type: "utility",
    rarity: "очень редкое",
    buffApplied: "Невидимость",
    effectSummary: "Невидимость на 1 час (или до атаки / сотворения заклинания)",
    description: "Вы становитесь невидимым на 1 час. Все переносимое снаряжение становится невидимым вместе с вами.",
    cost: "2500 зм",
    actionCost: "bonus_action",
  },
  {
    id: "potion-flying",
    name: "Зелье полёта",
    nameEn: "Potion of Flying",
    type: "utility",
    rarity: "очень редкое",
    buffApplied: "Полёт",
    effectSummary: "Скорость полёта равна вашей скорости перемещения на 1 час",
    description: "Прозрачная жидкость, в которой кружится белое перо. Дарует скорость полета на 1 час.",
    cost: "2500 зм",
    actionCost: "bonus_action",
  },
];

const rarityStyles: Record<string, string> = {
  обычное: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/25",
  необычное: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25",
  редкое: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25",
  "очень редкое": "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/25",
  легендарное: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 font-semibold",
  артефакт: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 font-semibold",
};

const typeStyles: Record<string, { label: string; badge: string }> = {
  heal: {
    label: "Исцеление",
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  },
  buff: {
    label: "Усиление",
    badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  },
  utility: {
    label: "Полезное",
    badge: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  },
};

function createUniqueId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function getSyncTimestamp(): number {
  return Date.now();
}

function parseInventory(
  raw: string | null | undefined,
  isPlayer: boolean
): { potions: InventoryPotion[]; gear: InventoryGear[] } {
  const potions: InventoryPotion[] = [];
  const gear: InventoryGear[] = [];

  if (raw && typeof raw === "string" && raw.trim() !== "") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (!item) continue;
          if (typeof item === "string") {
            const lower = item.toLowerCase();
            if (
              lower.includes("зелье") ||
              lower.includes("эликсир") ||
              lower.includes("potion") ||
              lower.includes("elixir")
            ) {
              const match = POPULAR_POTIONS.find(
                (p) =>
                  lower.includes(p.name.toLowerCase()) ||
                  (p.nameEn && lower.includes(p.nameEn.toLowerCase()))
              );
              const qtyMatch = item.match(/[xх(]\s*(\d+)/i);
              const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;

              if (match) {
                potions.push({
                  ...match,
                  id: createUniqueId("potion"),
                  quantity: qty,
                });
              } else {
                const formulaMatch = item.match(/(\d+d\d+(?:\s*[+-]\s*\d+)?)/i);
                potions.push({
                  id: createUniqueId("potion"),
                  name: item.replace(/\s*[xх(]\s*\d+.*$/i, "").trim(),
                  type: formulaMatch ? "heal" : "utility",
                  rarity: "обычное",
                  quantity: qty,
                  formula: formulaMatch ? formulaMatch[1].replace(/\s+/g, "") : undefined,
                  effectSummary: formulaMatch
                    ? `Восстанавливает ${formulaMatch[1]} HP`
                    : "Особый эффект",
                  actionCost: "bonus_action",
                });
              }
            } else {
              gear.push({
                id: createUniqueId("gear"),
                name: item,
                quantity: 1,
                unit: "шт.",
              });
            }
          } else if (typeof item === "object") {
            const isPotion =
              item.type === "heal" ||
              item.type === "buff" ||
              item.type === "utility" ||
              item.category === "potion" ||
              item.category === "зелье" ||
              Boolean(item.formula) ||
              Boolean(item.potionType) ||
              (typeof item.name === "string" && /зелье|эликсир|potion/i.test(item.name));

            if (isPotion) {
              const pType: "heal" | "buff" | "utility" =
                item.type === "heal" || item.type === "buff" || item.type === "utility"
                  ? item.type
                  : item.potionType === "heal" ||
                    item.potionType === "buff" ||
                    item.potionType === "utility"
                  ? item.potionType
                  : item.formula
                  ? "heal"
                  : item.tempHp
                  ? "buff"
                  : "utility";

              potions.push({
                id: item.id || createUniqueId("potion"),
                name: item.name || "Зелье",
                nameEn: item.nameEn,
                type: pType,
                rarity: item.rarity || "обычное",
                quantity:
                  typeof item.quantity === "number" && item.quantity > 0 ? item.quantity : 1,
                formula: item.formula,
                tempHp: item.tempHp,
                buffApplied: item.buffApplied,
                effectSummary:
                  item.effectSummary ||
                  item.description ||
                  (item.formula
                    ? `Восстанавливает ${item.formula} HP`
                    : item.tempHp
                    ? `+${item.tempHp} темп HP`
                    : "Особый эффект"),
                description: item.description || item.effectSummary || "",
                actionCost: item.actionCost || "bonus_action",
              });
            } else {
              gear.push({
                id: item.id || createUniqueId("gear"),
                name: item.name || "Предмет",
                quantity:
                  typeof item.quantity === "number" && item.quantity > 0 ? item.quantity : 1,
                unit: item.unit || "шт.",
                description: item.description || "",
              });
            }
          }
        }
      }
    } catch {
      // Игнорируем синтаксические ошибки невалидного JSON
    }
  }

  // Если у персонажа игрока инвентарь пуст, предоставить 2 стартовых «Зелья лечения» (2d4+2)
  if (isPlayer && potions.length === 0) {
    potions.push({
      id: "potion-healing-starter",
      name: "Зелье лечения",
      nameEn: "Potion of Healing",
      type: "heal",
      rarity: "обычное",
      quantity: 2,
      formula: "2d4+2",
      effectSummary: "Восстанавливает 2d4+2 хитов",
      description: "Мерцающая красная жидкость. Выпив это зелье, вы восстанавливаете 2d4 + 2 хитов.",
      actionCost: "bonus_action",
    });
  }

  return { potions, gear };
}

export function CharacterInventoryModal({
  open,
  onOpenChange,
  character,
  onCharacterUpdated,
}: CharacterInventoryModalProps) {
  const [currentChar, setCurrentChar] = useState<Character>(character);
  const [potions, setPotions] = useState<InventoryPotion[]>([]);
  const [gear, setGear] = useState<InventoryGear[]>([]);
  const [activeTab, setActiveTab] = useState<string>("potions");
  const [isDrinking, setIsDrinking] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState<string | null>(null);

  // Синхронизация при открытии модального окна или изменении входящего персонажа
  useEffect(() => {
    setCurrentChar(character);
    const { potions: parsedPotions, gear: parsedGear } = parseInventory(
      character.inventory,
      character.type === "player"
    );
    setPotions(parsedPotions);
    setGear(parsedGear);
  }, [character, open]);

  const isPlayer = currentChar.type === "player";
  const hpPct = currentChar.hpMax > 0 ? (currentChar.hpCurrent / currentChar.hpMax) * 100 : 0;
  const hpColor = hpPct > 60 ? "bg-emerald-500" : hpPct > 30 ? "bg-amber-500" : "bg-red-500";

  const totalPotionsCount = useMemo(() => {
    return potions.reduce((acc, p) => acc + p.quantity, 0);
  }, [potions]);

  // Логика употребления зелья вне боя
  async function handleDrinkPotion(potion: InventoryPotion) {
    if (potion.quantity <= 0 || isDrinking) return;
    setIsDrinking(potion.id);

    try {
      let rolledHp = 0;
      if (potion.formula) {
        try {
          const roll = rollDice(potion.formula);
          rolledHp = Math.max(1, roll.total);
        } catch {
          rolledHp = 5;
        }
      }

      const newHp = Math.min(currentChar.hpMax, currentChar.hpCurrent + rolledHp);
      const newTempHp = potion.tempHp
        ? Math.max(currentChar.hpTemp || 0, potion.tempHp)
        : currentChar.hpTemp || 0;

      // Уменьшаем количество зелья на 1
      const updatedPotions = potions
        .map((p) => {
          if (p.id === potion.id) {
            return { ...p, quantity: p.quantity - 1 };
          }
          return p;
        })
        .filter((p) => p.quantity > 0);

      const updatedInventory = [...updatedPotions, ...gear];

      const updatedCharacter: Character = {
        ...currentChar,
        hpCurrent: newHp,
        hpTemp: newTempHp,
        inventory: JSON.stringify(updatedInventory),
      };

      // 1. Отправка запроса на бэкенд
      const res = await fetch("/api/character", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: currentChar.id,
          hpCurrent: newHp,
          hpTemp: newTempHp,
          inventory: updatedInventory,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Не удалось обновить персонажа на сервере");
      }

      // 2. Оповещение через BroadcastChannel
      if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
        try {
          const channel = new BroadcastChannel("dnd5e_character_sync");
          channel.postMessage({
            type: "CHARACTER_SHEET_UPDATED",
            character: updatedCharacter,
            timestamp: getSyncTimestamp(),
          });
          channel.close();
        } catch (bcError) {
          console.warn("BroadcastChannel sync error:", bcError);
        }
      }

      // 3. Обновление локального стейта и глобального хранилища
      setCurrentChar(updatedCharacter);
      setPotions(updatedPotions);

      useDnDStore.getState().setCharacters(
        useDnDStore
          .getState()
          .characters.map((c) => (c.id === updatedCharacter.id ? updatedCharacter : c))
      );

      // 4. Колбэк обновления
      onCharacterUpdated?.(updatedCharacter);

      // 5. Уведомление пользователя
      if (rolledHp > 0) {
        toast.success(
          `Выпито «${potion.name}»: +${rolledHp} HP! (${newHp}/${currentChar.hpMax})`
        );
      } else if (potion.tempHp) {
        toast.success(
          `Выпито «${potion.name}»: +${potion.tempHp} темп. HP!`
        );
      } else {
        toast.success(`Выпито «${potion.name}»! ${potion.effectSummary}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Не удалось выпить зелье";
      toast.error(`Ошибка: ${msg}`);
    } finally {
      setIsDrinking(null);
    }
  }

  // Быстрое добавление официальных зелий
  async function handleAddPotion(preset: Omit<InventoryPotion, "quantity"> & { cost?: string }) {
    if (isAdding) return;
    setIsAdding(preset.id);

    try {
      let updatedPotions: InventoryPotion[];
      const existingIdx = potions.findIndex(
        (p) => p.name.toLowerCase() === preset.name.toLowerCase()
      );

      if (existingIdx >= 0) {
        updatedPotions = potions.map((p, idx) =>
          idx === existingIdx ? { ...p, quantity: p.quantity + 1 } : p
        );
      } else {
        const newPotion: InventoryPotion = {
          ...preset,
          id: createUniqueId("potion"),
          quantity: 1,
        };
        updatedPotions = [newPotion, ...potions];
      }

      const updatedInventory = [...updatedPotions, ...gear];

      const updatedCharacter: Character = {
        ...currentChar,
        inventory: JSON.stringify(updatedInventory),
      };

      // Сохранение в БД
      const res = await fetch("/api/character", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: currentChar.id,
          inventory: updatedInventory,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Не удалось сохранить инвентарь");
      }

      // BroadcastChannel
      if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
        try {
          const channel = new BroadcastChannel("dnd5e_character_sync");
          channel.postMessage({
            type: "CHARACTER_SHEET_UPDATED",
            character: updatedCharacter,
            timestamp: getSyncTimestamp(),
          });
          channel.close();
        } catch (bcError) {
          console.warn("BroadcastChannel sync error:", bcError);
        }
      }

      setCurrentChar(updatedCharacter);
      setPotions(updatedPotions);

      useDnDStore.getState().setCharacters(
        useDnDStore
          .getState()
          .characters.map((c) => (c.id === updatedCharacter.id ? updatedCharacter : c))
      );

      onCharacterUpdated?.(updatedCharacter);

      const count =
        existingIdx >= 0 ? updatedPotions[existingIdx].quantity : 1;
      toast.success(`Добавлено «${preset.name}» (x${count}) в инвентарь!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Не удалось добавить зелье";
      toast.error(`Ошибка: ${msg}`);
    } finally {
      setIsAdding(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col p-5 gap-3">
        <DialogHeader className="pb-1">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-semibold">
              <div className="size-8 rounded-lg bg-gradient-to-br from-amber-600 to-amber-700 flex items-center justify-center text-white shadow-sm shrink-0">
                <Package className="size-4" />
              </div>
              <span className="truncate">Инвентарь: {currentChar.name}</span>
            </DialogTitle>
            <Badge variant="outline" className="text-xs shrink-0 font-medium">
              {[currentChar.race, currentChar.class, isPlayer ? `${currentChar.level} ур.` : null]
                .filter(Boolean)
                .join(" • ")}
            </Badge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Управление походным снаряжением, лечебными эликсирами и зельями усиления.
          </DialogDescription>
        </DialogHeader>

        {/* Индикатор здоровья (HP / Temp HP) */}
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border/50 text-xs">
          <div className="flex items-center gap-2">
            <Heart className="size-4 text-rose-500 shrink-0" />
            <span className="text-muted-foreground font-medium">Хиты:</span>
            <span className="font-mono font-bold text-foreground">
              {currentChar.hpCurrent} / {currentChar.hpMax}
            </span>
            {Boolean(currentChar.hpTemp && currentChar.hpTemp > 0) && (
              <Badge
                variant="outline"
                className="text-[10px] text-blue-600 dark:text-blue-400 border-blue-500/30 font-mono py-0 h-4"
              >
                +{currentChar.hpTemp} темп.
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Progress value={hpPct} className="w-24 sm:w-32 h-2" indicatorClassName={hpColor} />
            <span className="font-mono text-[11px] text-muted-foreground w-8 text-right">
              {Math.round(hpPct)}%
            </span>
          </div>
        </div>

        {/* Вкладки модального окна */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col min-h-0"
        >
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="potions" className="text-xs flex items-center gap-1.5 py-1.5">
              <FlaskConical className="size-3.5 text-amber-500" />
              <span>Зелья ({totalPotionsCount})</span>
            </TabsTrigger>
            <TabsTrigger value="gear" className="text-xs flex items-center gap-1.5 py-1.5">
              <Package className="size-3.5 text-muted-foreground" />
              <span>Снаряжение ({gear.length})</span>
            </TabsTrigger>
            <TabsTrigger value="add" className="text-xs flex items-center gap-1.5 py-1.5">
              <Plus className="size-3.5 text-emerald-500" />
              <span>Добавить зелье</span>
            </TabsTrigger>
          </TabsList>

          {/* 🧪 ВКЛАДКА 1: ЗЕЛЬЯ */}
          <TabsContent value="potions" className="flex-1 mt-2 min-h-0">
            <ScrollArea className="h-[48vh] pr-3">
              {potions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground border border-dashed rounded-lg space-y-2">
                  <FlaskConical className="size-8 text-muted-foreground/50" />
                  <p className="text-sm font-medium">Нет зелий в инвентаре</p>
                  <p className="text-xs text-muted-foreground/80 max-w-xs">
                    Перейдите на вкладку «Добавить зелье», чтобы пополнить запасы эликсиров.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 text-xs"
                    onClick={() => setActiveTab("add")}
                  >
                    <Plus className="size-3.5 mr-1 text-emerald-500" /> Пополнить зелья
                  </Button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {potions.map((potion) => {
                    const tStyle = typeStyles[potion.type] || typeStyles.utility;
                    const rStyle = rarityStyles[potion.rarity || "обычное"] || rarityStyles.обычное;
                    const drinkingThis = isDrinking === potion.id;

                    return (
                      <div
                        key={potion.id}
                        className="rounded-lg border border-border/60 bg-card p-3 shadow-xs transition-all hover:border-amber-500/30 flex flex-col gap-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-sm leading-tight text-foreground">
                                {potion.name}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 h-4 ${tStyle.badge}`}
                              >
                                {tStyle.label}
                              </Badge>
                              {potion.rarity && (
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-1.5 py-0 h-4 ${rStyle}`}
                                >
                                  {potion.rarity}
                                </Badge>
                              )}
                              <Badge
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0 h-4 font-mono font-bold"
                              >
                                x{potion.quantity}
                              </Badge>
                            </div>
                            <p className="text-xs text-amber-700 dark:text-amber-300/90 font-medium">
                              {potion.effectSummary}
                            </p>
                          </div>

                          {/* Кнопка «Выпить зелье» */}
                          <Button
                            size="sm"
                            className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8 px-3 shrink-0 shadow-xs cursor-pointer"
                            disabled={drinkingThis || !!isDrinking}
                            onClick={() => handleDrinkPotion(potion)}
                          >
                            {drinkingThis ? (
                              <Loader2 className="size-3.5 animate-spin mr-1" />
                            ) : (
                              <Sparkles className="size-3.5 mr-1" />
                            )}
                            Выпить
                          </Button>
                        </div>

                        {potion.description && potion.description !== potion.effectSummary && (
                          <p className="text-[11px] text-muted-foreground leading-relaxed border-t border-border/30 pt-1.5">
                            {potion.description}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* 📦 ВКЛАДКА 2: СНАРЯЖЕНИЕ */}
          <TabsContent value="gear" className="flex-1 mt-2 min-h-0">
            <ScrollArea className="h-[48vh] pr-3">
              {gear.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground border border-dashed rounded-lg space-y-2">
                  <Package className="size-8 text-muted-foreground/50" />
                  <p className="text-sm font-medium">Снаряжение не найдено</p>
                  <p className="text-xs text-muted-foreground/80 max-w-xs">
                    Инвентарь походного снаряжения персонажа пока пуст.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/40 rounded-lg border border-border/60 bg-card overflow-hidden">
                  {gear.map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 flex items-center justify-between gap-3 text-xs hover:bg-muted/30 transition-colors"
                    >
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="font-medium text-foreground truncate">{item.name}</div>
                        {item.description && (
                          <div className="text-[11px] text-muted-foreground line-clamp-1">
                            {item.description}
                          </div>
                        )}
                      </div>
                      <Badge variant="outline" className="font-mono text-[11px] shrink-0">
                        {item.quantity} {item.unit || "шт."}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* ➕ ВКЛАДКА 3: БЫСТРОЕ ДОБАВЛЕНИЕ ОФИЦИАЛЬНЫХ ЗЕЛИЙ */}
          <TabsContent value="add" className="flex-1 mt-2 min-h-0">
            <ScrollArea className="h-[48vh] pr-3">
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-900 dark:text-amber-200">
                  <Info className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>
                    Нажмите «+ В инвентарь», чтобы мгновенно добавить зелье из официального компендиума D&D 5e.
                  </span>
                </div>

                {POPULAR_POTIONS.map((preset) => {
                  const tStyle = typeStyles[preset.type] || typeStyles.utility;
                  const rStyle = rarityStyles[preset.rarity || "обычное"] || rarityStyles.обычное;
                  const addingThis = isAdding === preset.id;
                  const alreadyHave = potions.find(
                    (p) => p.name.toLowerCase() === preset.name.toLowerCase()
                  );

                  return (
                    <div
                      key={preset.id}
                      className="rounded-lg border border-border/60 bg-card p-3 shadow-xs transition-all hover:border-border flex flex-col gap-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-sm leading-tight text-foreground">
                              {preset.name}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 h-4 ${tStyle.badge}`}
                            >
                              {tStyle.label}
                            </Badge>
                            {preset.rarity && (
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 h-4 ${rStyle}`}
                              >
                                {preset.rarity}
                              </Badge>
                            )}
                            {alreadyHave && (
                              <Badge
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0 h-4 font-mono text-emerald-600 dark:text-emerald-400"
                              >
                                В наличии: x{alreadyHave.quantity}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                            {preset.effectSummary}
                          </p>
                        </div>

                        {/* Кнопка добавления */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs h-8 px-2.5 shrink-0 cursor-pointer"
                          disabled={addingThis || !!isAdding}
                          onClick={() => handleAddPotion(preset)}
                        >
                          {addingThis ? (
                            <Loader2 className="size-3.5 animate-spin mr-1" />
                          ) : (
                            <Plus className="size-3.5 mr-1" />
                          )}
                          + В инвентарь
                        </Button>
                      </div>

                      <p className="text-[11px] text-muted-foreground leading-relaxed border-t border-border/30 pt-1.5">
                        {preset.description}
                      </p>

                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-0.5">
                        {preset.cost && (
                          <span className="flex items-center gap-1">
                            <Coins className="size-3 text-amber-500" />
                            {preset.cost}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="size-3 text-muted-foreground" />
                          Бонусное действие
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
