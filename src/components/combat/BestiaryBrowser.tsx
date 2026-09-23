"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  Skull,
  Shield,
  Heart,
  Footprints,
  Swords,
  Sparkles,
  Zap,
  Flame,
  Plus,
  UserPlus,
  Eye,
} from "lucide-react";
import type { MonsterDefinition, MonsterManifestEntry, CreatureType } from "@/lib/combat/monsters/types";
import { toast } from "sonner";

interface BestiaryBrowserProps {
  combatId?: string;
  onSpawnMonster?: (slug: string, count: number) => Promise<void> | void;
  externalSearchQuery?: string;
}

const CREATURE_TYPES: Array<{ id: string; labelRu: string }> = [
  { id: "all", labelRu: "Все типы существ" },
  { id: "beast", labelRu: "Звери (Beast)" },
  { id: "undead", labelRu: "Нежить (Undead)" },
  { id: "dragon", labelRu: "Драконы (Dragon)" },
  { id: "humanoid", labelRu: "Гуманоиды (Humanoid)" },
  { id: "monstrosity", labelRu: "Чудовища (Monstrosity)" },
  { id: "fiend", labelRu: "Исчадия (Fiend)" },
  { id: "aberration", labelRu: "Аберрации (Aberration)" },
  { id: "elemental", labelRu: "Элементали (Elemental)" },
  { id: "construct", labelRu: "Конструкты (Construct)" },
  { id: "giant", labelRu: "Великаны (Giant)" },
  { id: "fey", labelRu: "Феи (Fey)" },
  { id: "plant", labelRu: "Растения (Plant)" },
  { id: "celestial", labelRu: "Небожители (Celestial)" },
  { id: "ooze", labelRu: "Слизи (Ooze)" },
];

const CR_OPTIONS: Array<{ id: string; labelRu: string }> = [
  { id: "all", labelRu: "Любая опасность (CR)" },
  { id: "0", labelRu: "CR 0" },
  { id: "1/8", labelRu: "CR 1/8" },
  { id: "1/4", labelRu: "CR 1/4" },
  { id: "1/2", labelRu: "CR 1/2" },
  { id: "1", labelRu: "CR 1" },
  { id: "2", labelRu: "CR 2" },
  { id: "3", labelRu: "CR 3" },
  { id: "4", labelRu: "CR 4" },
  { id: "5", labelRu: "CR 5" },
  { id: "6-10", labelRu: "CR 6 – 10" },
  { id: "11-20", labelRu: "CR 11 – 20" },
  { id: "21+", labelRu: "CR 21+" },
];

