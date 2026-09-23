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
import {
  Map,
  Search,
  Check,
  Shield,
  Flame,
  Droplets,
  Trees,
  Mountain,
  DoorOpen,
  Castle,
  Upload,
  Globe,
  Link,
  Tag,
  BookOpen,
} from "lucide-react";
import { ALL_PRESETS } from "@/lib/combat/maps/presets";
import type { TacticalMapPreset } from "@/lib/combat/maps/types";
import { parseUniversalVTT } from "@/lib/combat/maps/uvtt-parser";
import {
  OPEN_BATTLEMAP_CATALOG,
  POPULAR_MAP_TAGS,
} from "@/lib/combat/maps/open-map-service";
import { toast } from "sonner";

interface MapPresetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  combatId?: string;
  onMapApplied?: (updatedCombat: any) => void;
}

type TabMode = "presets" | "open_catalog" | "custom_url";
type BiomeCategory = "all" | "dungeon_cave" | "forest_swamp" | "mountain_snow" | "urban_buildings" | "water_lava";

export function MapPresetsModal({
  isOpen,
  onClose,
  combatId,
  onMapApplied,
}: MapPresetsModalProps) {
  const [mode, setMode] = useState<TabMode>("presets");
  const [maps, setMaps] = useState<TacticalMapPreset[]>(ALL_PRESETS);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<BiomeCategory>("all");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedMap, setSelectedMap] = useState<TacticalMapPreset | null>(() => ALL_PRESETS[0] || null);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  // Кастомный ввод URL карты
  const [customName, setCustomName] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [customWidth, setCustomWidth] = useState(20);
  const [customHeight, setCustomHeight] = useState(20);

  useEffect(() => {
    if (isOpen) {
      // Подгружаем актуальный список с сервера или используем ALL_PRESETS
      fetch("/api/combat/maps")
        .then((res) => res.json())
        .then((data) => {
          if (data.maps && Array.isArray(data.maps)) {
            const fullMapList = data.maps.map((m: any) => {
              const full = ALL_PRESETS.find((p) => p.id === m.id);
              return full || m;
            });
            setMaps(fullMapList);
          }
        })
        .catch(() => {
          setMaps(ALL_PRESETS);
        });
    }
  }, [isOpen]);

  // Преобразование открытых карт каталога в форму TacticalMapPreset
  const openMapsAsPresets = useMemo<TacticalMapPreset[]>(() => {
    return OPEN_BATTLEMAP_CATALOG.map((om) => ({
      id: om.id,
      name: om.name,
      nameEn: om.nameEn,
      biome: om.biome,
      tags: om.tags,
      description: `${om.description} [Автор: ${om.author} • ${om.license}]`,
      gridWidth: om.gridWidth,
      gridHeight: om.gridHeight,
      cellSizeFt: om.cellSizeFt || 5,
      backgroundUrl: om.imageUrl,
      elements: om.elements || [],
      spawnZones: om.spawnZones || [
        { name: "party", cells: [{ x: 2, y: 2 }] },
        { name: "enemy_frontline", cells: [{ x: om.gridWidth - 3, y: om.gridHeight - 3 }] },
      ],
    }));
  }, []);

  // Фильтрованный список в зависимости от активного режима
  const currentList = useMemo(() => {
    const list = mode === "presets" ? maps : openMapsAsPresets;

    return list.filter((m) => {
      // 1. По тегу (для открытого каталога)
      if (mode === "open_catalog" && selectedTag) {
        if (!m.tags?.includes(selectedTag.toLowerCase())) {
          return false;
        }
      }

      // 2. Поисковый запрос
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchesName = m.name?.toLowerCase().includes(q);
        const matchesNameEn = m.nameEn?.toLowerCase().includes(q);
        const matchesTags = m.tags?.some((t) => t.toLowerCase().includes(q));
        const matchesBiome = m.biome?.toLowerCase().includes(q);
        if (!matchesName && !matchesNameEn && !matchesTags && !matchesBiome) {
          return false;
        }
      }

      // 3. Категория биомов
      if (selectedCategory === "all") return true;

      const b = (m.biome || "").toLowerCase();
      if (selectedCategory === "dungeon_cave") {
        return (
          b.includes("cave") ||
          b.includes("dungeon") ||
          b.includes("underdark") ||
          b.includes("crypt") ||
          b.includes("mine") ||
          b.includes("sewer") ||
          m.tags?.includes("crypt")
        );
      }
      if (selectedCategory === "forest_swamp") {
        return b.includes("forest") || b.includes("swamp") || b.includes("jungle") || b.includes("marsh");
      }
      if (selectedCategory === "mountain_snow") {
        return b.includes("mountain") || b.includes("snow") || b.includes("desert") || b.includes("tundra") || b.includes("cliff");
      }
      if (selectedCategory === "urban_buildings") {
        return (
          b.includes("city") ||
          b.includes("urban") ||
          b.includes("tavern") ||
          b.includes("temple") ||
          b.includes("arena") ||
          b.includes("prison") ||
          b.includes("library")
        );
      }
      if (selectedCategory === "water_lava") {
        return b.includes("ship") || b.includes("coastal") || b.includes("water") || b.includes("lava") || b.includes("volcano");
      }

      return true;
    });
  }, [mode, maps, openMapsAsPresets, searchQuery, selectedCategory, selectedTag]);

  // При переключении вкладки синхронизируем выбранную карту
  useEffect(() => {
    if (currentList.length > 0) {
      setSelectedMap(currentList[0]);
    } else {
      setSelectedMap(null);
    }
  }, [mode]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseUniversalVTT(text, {
          id: `custom-uvtt-${Date.now()}`,
          name: file.name.replace(/\.[^/.]+$/, ""),
          nameEn: "Custom VTT Map",
          biome: "dungeon_prison",
          tags: ["custom", "uvtt", "community"],
          description: `Импортированная пользовательская карта из файла ${file.name}`,
        });

        setMaps((prev) => [parsed, ...prev]);
        setSelectedMap(parsed);
        setMode("presets");
        toast.success(`Карта «${parsed.name}» успешно загружена (${parsed.gridWidth}×${parsed.gridHeight})`);
      } catch (err) {
        console.error("VTT parse error:", err);
        toast.error("Не удалось разобрать файл .dd2vtt");
      }
    };
    reader.readAsText(file);
  };

  const handleApplyMap = async (preset: TacticalMapPreset) => {
    if (!combatId) {
      toast.error("Бой не найден");
      return;
    }

    try {
      setApplyingId(preset.id);
      const isCustomOrOpen = preset.id.startsWith("custom-") || preset.id.startsWith("open-");

      const payload: any = { combatId };
      if (isCustomOrOpen) {
        payload.customMap = {
          name: preset.name,
          gridWidth: preset.gridWidth,
          gridHeight: preset.gridHeight,
          backgroundUrl: preset.backgroundUrl,
          elements: preset.elements || [],
          spawnZones: preset.spawnZones || [],
        };
      } else {
        payload.mapPresetId = preset.id;
      }

      const res = await fetch("/api/combat/maps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Ошибка при смене карты");
      }

      const data = await res.json();
      toast.success(`Карта «${preset.name}» успешно установлена на поле боя!`);
      if (onMapApplied && data.combat) {
        onMapApplied(data.combat);
      }
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Не удалось применить карту");
    } finally {
      setApplyingId(null);
    }
  };

  const handleApplyCustomUrl = async () => {
    if (!customUrl.trim()) {
      toast.error("Укажите ссылку на изображение карты");
      return;
    }

    const customPreset: TacticalMapPreset = {
      id: `custom-url-${Date.now()}`,
      name: customName.trim() || "Пользовательская карта",
      nameEn: "Custom Online Map",
      biome: "dungeon_prison",
      tags: ["online", "custom", "url"],
      description: `Карта загружена по прямой ссылке из сети: ${customUrl}`,
      gridWidth: Math.max(10, Math.min(50, customWidth || 20)),
      gridHeight: Math.max(10, Math.min(50, customHeight || 20)),
      cellSizeFt: 5,
      backgroundUrl: customUrl.trim(),
      elements: [],
      spawnZones: [
        { name: "party", cells: [{ x: 2, y: 2 }] },
        { name: "enemy_frontline", cells: [{ x: customWidth - 3, y: customHeight - 3 }] },
      ],
    };

    await handleApplyMap(customPreset);
  };

  const getElementStats = (preset: TacticalMapPreset) => {
    const elements = preset.elements || [];
    let walls = 0;
    let covers = 0;
    let hazards = 0;
    let doors = 0;
    let water = 0;

    for (const el of elements) {
      const t = el.type as string;
      if (t === "wall") walls++;
      else if (t === "cover") covers++;
      else if (t === "hazard" || t === "lava") hazards++;
      else if (t === "door") doors++;
      else if (t === "water") water++;
    }

    return { walls, covers, hazards, doors, water, total: elements.length };
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="!max-w-[94vw] sm:!max-w-[94vw] w-[94vw] h-[90vh] rounded-xl flex flex-col p-0 gap-0 bg-background border border-border shadow-xl overflow-hidden text-foreground">
        {/* Хедер модального окна */}
        <DialogHeader className="p-4 pb-3 border-b border-border bg-card shrink-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                <Map className="size-5 text-foreground" />
                <span>Тактические Карты & Биомы D&D 5e</span>
                <Badge variant="secondary" className="text-[11px] font-mono">
                  {mode === "presets" ? `${maps.length} карт` : `${openMapsAsPresets.length} онлайн`}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Готовые тактические поля боя Roll20/VTT из каноничных биомов и открытого доступа
              </DialogDescription>
            </div>

            {/* Вкладки режимов и кнопки действий */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="flex items-center bg-muted p-0.5 rounded-lg border border-border">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setMode("presets");
                    setSelectedTag(null);
                  }}
                  className={`h-7 text-xs px-2.5 rounded-md flex items-center gap-1.5 ${
                    mode === "presets"
                      ? "bg-background text-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                  }`}
                >
                  <BookOpen className="size-3.5" />
                  <span>Биомы (24)</span>
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setMode("open_catalog");
                    setSelectedCategory("all");
                  }}
                  className={`h-7 text-xs px-2.5 rounded-md flex items-center gap-1.5 ${
                    mode === "open_catalog"
                      ? "bg-background text-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                  }`}
                >
                  <Globe className="size-3.5" />
                  <span>Открытый доступ (Теги)</span>
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setMode("custom_url")}
                  className={`h-7 text-xs px-2.5 rounded-md flex items-center gap-1.5 ${
                    mode === "custom_url"
                      ? "bg-background text-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                  }`}
                >
                  <Link className="size-3.5" />
                  <span>Прямой URL</span>
                </Button>
              </div>

              <label className="cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-secondary text-secondary-foreground border border-border hover:bg-secondary/80 transition-colors shadow-xs">
                <Upload className="size-3.5" />
                <span>.dd2vtt</span>
                <input
                  type="file"
                  accept=".dd2vtt,.uvtt,.json"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
          </div>

          {/* Панель фильтров и поиска */}
          {mode !== "custom_url" && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-3">
              <div className="relative flex-1">
                <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={
                    mode === "open_catalog"
                      ? "Поиск по открытым картам, тегам (крипта, мост, руины)..."
                      : "Поиск по названию карты, биому или тегу..."
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs bg-background border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>

              {mode === "presets" ? (
                <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedCategory("all")}
                    className={`h-7 text-xs px-2.5 rounded-md border ${
                      selectedCategory === "all"
                        ? "bg-foreground text-background border-foreground font-medium shadow-xs"
                        : "bg-muted/40 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    Все ({maps.length})
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedCategory("dungeon_cave")}
                    className={`h-7 text-xs px-2.5 rounded-md border ${
                      selectedCategory === "dungeon_cave"
                        ? "bg-foreground text-background border-foreground font-medium shadow-xs"
                        : "bg-muted/40 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Castle className="size-3 mr-1" /> Подземелья
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedCategory("forest_swamp")}
                    className={`h-7 text-xs px-2.5 rounded-md border ${
                      selectedCategory === "forest_swamp"
                        ? "bg-foreground text-background border-foreground font-medium shadow-xs"
                        : "bg-muted/40 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Trees className="size-3 mr-1" /> Леса & Топи
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedCategory("mountain_snow")}
                    className={`h-7 text-xs px-2.5 rounded-md border ${
                      selectedCategory === "mountain_snow"
                        ? "bg-foreground text-background border-foreground font-medium shadow-xs"
                        : "bg-muted/40 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Mountain className="size-3 mr-1" /> Горы & Снег
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedCategory("urban_buildings")}
                    className={`h-7 text-xs px-2.5 rounded-md border ${
                      selectedCategory === "urban_buildings"
                        ? "bg-foreground text-background border-foreground font-medium shadow-xs"
                        : "bg-muted/40 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    Город
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedCategory("water_lava")}
                    className={`h-7 text-xs px-2.5 rounded-md border ${
                      selectedCategory === "water_lava"
                        ? "bg-foreground text-background border-foreground font-medium shadow-xs"
                        : "bg-muted/40 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Flame className="size-3 mr-1" /> Вода & Лава
                  </Button>
                </div>
              ) : (
                /* Облако популярных тегов для открытого доступа */
                <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedTag(null)}
                    className={`h-7 text-xs px-2.5 rounded-md border ${
                      selectedTag === null
                        ? "bg-foreground text-background border-foreground font-medium shadow-xs"
                        : "bg-muted/40 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    Все теги ({openMapsAsPresets.length})
                  </Button>
                  {POPULAR_MAP_TAGS.map((pt) => {
                    const isActive = selectedTag === pt.tag;
                    return (
                      <Button
                        key={pt.tag}
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedTag(isActive ? null : pt.tag)}
                        className={`h-7 text-xs px-2 rounded-md border whitespace-nowrap ${
                          isActive
                            ? "bg-foreground text-background border-foreground font-medium shadow-xs"
                            : "bg-muted/40 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        #{pt.labelRu}
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </DialogHeader>

        {/* Тело модального окна */}
        {mode === "custom_url" ? (
          /* РЕЖИМ ПРЯМОГО URL */
          <div className="flex-1 p-6 overflow-y-auto min-h-0 bg-background flex flex-col items-center justify-center max-w-2xl mx-auto w-full space-y-4 text-foreground">
            <div className="text-center space-y-1">
              <div className="inline-flex p-3 rounded-full bg-muted border border-border text-foreground mb-2">
                <Link className="size-6" />
              </div>
              <h3 className="text-lg font-bold">Использовать любую карту из интернета</h3>
              <p className="text-xs text-muted-foreground max-w-md">
                Вставьте прямую ссылку на изображение боевой карты (Pinterest, Reddit, Imgur, Discord или сайт сообщества), укажите размеры сетки и загрузите её на поле боя.
              </p>
            </div>

            <div className="w-full space-y-3 bg-card p-4 rounded-xl border border-border shadow-sm">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Название карты (опционально):
                </label>
                <Input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Например: Заброшенная сторожевая башня"
                  className="h-8 text-xs bg-background border-border"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Прямая ссылка на арт карты (URL):
                </label>
                <Input
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://example.com/battlemaps/dungeon_20x20.jpg"
                  className="h-8 text-xs bg-background border-border font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Ширина сетки (клеток):
                  </label>
                  <Input
                    type="number"
                    min={10}
                    max={60}
                    value={customWidth}
                    onChange={(e) => setCustomWidth(parseInt(e.target.value) || 20)}
                    className="h-8 text-xs bg-background border-border"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Высота сетки (клеток):
                  </label>
                  <Input
                    type="number"
                    min={10}
                    max={60}
                    value={customHeight}
                    onChange={(e) => setCustomHeight(parseInt(e.target.value) || 20)}
                    className="h-8 text-xs bg-background border-border"
                  />
                </div>
              </div>

              {/* Живой предпросмотр */}
              {customUrl && (
                <div className="mt-3">
                  <div className="text-[11px] font-semibold text-muted-foreground mb-1">Предпросмотр арта:</div>
                  <div className="w-full h-44 rounded-lg overflow-hidden border border-border relative bg-muted">
                    <img
                      src={customUrl}
                      alt="Превью"
                      className="w-full h-full object-cover"
                      onError={() => toast.error("Не удалось загрузить изображение по указанному URL")}
                    />
                  </div>
                </div>
              )}

              <Button
                onClick={handleApplyCustomUrl}
                disabled={!customUrl.trim()}
                className="w-full h-10 mt-2 bg-foreground text-background hover:bg-foreground/90 font-medium text-xs shadow transition-colors"
              >
                <Check className="size-4 mr-1.5" />
                Загрузить онлайн-карту на поле боя
              </Button>
            </div>
          </div>
        ) : (
          /* РЕЖИМ КАТАЛОГА (ПРЕСЕТЫ ИЛИ ОТКРЫТЫЙ ДОСТУП) */
          <div className="flex-1 grid grid-cols-12 overflow-hidden min-h-0">
            {/* Сетка списка карт (7 колонок) */}
            <div className="col-span-12 md:col-span-7 border-r border-border flex flex-col overflow-hidden min-h-0 bg-background">
              <ScrollArea className="flex-1 min-h-0 p-3">
                {currentList.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground italic">
                    По вашему запросу карт не найдено
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {currentList.map((map) => {
                      const isSelected = selectedMap?.id === map.id;
                      const stats = getElementStats(map);

                      return (
                        <div
                          key={map.id}
                          onClick={() => setSelectedMap(map)}
                          className={`p-3 rounded-lg border text-left cursor-pointer transition-all duration-150 relative ${
                            isSelected
                              ? "bg-muted/70 border-foreground shadow-xs ring-1 ring-foreground"
                              : "bg-card border-border hover:border-foreground/30 hover:bg-muted/30"
                          }`}
                        >
                          {map.backgroundUrl && (
                            <div className="w-full h-24 mb-2 rounded overflow-hidden border border-border relative bg-muted">
                              <img
                                src={map.backgroundUrl}
                                alt={map.name}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                              {map.id.startsWith("open-") && (
                                <div className="absolute top-1 right-1 text-[9px] bg-background/90 text-foreground px-1.5 py-0.5 rounded font-mono border border-border flex items-center gap-0.5">
                                  <Globe className="size-2.5" />
                                  <span>Open</span>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="flex items-start justify-between gap-1">
                            <div>
                              <div className="font-bold text-sm text-foreground flex items-center gap-1.5">
                                <span>{map.name}</span>
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {map.nameEn || map.biome}
                              </div>
                            </div>

                            <Badge
                              variant="outline"
                              className="text-[10px] shrink-0 border-border bg-muted/50 text-muted-foreground"
                            >
                              {map.gridWidth}×{map.gridHeight}
                            </Badge>
                          </div>

                          <p className="text-xs text-muted-foreground line-clamp-2 mt-2 leading-relaxed">
                            {map.description || "Тактическая арена с интерактивным окружением."}
                          </p>

                          {/* Плашки элементов */}
                          <div className="flex items-center gap-1.5 flex-wrap mt-2.5 pt-2 border-t border-border text-[10px] text-muted-foreground">
                            {stats.walls > 0 && (
                              <span className="flex items-center gap-0.5 bg-muted px-1.5 py-0.5 rounded border border-border text-foreground">
                                🧱 {stats.walls} стен
                              </span>
                            )}
                            {stats.covers > 0 && (
                              <span className="flex items-center gap-0.5 bg-muted px-1.5 py-0.5 rounded border border-border text-foreground">
                                <Shield className="size-2.5 text-blue-600" /> {stats.covers} укрытий
                              </span>
                            )}
                            {stats.hazards > 0 && (
                              <span className="flex items-center gap-0.5 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 text-amber-700 dark:text-amber-400">
                                <Flame className="size-2.5" /> опасности
                              </span>
                            )}
                            {stats.water > 0 && (
                              <span className="flex items-center gap-0.5 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20 text-sky-700 dark:text-sky-400">
                                <Droplets className="size-2.5" /> вода
                              </span>
                            )}
                            {stats.doors > 0 && (
                              <span className="flex items-center gap-0.5 bg-muted px-1.5 py-0.5 rounded border border-border text-foreground">
                                <DoorOpen className="size-2.5" /> двери
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Детальная панель выбранной карты (5 колонок) */}
            <div className="col-span-12 md:col-span-5 flex flex-col overflow-hidden min-h-0 bg-muted/20 p-4">
              {selectedMap ? (
                <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                  {/* Заголовок карточки (всегда виден) */}
                  <div className="shrink-0 mb-3 pb-2 border-b border-border">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-bold text-foreground">
                        {selectedMap.name}
                      </h3>
                      <Badge variant="secondary" className="border border-border">
                        {selectedMap.biome}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {selectedMap.nameEn} • {selectedMap.gridWidth}×{selectedMap.gridHeight} клеток (
                      {selectedMap.gridWidth * 5}×{selectedMap.gridHeight * 5} футов)
                    </div>
                  </div>

                  {/* Тело деталей: ПОЛНОСТЬЮ СКРОЛЛИРУЕМОЕ */}
                  <ScrollArea className="flex-1 min-h-0 pr-3">
                    <div className="space-y-3.5 pb-2">
                      {selectedMap.backgroundUrl && (
                        <div className="w-full h-44 rounded-lg overflow-hidden border border-border shadow-xs relative bg-muted shrink-0">
                          <img
                            src={selectedMap.backgroundUrl}
                            alt={selectedMap.name}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute bottom-1.5 right-2 text-[10px] bg-background/90 text-foreground px-2 py-0.5 rounded font-mono border border-border">
                            Top-Down 90° VTT
                          </div>
                        </div>
                      )}

                      <div className="p-3 bg-card rounded-lg border border-border text-xs leading-relaxed text-foreground shadow-xs">
                        {selectedMap.description}
                      </div>

                      {/* Теги */}
                      {selectedMap.tags && selectedMap.tags.length > 0 && (
                        <div>
                          <div className="text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide flex items-center gap-1">
                            <Tag className="size-3 text-foreground" />
                            <span>Окружение и свойства:</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {selectedMap.tags.map((t) => (
                              <Badge
                                key={t}
                                variant="secondary"
                                className="bg-muted text-muted-foreground border border-border text-[10px]"
                              >
                                #{t}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Элементы */}
                      <div className="space-y-2 text-xs">
                        <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                          Тактические элементы ({selectedMap.elements?.length || 0}):
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          {(() => {
                            const stats = getElementStats(selectedMap);
                            return (
                              <>
                                <div className="p-2 bg-card rounded border border-border flex items-center justify-between">
                                  <span className="text-muted-foreground">Стены:</span>
                                  <span className="font-bold text-foreground">{stats.walls}</span>
                                </div>
                                <div className="p-2 bg-card rounded border border-border flex items-center justify-between">
                                  <span className="text-muted-foreground">Укрытия (+2/+5):</span>
                                  <span className="font-bold text-foreground">{stats.covers}</span>
                                </div>
                                <div className="p-2 bg-card rounded border border-border flex items-center justify-between">
                                  <span className="text-muted-foreground">Опасности:</span>
                                  <span className="font-bold text-foreground">{stats.hazards}</span>
                                </div>
                                <div className="p-2 bg-card rounded border border-border flex items-center justify-between">
                                  <span className="text-muted-foreground">Водные зоны:</span>
                                  <span className="font-bold text-foreground">{stats.water}</span>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Зоны спавна */}
                      {selectedMap.spawnZones && selectedMap.spawnZones.length > 0 && (
                        <div className="p-2.5 bg-card rounded border border-border text-xs">
                          <div className="font-semibold text-foreground mb-1">
                            Зоны тактического развёртывания:
                          </div>
                          <div className="space-y-1 text-[11px] text-muted-foreground">
                            {selectedMap.spawnZones.map((z) => (
                              <div key={z.name} className="flex justify-between items-center">
                                <span className="capitalize">{z.name.replace("_", " ")}:</span>
                                <span className="font-mono text-foreground">{z.cells?.length || 0} клеток</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>

                  {/* Кнопка применения (зафиксирована внизу, всегда видна) */}
                  <div className="shrink-0 pt-3 border-t border-border mt-auto">
                    <Button
                      onClick={() => handleApplyMap(selectedMap)}
                      disabled={applyingId === selectedMap.id}
                      className="w-full h-11 bg-foreground text-background hover:bg-foreground/90 font-medium text-sm shadow transition-colors"
                    >
                      <Check className="size-4 mr-2" />
                      {applyingId === selectedMap.id ? "Применение карты..." : `Загрузить карту «${selectedMap.name}»`}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground italic">
                  Выберите карту слева для просмотра параметров
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
