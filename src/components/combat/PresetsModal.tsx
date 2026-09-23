"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Search,
  Plus,
  Trash2,
  Edit2,
  Swords,
  Shield,
  Zap,
  Sparkles,
  Footprints,
  Users,
  Skull,
  UserPlus,
  Layers,
  Heart,
  Flame,
  Wand2,
  Maximize2,
  Minimize2,
} from "lucide-react";
import type { CharacterPreset, Combatant } from "@/lib/combat/types";
import { DEFAULT_PRESETS } from "@/lib/combat/preset-data";
import { BestiaryBrowser } from "./BestiaryBrowser";

interface PresetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  combatId?: string;
  onSpawnPreset?: (preset: CharacterPreset, count?: number) => Promise<void> | void;
  onPresetSaved?: (preset: CharacterPreset) => void;
}

export function PresetsModal({
  isOpen,
  onClose,
  combatId,
  onSpawnPreset,
  onPresetSaved,
}: PresetsModalProps) {
  const [presets, setPresets] = useState<CharacterPreset[]>(DEFAULT_PRESETS);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "heroes" | "monsters" | "npc" | "custom">("all");
  const [crFilter, setCrFilter] = useState<string | "all">("all");
  const [selectedPreset, setSelectedPreset] = useState<CharacterPreset | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<CharacterPreset>>({});
  const [spawningId, setSpawningId] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const fetchPresets = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/combat/presets");
      if (res.ok) {
        const data = await res.json();
        if (data.presets) {
          setPresets(data.presets);
        }
      }
    } catch (e) {
      console.error("Failed to load presets:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPresets();
    }
  }, [isOpen]);

  const filteredPresets = useMemo(() => {
    return presets.filter((p) => {
      // 1. По типу/фильтру
      if (activeFilter === "heroes" && p.type !== "player") return false;
      if (activeFilter === "monsters" && p.type !== "enemy") return false;
      if (activeFilter === "npc" && (p.type !== "npc" && p.type !== "companion")) return false;
      if (activeFilter === "custom" && p.isTemplate) return false;

      // 1.5 По CR (Опасности)
      if (crFilter !== "all" && p.cr) {
        const crNum = parseFloat(eval(p.cr) || p.cr);
        if (crFilter === "0" && crNum !== 0) return false;
        if (crFilter === "1/8" && crNum !== 0.125) return false;
        if (crFilter === "1/4" && crNum !== 0.25) return false;
        if (crFilter === "1/2" && crNum !== 0.5) return false;
        if (crFilter === "1" && crNum !== 1) return false;
        if (crFilter === "2" && crNum !== 2) return false;
        if (crFilter === "3" && crNum !== 3) return false;
        if (crFilter === "4" && crNum !== 4) return false;
        if (crFilter === "5" && crNum !== 5) return false;
        if (crFilter === "6-10" && (crNum < 6 || crNum > 10)) return false;
        if (crFilter === "11-20" && (crNum < 11 || crNum > 20)) return false;
        if (crFilter === "21+" && crNum < 21) return false;
      }

      // 2. По строке поиска
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.className.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.tags?.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [presets, activeFilter, crFilter, searchQuery]);

  const handleSpawn = async (preset: CharacterPreset, count: number = 1) => {
    if (!combatId) return;
    try {
      setSpawningId(preset.id);
      if (onSpawnPreset) {
        await onSpawnPreset(preset, count);
      } else {
        const res = await fetch("/api/combat/presets/spawn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ combatId, presetId: preset.id, count }),
        });
        if (!res.ok) throw new Error("Spawn error");
      }
    } catch (e) {
      console.error("Error spawning preset:", e);
    } finally {
      setSpawningId(null);
    }
  };

  const handleDelete = async (presetId: string) => {
    if (presetId.startsWith("preset-")) return;
    if (!confirm("Удалить этот пресет?")) return;
    try {
      const res = await fetch(`/api/combat/presets?id=${presetId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setPresets((prev) => prev.filter((p) => p.id !== presetId));
        if (selectedPreset?.id === presetId) setSelectedPreset(null);
      }
    } catch (e) {
      console.error("Delete error:", e);
    }
  };

  const handleStartCreate = () => {
    setEditForm({
      name: "Новый боец",
      type: "enemy",
      className: "Монстр",
      level: 1,
      size: "medium",
      color: "#ef4444",
      icon: "👾",
      hpMax: 15,
      ac: 13,
      speed: 30,
      attacksPerAction: 1,
      profBonus: 2,
      abilityMods: { STR: 2, DEX: 1, CON: 2, INT: 0, WIS: 0, CHA: 0 },
      attacks: [
        {
          id: "atk-" + Date.now(),
          name: "Удар оружием",
          kind: "melee",
          range: { normal: 5 },
          attackBonus: 4,
          damage: [{ dice: "1d8", mod: 2, type: "slashing" }],
          actionCost: "action",
        },
      ],
      spells: { slots: {}, known: [] },
      abilities: [],
      description: "",
      tags: ["custom"],
    });
    setIsEditing(true);
  };

  const handleStartEdit = (preset: CharacterPreset) => {
    setEditForm(JSON.parse(JSON.stringify(preset)));
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!editForm.name) return alert("Введите имя!");
    try {
      const res = await fetch("/api/combat/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.preset) {
          setPresets((prev) => {
            const exists = prev.some((p) => p.id === data.preset.id);
            if (exists) return prev.map((p) => (p.id === data.preset.id ? data.preset : p));
            return [data.preset, ...prev];
          });
          setSelectedPreset(data.preset);
          setIsEditing(false);
          if (onPresetSaved) onPresetSaved(data.preset);
        }
      }
    } catch (e) {
      console.error("Save error:", e);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={"flex flex-col p-0 gap-0 bg-card border-border shadow-2xl overflow-hidden text-foreground transition-all duration-200 " + (
        isFullScreen
          ? "!max-w-full sm:!max-w-full w-screen h-screen !rounded-none !top-0 !left-0 !translate-x-0 !translate-y-0"
          : "!max-w-[96vw] sm:!max-w-[96vw] w-[96vw] h-[92vh] rounded-xl"
      )}>
        {/* Хедер модального окна */}
        <DialogHeader className="p-4 pb-3 border-b border-border/60 bg-muted/30">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Layers className="size-5 text-purple-500" />
                <span>Библиотека Пресетов & Бестиарий</span>
                <Badge variant="outline" className="text-[10px] font-semibold">
                  {presets.length} шаблонов
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Быстрый спавн героев, монстров и сохранение созданных бойцов
              </DialogDescription>
            </div>

            <div className="flex items-center gap-1.5">
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
                className="h-8 gap-1.5 bg-primary text-primary-foreground font-semibold shadow-xs"
                onClick={handleStartCreate}
              >
                <Plus className="size-3.5" />
                Создать пресет
              </Button>
            </div>
          </div>

          {/* Строка поиска и фильтрации */}
          <div className="flex items-center gap-2 pt-2">
            <div className="relative flex-1">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Поиск по имени, классу, тегам..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs bg-background"
              />
            </div>

            <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg border border-border/40">
              <Button
                size="sm"
                variant={activeFilter === "all" ? "default" : "ghost"}
                className={"h-7 text-[11px] px-2.5 " + (activeFilter === "all" ? "bg-background text-foreground shadow-xs font-bold" : "text-muted-foreground")}
                onClick={() => setActiveFilter("all")}
              >
                Все
              </Button>
              <Button
                size="sm"
                variant={activeFilter === "heroes" ? "default" : "ghost"}
                className={"h-7 text-[11px] px-2.5 flex items-center gap-1 " + (
                  activeFilter === "heroes" ? "bg-background text-emerald-950 dark:text-emerald-300 shadow-xs font-bold" : "text-muted-foreground"
                )}
                onClick={() => setActiveFilter("heroes")}
              >
                <Users className="size-3 text-emerald-600 dark:text-emerald-400" />
                Герои
              </Button>
              <Button
                size="sm"
                variant={activeFilter === "monsters" ? "default" : "ghost"}
                className={"h-7 text-[11px] px-2.5 flex items-center gap-1 " + (
                  activeFilter === "monsters" ? "bg-background text-red-950 dark:text-red-300 shadow-xs font-bold" : "text-muted-foreground"
                )}
                onClick={() => setActiveFilter("monsters")}
              >
                <Skull className="size-3 text-red-600 dark:text-red-400" />
                Бестиарий (2,875)
              </Button>
              <Button
                size="sm"
                variant={activeFilter === "npc" ? "default" : "ghost"}
                className={"h-7 text-[11px] px-2.5 flex items-center gap-1 " + (
                  activeFilter === "npc" ? "bg-background text-blue-950 dark:text-blue-300 shadow-xs font-bold" : "text-muted-foreground"
                )}
                onClick={() => setActiveFilter("npc")}
              >
                <UserPlus className="size-3 text-blue-600 dark:text-blue-400" />
                NPC
              </Button>
              <Button
                size="sm"
                variant={activeFilter === "custom" ? "default" : "ghost"}
                className={"h-7 text-[11px] px-2.5 flex items-center gap-1 " + (
                  activeFilter === "custom" ? "bg-background text-purple-950 dark:text-purple-300 shadow-xs font-bold" : "text-muted-foreground"
                )}
                onClick={() => setActiveFilter("custom")}
              >
                <Sparkles className="size-3 text-purple-600 dark:text-purple-400" />
                Мои
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Тело модального окна: Бестиарий (2,875) или Пресеты */}
        {activeFilter === "monsters" ? (
          <BestiaryBrowser
            combatId={combatId}
            externalSearchQuery={searchQuery}
            onSpawnMonster={async (slug, count) => {
              if (onSpawnPreset) {
                await onSpawnPreset({ id: slug } as any, count);
              }
            }}
          />
        ) : (
          <div className="flex-1 grid grid-cols-12 overflow-hidden min-h-0">
            {/* Список карточек пресетов (5 колонок) */}
            <div className="col-span-12 md:col-span-4 border-r border-border/60 bg-muted/10 flex flex-col overflow-hidden min-h-0">
            <div className="flex-1 overflow-y-auto min-h-0 p-2.5 space-y-1.5">
              <div className="space-y-1.5">
                {filteredPresets.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    Пресетов не найдено
                  </div>
                ) : (
                  filteredPresets.map((preset) => {
                    const isSelected = selectedPreset?.id === preset.id;
                    const isHero = preset.type === "player";
                    return (
                      <div
                        key={preset.id}
                        className={
                          "p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-2 " +
                          (isSelected
                            ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/40"
                            : "border-border/60 bg-background hover:bg-accent/40 hover:border-border")
                        }
                        onClick={() => {
                          setSelectedPreset(preset);
                          setIsEditing(false);
                        }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="size-7 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-xs shrink-0"
                            style={{ backgroundColor: preset.color || "#6b7280" }}
                          >
                            {preset.icon || preset.name.charAt(0).toUpperCase()}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-xs truncate text-foreground">
                                {preset.name}
                              </span>
                              {preset.cr && (
                                <Badge variant="outline" className="h-4 px-1 text-[9px] font-mono border-red-500/40 text-red-900 dark:text-red-400">
                                  CR {preset.cr}
                                </Badge>
                              )}
                              {isHero && (
                                <Badge variant="outline" className="h-4 px-1 text-[9px] border-emerald-500/40 text-emerald-900 dark:text-emerald-400">
                                  {preset.level} ур.
                                </Badge>
                              )}
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate">
                              {preset.className} • HP: {preset.hpMax} • AC: {preset.ac}
                            </div>
                          </div>
                        </div>

                        {/* Кнопки быстрого спавна прямо в карточке */}
                        {combatId && (
                          <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-6 px-1.5 text-[10px] font-bold bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30"
                              disabled={spawningId === preset.id}
                              onClick={() => handleSpawn(preset, 1)}
                              title="Заспавнить 1 на поле боя"
                            >
                              +1
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-6 px-1 text-[10px] font-bold bg-muted hover:bg-muted/80 text-foreground border border-border"
                              disabled={spawningId === preset.id}
                              onClick={() => handleSpawn(preset, 3)}
                              title="Заспавнить 3 бойца на поле боя"
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
            </div>
          </div>

          {/* Правая панель: Детальная информация или Редактор (7 колонок) */}
          <div className="col-span-12 md:col-span-8 flex flex-col overflow-hidden bg-background min-h-0">
            {isEditing ? (
              /* РЕДАКТОР ПРЕСЕТА */
              <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                <div className="p-3 border-b border-border/60 bg-muted/20 flex items-center justify-between">
                  <span className="font-bold text-xs flex items-center gap-1.5">
                    <Edit2 className="size-3.5 text-primary" />
                    {editForm.id ? "Редактирование пресета" : "Создание нового пресета"}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => setIsEditing(false)}
                    >
                      Отмена
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-primary text-primary-foreground font-bold"
                      onClick={handleSaveEdit}
                    >
                      Сохранить
                    </Button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Имя</label>
                        <Input
                          value={editForm.name || ""}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="h-7 text-xs mt-0.5"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Класс / Вид</label>
                        <Input
                          value={editForm.className || ""}
                          onChange={(e) => setEditForm({ ...editForm, className: e.target.value })}
                          className="h-7 text-xs mt-0.5"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Тип</label>
                        <select
                          value={editForm.type || "enemy"}
                          onChange={(e) => setEditForm({ ...editForm, type: e.target.value as any })}
                          className="w-full h-7 text-xs rounded-md border border-input bg-background px-2 mt-0.5"
                        >
                          <option value="player">Игрок (Герой)</option>
                          <option value="enemy">Враг</option>
                          <option value="npc">НПС</option>
                          <option value="companion">Спутник</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Уровень</label>
                        <Input
                          type="number"
                          value={editForm.level || 1}
                          onChange={(e) => setEditForm({ ...editForm, level: Number(e.target.value) })}
                          className="h-7 text-xs mt-0.5"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase">CR (Опасность)</label>
                        <Input
                          value={editForm.cr || ""}
                          placeholder="1/4, 1, 3..."
                          onChange={(e) => setEditForm({ ...editForm, cr: e.target.value })}
                          className="h-7 text-xs mt-0.5"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Размер</label>
                        <select
                          value={editForm.size || "medium"}
                          onChange={(e) => setEditForm({ ...editForm, size: e.target.value as any })}
                          className="w-full h-7 text-xs rounded-md border border-input bg-background px-2 mt-0.5"
                        >
                          <option value="tiny">Крошечный</option>
                          <option value="small">Маленький</option>
                          <option value="medium">Средний</option>
                          <option value="large">Большой (2×2)</option>
                          <option value="huge">Огромный (3×3)</option>
                          <option value="gargantuan">Громадный (4×4)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Макс HP</label>
                        <Input
                          type="number"
                          value={editForm.hpMax || 10}
                          onChange={(e) => setEditForm({ ...editForm, hpMax: Number(e.target.value) })}
                          className="h-7 text-xs mt-0.5"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase">КД (AC)</label>
                        <Input
                          type="number"
                          value={editForm.ac || 10}
                          onChange={(e) => setEditForm({ ...editForm, ac: Number(e.target.value) })}
                          className="h-7 text-xs mt-0.5"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Скорость</label>
                        <Input
                          type="number"
                          value={editForm.speed || 30}
                          onChange={(e) => setEditForm({ ...editForm, speed: Number(e.target.value) })}
                          className="h-7 text-xs mt-0.5"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Атак за Действие</label>
                        <Input
                          type="number"
                          value={editForm.attacksPerAction || 1}
                          onChange={(e) => setEditForm({ ...editForm, attacksPerAction: Number(e.target.value) })}
                          className="h-7 text-xs mt-0.5"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Описание</label>
                      <textarea
                        value={editForm.description || ""}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        className="w-full h-16 text-xs rounded-md border border-input bg-background p-2 mt-0.5 resize-none"
                        placeholder="Особенности, тактика поведения..."
                      />
                    </div>
                  </div>
              </div>
            ) : selectedPreset ? (
              /* ПРОСМОТР ДЕТАЛЕЙ ПРЕСЕТА */
              <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                {/* Шапка деталей */}
                <div className="p-4 pb-3 border-b border-border/60 bg-muted/15 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="size-10 rounded-full flex items-center justify-center text-white text-base font-bold shadow-sm"
                      style={{ backgroundColor: selectedPreset.color || "#6b7280" }}
                    >
                      {selectedPreset.icon || selectedPreset.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-bold text-sm text-foreground">{selectedPreset.name}</h3>
                        <Badge variant="outline" className="text-[10px]">
                          {selectedPreset.className} {selectedPreset.level} ур.
                        </Badge>
                        {selectedPreset.cr && (
                          <Badge variant="destructive" className="text-[10px] font-mono">
                            CR {selectedPreset.cr}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span className="font-bold text-red-600 dark:text-red-400">❤ {selectedPreset.hpMax} HP</span>
                        <span>•</span>
                        <span className="font-bold text-blue-600 dark:text-blue-400">🛡️ {selectedPreset.ac} AC</span>
                        <span>•</span>
                        <span className="font-bold text-amber-600 dark:text-amber-400">👣 {selectedPreset.speed} фт</span>
                        {selectedPreset.attacksPerAction > 1 && (
                          <>
                            <span>•</span>
                            <span className="font-bold text-purple-600 dark:text-purple-400">⚔️ {selectedPreset.attacksPerAction} атаки/действие</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={() => handleStartEdit(selectedPreset)}
                    >
                      <Edit2 className="size-3" />
                      Редактировать
                    </Button>
                    {!selectedPreset.isTemplate && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-red-500 hover:bg-red-500/20"
                        onClick={() => handleDelete(selectedPreset.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Содержимое: Атаки, Магия, Способности */}
                <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-3.5 text-xs">
                    {selectedPreset.description && (
                      <div className="p-2 rounded bg-muted/40 text-muted-foreground italic text-xs">
                        {selectedPreset.description}
                      </div>
                    )}

                    {/* Характеристики */}
                    <div>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        Характеристики & Модификаторы
                      </span>
                      <div className="grid grid-cols-6 gap-1 mt-1 text-center font-mono">
                        {Object.entries(selectedPreset.abilityMods || {}).map(([stat, mod]) => (
                          <div key={stat} className="p-1 rounded bg-muted/60 border border-border/50">
                            <div className="text-[9px] text-muted-foreground font-bold">{stat}</div>
                            <div className="text-xs font-bold text-foreground">
                              {mod >= 0 ? "+" + mod : mod}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Атаки */}
                    {selectedPreset.attacks && selectedPreset.attacks.length > 0 && (
                      <div>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                          <Swords className="size-3 text-amber-500" />
                          Атаки ({selectedPreset.attacks.length})
                        </span>
                        <div className="space-y-1 mt-1">
                          {selectedPreset.attacks.map((atk) => (
                            <div key={atk.id} className="p-1.5 rounded bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
                              <div>
                                <span className="font-bold text-foreground">{atk.name}</span>
                                <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold ml-1.5">
                                  +{atk.attackBonus}
                                </span>
                                <span className="text-[11px] text-muted-foreground ml-1.5">
                                  {atk.damage.map((d) => d.dice + (d.mod ? "+" + d.mod : "") + " " + d.type).join(" + ")}
                                </span>
                              </div>
                              <Badge variant="outline" className="text-[9px] uppercase">
                                {atk.kind}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Заклинания */}
                    {selectedPreset.spells?.known && selectedPreset.spells.known.length > 0 && (
                      <div>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                          <Zap className="size-3 text-blue-500" />
                          Заклинания ({selectedPreset.spells.known.length})
                        </span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedPreset.spells.known.map((spell, i) => (
                            <Badge key={i} variant="secondary" className="bg-blue-500/15 border border-blue-500/30 text-foreground font-semibold">
                              {spell}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Способности */}
                    {selectedPreset.abilities && selectedPreset.abilities.length > 0 && (
                      <div>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                          <Sparkles className="size-3 text-purple-500" />
                          Способности ({selectedPreset.abilities.length})
                        </span>
                        <div className="space-y-1 mt-1">
                          {selectedPreset.abilities.map((ab) => (
                            <div key={ab.id} className="p-1.5 rounded bg-purple-500/10 border border-purple-500/20">
                              <div className="font-bold text-foreground">{ab.name}</div>
                              {ab.parameters?.description && (
                                <div className="text-[11px] text-muted-foreground mt-0.5">
                                  {ab.parameters.description}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                {/* Нижняя панель спавна на карту */}
                {combatId && (
                  <div className="p-3 border-t border-border/60 bg-muted/20 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Спавн на боевую сетку:
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        className="h-7 bg-primary text-primary-foreground font-bold shadow-xs px-3 gap-1"
                        disabled={spawningId === selectedPreset.id}
                        onClick={() => handleSpawn(selectedPreset, 1)}
                      >
                        <UserPlus className="size-3.5" />
                        Заспавнить 1
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs font-bold"
                        disabled={spawningId === selectedPreset.id}
                        onClick={() => handleSpawn(selectedPreset, 2)}
                      >
                        ×2
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs font-bold"
                        disabled={spawningId === selectedPreset.id}
                        onClick={() => handleSpawn(selectedPreset, 3)}
                      >
                        ×3
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs font-bold"
                        disabled={spawningId === selectedPreset.id}
                        onClick={() => handleSpawn(selectedPreset, 5)}
                      >
                        ×5
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <Layers className="size-10 mb-2 opacity-30" />
                <span className="font-semibold text-xs">Выберите пресет слева для просмотра и спавна</span>
              </div>
            )}
          </div>
        </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
