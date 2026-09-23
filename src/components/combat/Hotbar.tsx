"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Swords,
  Zap,
  Shield,
  Footprints,
  HandHelping,
  LogOut,
  FastForward,
  Sparkles,
  Eye,
  EyeOff,
  Compass,
  ArrowUp,
  ArrowUpRight,
  ArrowRight,
  ArrowDownRight,
  ArrowDown,
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpLeft,
  XCircle,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  Layers,
  SlidersHorizontal,
  FlaskConical,
} from "lucide-react";
import type {
  Combatant,
  Attack,
  CombatAbility,
  FacingDirection,
  VisibilityStatus,
  ActionParameters,
  CombatPotion,
} from "@/lib/combat/types";
import { CONDITION_EFFECTS, DAMAGE_TYPE_LABELS } from "@/lib/combat/types";
import { canPayForAttack, effectiveSpeed, remainingMovement, hasCondition } from "@/lib/combat/rules";

interface HotbarProps {
  combatant: Combatant;
  isMyTurn: boolean;
  /** Имена заклинаний по id из библиотеки — знает только родитель */
  spellNames: Record<string, string>;
  /** Параметры заклинаний из библиотеки */
  spellParams?: Record<string, ActionParameters>;
  onAttack: (attackId: string) => void;
  onCastSpell: (spellId: string) => void;
  onUseAbility: (abilityId: string) => void;
  onDash: () => void;
  onDodge: () => void;
  onDisengage: () => void;
  onHelp: () => void;
  onHide?: () => void;
  onStandUp?: () => void;
  onDropProne?: () => void;
  onSetFacing?: (facing: FacingDirection) => void;
  visibilityStatus?: VisibilityStatus;
  activeTargeting?: { type: "attack" | "spell" | "ability"; id: string; name: string } | null;
  onCancelTargeting?: () => void;
  onEndTurn: () => void;
  advantage: boolean;
  disadvantage: boolean;
  onToggleAdvantage: () => void;
  onToggleDisadvantage: () => void;
  onOpenWildShape?: () => void;
  onRevertWildShape?: () => void;
  onDrinkPotion?: (potionId: string) => void;
}

const COST_LABEL: Record<string, string> = {
  action: "Действие",
  bonus: "Бонусное",
  "action+bonus": "Действие + бонус",
  reaction: "Реакция",
  free: "Бесплатно",
  none: "—",
};

function damageSummary(attack: Attack): string {
  return attack.damage
    .map((d) => {
      const dice = d.dice || "";
      const mod = d.mod ? (d.mod > 0 ? "+" + d.mod : "" + d.mod) : "";
      const type = DAMAGE_TYPE_LABELS[d.type] || d.type;
      return (dice + mod + " " + type).trim();
    })
    .join(" + ");
}

function spellSummary(p?: ActionParameters): string {
  if (!p) return "";
  const parts: string[] = [];
  if (p.level === 0) parts.push("Заговор");
  else if (p.level) parts.push(p.level + " круг");
  if (p.school) parts.push(p.school);
  if (p.actionCost) parts.push(COST_LABEL[p.actionCost] ?? p.actionCost);
  if (p.range) {
    if (p.range.type === "touch") parts.push("Касание");
    else if (p.range.type === "self") parts.push("На себя");
    else if (p.range.value) parts.push(p.range.value + " фт");
  }
  if (p.aoe) {
    parts.push("Область " + p.aoe.size + " фт (" + p.aoe.shape + ")");
  }
  if (p.damage && p.damage.length > 0) {
    const dmg = p.damage
      .map(
        (d) =>
          (d.dice || "") + (d.mod ? (d.mod > 0 ? "+" + d.mod : d.mod) : "") + " " + (DAMAGE_TYPE_LABELS[d.type] || d.type)
      )
      .join(" + ");
    parts.push(dmg);
  }
  if (p.saveType) {
    parts.push("Спасбросок " + p.saveType);
  }
  if (p.concentration) {
    parts.push("Концентрация");
  }
  return parts.join(" • ");
}

function extractWeaponBase(name: string): string {
  let base = name.replace(/\s*\([^)]*\)/g, "").trim();
  base = base.replace(/\s*\[[^\]]*\]/g, "").trim();
  if (base.toLowerCase().includes("дубинка") || base.toLowerCase().includes("шиллейла")) return "Дубинка / Шиллейла";
  if (base.toLowerCase().includes("кинжал")) return "Кинжал";
  if (base.toLowerCase().includes("короткий меч")) return "Короткий меч";
  if (base.toLowerCase().includes("длинный меч")) return "Длинный меч";
  if (base.toLowerCase().includes("рапира")) return "Рапира";
  if (base.toLowerCase().includes("посох")) return "Посох";
  if (base.toLowerCase().includes("ручной арбалет")) return "Ручной арбалет";
  if (base.toLowerCase().includes("тяжёлый арбалет")) return "Тяжёлый арбалет";
  if (base.toLowerCase().includes("короткий лук")) return "Короткий лук";
  if (base.toLowerCase().includes("длинный лук")) return "Длинный лук";
  if (
    base.toLowerCase().includes("укус") ||
    base.toLowerCase().includes("когти") ||
    base.toLowerCase().includes("бивни")
  ) {
    return "Природные";
  }
  if (base.toLowerCase().includes("безоружный") || base.toLowerCase().includes("кулак")) {
    return "Рукопашный";
  }
  return base || name;
}

