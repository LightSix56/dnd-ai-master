"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Shield,
  Footprints,
  LogOut,
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
  Heart,
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
  bonus: "Бонусное действие",
  "action+bonus": "Действие + бонусное",
  reaction: "Реакция",
  free: "Бесплатно",
  none: "—",
};

type CostKind = "action" | "bonus" | "reaction" | "free";
type Tab = "actions" | "spells" | "items";

/** Цвет по школе магии; ключ — корень слова, чтобы ловить «Воплощение»/«воплощения» */
const SCHOOL_ACCENT: Array<{ match: string; bar: string; text: string }> = [
  { match: "воплощ", bar: "bg-orange-500", text: "text-orange-600 dark:text-orange-400" },
  { match: "ограж", bar: "bg-sky-500", text: "text-sky-600 dark:text-sky-400" },
  { match: "прорицан", bar: "bg-cyan-500", text: "text-cyan-600 dark:text-cyan-400" },
  { match: "очарован", bar: "bg-pink-500", text: "text-pink-600 dark:text-pink-400" },
  { match: "вызов", bar: "bg-yellow-500", text: "text-yellow-600 dark:text-yellow-400" },
  { match: "иллюз", bar: "bg-indigo-500", text: "text-indigo-600 dark:text-indigo-400" },
  { match: "некром", bar: "bg-emerald-600", text: "text-emerald-600 dark:text-emerald-400" },
  { match: "преобраз", bar: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
];
const DEFAULT_SPELL_ACCENT = { bar: "bg-blue-500", text: "text-blue-600 dark:text-blue-400" };

function schoolAccent(school?: string) {
  const s = (school ?? "").toLowerCase();
  return SCHOOL_ACCENT.find((a) => s.includes(a.match)) ?? DEFAULT_SPELL_ACCENT;
}

function diceText(d: { dice?: string; mod?: number; type?: string }, withType = true): string {
  const dice = d.dice || "";
  const mod = d.mod ? (d.mod > 0 ? "+" + d.mod : "" + d.mod) : "";
  const type = withType && d.type ? DAMAGE_TYPE_LABELS[d.type] || d.type : "";
  return (dice + mod + " " + type).trim();
}

function damageSummary(attack: Attack): string {
  return attack.damage.map((d) => diceText(d)).join(" + ");
}

function shortDamage(attack: Attack): string {
  return attack.damage.map((d) => diceText(d, false)).filter(Boolean).join(" + ");
}

function rangeText(attack: Attack): string {
  return attack.range.long && attack.range.long > attack.range.normal
    ? attack.range.normal + "/" + attack.range.long + " фт"
    : attack.range.normal + " фт";
}

const AOE_SHAPE: Record<string, string> = {
  sphere: "сфера",
  cone: "конус",
  line: "линия",
  cylinder: "цилиндр",
  cube: "куб",
};

function spellRangeText(p?: ActionParameters): string | null {
  if (!p?.range) return null;
  if (p.range.type === "touch") return "Касание";
  if (p.range.type === "self") return "На себя";
  if (p.range.value) return p.range.value + " фт";
  return null;
}

function costKind(cost: string | undefined): CostKind {
  if (cost === "bonus") return "bonus";
  if (cost === "reaction") return "reaction";
  if (cost === "free" || cost === "none") return "free";
  return "action";
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
  onOpenWildShape,
  onRevertWildShape,
  onDrinkPotion,
}: HotbarProps) {
  const [activeTab, setActiveTab] = useState<Tab>("actions");
  const [spellFilter, setSpellFilter] = useState<number | "all">("all");
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isDead = combatant.hpCurrent <= 0;
  const totalSpeed = effectiveSpeed(combatant);
  const movementRemaining = remainingMovement(combatant);
  const isDashing = hasCondition(combatant, "dashing");
  const disabled = !isMyTurn || isDead;

  const actionAvailable = !combatant.actionUsed || combatant.extraActions > 0;
  const attacksLeft = Math.max(0, combatant.attacksPerAction - combatant.attacksMadeThisAction);

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

  const availablePotions = useMemo(
    () => (combatant.potions || []).filter((p) => p.quantity > 0),
    [combatant.potions]
  );
  const totalPotionsCount = useMemo(
    () => availablePotions.reduce((sum, p) => sum + p.quantity, 0),
    [availablePotions]
  );

  const spellsByLevel = useMemo(() => {
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
      .map(([level, spells]) => ({ level, spells }));
  }, [combatant.spells.known, spellNames, spellParams]);

  const abilityGroups = useMemo(() => {
    const groups: Record<CostKind, { label: string; items: CombatAbility[] }> = {
      action: { label: "Действие", items: [] },
      bonus: { label: "Бонусное действие", items: [] },
      reaction: { label: "Реакция", items: [] },
      free: { label: "Особые", items: [] },
    };
    for (const ab of combatant.abilities) {
      // Скрытая атака — пассивное умение: срабатывает сама при попадании, кнопки у неё нет
      if (ab.id === "sneak_attack" || ab.name.startsWith("Скрытая атака")) continue;
      // Умения, которые действуют сами (Божественный удар, Увёртливость), тоже без кнопки
      if (ab.parameters?.passive) continue;
      groups[costKind(ab.parameters?.actionCost)].items.push(ab);
    }
    return (Object.entries(groups) as Array<[CostKind, { label: string; items: CombatAbility[] }]>)
      .filter(([, g]) => g.items.length > 0)
      .map(([key, g]) => ({ key, ...g }));
  }, [combatant.abilities]);

  const hasSpells = spellsByLevel.length > 0;
  const tab: Tab = activeTab === "spells" && !hasSpells ? "actions" : activeTab;

  // ================= Мёртв / без сознания =================
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
            <Badge variant="destructive" className="h-5 text-[10px]">Погиб</Badge>
          ) : isStableCond ? (
            <Badge variant="secondary" className="h-5 text-[10px] bg-blue-500/20 text-blue-900 dark:text-blue-300 border-blue-500/40 font-semibold">
              Стабилизирован
            </Badge>
          ) : (
            <div className="flex items-center gap-1.5 text-[11px]">
              <Badge variant="outline" className="h-5 text-[10px] text-amber-900 dark:text-amber-400 border-amber-500/40 font-semibold">
                0 HP
              </Badge>
              <span className="text-emerald-700 dark:text-emerald-400 font-mono font-bold">
                Успехи: {"●".repeat(successes)}{"○".repeat(Math.max(0, 3 - successes))}
              </span>
              <span className="text-red-700 dark:text-red-400 font-mono font-bold">
                Провалы: {"●".repeat(failures)}{"○".repeat(Math.max(0, 3 - failures))}
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

  // ================= Плитки: действия =================
  const attackTiles = combatant.attacks.map((atk) => {
    const pay = canPayForAttack(combatant, atk);
    const isTargetingThis = activeTargeting?.type === "attack" && activeTargeting.id === atk.id;
    const cost = atk.actionCost === "bonus" ? "bonus" : "action";
    return (
      <Tile
        key={"atk-" + atk.id}
        label={atk.name}
        caption={"+" + atk.attackBonus + (shortDamage(atk) ? " · " + shortDamage(atk) : "")}
        barClass="bg-amber-500"
        cost={cost}
        extraCost={atk.actionCost === "action+bonus"}
        active={isTargetingThis}
        unavailable={!isTargetingThis && (disabled || !pay.ok)}
        onClick={() => (isTargetingThis ? onCancelTargeting?.() : onAttack(atk.id))}
        tooltip={{
          title: atk.name,
          tag: COST_LABEL[atk.actionCost] ?? atk.actionCost,
          lines: [
            "+" + atk.attackBonus + " к попаданию",
            damageSummary(atk),
            "Дистанция: " + rangeText(atk),
          ].filter(Boolean),
          description: atk.description,
          warning: isTargetingThis ? undefined : !isMyTurn ? "Не ваш ход" : pay.ok ? undefined : pay.reason,
          hint: isTargetingThis ? "Нажмите ещё раз или Esc, чтобы отменить выбор цели" : undefined,
        }}
      />
    );
  });

  const abilityClick = (ab: CombatAbility, isTargetingThis: boolean) => {
    if (isTargetingThis) {
      onCancelTargeting?.();
    } else if (ab.id === "revert_wild_shape" || ab.name.toLowerCase().includes("выйти из облика")) {
      if (onRevertWildShape) onRevertWildShape();
      else onUseAbility(ab.id);
    } else if (ab.id.includes("wild_shape") || ab.name.toLowerCase().includes("дикий облик")) {
      if (onOpenWildShape) onOpenWildShape();
      else onUseAbility(ab.id);
    } else {
      onUseAbility(ab.id);
    }
  };

  const abilityTiles = abilityGroups.map((grp) =>
      grp.items.map((ab) => {
        const kind = costKind(ab.parameters?.actionCost);
        const noUses = ab.usesMax > 0 && ab.usesUsed >= ab.usesMax;
        const costBlocked =
          kind === "bonus"
            ? combatant.bonusActionUsed
            : kind === "reaction"
            ? combatant.reactionUsed
            : kind === "free"
            ? false
            : !actionAvailable;
        const isTargetingThis = activeTargeting?.type === "ability" && activeTargeting.id === ab.id;
        const warning = isTargetingThis
          ? undefined
          : !isMyTurn
          ? "Не ваш ход"
          : noUses
          ? "Использования закончились"
          : costBlocked
          ? kind === "bonus"
            ? "Бонусное действие уже потрачено"
            : kind === "reaction"
            ? "Реакция уже потрачена"
            : "Действие уже потрачено"
          : undefined;
        return (
          <Tile
            key={"ab-" + ab.id}
            label={ab.name}
            charges={ab.usesMax > 0 ? ab.usesMax - ab.usesUsed + "/" + ab.usesMax : undefined}
            barClass="bg-purple-500"
            cost={kind}
            active={isTargetingThis}
            unavailable={!isTargetingThis && (disabled || noUses || costBlocked)}
            onClick={() => abilityClick(ab, isTargetingThis)}
            tooltip={{
              title: ab.name,
              tag: COST_LABEL[ab.parameters?.actionCost ?? "action"] ?? "Действие",
              lines: [
                ab.usesMax > 0 ? "Использований: " + (ab.usesMax - ab.usesUsed) + "/" + ab.usesMax : "",
              ].filter(Boolean),
              description: ab.parameters?.description,
              warning,
            }}
          />
        );
      }));

  const tacticTiles = (
    <React.Fragment key="tactics">
      <Tile
        label="Рывок"
        caption={!actionAvailable && canBonusTactics ? "бонусное" : "+" + combatant.speed + " фт"}
        barClass="bg-emerald-500"
        cost={!actionAvailable && canBonusTactics ? "bonus" : "action"}
        unavailable={disabled || !canDash || isDashing}
        onClick={onDash}
        tooltip={{
          title: "Рывок",
          tag: "Действие",
          lines: ["Удваивает скорость на этот ход"],
          warning: !isMyTurn ? "Не ваш ход" : isDashing ? "Рывок уже совершён" : !canDash ? "Действие уже потрачено" : undefined,
        }}
      />
      <Tile
        label="Уклонение"
        barClass="bg-emerald-500"
        cost="action"
        unavailable={disabled || !actionAvailable || hasCondition(combatant, "dodging")}
        onClick={onDodge}
        tooltip={{
          title: "Уклонение",
          tag: "Действие",
          lines: ["Атаки по вам с помехой до начала вашего следующего хода"],
          warning: !isMyTurn ? "Не ваш ход" : hasCondition(combatant, "dodging") ? "Уже уклоняетесь" : !actionAvailable ? "Действие уже потрачено" : undefined,
        }}
      />
      <Tile
        label="Отход"
        caption={!actionAvailable && canBonusTactics ? "бонусное" : undefined}
        barClass="bg-emerald-500"
        cost={!actionAvailable && canBonusTactics ? "bonus" : "action"}
        unavailable={disabled || !canDisengage || hasCondition(combatant, "disengaging")}
        onClick={onDisengage}
        tooltip={{
          title: "Отход",
          tag: "Действие",
          lines: ["Движение в этот ход не провоцирует атак по возможности"],
          warning: !isMyTurn ? "Не ваш ход" : hasCondition(combatant, "disengaging") ? "Уже отходите" : !canDisengage ? "Действие уже потрачено" : undefined,
        }}
      />
      <Tile
        label="Помощь"
        barClass="bg-emerald-500"
        cost="action"
        unavailable={disabled || !actionAvailable}
        onClick={onHelp}
        tooltip={{
          title: "Помощь",
          tag: "Действие",
          lines: ["Союзник из выбранной цели получает преимущество на следующую атаку"],
          warning: !isMyTurn ? "Не ваш ход" : !actionAvailable ? "Действие уже потрачено" : undefined,
        }}
      />
      {onHide && (
        <Tile
          label={combatant.isHidden ? "Скрыт" : "Спрятаться"}
          caption={!combatant.isHidden && !actionAvailable && canBonusTactics ? "бонусное" : undefined}
          barClass="bg-emerald-500"
          cost={!actionAvailable && canBonusTactics ? "bonus" : "action"}
          unavailable={disabled || !canHide || combatant.isHidden || visibilityStatus === "visible"}
          onClick={onHide}
          tooltip={{
            title: "Спрятаться",
            tag: "Действие",
            lines: ["Проверка Скрытности против Внимательности врагов"],
            warning: !isMyTurn
              ? "Не ваш ход"
              : combatant.isHidden
              ? "Вы уже скрыты"
              : visibilityStatus === "visible"
              ? "Вас видят — прятаться негде"
              : !canHide
              ? "Действие уже потрачено"
              : undefined,
          }}
        />
      )}
      {hasCondition(combatant, "prone")
        ? onStandUp && (
            <Tile
              label="Встать"
              caption={Math.floor(totalSpeed / 2) + " фт движения"}
              barClass="bg-emerald-500"
              cost="free"
              unavailable={disabled || movementRemaining < Math.floor(totalSpeed / 2)}
              onClick={onStandUp}
              tooltip={{
                title: "Встать",
                tag: "Движение",
                lines: ["Тратит половину скорости"],
                warning:
                  !isMyTurn
                    ? "Не ваш ход"
                    : movementRemaining < Math.floor(totalSpeed / 2)
                    ? "Не хватает движения"
                    : undefined,
              }}
            />
          )
        : onDropProne && (
            <Tile
              label="Лечь"
              barClass="bg-emerald-500"
              cost="free"
              unavailable={disabled}
              onClick={onDropProne}
              tooltip={{
                title: "Лечь",
                tag: "Бесплатно",
                lines: ["Укрытие от дальних атак, но помеха на атаки и уязвимость вблизи"],
                warning: !isMyTurn ? "Не ваш ход" : undefined,
              }}
            />
          )}
    </React.Fragment>
  );

  // ================= Плитки: заклинания =================
  const isWildShaped = !!combatant.wildShape;
  const slotLevels = Object.keys(combatant.spells.slots)
    .map(Number)
    .filter((l) => l > 0)
    .sort((a, b) => a - b);
  const slotSummary =
    slotLevels
      .map((l) => {
        const s = combatant.spells.slots[l];
        return l + " кр: " + (s.max - s.used) + "/" + s.max;
      })
      .join(", ") || "только заговоры";

  const spellSections = spellsByLevel
    .filter((grp) => spellFilter === "all" || grp.level === spellFilter)
    .map((grp) => {
      const slotInfo = grp.level === 0 ? null : combatant.spells.slots[grp.level];
      return (
        <TileSection
          key={"lvl-" + grp.level}
          lead={<LevelBadge level={grp.level} slot={slotInfo} />}
        >
          {grp.spells.map(({ id: spellId, name, params: p }) => {
            const isTargetingThis = activeTargeting?.type === "spell" && activeTargeting.id === spellId;
            const kind = costKind(p?.actionCost);
            const costBlocked =
              kind === "bonus"
                ? combatant.bonusActionUsed
                : kind === "reaction"
                ? combatant.reactionUsed
                : kind === "free"
                ? false
                : !actionAvailable;
            const spellLvl = p?.level ?? 0;
            const hasSlot =
              spellLvl === 0 ||
              Object.entries(combatant.spells.slots).some(
                ([l, s]) => Number(l) >= spellLvl && s.used < s.max
              );
            const canCast = !isWildShaped && !costBlocked && hasSlot;
            const accent = schoolAccent(p?.school);
            const dmg = p?.damage && p.damage.length > 0 ? p.damage.map((d) => diceText(d)).join(" + ") : "";
            const range = spellRangeText(p);

            const warning = isTargetingThis
              ? undefined
              : isWildShaped
              ? "Заклинания недоступны в облике зверя"
              : !isMyTurn
              ? "Не ваш ход"
              : !hasSlot
              ? "Нет ячеек " + spellLvl + " круга и выше (" + slotSummary + ")"
              : costBlocked
              ? kind === "bonus"
                ? "Бонусное действие уже потрачено"
                : kind === "reaction"
                ? "Реакция уже потрачена"
                : "Действие уже потрачено"
              : undefined;

            return (
              <Tile
                key={"spell-" + spellId}
                label={name}
                caption={dmg ? diceText(p!.damage![0], false) : undefined}
                barClass={accent.bar}
                cost={kind}
                concentration={!!p?.concentration}
                active={isTargetingThis}
                unavailable={!isTargetingThis && (disabled || !canCast)}
                onClick={() => (isTargetingThis ? onCancelTargeting?.() : onCastSpell(spellId))}
                tooltip={{
                  title: name,
                  tag: [spellLvl === 0 ? "Заговор" : spellLvl + " круг", p?.school].filter(Boolean).join(" · "),
                  tagClass: accent.text,
                  lines: [
                    COST_LABEL[p?.actionCost ?? "action"] ?? "",
                    range ? "Дистанция: " + range : "",
                    p?.aoe ? "Область: " + p.aoe.size + " фт (" + (AOE_SHAPE[p.aoe.shape] ?? p.aoe.shape) + ")" : "",
                    dmg ? "Урон: " + dmg : "",
                    p?.saveType ? "Спасбросок: " + p.saveType : "",
                    p?.concentration ? "Концентрация" : "",
                    spellLvl > 0 ? "Ячейки: " + slotSummary : "",
                  ].filter(Boolean),
                  description: p?.description,
                  warning,
                  hint: isTargetingThis ? "Нажмите ещё раз или Esc, чтобы отменить выбор цели" : undefined,
                }}
              />
            );
          })}
        </TileSection>
      );
    });

  // ================= Плитки: предметы =================
  const itemTiles = (
    <TileSection>
      {availablePotions.length === 0 ? (
        <div className="text-xs text-muted-foreground py-3 px-1">В инвентаре нет доступных зелий</div>
      ) : (
        availablePotions.map((p: CombatPotion) => {
          const blocked = disabled || combatant.bonusActionUsed || p.quantity <= 0;
          const typeLabel = p.type === "heal" ? "Лечение" : p.type === "buff" ? "Усиление" : "Прочее";
          return (
            <Tile
              key={"potion-" + p.id}
              label={p.name}
              caption={p.formula}
              charges={"×" + p.quantity}
              barClass={p.type === "heal" ? "bg-rose-500" : p.type === "buff" ? "bg-sky-500" : "bg-slate-400"}
              cost="bonus"
              unavailable={blocked}
              onClick={() => onDrinkPotion?.(p.id)}
              tooltip={{
                title: p.name,
                tag: [typeLabel, p.rarity].filter(Boolean).join(" · "),
                lines: [
                  "Бонусное действие",
                  p.formula ? "Эффект: " + p.formula : "",
                  p.tempHp ? "+" + p.tempHp + " врем. HP" : "",
                  p.buffEffect ?? "",
                ].filter(Boolean),
                description: p.description,
                warning: !isMyTurn
                  ? "Не ваш ход"
                  : combatant.bonusActionUsed
                  ? "Бонусное действие уже потрачено"
                  : undefined,
              }}
            />
          );
        })
      )}
    </TileSection>
  );

  // ================= Портрет и ресурсы =================
  const hpPct = combatant.hpMax > 0 ? Math.max(0, Math.min(100, (combatant.hpCurrent / combatant.hpMax) * 100)) : 0;
  const hpColor = hpPct > 50 ? "bg-emerald-500" : hpPct > 25 ? "bg-amber-500" : "bg-red-500";
  const movePct = totalSpeed > 0 ? Math.max(0, Math.min(100, (movementRemaining / totalSpeed) * 100)) : 0;

  return (
    <div className="border-t bg-card/95 backdrop-blur-md px-2.5 pt-1.5 pb-2 shadow-2xl select-none text-foreground">
      <div className="max-w-6xl mx-auto space-y-1.5">
        {/* ============ Индикаторы ресурсов хода ============ */}
        <div className="flex items-center justify-center gap-x-3 gap-y-1 flex-wrap text-[11px]">
          {!isMyTurn && (
            <span className="text-amber-800 dark:text-amber-400 font-semibold">Ход другого бойца</span>
          )}
          <ResourceGem kind="action" label="Действие" used={!actionAvailable} extra={combatant.extraActions} />
          <ResourceGem kind="bonus" label="Бонусное" used={combatant.bonusActionUsed} />
          <ResourceGem kind="reaction" label="Реакция" used={combatant.reactionUsed} />

          <div
            className="flex items-center gap-1.5"
            title={"Движение: " + movementRemaining + " из " + totalSpeed + " фт" + (isDashing ? " (рывок)" : "")}
          >
            <Footprints className="size-3.5 text-amber-600 dark:text-amber-400" />
            <div className="w-24 h-2 rounded-full bg-muted overflow-hidden border border-border/60">
              <div
                className={"h-full transition-all " + (movementRemaining === 0 ? "bg-red-500" : "bg-amber-500")}
                style={{ width: movePct + "%" }}
              />
            </div>
            <span className="font-mono font-bold tabular-nums">
              {movementRemaining}/{totalSpeed} фт
            </span>
          </div>

          {combatant.attacksPerAction > 1 && (
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-amber-500/50 text-amber-900 dark:text-amber-300 font-semibold">
              Атак: {attacksLeft}/{combatant.attacksPerAction}
            </Badge>
          )}
          {combatant.concentration && (
            <Badge
              variant="outline"
              className="h-5 px-1.5 text-[10px] bg-purple-500/15 text-purple-900 dark:text-purple-300 border-purple-500/50 font-bold"
              title="Концентрация"
            >
              ◆ {combatant.concentration.spellName}
            </Badge>
          )}
          {combatant.wildShape && (
            <Badge
              variant="outline"
              className="h-5 px-1.5 text-[10px] bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 border-emerald-500/60 font-bold"
            >
              {combatant.wildShape.icon || "🐾"} {combatant.wildShape.formName}
            </Badge>
          )}
          {combatant.conditions
            .filter((c) => c.type !== "death_save")
            .map((c, i) => (
              <Badge
                key={i}
                variant="outline"
                className="h-5 px-1.5 text-[10px] bg-amber-500/15 text-amber-950 dark:text-amber-300 border-amber-500/40 font-semibold"
                title={CONDITION_EFFECTS[c.type]?.description}
              >
                {CONDITION_EFFECTS[c.type]?.name || c.type}
                {c.duration ? " (" + c.duration + ")" : ""}
              </Badge>
            ))}

          <Button
            size="icon"
            variant="ghost"
            className="size-5 text-muted-foreground hover:text-foreground"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? "Развернуть панель" : "Свернуть панель"}
          >
            {isCollapsed ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </Button>
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

        {/* ============ Основная панель ============ */}
        {!isCollapsed && (
          <div className="flex flex-col md:flex-row md:items-stretch gap-2">
            {/* Портрет */}
            <div className="md:w-48 shrink-0 flex md:flex-col items-center md:items-stretch gap-2.5 md:gap-1.5 p-2 rounded-lg border bg-muted/40">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative shrink-0">
                  <div
                    className="size-12 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-md ring-2 ring-offset-2 ring-offset-card"
                    style={{ backgroundColor: combatant.color, ["--tw-ring-color" as string]: combatant.color }}
                  >
                    {combatant.name.charAt(0).toUpperCase()}
                  </div>
                  <div
                    className="absolute -bottom-1 -right-2 flex items-center gap-0.5 rounded-full bg-card border px-1.5 py-px text-[11px] font-bold font-mono shadow"
                    title="Класс доспеха"
                  >
                    <Shield className="size-3 text-blue-600 dark:text-blue-400" />
                    {combatant.ac}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-sm leading-tight truncate" title={combatant.name}>{combatant.name}</div>
                  <div className="text-[10.5px] text-muted-foreground truncate">
                    {[combatant.className, combatant.level ? combatant.level + " ур." : ""].filter(Boolean).join(" · ")}
                  </div>
                </div>
              </div>
              <div className="flex-1 md:flex-none min-w-0" title="Хиты">
                <div className="relative h-4 rounded-full bg-muted border border-border overflow-hidden">
                  <div className={"h-full transition-all " + hpColor} style={{ width: hpPct + "%" }} />
                  <div className="absolute inset-0 flex items-center justify-center gap-1 text-[10.5px] font-bold font-mono text-foreground drop-shadow-sm">
                    <Heart className="size-2.5 fill-current text-red-500" />
                    {combatant.hpCurrent}/{combatant.hpMax}
                    {combatant.hpTemp > 0 && (
                      <span className="text-blue-700 dark:text-blue-300">+{combatant.hpTemp}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Сетка действий */}
            <div className="flex-1 min-w-0 rounded-lg border bg-muted/20 flex flex-col">
              <div className="flex items-center gap-1 px-1.5 pt-1 border-b border-border/60">
                <TabButton active={tab === "actions"} onClick={() => setActiveTab("actions")}>
                  Действия
                </TabButton>
                {hasSpells && (
                  <TabButton active={tab === "spells"} onClick={() => setActiveTab("spells")}>
                    Заклинания
                  </TabButton>
                )}
                <TabButton active={tab === "items"} onClick={() => setActiveTab("items")}>
                  Предметы{totalPotionsCount > 0 ? " (" + totalPotionsCount + ")" : ""}
                </TabButton>

                {tab === "spells" && (
                  <div className="ml-auto flex items-center gap-0.5 pb-1 overflow-x-auto">
                    <FilterChip active={spellFilter === "all"} onClick={() => setSpellFilter("all")}>
                      Все
                    </FilterChip>
                    {spellsByLevel.map((grp) => {
                      const slot = grp.level === 0 ? null : combatant.spells.slots[grp.level];
                      return (
                        <FilterChip
                          key={grp.level}
                          active={spellFilter === grp.level}
                          dim={!!slot && slot.used >= slot.max}
                          onClick={() => setSpellFilter(grp.level)}
                        >
                          {grp.level === 0 ? "Заг." : grp.level}
                          {slot && <span className="ml-1 font-mono">{slot.max - slot.used}/{slot.max}</span>}
                        </FilterChip>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="p-1.5 h-[136px] overflow-y-auto">
                {tab === "actions" && (
                  <div className="flex flex-wrap gap-1">
                    {[attackTiles, ...abilityTiles, [tacticTiles]]
                      .filter((g) => g.length > 0)
                      .map((g, i) => (
                        <TileSection key={i} divider={i > 0}>
                          {g}
                        </TileSection>
                      ))}
                  </div>
                )}
                {tab === "spells" && <div className="flex flex-wrap gap-1">{spellSections}</div>}
                {tab === "items" && <div className="flex flex-wrap gap-1">{itemTiles}</div>}
              </div>
            </div>

            {/* Завершить ход */}
            <div className="md:w-40 shrink-0 flex md:flex-col gap-1.5">
              {isMyTurn ? (
                <Button
                  className="flex-1 md:h-auto min-h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md flex md:flex-col items-center justify-center gap-1"
                  onClick={onEndTurn}
                >
                  <LogOut className="size-4" />
                  <span>Завершить ход</span>
                </Button>
              ) : (
                <div className="flex-1 min-h-12 rounded-md border border-dashed flex items-center justify-center text-[11px] text-muted-foreground text-center px-2">
                  Ожидание хода
                </div>
              )}
              <div className="flex md:flex-col gap-1.5">
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
                    className="h-7 text-[11px] bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-950 dark:text-emerald-300 border-emerald-500/50 font-bold"
                    disabled={disabled || combatant.bonusActionUsed}
                    onClick={onRevertWildShape}
                    title="Вернуться в истинный облик"
                  >
                    Выйти из зверя
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ================= Вспомогательные компоненты =================

interface TileTooltip {
  title: string;
  tag?: string;
  tagClass?: string;
  lines?: string[];
  description?: string;
  warning?: string;
  hint?: string;
}

function Tile({
  label,
  caption,
  charges,
  barClass,
  cost,
  extraCost,
  concentration,
  active,
  unavailable,
  onClick,
  tooltip,
}: {
  label: string;
  caption?: string;
  charges?: string;
  barClass: string;
  cost: CostKind;
  /** Атака «действие + бонусное»: рядом с маркером действия рисуем маркер бонусного */
  extraCost?: boolean;
  concentration?: boolean;
  active?: boolean;
  unavailable?: boolean;
  onClick: () => void;
  tooltip: TileTooltip;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-disabled={unavailable || undefined}
          onClick={() => {
            if (!unavailable) onClick();
          }}
          className={
            "relative w-[92px] h-[60px] shrink-0 rounded-md border bg-card text-left overflow-hidden transition-all flex flex-col " +
            (active
              ? "ring-2 ring-red-500 border-red-500 animate-pulse "
              : unavailable
              ? "opacity-40 cursor-not-allowed grayscale-[40%] "
              : "hover:-translate-y-0.5 hover:shadow-md hover:border-foreground/40 cursor-pointer ")
          }
        >
          <span className="flex items-center gap-1 h-3.5 px-1.5 shrink-0">
            <span className={"h-1 flex-1 rounded-full " + barClass} />
            {concentration && <span className="text-[8px] leading-none text-purple-600 dark:text-purple-400 font-bold">◆</span>}
            <CostMarker kind={cost} size="sm" />
            {extraCost && <CostMarker kind="bonus" size="sm" />}
          </span>
          <span className="flex-1 px-1.5 pb-0.5 flex flex-col justify-between min-h-0">
            <span className="text-[11px] font-semibold leading-[1.1] line-clamp-2 break-words">{label}</span>
            <span className="flex items-end justify-between gap-1">
              <span className="text-[9.5px] font-mono text-muted-foreground truncate">{caption}</span>
              {charges && (
                <span className="text-[9.5px] font-mono font-bold bg-muted rounded px-1 shrink-0">{charges}</span>
              )}
            </span>
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={6}
        className="bg-popover text-popover-foreground border shadow-xl max-w-72 p-0 z-[400] [&>svg]:hidden"
      >
        <div className="px-3 py-2 space-y-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-bold text-sm">{tooltip.title}</span>
          </div>
          {tooltip.tag && (
            <div className={"text-[10.5px] font-semibold " + (tooltip.tagClass ?? "text-muted-foreground")}>{tooltip.tag}</div>
          )}
          {tooltip.lines && tooltip.lines.length > 0 && (
            <ul className="text-[11px] space-y-0.5">
              {tooltip.lines.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          )}
          {tooltip.description && (
            <p className="text-[11px] text-muted-foreground leading-snug whitespace-pre-line">{tooltip.description}</p>
          )}
          {tooltip.hint && <p className="text-[10.5px] text-muted-foreground italic">{tooltip.hint}</p>}
          {tooltip.warning && (
            <p className="text-[11px] font-semibold text-red-600 dark:text-red-400">{tooltip.warning}</p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/** Группа плиток: сама ничего не рисует, плитки текут в общей сетке; перед группой — тонкий разделитель */
function TileSection({
  lead,
  divider,
  children,
}: {
  lead?: React.ReactNode;
  divider?: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      {divider && <span aria-hidden className="w-px self-stretch bg-border mx-0.5" />}
      {lead}
      {children}
    </>
  );
}

function LevelBadge({ level, slot }: { level: number; slot: { max: number; used: number } | null }) {
  return (
    <div
      className="w-8 h-[60px] shrink-0 rounded-md border bg-muted/60 flex flex-col items-center justify-center gap-1"
      title={level === 0 ? "Заговоры" : level + " круг" + (slot ? ": ячеек " + (slot.max - slot.used) + " из " + slot.max : "")}
    >
      <span className="text-sm font-bold leading-none">{level === 0 ? "∞" : level}</span>
      {slot && <SlotPips max={slot.max} used={slot.used} vertical />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "px-2.5 py-1 text-[11.5px] font-bold rounded-t-md border-b-2 transition-colors " +
        (active
          ? "border-foreground text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}

function FilterChip({
  active,
  dim,
  onClick,
  children,
}: {
  active: boolean;
  dim?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "px-1.5 h-5 rounded text-[10px] font-bold border shrink-0 transition-colors " +
        (active ? "bg-foreground text-background border-foreground " : "bg-card hover:bg-accent border-border ") +
        (dim && !active ? "opacity-50" : "")
      }
    >
      {children}
    </button>
  );
}

function SlotPips({ max, used, vertical }: { max: number; used: number; vertical?: boolean }) {
  return (
    <span className={"flex items-center gap-0.5 " + (vertical ? "flex-wrap justify-center max-w-[22px]" : "")} title={"Ячеек: " + (max - used) + " из " + max}>
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className={
            "size-2 rounded-full border " +
            (i < max - used ? "bg-blue-500 border-blue-500" : "bg-transparent border-muted-foreground/50")
          }
        />
      ))}
    </span>
  );
}

const COST_STYLE: Record<CostKind, { fill: string; shape: string; title: string }> = {
  action: { fill: "bg-emerald-500", shape: "rounded-full", title: "Действие" },
  bonus: {
    fill: "bg-orange-500",
    shape: "[clip-path:polygon(50%_0,100%_100%,0_100%)]",
    title: "Бонусное действие",
  },
  reaction: { fill: "bg-violet-500", shape: "rotate-45 rounded-[2px]", title: "Реакция" },
  free: { fill: "bg-slate-400", shape: "rounded-[2px]", title: "Бесплатно" },
};

function CostMarker({ kind, size, used }: { kind: CostKind; size: "sm" | "md"; used?: boolean }) {
  const s = COST_STYLE[kind];
  const dim = size === "md" ? "size-3.5" : "size-2";
  return (
    <span
      aria-hidden
      className={"inline-block " + dim + " " + s.shape + " " + (used ? "bg-muted-foreground/30" : s.fill)}
    />
  );
}

function ResourceGem({
  kind,
  label,
  used,
  extra,
}: {
  kind: CostKind;
  label: string;
  used: boolean;
  extra?: number;
}) {
  return (
    <div
      className={"flex items-center gap-1.5 transition-opacity " + (used ? "opacity-50" : "")}
      title={label + (used ? ": потрачено" : ": доступно")}
    >
      <CostMarker kind={kind} size="md" used={used} />
      <span className={"font-semibold " + (used ? "line-through text-muted-foreground" : "")}>{label}</span>
      {!!extra && extra > 0 && (
        <Badge className="h-4 px-1 text-[9px] bg-amber-500 hover:bg-amber-500 text-black font-bold">+{extra}</Badge>
      )}
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
          className="h-7 flex-1 px-1.5 text-[11px] flex items-center justify-center gap-1 font-semibold"
          disabled={disabled}
          title="Направление взгляда"
        >
          <Compass className="size-3 text-amber-600 dark:text-amber-500" />
          <span>Взгляд</span>
          <span className="font-bold text-amber-800 dark:text-amber-400 font-mono">{currentFacing}</span>
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
          <CompassButton dir="NW" icon={ArrowUpLeft} title="Северо-Запад" currentFacing={currentFacing} onSelect={onSetFacing} />
          <CompassButton dir="N" icon={ArrowUp} title="Север" currentFacing={currentFacing} onSelect={onSetFacing} />
          <CompassButton dir="NE" icon={ArrowUpRight} title="Северо-Восток" currentFacing={currentFacing} onSelect={onSetFacing} />

          <CompassButton dir="W" icon={ArrowLeft} title="Запад" currentFacing={currentFacing} onSelect={onSetFacing} />
          <div className="size-8 rounded-full bg-amber-500/20 border-2 border-amber-500 flex items-center justify-center text-amber-900 dark:text-amber-400 font-bold text-xs select-none">
            {currentFacing}
          </div>
          <CompassButton dir="E" icon={ArrowRight} title="Восток" currentFacing={currentFacing} onSelect={onSetFacing} />

          <CompassButton dir="SW" icon={ArrowDownLeft} title="Юго-Запад" currentFacing={currentFacing} onSelect={onSetFacing} />
          <CompassButton dir="S" icon={ArrowDown} title="Юг" currentFacing={currentFacing} onSelect={onSetFacing} />
          <CompassButton dir="SE" icon={ArrowDownRight} title="Юго-Восток" currentFacing={currentFacing} onSelect={onSetFacing} />
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
  title,
  currentFacing,
  onSelect,
}: {
  dir: FacingDirection;
  icon: React.ComponentType<{ className?: string }>;
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