export function BestiaryBrowser({
  combatId,
  onSpawnMonster,
  externalSearchQuery = "",
}: BestiaryBrowserProps) {
  const [query, setQuery] = useState(externalSearchQuery);
  const [selectedType, setSelectedType] = useState("all");
  const [selectedCr, setSelectedCr] = useState("all");
  const [monsters, setMonsters] = useState<MonsterManifestEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<MonsterManifestEntry | null>(null);
  const [monsterDef, setMonsterDef] = useState<MonsterDefinition | null>(null);
  const [defLoading, setDefLoading] = useState(false);
  const [spawningSlug, setSpawningSlug] = useState<string | null>(null);

  useEffect(() => {
    if (externalSearchQuery !== query) {
      setQuery(externalSearchQuery);
    }
  }, [externalSearchQuery]);

  const fetchMonsters = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (selectedType && selectedType !== "all") params.set("type", selectedType);

      if (selectedCr !== "all") {
        if (selectedCr === "0") { params.set("crMin", "0"); params.set("crMax", "0"); }
        else if (selectedCr === "1/8") { params.set("crMin", "0.125"); params.set("crMax", "0.125"); }
        else if (selectedCr === "1/4") { params.set("crMin", "0.25"); params.set("crMax", "0.25"); }
        else if (selectedCr === "1/2") { params.set("crMin", "0.5"); params.set("crMax", "0.5"); }
        else if (selectedCr === "6-10") { params.set("crMin", "6"); params.set("crMax", "10"); }
        else if (selectedCr === "11-20") { params.set("crMin", "11"); params.set("crMax", "20"); }
        else if (selectedCr === "21+") { params.set("crMin", "21"); }
        else {
          const num = parseFloat(selectedCr);
          if (!isNaN(num)) { params.set("crMin", String(num)); params.set("crMax", String(num)); }
        }
      }
      params.set("limit", "100");

      const res = await fetch(`/api/combat/monsters?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setMonsters(data.monsters || []);
        setTotalCount(data.total || 0);
        if (data.monsters?.length > 0 && (!selectedEntry || !data.monsters.some((m: any) => m.slug === selectedEntry.slug))) {
          setSelectedEntry(data.monsters[0]);
        }
      }
    } catch (e) {
      console.error("Failed to fetch monsters:", e);
    } finally {
      setLoading(false);
    }
  }, [query, selectedType, selectedCr, selectedEntry]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMonsters();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchMonsters]);

  useEffect(() => {
    if (selectedEntry?.slug) {
      setDefLoading(true);
      fetch(`/api/combat/monsters?slug=${selectedEntry.slug}`)
        .then((r) => r.json())
        .then((data) => {
          setMonsterDef(data.monster || null);
        })
        .catch(() => setMonsterDef(null))
        .finally(() => setDefLoading(false));
    } else {
      setMonsterDef(null);
    }
  }, [selectedEntry?.slug]);

  const handleSpawn = async (slug: string, name: string, count = 1) => {
    if (!combatId) {
      toast.error("Бой не найден");
      return;
    }

    try {
      setSpawningSlug(slug);
      const res = await fetch("/api/combat/presets/spawn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ combatId, slug, count }),
      });

      if (res.ok) {
        toast.success(`На поле боя заспавнен: ${name} (×${count})`);
        if (onSpawnMonster) {
          await onSpawnMonster(slug, count);
        }
      } else {
        toast.error("Не удалось заспавнить существо");
      }
    } catch {
      toast.error("Ошибка при выполнении запроса");
    } finally {
      setSpawningSlug(null);
    }
  };

  return (
    <div className="flex-1 grid grid-cols-12 overflow-hidden min-h-0">
      {/* Левая колонка: Фильтры + Список (5 колонок) */}
      <div className="col-span-12 md:col-span-5 border-r border-border/60 bg-muted/10 flex flex-col overflow-hidden min-h-0">
        {/* Фильтры типов и CR */}
        <div className="p-2.5 border-b border-border/50 bg-background/50 space-y-2">
          <div className="flex items-center gap-1.5">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="flex-1 h-7 text-xs rounded-md border border-input bg-background px-2 text-foreground"
            >
              {CREATURE_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.labelRu}
                </option>
              ))}
            </select>

            <select
              value={selectedCr}
              onChange={(e) => setSelectedCr(e.target.value)}
              className="w-36 h-7 text-xs rounded-md border border-input bg-background px-2 text-foreground"
            >
              {CR_OPTIONS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.labelRu}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground px-0.5">
            <span>
              Найдено: <strong className="text-foreground">{totalCount}</strong> существ
            </span>
            {loading && <span className="animate-pulse text-primary text-[10px]">Загрузка...</span>}
          </div>
        </div>

        {/* Список карточек монстров */}
        <ScrollArea className="flex-1 min-h-0 p-2">
          <div className="space-y-1.5">
            {monsters.length === 0 && !loading ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                Существ по заданным критериям не найдено
              </div>
            ) : (
              monsters.map((m) => {
                const isSelected = selectedEntry?.slug === m.slug;

                return (
                  <div
                    key={m.slug}
                    onClick={() => setSelectedEntry(m)}
                    className={`p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                      isSelected
                        ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/40"
                        : "border-border/60 bg-background hover:bg-accent/40 hover:border-border"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs truncate text-foreground">
                          {m.name}
                        </span>
                        <Badge
                          variant="outline"
                          className="h-4 px-1 text-[9px] font-mono border-red-500/40 text-red-700 dark:text-red-300"
                        >
                          CR {m.challengeRating}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className="h-4 px-1 text-[9px] capitalize text-muted-foreground"
                        >
                          {m.type}
                        </Badge>
                      </div>

                      <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                        <span className="italic">{m.nameEn}</span> • ❤ {m.hpAverage} HP • 🛡️ {m.ac} AC
                      </div>
                    </div>

                    {/* Быстрые кнопки спавна в строку */}
                    {combatId && (
                      <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-6 px-1.5 text-[10px] font-bold bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30"
                          disabled={spawningSlug === m.slug}
                          onClick={() => handleSpawn(m.slug, m.name, 1)}
                          title="Заспавнить 1 существо на сетку"
                        >
                          +1
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-6 px-1 text-[10px] font-bold bg-muted hover:bg-muted/80 text-foreground border border-border"
                          disabled={spawningSlug === m.slug}
                          onClick={() => handleSpawn(m.slug, m.name, 3)}
                          title="Заспавнить группу из 3 существ"
                        >
                          ×3
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Правая колонка: Детальный Stat Block монстра (7 колонок) */}
      <div className="col-span-12 md:col-span-7 flex flex-col overflow-hidden bg-background min-h-0">
        {selectedEntry ? (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Заголовок статблока */}
            <div className="p-3 border-b border-border/60 bg-muted/20 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-foreground">
                    {selectedEntry.name}
                  </h3>
                  <Badge className="bg-red-600/90 text-white font-mono text-[10px]">
                    CR {selectedEntry.challengeRating} ({selectedEntry.xp} XP)
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground italic">
                  {selectedEntry.nameEn} • {selectedEntry.size}, {selectedEntry.type}
                  {monsterDef?.alignment && ` (${monsterDef.alignment})`}
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-red-600 dark:text-red-400 flex items-center gap-1">
                  <Heart className="size-3" /> {selectedEntry.hpAverage} HP
                </span>
                <span>•</span>
                <span className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                  <Shield className="size-3" /> {selectedEntry.ac} AC
                </span>
              </div>
            </div>

            {/* Тело статблока */}
            <ScrollArea className="flex-1 min-h-0 p-4">
              <div className="space-y-3.5 text-xs text-foreground">
                {/* Характеристики (STR, DEX, CON, INT, WIS, CHA) */}
                {monsterDef && (
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Основные характеристики
                    </span>
                    <div className="grid grid-cols-6 gap-1 mt-1 text-center font-mono">
                      {(["str", "dex", "con", "int", "wis", "cha"] as const).map((stat) => {
                        const val = monsterDef.abilities[stat] ?? 10;
                        const mod = Math.floor((val - 10) / 2);
                        return (
                          <div key={stat} className="p-1 rounded bg-muted/60 border border-border/50">
                            <div className="text-[9px] text-muted-foreground font-bold uppercase">
                              {stat}
                            </div>
                            <div className="text-xs font-bold">{val}</div>
                            <div className="text-[10px] text-primary font-semibold">
                              {mod >= 0 ? `+${mod}` : mod}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Скорость и чувства */}
                {monsterDef && (
                  <div className="grid grid-cols-2 gap-2 text-[11px] p-2 rounded bg-muted/30 border border-border/40">
                    <div>
                      <span className="font-bold text-muted-foreground">Скорость: </span>
                      <span>
                        {monsterDef.speed.walk || 30} фт.
                        {monsterDef.speed.fly && `, полёт ${monsterDef.speed.fly} фт.`}
                        {monsterDef.speed.swim && `, плавание ${monsterDef.speed.swim} фт.`}
                        {monsterDef.speed.burrow && `, рытьё ${monsterDef.speed.burrow} фт.`}
                        {monsterDef.speed.climb && `, лазание ${monsterDef.speed.climb} фт.`}
                      </span>
                    </div>

                    <div>
                      <span className="font-bold text-muted-foreground">Чувства: </span>
                      <span>
                        {monsterDef.senses.darkvision && `тёмное зрение ${monsterDef.senses.darkvision} фт., `}
                        {monsterDef.senses.blindsight && `слепое зрение ${monsterDef.senses.blindsight} фт., `}
                        пассивное восприятие {monsterDef.senses.passivePerception}
                      </span>
                    </div>
                  </div>
                )}

                {/* Сопротивления и иммунитеты */}
                {monsterDef && (monsterDef.damageResistances.length > 0 || monsterDef.damageImmunities.length > 0 || monsterDef.conditionImmunities.length > 0) && (
                  <div className="text-[11px] space-y-1 p-2 rounded bg-muted/20 border border-border/30">
                    {monsterDef.damageResistances.length > 0 && (
                      <div>
                        <span className="font-bold text-amber-600 dark:text-amber-400">Сопротивление к урону: </span>
                        <span>{monsterDef.damageResistances.join(", ")}</span>
                      </div>
                    )}
                    {monsterDef.damageImmunities.length > 0 && (
                      <div>
                        <span className="font-bold text-red-600 dark:text-red-400">Иммунитет к урону: </span>
                        <span>{monsterDef.damageImmunities.join(", ")}</span>
                      </div>
                    )}
                    {monsterDef.conditionImmunities.length > 0 && (
                      <div>
                        <span className="font-bold text-blue-600 dark:text-blue-400">Иммунитет к состояниям: </span>
                        <span>{monsterDef.conditionImmunities.join(", ")}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Особенности (Traits) */}
                {monsterDef && monsterDef.traits.length > 0 && (
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="size-3 text-purple-500" />
                      Особенности ({monsterDef.traits.length})
                    </span>
                    <div className="space-y-1.5 mt-1">
                      {monsterDef.traits.map((t, i) => (
                        <div key={i} className="p-2 rounded bg-muted/40 border border-border/40 text-[11px] leading-relaxed">
                          <strong className="text-foreground font-semibold">{t.name}. </strong>
                          <span className="text-muted-foreground">{t.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Действия и атаки */}
                {monsterDef && monsterDef.actions.length > 0 && (
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <Swords className="size-3 text-amber-500" />
                      Действия & Атаки ({monsterDef.actions.length})
                    </span>
                    <div className="space-y-1.5 mt-1">
                      {monsterDef.actions.map((act, i) => (
                        <div key={i} className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-[11px] leading-relaxed">
                          <div className="flex items-center justify-between mb-0.5">
                            <strong className="text-foreground font-bold">{act.name}</strong>
                            {act.attackBonus !== undefined && (
                              <Badge variant="outline" className="text-[9px] border-emerald-500/50 text-emerald-700 dark:text-emerald-400 font-bold">
                                +{act.attackBonus} к попаданию
                              </Badge>
                            )}
                          </div>
                          <div className="text-muted-foreground">
                            {act.damage && act.damage.length > 0 && (
                              <span className="font-semibold text-foreground mr-1">
                                Урон: {act.damage.map((d) => `${d.dice}${d.mod ? (d.mod > 0 ? "+" + d.mod : d.mod) : ""} ${d.type}`).join(" + ")}.
                              </span>
                            )}
                            {act.description}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Легендарные действия */}
                {monsterDef?.legendaryActions && (
                  <div>
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
                      <Flame className="size-3" />
                      Легендарные действия ({monsterDef.legendaryActions.actionsPerRound} в раунд)
                    </span>
                    <div className="space-y-1 mt-1">
                      {monsterDef.legendaryActions.options?.map((la, i) => (
                        <div key={i} className="p-2 rounded bg-red-500/10 border border-red-500/20 text-[11px]">
                          <strong className="text-foreground font-bold">{la.name} (стоимость: {la.cost}). </strong>
                          <span className="text-muted-foreground">{la.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Нижняя панель спавна */}
            <div className="p-3 border-t border-border/60 bg-muted/20 flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground truncate">
                Спавн «{selectedEntry.name}» на поле боя:
              </span>

              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  className="h-8 bg-primary text-primary-foreground font-bold shadow-xs px-3 gap-1"
                  disabled={spawningSlug === selectedEntry.slug}
                  onClick={() => handleSpawn(selectedEntry.slug, selectedEntry.name, 1)}
                >
                  <UserPlus className="size-3.5" />
                  Заспавнить 1
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs font-bold"
                  disabled={spawningSlug === selectedEntry.slug}
                  onClick={() => handleSpawn(selectedEntry.slug, selectedEntry.name, 2)}
                >
                  ×2
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs font-bold"
                  disabled={spawningSlug === selectedEntry.slug}
                  onClick={() => handleSpawn(selectedEntry.slug, selectedEntry.name, 3)}
                >
                  ×3
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs font-bold"
                  disabled={spawningSlug === selectedEntry.slug}
                  onClick={() => handleSpawn(selectedEntry.slug, selectedEntry.name, 5)}
                >
                  ×5
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <Skull className="size-10 mb-2 opacity-30" />
            <span className="font-semibold text-xs">Выберите существо слева для просмотра параметров и спавна</span>
          </div>
        )}
      </div>
    </div>
  );
}
