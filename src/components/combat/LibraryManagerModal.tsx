"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BookOpen,
  Search,
  Plus,
  Edit2,
  Trash2,
  Copy,
  Swords,
  Sparkles,
  Flame,
  Shield,
  UserPlus,
  RefreshCw,
  Clock,
  Target,
  Zap,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { toast } from "sonner";
import {
  LibraryItemEditorModal,
  type EditableLibraryItem,
  type LibraryCategory,
} from "./LibraryItemEditorModal";
import type { Combatant, AttackKind, ActionCost, DamageRoll, ActionParameters } from "@/lib/combat/types";
import { DAMAGE_TYPE_LABELS } from "@/lib/combat/types";

interface AttackItem {
  id: string;
  name: string;
  kind: AttackKind;
  attackBonus: number;
  damage: DamageRoll[];
  rangeNormal: number;
  rangeLong?: number;
  finesse?: boolean;
  actionCost: ActionCost;
  description?: string;
}

interface SpellItem {
  id: string;
  name: string;
  level: number;
  school?: string;
  parameters: ActionParameters;
}

interface AbilityItem {
  id: string;
  name: string;
  source?: string;
  className?: string;
  minLevel?: number;
  category: "damage" | "utility";
  parameters: ActionParameters;
}

interface Props {
  combatId?: string;
  targetCombatant?: Combatant | null;
  onAddedToCombatant?: () => void;
  onClose: () => void;
}