export function Hotbar({
  combatant,
  isMyTurn,
  spellNames,
  spellParams,
  onAttack,
  onCastSpell,
  onUseAbility,
  onDash,
  onDodge,
  onDisengage,
  onHelp,
  onHide,
  onStandUp,
  onDropProne,
  onSetFacing,
  visibilityStatus,
  activeTargeting,
  onCancelTargeting,
  onEndTurn,
  advantage,
  disadvantage,
  onToggleAdvantage,
  onToggleDisadvantage,
  onOpenWildShape,
  onRevertWildShape,
  onDrinkPotion,
}: HotbarProps) {
  const [viewMode, setViewMode] = useState<"sections" | "tabs">("sections");
  const [activeTab, setActiveTab] = useState<"all" | "attacks" | "spells" | "abilities" | "tactics" | "potions">("all");
  const [sizeMode, setSizeMode] = useState<"tiny" | "compact" | "normal" | "large">("compact");
  const [widthMode, setWidthMode] = useState<"compact" | "medium" | "wide" | "full">("medium");
  const [heightMode, setHeightMode] = useState<"sm" | "md" | "lg" | "auto">("md");
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    try {
      const savedView = localStorage.getItem("dnd_hotbar_view");
      if (savedView === "sections" || savedView === "tabs") setViewMode(savedView);
      const savedSize = localStorage.getItem("dnd_hotbar_size");
      if (savedSize === "tiny" || savedSize === "compact" || savedSize === "normal" || savedSize === "large") {
        setSizeMode(savedSize as any);
      }
      const savedWidth = localStorage.getItem("dnd_hotbar_width");
      if (savedWidth === "compact" || savedWidth === "medium" || savedWidth === "wide" || savedWidth === "full") {
        setWidthMode(savedWidth as any);
      }
      const savedHeight = localStorage.getItem("dnd_hotbar_height");
      if (savedHeight === "sm" || savedHeight === "md" || savedHeight === "lg" || savedHeight === "auto") {
        setHeightMode(savedHeight as any);
      }
    } catch {}
  }, []);

  const handleSetViewMode = (mode: "sections" | "tabs") => {
    setViewMode(mode);
    try {
      localStorage.setItem("dnd_hotbar_view", mode);
    } catch {}
  };

  const handleSetSizeMode = (size: "tiny" | "compact" | "normal" | "large") => {
    setSizeMode(size);
    try {
      localStorage.setItem("dnd_hotbar_size", size);
    } catch {}
  };

  const handleSetWidthMode = (w: "compact" | "medium" | "wide" | "full") => {
    setWidthMode(w);
    try {
      localStorage.setItem("dnd_hotbar_width", w);
    } catch {}
  };

  const handleSetHeightMode = (h: "sm" | "md" | "lg" | "auto") => {
    setHeightMode(h);
    try {
      localStorage.setItem("dnd_hotbar_height", h);
    } catch {}
  };

  const isDead = combatant.hpCurrent <= 0;
  const totalSpeed = effectiveSpeed(combatant);
  const movementRemaining = remainingMovement(combatant);
  const isDashing = hasCondition(combatant, "dashing");
  const disabled = !isMyTurn || isDead;

  const actionAvailable = !combatant.actionUsed || combatant.extraActions > 0;
  const attacksLeft = Math.max(0, combatant.attacksPerAction - combatant.attacksMadeThisAction);
  const midAction = combatant.attacksMadeThisAction > 0 && attacksLeft > 0;

  const isRogue =
    combatant.className?.toLowerCase().includes("плут") ||
    combatant.className?.toLowerCase().includes("rogue");
  const hasCunningAction =
    (combatant.level >= 2 && isRogue) ||
    combatant.abilities.some(
      (a) =>
        a.name.toLowerCase().includes("хитрое") ||
        a.name.toLowerCase().includes("хитроумное") ||
        a.id.includes("cunning_action")
    );
  const canBonusTactics = hasCunningAction && !combatant.bonusActionUsed;
  const canDash = actionAvailable || canBonusTactics;
  const canDisengage = actionAvailable || canBonusTactics;
  const canHide = actionAvailable || canBonusTactics;

  // Зелья и расходники
  const availablePotions = useMemo(
    () => (combatant.potions || []).filter((p) => p.quantity > 0),
    [combatant.potions]
  );
  const totalPotionsCount = useMemo(
    () => availablePotions.reduce((sum, p) => sum + p.quantity, 0),
    [availablePotions]
  );

  // Группировка атак
  const groupedAttacks = useMemo(() => {
    const map = new Map<string, Attack[]>();
    for (const atk of combatant.attacks) {
      const base = extractWeaponBase(atk.name);
      if (!map.has(base)) map.set(base, []);
      map.get(base)!.push(atk);
    }
    return Array.from(map.entries()).map(([weapon, atks]) => ({
      weapon,
      attacks: atks,
    }));
  }, [combatant.attacks]);

  // Группировка заклинаний
  const groupedSpells = useMemo(() => {
    const map = new Map<number, Array<{ id: string; name: string; params?: ActionParameters }>>();
    for (const spellId of combatant.spells.known) {
      const p = spellParams?.[spellId];
      const lvl = p?.level ?? 0;
      const name =
        spellNames[spellId] ||
        (spellId && !spellId.startsWith("cm") && !spellId.startsWith("c_") ? spellId : "Заклинание");
      if (!map.has(lvl)) map.set(lvl, []);
      map.get(lvl)!.push({ id: spellId, name, params: p });
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([level, list]) => ({
        level,
        label: level === 0 ? "Заговоры (0 кр)" : level + " круг",
        spells: list,
      }));
  }, [combatant.spells.known, spellNames, spellParams]);

  // Группировка способностей
  const groupedAbilities = useMemo(() => {
    const groups: Record<string, { label: string; icon: string; items: CombatAbility[] }> = {
      action: { label: "⚡ Действия", icon: "⚡", items: [] },
      bonus: { label: "⏱️ Бонус", icon: "⏱️", items: [] },
      reaction: { label: "🛡️ Реакции", icon: "🛡️", items: [] },
      free: { label: "💎 Особые", icon: "💎", items: [] },
    };

    for (const ab of combatant.abilities) {
      const cost = ab.parameters?.actionCost ?? "action";
      if (cost === "bonus") groups.bonus.items.push(ab);
      else if (cost === "reaction") groups.reaction.items.push(ab);
      else if (cost === "free" || cost === "none") groups.free.items.push(ab);
      else groups.action.items.push(ab);
    }

    return Object.entries(groups)
      .filter(([_, g]) => g.items.length > 0)
      .map(([key, g]) => ({ key, ...g }));
  }, [combatant.abilities]);

  // Высота кнопок и базовый размер
  const btnSizeClass =
    sizeMode === "tiny"
      ? "h-6 text-[10.5px] px-1.5 py-0 font-medium rounded-md gap-1 shadow-none"
      : sizeMode === "compact"
      ? "h-7 text-[11px] px-2 py-0.5 font-medium rounded-md gap-1"
      : sizeMode === "large"
      ? "h-9 text-xs px-3 py-1 font-bold rounded-md gap-1.5"
      : "h-8 text-xs px-2.5 py-1 font-semibold rounded-md gap-1.5";

  // Настройка ширины названий действий
  const textWidthClass =
    widthMode === "compact"
      ? "max-w-[110px] truncate"
      : widthMode === "medium"
      ? "max-w-[190px] truncate"
      : widthMode === "wide"
      ? "max-w-[290px] truncate"
      : "max-w-none whitespace-nowrap";

  const heightClass =
    heightMode === "sm"
      ? "max-h-[110px]"
      : heightMode === "md"
      ? "max-h-[190px]"
      : heightMode === "lg"
      ? "max-h-[320px]"
      : "max-h-[500px]";

  if (isDead) {
    const isDeadCond = hasCondition(combatant, "dead");
    const isStableCond = hasCondition(combatant, "stable");
    const dsCond = combatant.conditions.find((c) => c.type === "death_save");
    const successes = dsCond?.duration ?? 0;
    const failures = dsCond?.value ?? 0;

    return (
      <div className="border-t bg-card/95 backdrop-blur p-2 text-center text-xs flex items-center justify-between max-w-5xl mx-auto shadow-lg text-foreground">
        <div className="flex items-center gap-2.5">
          <div
            className="size-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shadow"
            style={{ backgroundColor: combatant.color }}
          >
            {combatant.name.charAt(0).toUpperCase()}
          </div>
          <span className="font-bold text-foreground">{combatant.name}</span>
          {isDeadCond ? (
            <Badge variant="destructive" className="h-5 text-[10px]">💀 Погиб</Badge>
          ) : isStableCond ? (
            <Badge variant="secondary" className="h-5 text-[10px] bg-blue-500/20 text-blue-900 dark:text-blue-300 border-blue-500/40 font-semibold">
              🛡️ Стабилизирован
            </Badge>
          ) : (
            <div className="flex items-center gap-1.5 text-[11px]">
              <Badge variant="outline" className="h-5 text-[10px] text-amber-900 dark:text-amber-400 border-amber-500/40 font-semibold">
                ⚠️ 0 HP
              </Badge>
              <span className="text-emerald-700 dark:text-emerald-400 font-mono font-bold">
                У: {"🟢".repeat(successes)}{"⚪".repeat(Math.max(0, 3 - successes))}
              </span>
              <span className="text-red-700 dark:text-red-400 font-mono font-bold">
                П: {"🔴".repeat(failures)}{"⚪".repeat(Math.max(0, 3 - failures))}
              </span>
            </div>
          )}
        </div>
        {isMyTurn && (
          <Button variant="outline" size="sm" onClick={onEndTurn} className="h-6 text-[11px] font-semibold text-foreground">
            <LogOut className="size-3 mr-1" />
            Завершить ход
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="border-t bg-card/95 backdrop-blur-md px-2.5 py-1.5 shadow-2xl transition-all select-none text-foreground">
      {!isMyTurn && (
        <div className="text-center text-[11px] text-amber-800 dark:text-amber-400 font-semibold mb-0.5 flex items-center justify-center gap-1">
          <span>⏸️</span>
          <span>Ход другого бойца</span>
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-1.5">
        {/* ================= ВЕРХНЯЯ СТАТУС-СТРОКА (КОМПАКТНАЯ) ================= */}
        <div className="flex items-center justify-between gap-1.5 flex-wrap text-xs pb-1 border-b border-border/40">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Иконка и имя */}
            <div className="flex items-center gap-1">
              <div
                className="size-4.5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shadow"
                style={{ backgroundColor: combatant.color }}
              >
                {combatant.name.charAt(0).toUpperCase()}
              </div>
              <span className="font-bold text-xs tracking-tight text-foreground">{combatant.name}</span>
            </div>

            <Separator orientation="vertical" className="h-3.5" />

            {/* Хиты */}
            <span className="flex items-center gap-0.5 font-mono font-bold text-[11px] text-foreground">
              <span className="text-red-500">❤</span>
              <span>
                {combatant.hpCurrent}/{combatant.hpMax}
                {combatant.hpTemp > 0 && <span className="text-blue-600 dark:text-blue-400 font-bold"> +{combatant.hpTemp}</span>}
              </span>
            </span>

            {/* КД */}
            <span className="flex items-center gap-0.5 text-blue-700 dark:text-blue-400 font-mono font-bold text-[11px]">
              <Shield className="size-3" /> {combatant.ac}
            </span>

            {/* Движение */}
            <span className="flex items-center gap-0.5 font-mono font-bold text-[11px]">
              <Footprints className="size-3 text-amber-600 dark:text-amber-400" />
              <span className={movementRemaining === 0 ? "text-red-600 dark:text-red-400" : "text-amber-800 dark:text-amber-300"}>
                {movementRemaining}/{totalSpeed}ф
                {isDashing && <span className="text-amber-600 ml-0.5">⚡Р</span>}
              </span>
            </span>

            <Separator orientation="vertical" className="h-3.5" />

            {/* Расход ресурсов (Действие, Бонус, Реакция) */}
            <div className="flex items-center gap-0.5">
              <ResourcePip label="Д" used={!actionAvailable} title="Основное действие" />
              <ResourcePip label="Б" used={combatant.bonusActionUsed} title="Бонусное действие" />
              <ResourcePip label="Р" used={combatant.reactionUsed} roundBased title="Реакция" />
            </div>

            {combatant.extraActions > 0 && (
              <Badge className="h-4 px-1 text-[9px] bg-amber-500 hover:bg-amber-500 text-black font-bold">
                ⚡ +{combatant.extraActions}Д
              </Badge>
            )}

            {combatant.attacksPerAction > 1 && (
              <Badge variant="outline" className="h-4 px-1 text-[9px] border-amber-500/50 text-amber-900 dark:text-amber-300 font-semibold">
                {attacksLeft}/{combatant.attacksPerAction} ат
              </Badge>
            )}

            {combatant.concentration && (
              <Badge
                variant="outline"
                className="h-4 px-1 text-[9px] bg-purple-500/15 text-purple-900 dark:text-purple-300 border-purple-500/50 font-bold"
              >
                ◆ {combatant.concentration.spellName}
              </Badge>
            )}

            {combatant.wildShape && (
              <Badge
                variant="outline"
                className="h-4 px-1 text-[9px] bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 border-emerald-500/60 font-bold flex items-center gap-0.5 animate-pulse"
              >
                <span>{combatant.wildShape.icon || "🐾"}</span>
                <span>{combatant.wildShape.formName} ({combatant.hpCurrent}/{combatant.hpMax})</span>
              </Badge>
            )}

            {combatant.conditions.length > 0 && (
              <div className="flex gap-0.5 flex-wrap">
                {combatant.conditions.map((c, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="h-4 px-1 text-[9px] bg-amber-500/15 text-amber-950 dark:text-amber-300 border-amber-500/40 font-semibold"
                    title={CONDITION_EFFECTS[c.type]?.description}
                  >
                    {CONDITION_EFFECTS[c.type]?.name || c.type}
                    {c.duration ? " (" + c.duration + ")" : ""}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Правая панель: Быстрый доступ к зельям, Вид, Настройки размера и ширины, Свернуть */}
          <div className="flex items-center gap-0.5 ml-auto">
            {/* Быстрый доступ к зельям */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-1.5 text-[10.5px] font-semibold flex items-center gap-1 border-amber-500/40 bg-background/80 hover:bg-amber-500/10 text-foreground shadow-xs"
                  title="Рюкзак: Зелья и расходники (1 Бонусное действие)"
                >
                  <FlaskConical className="size-3 text-amber-600 dark:text-amber-400" />
                  <span>Зелья</span>
                  <Badge
                    variant="secondary"
                    className={`h-4 px-1 text-[9px] font-bold ${
                      totalPotionsCount > 0
                        ? "bg-amber-500/20 text-amber-950 dark:text-amber-300 border border-amber-500/40"
                        : "text-muted-foreground"
                    }`}
                  >
                    {totalPotionsCount}
                  </Badge>
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-80 p-3 bg-card backdrop-blur border-border shadow-2xl space-y-2.5 text-foreground z-[300]"
              >
                {/* Заголовок */}
                <div className="flex items-center justify-between pb-1.5 border-b border-border/50">
                  <div className="flex items-center gap-1.5">
                    <FlaskConical className="size-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-xs font-bold tracking-tight">Рюкзак: Зелья и расходники</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono font-bold">
                    Всего: {totalPotionsCount} шт.
                  </Badge>
                </div>

                {/* Подзаголовок стоимости */}
                <div className="flex items-center justify-between text-[11px] px-2 py-1 rounded bg-muted/60 border border-border/60">
                  <span className="text-muted-foreground text-[10.5px]">Стоимость: 1 Бонусное действие</span>
                  {combatant.bonusActionUsed ? (
                    <span className="text-red-600 dark:text-red-400 font-bold text-[10.5px] flex items-center gap-0.5">
                      <span>⏱️</span> Бонусное действие потрачено
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[10.5px] flex items-center gap-0.5">
                      <span>⚡</span> Бонусное действие доступно
                    </span>
                  )}
                </div>

                {/* Список зелий */}
                {availablePotions.length === 0 ? (
                  <div className="py-4 text-center text-xs text-muted-foreground">
                    В инвентаре нет зелий
                  </div>
                ) : (
                  <ScrollArea className="max-h-[260px] pr-1 overflow-y-auto">
                    <div className="space-y-2">
                      {availablePotions.map((p) => {
                        const typeLabel =
                          p.type === "heal"
                            ? "💚 Лечение"
                            : p.type === "buff"
                            ? "🛡️ Бафф"
                            : "🔮 Утилитарное";

                        const isBonusBlocked = combatant.bonusActionUsed;
                        const isBlocked = disabled || isBonusBlocked || p.quantity <= 0;
                        const blockReason = isDead
                          ? "Боец без сознания или мертв"
                          : !isMyTurn
                          ? "Не ваш ход"
                          : isBonusBlocked
                          ? "Бонусное действие уже потрачено в этом раунде"
                          : p.quantity <= 0
                          ? "Зелье закончилось"
                          : undefined;

                        return (
                          <div
                            key={p.id}
                            className="p-2 rounded-md bg-background/80 border border-border/80 shadow-xs space-y-1.5"
                          >
                            <div className="flex items-start justify-between gap-1">
                              <div>
                                <div className="font-bold text-xs text-foreground flex items-center gap-1.5">
                                  <span>{p.name}</span>
                                  <Badge variant="secondary" className="h-4 px-1 text-[9px] font-mono font-bold">
                                    x{p.quantity}
                                  </Badge>
                                </div>
                                {p.nameEn && (
                                  <div className="text-[10px] text-muted-foreground italic">
                                    {p.nameEn}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1 flex-wrap justify-end">
                                <Badge
                                  variant="outline"
                                  className="h-4 px-1 text-[9px] border-amber-500/40 text-amber-900 dark:text-amber-300 font-medium"
                                >
                                  {typeLabel}
                                </Badge>
                                {p.rarity && (
                                  <Badge variant="secondary" className="h-4 px-1 text-[9px] text-muted-foreground">
                                    {p.rarity}
                                  </Badge>
                                )}
                              </div>
                            </div>

                            {(p.formula || p.tempHp || p.buffEffect) && (
                              <div className="text-[11px] font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                                {p.formula && <span>Эффект: {p.formula}</span>}
                                {p.tempHp && <span> +{p.tempHp} врем. HP</span>}
                                {p.buffEffect && <span> ({p.buffEffect})</span>}
                              </div>
                            )}

                            {p.description && (
                              <div className="text-[10.5px] text-muted-foreground leading-snug">
                                {p.description}
                              </div>
                            )}

                            <div className="pt-0.5 flex items-center justify-between gap-2">
                              <Button
                                size="sm"
                                variant="default"
                                className="h-6 text-[10.5px] font-bold px-2.5 bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 hover:from-amber-500 hover:to-amber-700 text-amber-50 border border-amber-600/60 shadow-xs disabled:opacity-50"
                                disabled={isBlocked}
                                title={blockReason || "Выпить зелье (1 Бонусное действие)"}
                                onClick={() => onDrinkPotion?.(p.id)}
                              >
                                <FlaskConical className="size-3 mr-1" />
                                Выпить
                              </Button>
                              {isBonusBlocked && (
                                <span className="text-[10px] text-red-600 dark:text-red-400 font-medium" title="Бонусное действие уже потрачено в этом раунде">
                                  Бонусное действие недоступно
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </PopoverContent>
            </Popover>

            <Separator orientation="vertical" className="h-3.5 mx-0.5" />

            {/* Вид: Вкладки / Все блоки */}
            <Button
              size="sm"
              variant="ghost"
              className="h-5.5 w-5.5 p-0 text-foreground hover:bg-accent"
              onClick={() => handleSetViewMode(viewMode === "sections" ? "tabs" : "sections")}
              title={viewMode === "sections" ? "Вкладки" : "Все блоки"}
            >
              {viewMode === "sections" ? <Layers className="size-3 text-foreground" /> : <LayoutGrid className="size-3 text-foreground" />}
            </Button>

            {/* Настройка масштаба, ширины кнопок и высоты панели */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-5.5 w-5.5 p-0 text-foreground hover:bg-accent"
                  title="Настройка размера, ширины и высоты кнопок"
                >
                  <SlidersHorizontal className="size-3 text-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-3 bg-card backdrop-blur border-border shadow-2xl space-y-2.5 text-foreground">
                {/* 1. Размер / Высота кнопок */}
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Размер и высота кнопок
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    <Button
                      size="sm"
                      variant={sizeMode === "tiny" ? "default" : "outline"}
                      className={"h-6 text-[9px] " + (sizeMode === "tiny" ? "bg-primary font-bold text-primary-foreground" : "text-foreground")}
                      onClick={() => handleSetSizeMode("tiny")}
                    >
                      Микро
                    </Button>
                    <Button
                      size="sm"
                      variant={sizeMode === "compact" ? "default" : "outline"}
                      className={"h-6 text-[9px] " + (sizeMode === "compact" ? "bg-primary font-bold text-primary-foreground" : "text-foreground")}
                      onClick={() => handleSetSizeMode("compact")}
                    >
                      Компакт
                    </Button>
                    <Button
                      size="sm"
                      variant={sizeMode === "normal" ? "default" : "outline"}
                      className={"h-6 text-[9px] " + (sizeMode === "normal" ? "bg-primary font-bold text-primary-foreground" : "text-foreground")}
                      onClick={() => handleSetSizeMode("normal")}
                    >
                      Норм
                    </Button>
                    <Button
                      size="sm"
                      variant={sizeMode === "large" ? "default" : "outline"}
                      className={"h-6 text-[9px] " + (sizeMode === "large" ? "bg-primary font-bold text-primary-foreground" : "text-foreground")}
                      onClick={() => handleSetSizeMode("large")}
                    >
                      Крупный
                    </Button>
                  </div>
                </div>

                {/* 2. Ширина названий (чтобы текст влезал точно) */}
                <div className="pt-1.5 border-t border-border/50">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Ширина названий действий
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    <Button
                      size="sm"
                      variant={widthMode === "compact" ? "default" : "outline"}
                      className={"h-6 text-[9px] " + (widthMode === "compact" ? "bg-primary font-bold text-primary-foreground" : "text-foreground")}
                      onClick={() => handleSetWidthMode("compact")}
                      title="Компактная ширина: 110px"
                    >
                      110px
                    </Button>
                    <Button
                      size="sm"
                      variant={widthMode === "medium" ? "default" : "outline"}
                      className={"h-6 text-[9px] " + (widthMode === "medium" ? "bg-primary font-bold text-primary-foreground" : "text-foreground")}
                      onClick={() => handleSetWidthMode("medium")}
                      title="Средняя ширина: 190px (помещается большинство названий)"
                    >
                      190px
                    </Button>
                    <Button
                      size="sm"
                      variant={widthMode === "wide" ? "default" : "outline"}
                      className={"h-6 text-[9px] " + (widthMode === "wide" ? "bg-primary font-bold text-primary-foreground" : "text-foreground")}
                      onClick={() => handleSetWidthMode("wide")}
                      title="Широкая ширина: 290px"
                    >
                      290px
                    </Button>
                    <Button
                      size="sm"
                      variant={widthMode === "full" ? "default" : "outline"}
                      className={"h-6 text-[9px] " + (widthMode === "full" ? "bg-primary font-bold text-primary-foreground" : "text-foreground")}
                      onClick={() => handleSetWidthMode("full")}
                      title="Полный текст: без обрезки"
                    >
                      Полный
                    </Button>
                  </div>
                </div>

                {/* 3. Высота хотбара */}
                <div className="pt-1.5 border-t border-border/50">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Высота панели хотбара
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    <Button
                      size="sm"
                      variant={heightMode === "sm" ? "default" : "outline"}
                      className={"h-6 text-[9px] " + (heightMode === "sm" ? "bg-primary font-bold text-primary-foreground" : "text-foreground")}
                      onClick={() => handleSetHeightMode("sm")}
                    >
                      1 ряд
                    </Button>
                    <Button
                      size="sm"
                      variant={heightMode === "md" ? "default" : "outline"}
                      className={"h-6 text-[9px] " + (heightMode === "md" ? "bg-primary font-bold text-primary-foreground" : "text-foreground")}
                      onClick={() => handleSetHeightMode("md")}
                    >
                      2 ряда
                    </Button>
                    <Button
                      size="sm"
                      variant={heightMode === "lg" ? "default" : "outline"}
                      className={"h-6 text-[9px] " + (heightMode === "lg" ? "bg-primary font-bold text-primary-foreground" : "text-foreground")}
                      onClick={() => handleSetHeightMode("lg")}
                    >
                      3 ряда
                    </Button>
                    <Button
                      size="sm"
                      variant={heightMode === "auto" ? "default" : "outline"}
                      className={"h-6 text-[9px] " + (heightMode === "auto" ? "bg-primary font-bold text-primary-foreground" : "text-foreground")}
                      onClick={() => handleSetHeightMode("auto")}
                    >
                      Авто
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Свернуть / Развернуть */}
            <Button
              size="sm"
              variant="ghost"
              className="h-5.5 w-5.5 p-0 text-foreground hover:bg-accent"
              onClick={() => setIsCollapsed(!isCollapsed)}
              title={isCollapsed ? "Развернуть" : "Свернуть"}
            >
              {isCollapsed ? <ChevronUp className="size-3.5 text-foreground" /> : <ChevronDown className="size-3.5 text-foreground" />}
            </Button>
          </div>
        </div>

        {/* Панель активного таргетинга */}
        {activeTargeting && onCancelTargeting && (
          <div className="flex items-center justify-between px-2 py-1 rounded bg-red-500/20 border border-red-500/50 shadow-sm animate-in fade-in">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-red-950 dark:text-red-200">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
              </span>
              <span>Цель: <strong className="text-foreground underline font-bold">{activeTargeting.name}</strong></span>
            </div>
            <Button
              size="sm"
              variant="destructive"
              className="h-5 text-[10px] font-bold bg-red-600 hover:bg-red-700 text-white flex items-center gap-1 px-1.5"
              onClick={onCancelTargeting}
            >
              <XCircle className="size-3" />
              Отмена (Esc)
            </Button>
          </div>
        )}

        {/* ================= ОСНОВНОЙ БЛОК ДЕЙСТВИЙ ================= */}
        {!isCollapsed && (
          <div className="space-y-1">
            {/* Переключатель вкладок при viewMode === "tabs" */}
            {viewMode === "tabs" && (
              <div className="flex items-center gap-0.5 border-b border-border/40 pb-1 overflow-x-auto">
                <Button
                  size="sm"
                  variant={activeTab === "all" ? "default" : "ghost"}
                  className={"h-6 text-[10.5px] font-bold px-2 " + (activeTab === "all" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}
                  onClick={() => setActiveTab("all")}
                >
                  Все
                </Button>
                {combatant.attacks.length > 0 && (
                  <Button
                    size="sm"
                    variant={activeTab === "attacks" ? "default" : "ghost"}
                    className={"h-6 text-[10.5px] font-bold px-2 flex items-center gap-1 " + (
                      activeTab === "attacks" ? "bg-amber-500/20 text-amber-950 dark:text-amber-300 border border-amber-500/40" : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => setActiveTab("attacks")}
                  >
                    <Swords className="size-2.5 text-amber-600 dark:text-amber-400" />
                    Атаки ({combatant.attacks.length})
                  </Button>
                )}
                {combatant.spells.known.length > 0 && (
                  <Button
                    size="sm"
                    variant={activeTab === "spells" ? "default" : "ghost"}
                    className={"h-6 text-[10.5px] font-bold px-2 flex items-center gap-1 " + (
                      activeTab === "spells" ? "bg-blue-500/20 text-blue-950 dark:text-blue-300 border border-blue-500/40" : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => setActiveTab("spells")}
                  >
                    <Zap className="size-2.5 text-blue-600 dark:text-blue-400" />
                    Магия ({combatant.spells.known.length})
                  </Button>
                )}
                {combatant.abilities.length > 0 && (
                  <Button
                    size="sm"
                    variant={activeTab === "abilities" ? "default" : "ghost"}
                    className={"h-6 text-[10.5px] font-bold px-2 flex items-center gap-1 " + (
                      activeTab === "abilities" ? "bg-purple-500/20 text-purple-950 dark:text-purple-300 border border-purple-500/40" : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => setActiveTab("abilities")}
                  >
                    <Sparkles className="size-2.5 text-purple-600 dark:text-purple-400" />
                    Способности ({combatant.abilities.length})
                  </Button>
                )}
                <Button
                  size="sm"
                  variant={activeTab === "tactics" ? "default" : "ghost"}
                  className={"h-6 text-[10.5px] font-bold px-2 flex items-center gap-1 " + (
                    activeTab === "tactics" ? "bg-emerald-500/20 text-emerald-950 dark:text-emerald-300 border border-emerald-500/40" : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setActiveTab("tactics")}
                >
                  <Shield className="size-2.5 text-emerald-600 dark:text-emerald-400" />
                  Тактика
                </Button>
                <Button
                  size="sm"
                  variant={activeTab === "potions" ? "default" : "ghost"}
                  className={"h-6 text-[10.5px] font-bold px-2 flex items-center gap-1 " + (
                    activeTab === "potions" ? "bg-amber-500/20 text-amber-950 dark:text-amber-300 border border-amber-500/40" : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setActiveTab("potions")}
                >
                  <FlaskConical className="size-2.5 text-amber-600 dark:text-amber-400" />
                  🎒 Зелья ({totalPotionsCount})
                </Button>
              </div>
            )}

            {/* Контейнер со скроллом для всех действий */}
            <ScrollArea className={heightClass + " pr-1.5 overflow-y-auto"}>
              <div className="space-y-1.5 pb-1">
                {/* 1. БЛОК АТАК */}
                {(viewMode === "sections" || activeTab === "all" || activeTab === "attacks") &&
                  groupedAttacks.length > 0 && (
                    <div className="p-1 rounded bg-amber-500/10 border border-amber-500/25">
                      <div className="flex items-center gap-1.5 flex-wrap overflow-x-auto py-0.5">
                        <span className="text-[10px] font-bold text-amber-900 dark:text-amber-400 uppercase tracking-tight flex items-center gap-1 select-none pr-1">
                          <Swords className="size-3 text-amber-600 dark:text-amber-400" />
                          Атаки:
                        </span>

                        {groupedAttacks.map((grp) => (
                          <div key={grp.weapon} className="flex items-center gap-0.5 bg-background/90 px-1 py-0.5 rounded border border-border/80 shadow-xs">
                            <span className="text-[10px] font-bold text-muted-foreground select-none pr-0.5">
                              {grp.weapon}:
                            </span>
                            {grp.attacks.map((atk) => {
                              const pay = canPayForAttack(combatant, atk);
                              const isTargetingThis =
                                activeTargeting?.type === "attack" && activeTargeting?.id === atk.id;
                              const rangeText =
                                atk.range.long && atk.range.long > atk.range.normal
                                  ? atk.range.normal + "/" + atk.range.long + " фт"
                                  : atk.range.normal + " фт";

                              return (
                                <Button
                                  key={atk.id}
                                  size="sm"
                                  variant="secondary"
                                  className={btnSizeClass + " transition-all " + (
                                    isTargetingThis
                                      ? "ring-2 ring-amber-500 bg-amber-500/30 text-amber-950 dark:text-amber-200 font-bold border-amber-500 animate-pulse"
                                      : atk.actionCost === "action+bonus"
                                      ? "border border-amber-500/60 bg-amber-500/15 hover:bg-amber-500/25 text-foreground"
                                      : "bg-muted/90 hover:bg-muted text-foreground border border-border"
                                  )}
                                  disabled={disabled || (!isTargetingThis && !pay.ok)}
                                  onClick={() => {
                                    if (isTargetingThis) onCancelTargeting?.();
                                    else onAttack(atk.id);
                                  }}
                                  title={
                                    isTargetingThis
                                      ? "Отменить выбор (Esc)"
                                      : pay.ok
                                      ? "+" + atk.attackBonus + " к попаданию, " + damageSummary(atk) + "\n" + rangeText + " • " + (COST_LABEL[atk.actionCost] ?? atk.actionCost)
                                      : pay.reason
                                  }
                                >
                                  <Swords className="size-2.5 text-amber-600 dark:text-amber-400" />
                                  <span className={"font-semibold text-foreground " + textWidthClass}>{atk.name}</span>
                                  <span className="text-[9.5px] font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                    +{atk.attackBonus}
                                  </span>
                                  {atk.actionCost === "action+bonus" && (
                                    <span className="text-[9px] text-amber-700 dark:text-amber-400 font-bold">2×</span>
                                  )}
                                </Button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* 2. БЛОК ЗАКЛИНАНИЙ */}
                {(viewMode === "sections" || activeTab === "all" || activeTab === "spells") &&
                  groupedSpells.length > 0 && (
                    <div className="p-1 rounded bg-blue-500/10 border border-blue-500/25">
                      <div className="flex items-center gap-1.5 flex-wrap overflow-x-auto py-0.5">
                        <span className="text-[10px] font-bold text-blue-900 dark:text-blue-400 uppercase tracking-tight flex items-center gap-1 select-none pr-1">
                          <Zap className="size-3 text-blue-600 dark:text-blue-400" />
                          Магия:
                        </span>

                        {groupedSpells.map((grp) => {
                          const slotInfo =
                            grp.level === 0 ? null : combatant.spells.slots[String(grp.level)];

                          return (
                            <div key={grp.level} className="flex items-center gap-0.5 bg-background/90 px-1 py-0.5 rounded border border-border/80 shadow-xs">
                              <span className="text-[10px] font-bold text-blue-900 dark:text-blue-400 select-none pr-0.5">
                                {grp.label}
                                {slotInfo && (
                                  <span className="text-[9px] text-foreground font-mono font-bold ml-0.5">
                                    ({slotInfo.max - slotInfo.used}/{slotInfo.max})
                                  </span>
                                )}:
                              </span>

                              {grp.spells.map(({ id: spellId, name, params: p }) => {
                                const isTargetingThis =
                                  activeTargeting?.type === "spell" && activeTargeting?.id === spellId;
                                const cost = p?.actionCost ?? "action";
                                const costBlocked =
                                  cost === "bonus"
                                    ? combatant.bonusActionUsed
                                    : cost === "reaction"
                                    ? combatant.reactionUsed
                                    : cost === "free" || cost === "none"
                                    ? false
                                    : !actionAvailable;

                                const spellLvl = p?.level ?? 0;
                                const hasSlot =
                                  spellLvl === 0 ||
                                  Object.entries(combatant.spells.slots).some(
                                    ([l, s]) => Number(l) >= spellLvl && s.used < s.max
                                  );
                                const isWildShaped = !!combatant.wildShape;
                                const canCast = !isWildShaped && !costBlocked && hasSlot;

                                const summary = spellSummary(p);
                                const slotText =
                                  Object.entries(combatant.spells.slots)
                                    .map(([l, s]) => l + " кр: " + (s.max - s.used) + "/" + s.max)
                                    .join(", ") || "заговоры";

                                return (
                                  <Button
                                    key={"spell-" + spellId}
                                    size="sm"
                                    variant="secondary"
                                    className={btnSizeClass + " transition-all " + (
                                      isTargetingThis
                                        ? "ring-2 ring-blue-500 bg-blue-500/30 text-blue-950 dark:text-blue-200 font-bold border-blue-500 animate-pulse"
                                        : "bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/40 text-foreground"
                                    )}
                                    disabled={disabled || (!isTargetingThis && !canCast)}
                                    onClick={() => {
                                      if (isTargetingThis) onCancelTargeting?.();
                                      else onCastSpell(spellId);
                                    }}
                                    title={
                                      isWildShaped
                                        ? "Заклинания недоступны в облике зверя (D&D 5e)"
                                        : isTargetingThis
                                        ? "Отменить выбор (Esc)"
                                        : !hasSlot
                                        ? "Нет ячеек " + spellLvl + "+ круга\nЯчейки: " + slotText
                                        : costBlocked
                                        ? cost === "bonus"
                                          ? "Бонусное действие уже использовано"
                                          : "Действие уже использовано"
                                        : (summary ? summary + "\n" : "") + (p?.description ? p.description + "\n" : "") + "Ячейки: " + slotText
                                    }
                                  >
                                    <Zap className="size-2.5 text-blue-600 dark:text-blue-400" />
                                    <span className={"font-semibold text-foreground " + textWidthClass}>{name}</span>
                                    {cost === "bonus" && (
                                      <span className="text-[8.5px] bg-blue-500/20 text-blue-900 dark:text-blue-300 px-0.5 rounded font-bold">
                                        Б
                                      </span>
                                    )}
                                  </Button>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                {/* 3. БЛОК СПОСОБНОСТЕЙ */}
                {(viewMode === "sections" || activeTab === "all" || activeTab === "abilities") &&
                  groupedAbilities.length > 0 && (
                    <div className="p-1 rounded bg-purple-500/10 border border-purple-500/25">
                      <div className="flex items-center gap-1.5 flex-wrap overflow-x-auto py-0.5">
                        <span className="text-[10px] font-bold text-purple-900 dark:text-purple-400 uppercase tracking-tight flex items-center gap-1 select-none pr-1">
                          <Sparkles className="size-3 text-purple-600 dark:text-purple-400" />
                          Способности:
                        </span>

                        {groupedAbilities.map((grp) => (
                          <div key={grp.key} className="flex items-center gap-0.5 bg-background/90 px-1 py-0.5 rounded border border-border/80 shadow-xs">
                            <span className="text-[10px] font-bold text-purple-900 dark:text-purple-400 select-none pr-0.5">
                              {grp.label}:
                            </span>
                            {grp.items.map((ab) => {
                              const cost = ab.parameters?.actionCost ?? "action";
                              const noUses = ab.usesMax > 0 && ab.usesUsed >= ab.usesMax;
                              const costBlocked =
                                cost === "bonus"
                                  ? combatant.bonusActionUsed
                                  : cost === "reaction"
                                  ? combatant.reactionUsed
                                  : cost === "free" || cost === "none"
                                  ? false
                                  : !actionAvailable;
                              const isTargetingThis =
                                activeTargeting?.type === "ability" && activeTargeting?.id === ab.id;

                              return (
                                <Button
                                  key={ab.id}
                                  size="sm"
                                  variant="secondary"
                                  className={btnSizeClass + " transition-all " + (
                                    isTargetingThis
                                      ? "ring-2 ring-purple-500 bg-purple-500/30 text-purple-950 dark:text-purple-200 font-bold border-purple-500 animate-pulse"
                                      : "bg-purple-600/15 hover:bg-purple-600/25 border border-purple-500/40 text-foreground"
                                  )}
                                  disabled={disabled || (!isTargetingThis && (noUses || costBlocked))}
                                  onClick={() => {
                                    if (isTargetingThis) {
                                      onCancelTargeting?.();
                                    } else if (
                                      ab.id === "revert_wild_shape" ||
                                      ab.name.toLowerCase().includes("выйти из облика")
                                    ) {
                                      if (onRevertWildShape) onRevertWildShape();
                                      else onUseAbility(ab.id);
                                    } else if (
                                      ab.id.includes("wild_shape") ||
                                      ab.name.toLowerCase().includes("дикий облик")
                                    ) {
                                      if (onOpenWildShape) onOpenWildShape();
                                      else onUseAbility(ab.id);
                                    } else {
                                      onUseAbility(ab.id);
                                    }
                                  }}
                                  title={
                                    isTargetingThis
                                      ? "Отменить выбор (Esc)"
                                      : (COST_LABEL[cost] ?? cost) + (ab.usesMax > 0 ? " • " + (ab.usesMax - ab.usesUsed) + "/" + ab.usesMax : "") + (ab.parameters?.description ? "\n" + ab.parameters.description : "")
                                  }
                                >
                                  <Sparkles className="size-2.5 text-purple-600 dark:text-purple-400" />
                                  <span className={"font-semibold text-foreground " + textWidthClass}>{ab.name}</span>
                                  {ab.usesMax > 0 && (
                                    <span className="text-[9.5px] font-mono font-bold text-purple-700 dark:text-purple-300">
                                      {ab.usesMax - ab.usesUsed}/{ab.usesMax}
                                    </span>
                                  )}
                                </Button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* 4. БЛОК ТАКТИКИ И БАЗОВЫХ ДЕЙСТВИЙ */}
                {(viewMode === "sections" || activeTab === "all" || activeTab === "tactics") && (
                  <div className="p-1 rounded bg-emerald-500/10 border border-emerald-500/25">
                    <div className="flex items-center gap-1 flex-wrap py-0.5">
                      <span className="text-[10px] font-bold text-emerald-900 dark:text-emerald-400 uppercase tracking-tight flex items-center gap-1 select-none pr-1">
                        <Shield className="size-3 text-emerald-600 dark:text-emerald-400" />
                        Тактика:
                      </span>

                      <ActionButton
                        icon={<FastForward className="size-2.5 text-amber-600 dark:text-amber-400" />}
                        label={!actionAvailable && canBonusTactics ? "Рывок (Б)" : "Рывок"}
                        sizeClass={btnSizeClass}
                        disabled={disabled || !canDash || hasCondition(combatant, "dashing")}
                        onClick={onDash}
                      />
                      <ActionButton
                        icon={<Shield className="size-2.5 text-blue-600 dark:text-blue-400" />}
                        label="Уклонение"
                        sizeClass={btnSizeClass}
                        disabled={disabled || !actionAvailable || hasCondition(combatant, "dodging")}
                        onClick={onDodge}
                      />
                      <ActionButton
                        icon={<LogOut className="size-2.5 text-purple-600 dark:text-purple-400" />}
                        label={!actionAvailable && canBonusTactics ? "Отход (Б)" : "Отход"}
                        sizeClass={btnSizeClass}
                        disabled={disabled || !canDisengage || hasCondition(combatant, "disengaging")}
                        onClick={onDisengage}
                      />
                      <ActionButton
                        icon={<HandHelping className="size-2.5 text-emerald-600 dark:text-emerald-400" />}
                        label="Помощь"
                        sizeClass={btnSizeClass}
                        disabled={disabled || !actionAvailable}
                        onClick={onHelp}
                      />

                      {onHide && (
                        <ActionButton
                          icon={
                            combatant.isHidden ? (
                              <EyeOff className="size-2.5 text-sky-600 dark:text-sky-400" />
                            ) : (
                              <Eye className="size-2.5 text-slate-700 dark:text-slate-300" />
                            )
                          }
                          label={combatant.isHidden ? "Скрыт" : !actionAvailable && canBonusTactics ? "Спрятаться (Б)" : "Спрятаться"}
                          sizeClass={btnSizeClass}
                          disabled={
                            disabled || !canHide || combatant.isHidden || visibilityStatus === "visible"
                          }
                          onClick={onHide}
                        />
                      )}

                      {hasCondition(combatant, "prone") ? (
                        onStandUp && (
                          <ActionButton
                            icon={<Footprints className="size-2.5 text-amber-600 dark:text-amber-400" />}
                            label={"Встать (" + Math.floor(totalSpeed / 2) + "ф)"}
                            sizeClass={btnSizeClass}
                            disabled={disabled || movementRemaining < Math.floor(totalSpeed / 2)}
                            onClick={onStandUp}
                          />
                        )
                      ) : (
                        onDropProne && (
                          <ActionButton
                            icon={<ArrowDown className="size-2.5 text-slate-600 dark:text-muted-foreground" />}
                            label="Лечь"
                            sizeClass={btnSizeClass}
                            disabled={disabled}
                            onClick={onDropProne}
                          />
                        )
                      )}

                      <Separator orientation="vertical" className="h-5 mx-0.5" />

                      {onSetFacing && (
                        <FacingCompass
                          currentFacing={combatant.facing || (combatant.type === "enemy" ? "W" : "E")}
                          onSetFacing={onSetFacing}
                          disabled={disabled}
                        />
                      )}

                      {combatant.wildShape && onRevertWildShape && (
                        <Button
                          size="sm"
                          variant="outline"
                          className={btnSizeClass + " bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-950 dark:text-emerald-300 border-emerald-500/50 flex items-center gap-1 font-bold"}
                          disabled={disabled || combatant.bonusActionUsed}
                          onClick={onRevertWildShape}
                          title="Вернуться в истинный облик"
                        >
                          <span>🔄</span>
                          <span>Выйти из зверя</span>
                        </Button>
                      )}

                      {isMyTurn && (
                        <Button
                          size="sm"
                          className={btnSizeClass + " ml-auto bg-emerald-600 hover:bg-emerald-700 font-bold text-white shadow flex items-center gap-1"}
                          onClick={onEndTurn}
                        >
                          <LogOut className="size-3" />
                          <span>Завершить ход</span>
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* 5. БЛОК ЗЕЛИЙ И РАСХОДНИКОВ */}
                {((viewMode === "sections" && availablePotions.length > 0) ||
                  activeTab === "potions" ||
                  (activeTab === "all" && availablePotions.length > 0)) && (
                  <div className="p-1.5 rounded bg-amber-500/10 border border-amber-500/25 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap py-0.5">
                      <span className="text-[10px] font-bold text-amber-900 dark:text-amber-400 uppercase tracking-tight flex items-center gap-1 select-none pr-1">
                        <FlaskConical className="size-3 text-amber-600 dark:text-amber-400" />
                        🎒 Зелья и расходники (Бонусное действие):
                      </span>
                      <div className="flex items-center gap-1.5 text-[10px]">
                        {combatant.bonusActionUsed ? (
                          <span className="text-red-600 dark:text-red-400 font-bold flex items-center gap-0.5">
                            <span>⏱️</span> Бонусное действие потрачено
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                            <span>⚡</span> 1 Бонусное действие доступно
                          </span>
                        )}
                      </div>
                    </div>

                    {availablePotions.length === 0 ? (
                      <div className="py-4 text-center text-xs text-muted-foreground">
                        В инвентаре нет доступных зелий
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                        {availablePotions.map((potion) => {
                          const typeLabel =
                            potion.type === "heal"
                              ? "💚 Лечение"
                              : potion.type === "buff"
                              ? "🛡️ Бафф"
                              : "🔮 Утилитарное";
                          const isBonusBlocked = combatant.bonusActionUsed;
                          const isBlocked = disabled || isBonusBlocked || potion.quantity <= 0;
                          const blockReason = isDead
                            ? "Боец без сознания или мертв"
                            : !isMyTurn
                            ? "Не ваш ход"
                            : isBonusBlocked
                            ? "Бонусное действие уже потрачено в этом раунде"
                            : potion.quantity <= 0
                            ? "Зелье закончилось"
                            : undefined;

                          return (
                            <div
                              key={potion.id}
                              className="flex flex-col justify-between p-2.5 rounded-md bg-background/90 border border-border/80 shadow-xs hover:border-amber-500/40 transition-colors gap-2"
                            >
                              <div className="space-y-1">
                                <div className="flex items-start justify-between gap-1">
                                  <div className="font-bold text-xs text-foreground flex items-center gap-1.5 min-w-0">
                                    <FlaskConical className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                    <span className="truncate">{potion.name}</span>
                                  </div>
                                  <Badge variant="secondary" className="h-4 px-1 text-[9px] font-mono font-bold shrink-0">
                                    x{potion.quantity}
                                  </Badge>
                                </div>
                                {potion.nameEn && (
                                  <div className="text-[10px] text-muted-foreground italic truncate">
                                    {potion.nameEn}
                                  </div>
                                )}
                                <div className="flex items-center gap-1 flex-wrap pt-0.5">
                                  <Badge
                                    variant="outline"
                                    className="h-4 px-1 text-[8.5px] border-amber-500/40 text-amber-900 dark:text-amber-300 font-medium"
                                  >
                                    {typeLabel}
                                  </Badge>
                                  {potion.rarity && (
                                    <Badge variant="secondary" className="h-4 px-1 text-[8.5px] text-muted-foreground">
                                      {potion.rarity}
                                    </Badge>
                                  )}
                                </div>
                                {(potion.formula || potion.tempHp || potion.buffEffect) && (
                                  <div className="text-[11px] font-mono font-semibold text-emerald-700 dark:text-emerald-400 pt-0.5">
                                    {potion.formula && <span>Эффект: {potion.formula}</span>}
                                    {potion.tempHp && <span> +{potion.tempHp} врем. HP</span>}
                                    {potion.buffEffect && <span> ({potion.buffEffect})</span>}
                                  </div>
                                )}
                                {potion.description && (
                                  <div className="text-[10.5px] text-muted-foreground line-clamp-2 leading-tight pt-0.5">
                                    {potion.description}
                                  </div>
                                )}
                              </div>

                              <div className="pt-1.5 border-t border-border/40">
                                <Button
                                  size="sm"
                                  variant="default"
                                  className={
                                    "w-full " +
                                    (activeTab === "potions" ? "h-8 text-xs font-bold" : btnSizeClass) +
                                    " bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 hover:from-amber-500 hover:to-amber-700 text-amber-50 border border-amber-600/60 shadow-xs disabled:opacity-50"
                                  }
                                  disabled={isBlocked}
                                  title={blockReason || "Выпить зелье (1 Бонусное действие)"}
                                  onClick={() => onDrinkPotion?.(potion.id)}
                                >
                                  <FlaskConical className="size-3.5 mr-1" />
                                  <span>Выпить (Бонусное действие)</span>
                                </Button>
                                {isBonusBlocked && (
                                  <div className="text-[9.5px] text-red-600 dark:text-red-400 font-medium text-center mt-1">
                                    Бонусное действие уже потрачено в этом раунде
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}

function FacingCompass({
  currentFacing,
  onSetFacing,
  disabled,
}: {
  currentFacing: FacingDirection;
  onSetFacing: (facing: FacingDirection) => void;
  disabled?: boolean;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-6 px-1.5 text-[10.5px] flex items-center gap-1 border-amber-500/50 hover:border-amber-500 bg-amber-500/10 hover:bg-amber-500/20 text-foreground font-semibold"
          disabled={disabled}
          title="Направление взгляда"
        >
          <Compass className="size-3 text-amber-600 dark:text-amber-500" />
          <span className="font-bold text-amber-800 dark:text-amber-400 font-mono text-[11px]">{currentFacing}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        className="w-52 p-2.5 flex flex-col items-center gap-2 bg-card backdrop-blur-md shadow-2xl border-amber-500/40 text-foreground"
      >
        <div className="text-[10px] font-bold text-foreground uppercase tracking-wide flex items-center gap-1">
          <Compass className="size-3.5 text-amber-600 dark:text-amber-500" />
          <span>Направление взгляда</span>
        </div>

        <div className="grid grid-cols-3 grid-rows-3 gap-1 p-1.5 rounded-full bg-muted/60 border border-amber-500/30">
          <CompassButton dir="NW" icon={ArrowUpLeft} label="СЗ" title="Северо-Запад" currentFacing={currentFacing} onSelect={onSetFacing} />
          <CompassButton dir="N" icon={ArrowUp} label="С" title="Север" currentFacing={currentFacing} onSelect={onSetFacing} />
          <CompassButton dir="NE" icon={ArrowUpRight} label="СВ" title="Северо-Восток" currentFacing={currentFacing} onSelect={onSetFacing} />

          <CompassButton dir="W" icon={ArrowLeft} label="З" title="Запад" currentFacing={currentFacing} onSelect={onSetFacing} />
          <div className="size-8 rounded-full bg-amber-500/20 border-2 border-amber-500 flex items-center justify-center text-amber-900 dark:text-amber-400 font-bold text-xs select-none">
            {currentFacing}
          </div>
          <CompassButton dir="E" icon={ArrowRight} label="В" title="Восток" currentFacing={currentFacing} onSelect={onSetFacing} />

          <CompassButton dir="SW" icon={ArrowDownLeft} label="ЮЗ" title="Юго-Запад" currentFacing={currentFacing} onSelect={onSetFacing} />
          <CompassButton dir="S" icon={ArrowDown} label="Ю" title="Юг" currentFacing={currentFacing} onSelect={onSetFacing} />
          <CompassButton dir="SE" icon={ArrowDownRight} label="ЮВ" title="Юго-Восток" currentFacing={currentFacing} onSelect={onSetFacing} />
        </div>

        <div className="text-[9px] text-muted-foreground text-center">
          Сектор 120° • 0 очков движения
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CompassButton({
  dir,
  icon: Icon,
  label,
  title,
  currentFacing,
  onSelect,
}: {
  dir: FacingDirection;
  icon: any;
  label: string;
  title: string;
  currentFacing: FacingDirection;
  onSelect: (dir: FacingDirection) => void;
}) {
  const isSelected = currentFacing === dir;
  return (
    <button
      type="button"
      className={"size-8 rounded-full flex items-center justify-center transition-all " + (
        isSelected
          ? "bg-amber-500 text-black font-bold shadow ring-2 ring-amber-400 scale-105"
          : "bg-background hover:bg-amber-500/20 text-foreground hover:text-amber-600 hover:scale-105 border border-border"
      )}
      onClick={() => onSelect(dir)}
      title={title}
    >
      <Icon className={"size-3.5 " + (isSelected ? "stroke-[2.5]" : "stroke-[2]")} />
    </button>
  );
}

function ResourcePip({
  label,
  used,
  roundBased,
  title,
}: {
  label: string;
  used: boolean;
  roundBased?: boolean;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={"px-1 py-0.2 rounded text-[9.5px] font-bold cursor-default " + (
        used
          ? roundBased
            ? "bg-amber-500/20 text-amber-900 dark:text-amber-300"
            : "bg-red-500/20 text-red-900 dark:text-red-300"
          : "bg-emerald-500/20 text-emerald-950 dark:text-emerald-300"
      )}
    >
      {label}
    </span>
  );
}

function ActionButton({
  icon,
  label,
  sizeClass = "h-6 text-[10.5px]",
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  sizeClass?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      size="sm"
      variant="outline"
      className={sizeClass + " flex items-center gap-1 shadow-2xs border-border hover:bg-accent text-foreground font-semibold"}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
      <span className="text-foreground">{label}</span>
    </Button>
  );
}