export function LibraryManagerModal({
  combatId,
  targetCombatant,
  onAddedToCombatant,
  onClose,
}: Props) {
  const [activeTab, setActiveTab] = useState<LibraryCategory>("attack");
  const [search, setSearch] = useState("");
  const [spellLevelFilter, setSpellLevelFilter] = useState<number | "all">("all");
  const [spellSchoolFilter, setSpellSchoolFilter] = useState<string | "all">("all");
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const [attacks, setAttacks] = useState<AttackItem[]>([]);
  const [spells, setSpells] = useState<SpellItem[]>([]);
  const [damageAbilities, setDamageAbilities] = useState<AbilityItem[]>([]);
  const [utilityAbilities, setUtilityAbilities] = useState<AbilityItem[]>([]);

  // Редактор
  const [editingItem, setEditingItem] = useState<Partial<EditableLibraryItem> | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const loadLibrary = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/library");
      if (res.ok) {
        const data = await res.json();
        setAttacks(data.attacks || []);
        setSpells(data.spells || []);
        setDamageAbilities(data.damageAbilities || []);
        setUtilityAbilities(data.utilityAbilities || []);
      }
    } catch (e) {
      toast.error("Не удалось загрузить библиотеку");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  async function handleSeed() {
    setSeeding(true);
    try {
      const res = await fetch("/api/library/seed", { method: "POST" });
      if (res.ok) {
        toast.success("Библиотека синхронизирована с базой D&D 5e!");
        await loadLibrary();
      } else {
        toast.error("Ошибка синхронизации");
      }
    } catch (e) {
      toast.error(`Ошибка: ${(e as Error).message}`);
    } finally {
      setSeeding(false);
    }
  }

  async function handleDelete(kind: "attack" | "spell" | "ability", id: string, name: string) {
    if (!confirm(`Удалить «${name}» из библиотеки?`)) return;
    try {
      const res = await fetch("/api/library", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id }),
      });
      if (res.ok) {
        toast.success(`«${name}» удалено`);
        await loadLibrary();
      }
    } catch (e) {
      toast.error("Не удалось удалить элемент");
    }
  }

  async function handleSaveItem(item: EditableLibraryItem) {
    const isAttack = item.category === "attack";
    const isSpell = item.category === "spell";
    const kind = isAttack ? "attack" : isSpell ? "spell" : "ability";

    let payload: any = {
      kind,
      id: item.id,
      name: item.name,
      description: item.description,
      actionCost: item.actionCost,
    };

    if (isAttack) {
      payload.attackKind = item.rangeType === "ranged" ? "ranged" : "melee";
      payload.attackBonus = 0;
      payload.damage = item.damage;
      payload.rangeNormal = item.rangeNormal;
      payload.rangeLong = item.rangeLong;
      payload.finesse = item.finesse;
    } else if (isSpell) {
      payload.level = item.level;
      payload.school = item.school;
      payload.parameters = {
        name: item.name,
        type: "spell",
        level: item.level,
        actionCost: item.actionCost,
        range: {
          type: item.rangeType,
          value: item.rangeType === "self" ? undefined : item.rangeNormal,
          longRange: item.rangeLong,
        },
        aoe: item.hasAoe && item.aoeShape ? { shape: item.aoeShape, size: item.aoeSize ?? 20 } : null,
        damage: item.damage,
        saveType: item.hasSave ? item.saveType : null,
        saveDC: item.hasSave && item.saveDC ? item.saveDC : null,
        effects: item.conditionType
          ? [{ condition: item.conditionType, durationRounds: item.conditionDuration ?? 1 }]
          : [],
        concentration: item.concentration,
        targeting: item.hasAoe ? "point" : item.rangeType === "self" ? "self" : "creature",
        spellSlotLevel: item.level,
        description: item.description,
      };
    } else {
      payload.className = item.className;
      payload.minLevel = item.minLevel;
      payload.category = item.category === "damage_ability" ? "damage" : "utility";
      payload.parameters = {
        name: item.name,
        type: "ability",
        actionCost: item.actionCost,
        range: {
          type: item.rangeType,
          value: item.rangeType === "self" ? undefined : item.rangeNormal,
        },
        aoe: item.hasAoe && item.aoeShape ? { shape: item.aoeShape, size: item.aoeSize ?? 20 } : null,
        damage: item.damage,
        saveType: item.hasSave ? item.saveType : null,
        saveDC: item.hasSave && item.saveDC ? item.saveDC : null,
        selfEffects: item.conditionType && item.rangeType === "self"
          ? [{ condition: item.conditionType, durationRounds: item.conditionDuration ?? 1 }]
          : [],
        effects: item.conditionType && item.rangeType !== "self"
          ? [{ condition: item.conditionType, durationRounds: item.conditionDuration ?? 1 }]
          : [],
        targeting: item.hasAoe ? "point" : item.rangeType === "self" ? "self" : "creature",
        uses: item.usesMax ?? 0,
        refresh: item.refresh ?? "none",
        description: item.description,
      };
    }

    const res = await fetch("/api/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Ошибка сохранения");
    }

    await loadLibrary();
  }

  async function handleAddToCombatant(itemType: "attack" | "spell" | "ability", itemId: string, itemName: string) {
    if (!combatId || !targetCombatant) {
      toast.info("Выберите персонажа на сетке боя, чтобы добавить способность");
      return;
    }

    try {
      const res = await fetch("/api/combat/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          combatId,
          action: "add-from-library",
          combatantId: targetCombatant.id,
          itemType,
          itemId,
          itemName,
        }),
      });

      if (res.ok) {
        toast.success(`«${itemName}» добавлено бойцу ${targetCombatant.name}!`);
        onAddedToCombatant?.();
      } else {
        toast.error("Не удалось добавить скилл бойцу");
      }
    } catch (e) {
      toast.error(`Ошибка: ${(e as Error).message}`);
    }
  }

  // Фильтрация поиска
  const filteredAttacks = useMemo(
    () => attacks.filter((a) => a.name.toLowerCase().includes(search.toLowerCase())),
    [attacks, search]
  );
  const filteredSpells = useMemo(() => {
    const q = search.toLowerCase().trim();
    return spells.filter((s) => {
      if (spellLevelFilter !== "all" && s.level !== spellLevelFilter) return false;
      if (spellSchoolFilter !== "all" && s.school?.toLowerCase() !== spellSchoolFilter.toLowerCase()) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        (s.school && s.school.toLowerCase().includes(q)) ||
        (s.parameters?.description && s.parameters.description.toLowerCase().includes(q))
      );
    });
  }, [spells, search, spellLevelFilter, spellSchoolFilter]);
  const filteredDamageAbilities = useMemo(
    () => damageAbilities.filter((a) => a.name.toLowerCase().includes(search.toLowerCase())),
    [damageAbilities, search]
  );
  const filteredUtilityAbilities = useMemo(
    () => utilityAbilities.filter((a) => a.name.toLowerCase().includes(search.toLowerCase())),
    [utilityAbilities, search]
  );

  return (
    <>
      <Dialog open onOpenChange={onClose}>
        <DialogContent className={"flex flex-col p-0 bg-card border-border shadow-2xl overflow-hidden transition-all duration-200 " + (
          isFullScreen
            ? "!max-w-full sm:!max-w-full w-screen h-screen !rounded-none !top-0 !left-0 !translate-x-0 !translate-y-0"
            : "!max-w-[96vw] sm:!max-w-[96vw] w-[96vw] h-[92vh] rounded-xl"
        )}>
          {/* Header */}
          <DialogHeader className="p-4 pb-2 border-b bg-card/60">
            <div className="flex items-center justify-between gap-4">
              <DialogTitle className="flex items-center gap-2 text-lg">
                <BookOpen className="size-5 text-blue-500" />
                Библиотека боевого движка
                {targetCombatant && (
                  <Badge variant="outline" className="ml-2 text-xs border-blue-500/40 text-blue-400 bg-blue-500/10">
                    Цель: {targetCombatant.name}
                  </Badge>
                )}
              </DialogTitle>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSeed}
                  disabled={seeding}
                  className="h-8 text-xs"
                >
                  <RefreshCw className={`size-3 mr-1 ${seeding ? "animate-spin" : ""}`} />
                  {seeding ? "Обновление..." : "Сброс к D&D 5e"}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0"
                  onClick={() => setIsFullScreen(!isFullScreen)}
                  title={isFullScreen ? "Оконный режим" : "На весь экран"}
                >
                  {isFullScreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingItem({ category: activeTab });
                    setIsEditorOpen(true);
                  }}
                  className="h-8 text-xs bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="size-3.5 mr-1" />
                  Создать
                </Button>
              </div>
            </div>

            {/* Поиск */}
            <div className="relative mt-2">
              <Search className="size-4 absolute left-2.5 top-2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по названию..."
                className="pl-8 h-8 text-xs bg-background/50"
              />
            </div>
          </DialogHeader>

          {/* Вкладки 4 категорий */}
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as LibraryCategory)}
            className="flex-1 flex flex-col overflow-hidden min-h-0"
          >
            <div className="px-4 pt-2 border-b bg-muted/20">
              <TabsList className="grid grid-cols-4 h-9">
                <TabsTrigger value="attack" className="text-xs gap-1.5">
                  <Swords className="size-3.5 text-amber-500" />
                  Удары ({filteredAttacks.length})
                </TabsTrigger>
                <TabsTrigger value="spell" className="text-xs gap-1.5">
                  <Sparkles className="size-3.5 text-indigo-400" />
                  Заклинания ({filteredSpells.length})
                </TabsTrigger>
                <TabsTrigger value="damage_ability" className="text-xs gap-1.5">
                  <Flame className="size-3.5 text-rose-500" />
                  Способности (Урон) ({filteredDamageAbilities.length})
                </TabsTrigger>
                <TabsTrigger value="utility_ability" className="text-xs gap-1.5">
                  <Shield className="size-3.5 text-blue-400" />
                  Утилиты / Хил ({filteredUtilityAbilities.length})
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Контент категорий */}
            <div className="flex-1 overflow-hidden min-h-0 p-4">
              {loading ? (
                <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">
                  Загрузка библиотеки...
                </div>
              ) : (
                <>
                  {/* 1. УДАРЫ */}
                  <TabsContent value="attack" className="h-full m-0">
                    <div className="h-full overflow-y-auto min-h-0 max-h-[calc(92vh-210px)] pr-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {filteredAttacks.map((atk) => (
                          <div
                            key={atk.id}
                            className="border rounded-md p-3 bg-card/40 hover:bg-card/70 transition-colors flex flex-col justify-between space-y-2"
                          >
                            <div>
                              <div className="flex items-start justify-between gap-2">
                                <div className="font-semibold text-sm flex items-center gap-1.5">
                                  <Swords className="size-4 text-amber-500 shrink-0" />
                                  {atk.name}
                                </div>
                                <Badge variant="outline" className="text-[10px] uppercase font-mono shrink-0">
                                  {atk.kind === "ranged" ? "Дальний" : "Ближний"}
                                </Badge>
                              </div>

                              <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground mt-1 font-mono">
                                <span>
                                  🎲{" "}
                                  {atk.damage.map((d) => `${d.dice}${d.mod ? `+${d.mod}` : ""} ${DAMAGE_TYPE_LABELS[d.type] || d.type}`).join(" + ")}
                                </span>
                                <span>• 🎯 {atk.rangeNormal}{atk.rangeLong ? `/${atk.rangeLong}` : ""} фт</span>
                                {atk.finesse && <span className="text-emerald-400">• Фехт.</span>}
                              </div>

                              {atk.description && (
                                <p className="text-xs text-muted-foreground line-clamp-2 mt-1.5">
                                  {atk.description}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-border/30">
                              <div className="flex items-center gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingItem({
                                      id: atk.id,
                                      category: "attack",
                                      name: atk.name,
                                      rangeType: atk.kind === "ranged" ? "ranged" : "melee",
                                      rangeNormal: atk.rangeNormal,
                                      rangeLong: atk.rangeLong,
                                      finesse: atk.finesse,
                                      actionCost: atk.actionCost,
                                      damage: atk.damage,
                                      description: atk.description,
                                    });
                                    setIsEditorOpen(true);
                                  }}
                                  className="size-7"
                                  title="Редактировать"
                                >
                                  <Edit2 className="size-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleDelete("attack", atk.id, atk.name)}
                                  className="size-7 text-destructive"
                                  title="Удалить"
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>

                              {targetCombatant && (
                                <Button
                                  size="sm"
                                  onClick={() => handleAddToCombatant("attack", atk.id, atk.name)}
                                  className="h-7 text-xs bg-amber-600 hover:bg-amber-700"
                                >
                                  <UserPlus className="size-3 mr-1" />
                                  Добавить {targetCombatant.name}
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </TabsContent>


                  {/* 2. ЗАКЛИНАНИЯ */}
                  <TabsContent value="spell" className="h-full m-0 flex flex-col">
                    {/* Круги заклинаний и школы */}
                    <div className="flex items-center gap-1.5 pb-2 mb-2 border-b border-border/40 overflow-x-auto shrink-0 flex-wrap">
                      <span className="text-xs font-semibold text-muted-foreground mr-1">Круг:</span>
                      <Button
                        size="sm"
                        variant={spellLevelFilter === "all" ? "default" : "outline"}
                        className="h-6 px-2 text-xs"
                        onClick={() => setSpellLevelFilter("all")}
                      >
                        Все ({spells.length})
                      </Button>
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((lvl) => {
                        const count = spells.filter((s) => s.level === lvl).length;
                        return (
                          <Button
                            key={lvl}
                            size="sm"
                            variant={spellLevelFilter === lvl ? "default" : "outline"}
                            className="h-6 px-2 text-xs font-mono"
                            onClick={() => setSpellLevelFilter(lvl)}
                          >
                            {lvl === 0 ? "Заговоры" : `${lvl} круг`} ({count})
                          </Button>
                        );
                      })}
                    </div>

                    <div className="h-full overflow-y-auto min-h-0 max-h-[calc(92vh-210px)] pr-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {filteredSpells.map((sp) => {
                          const p = sp.parameters;
                          return (
                            <div
                              key={sp.id}
                              className="border rounded-md p-3 bg-card/40 hover:bg-card/70 transition-colors flex flex-col justify-between space-y-2"
                            >
                              <div>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="font-semibold text-sm flex items-center gap-1.5">
                                    <Sparkles className="size-4 text-indigo-400 shrink-0" />
                                    {sp.name}
                                  </div>
                                  <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                                    {sp.level === 0 ? "Заговор" : `${sp.level} круг`}
                                  </Badge>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground mt-1 font-mono">
                                  {p.damage && p.damage.length > 0 && (
                                    <span>
                                      🎲 {p.damage.map((d) => `${d.dice}${d.mod ? `+${d.mod}` : ""} ${DAMAGE_TYPE_LABELS[d.type] || d.type}`).join(" + ")}
                                    </span>
                                  )}
                                  {p.saveType && (
                                    <span className="text-amber-400">🛡️ Спас {p.saveType}</span>
                                  )}
                                  {p.aoe && (
                                    <span className="text-blue-400">
                                      📐 {p.aoe.shape} {p.aoe.size} фт
                                    </span>
                                  )}
                                  {p.concentration && <span className="text-purple-400">🧘 Конц.</span>}
                                </div>

                                {p.description && (
                                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1.5">
                                    {p.description}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-border/30">
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => {
                                      setEditingItem({
                                        id: sp.id,
                                        category: "spell",
                                        name: sp.name,
                                        level: sp.level,
                                        school: sp.school,
                                        actionCost: p.actionCost || "action",
                                        rangeType: (p.range?.type as any) || "ranged",
                                        rangeNormal: p.range?.value ?? 60,
                                        rangeLong: p.range?.longRange,
                                        hasAoe: !!p.aoe,
                                        aoeShape: p.aoe?.shape,
                                        aoeSize: p.aoe?.size,
                                        damage: p.damage || [],
                                        hasSave: !!p.saveType,
                                        saveType: p.saveType || "DEX",
                                        saveDC: p.saveDC,
                                        concentration: p.concentration,
                                        conditionType: p.effects?.[0]?.condition,
                                        conditionDuration: p.effects?.[0]?.durationRounds,
                                        description: p.description,
                                      });
                                      setIsEditorOpen(true);
                                    }}
                                    className="size-7"
                                    title="Редактировать"
                                  >
                                    <Edit2 className="size-3.5" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleDelete("spell", sp.id, sp.name)}
                                    className="size-7 text-destructive"
                                    title="Удалить"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </Button>
                                </div>

                                {targetCombatant && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleAddToCombatant("spell", sp.id, sp.name)}
                                    className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700"
                                  >
                                    <UserPlus className="size-3 mr-1" />
                                    Добавить {targetCombatant.name}
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </TabsContent>

                  {/* 3. СПОСОБНОСТИ С УРОНОМ */}
                  <TabsContent value="damage_ability" className="h-full m-0">
                    <div className="h-full overflow-y-auto min-h-0 max-h-[calc(92vh-210px)] pr-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {filteredDamageAbilities.map((ab) => {
                          const p = ab.parameters;
                          return (
                            <div
                              key={ab.id}
                              className="border rounded-md p-3 bg-card/40 hover:bg-card/70 transition-colors flex flex-col justify-between space-y-2"
                            >
                              <div>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="font-semibold text-sm flex items-center gap-1.5">
                                    <Flame className="size-4 text-rose-500 shrink-0" />
                                    {ab.name}
                                  </div>
                                  <Badge variant="outline" className="text-[10px] shrink-0">
                                    {ab.className || ab.source || "Способность"}
                                  </Badge>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground mt-1 font-mono">
                                  {p.damage && p.damage.length > 0 && (
                                    <span>
                                      🎲 {p.damage.map((d) => `${d.dice}${d.mod ? `+${d.mod}` : ""} ${DAMAGE_TYPE_LABELS[d.type] || d.type}`).join(" + ")}
                                    </span>
                                  )}
                                  {p.saveType && <span>🛡️ Спас {p.saveType}</span>}
                                  {p.aoe && <span>📐 {p.aoe.shape} {p.aoe.size} фт</span>}
                                  {p.uses ? <span>🔋 {p.uses} исп.</span> : null}
                                </div>

                                {p.description && (
                                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1.5">
                                    {p.description}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-border/30">
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => {
                                      setEditingItem({
                                        id: ab.id,
                                        category: "damage_ability",
                                        name: ab.name,
                                        className: ab.className,
                                        minLevel: ab.minLevel,
                                        source: ab.source,
                                        actionCost: p.actionCost || "action",
                                        rangeType: (p.range?.type as any) || "self",
                                        rangeNormal: p.range?.value ?? 5,
                                        hasAoe: !!p.aoe,
                                        aoeShape: p.aoe?.shape,
                                        aoeSize: p.aoe?.size,
                                        damage: p.damage || [],
                                        hasSave: !!p.saveType,
                                        saveType: p.saveType || "DEX",
                                        saveDC: p.saveDC,
                                        usesMax: p.uses,
                                        refresh: p.refresh,
                                        description: p.description,
                                      });
                                      setIsEditorOpen(true);
                                    }}
                                    className="size-7"
                                    title="Редактировать"
                                  >
                                    <Edit2 className="size-3.5" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleDelete("ability", ab.id, ab.name)}
                                    className="size-7 text-destructive"
                                    title="Удалить"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </Button>
                                </div>

                                {targetCombatant && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleAddToCombatant("ability", ab.id, ab.name)}
                                    className="h-7 text-xs bg-rose-600 hover:bg-rose-700"
                                  >
                                    <UserPlus className="size-3 mr-1" />
                                    Добавить {targetCombatant.name}
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </TabsContent>

                  {/* 4. СПОСОБНОСТИ БЕЗ УРОНА / УТИЛИТЫ */}
                  <TabsContent value="utility_ability" className="h-full m-0">
                    <div className="h-full overflow-y-auto min-h-0 max-h-[calc(92vh-210px)] pr-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {filteredUtilityAbilities.map((ab) => {
                          const p = ab.parameters;
                          return (
                            <div
                              key={ab.id}
                              className="border rounded-md p-3 bg-card/40 hover:bg-card/70 transition-colors flex flex-col justify-between space-y-2"
                            >
                              <div>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="font-semibold text-sm flex items-center gap-1.5">
                                    <Shield className="size-4 text-blue-400 shrink-0" />
                                    {ab.name}
                                  </div>
                                  <Badge variant="outline" className="text-[10px] shrink-0">
                                    {ab.className || ab.source || "Утилита"}
                                  </Badge>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground mt-1 font-mono">
                                  {p.selfHeal && <span>💚 Хил {p.selfHeal.dice}</span>}
                                  {p.grantsExtraAction && <span className="text-amber-400">⚡ Доп. Действие</span>}
                                  {p.selfEffects?.[0] && (
                                    <span className="text-emerald-400">🛡️ {p.selfEffects[0].condition}</span>
                                  )}
                                  {p.uses ? <span>🔋 {p.uses} исп.</span> : null}
                                </div>

                                {p.description && (
                                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1.5">
                                    {p.description}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-border/30">
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => {
                                      setEditingItem({
                                        id: ab.id,
                                        category: "utility_ability",
                                        name: ab.name,
                                        className: ab.className,
                                        minLevel: ab.minLevel,
                                        source: ab.source,
                                        actionCost: p.actionCost || "action",
                                        rangeType: (p.range?.type as any) || "self",
                                        rangeNormal: p.range?.value ?? 5,
                                        damage: p.damage || [],
                                        usesMax: p.uses,
                                        refresh: p.refresh,
                                        conditionType: p.selfEffects?.[0]?.condition || p.effects?.[0]?.condition,
                                        conditionDuration: p.selfEffects?.[0]?.durationRounds || p.effects?.[0]?.durationRounds,
                                        description: p.description,
                                      });
                                      setIsEditorOpen(true);
                                    }}
                                    className="size-7"
                                    title="Редактировать"
                                  >
                                    <Edit2 className="size-3.5" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleDelete("ability", ab.id, ab.name)}
                                    className="size-7 text-destructive"
                                    title="Удалить"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </Button>
                                </div>

                                {targetCombatant && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleAddToCombatant("ability", ab.id, ab.name)}
                                    className="h-7 text-xs bg-blue-600 hover:bg-blue-700"
                                  >
                                    <UserPlus className="size-3 mr-1" />
                                    Добавить {targetCombatant.name}
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </TabsContent>
                </>
              )}
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Модалка редактора элемента */}
      {isEditorOpen && (
        <LibraryItemEditorModal
          initialItem={editingItem}
          defaultCategory={activeTab}
          onSave={handleSaveItem}
          onClose={() => {
            setIsEditorOpen(false);
            setEditingItem(null);
          }}
        />
      )}
    </>
  );
}
