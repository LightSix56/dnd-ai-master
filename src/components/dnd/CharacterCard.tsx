"use client";

import { useState } from "react";
import { Character } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Skull,
  MapPin,
  Heart,
  Trash2,
  Loader2,
  Activity,
  Shield,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Package,
} from "lucide-react";
import { CharacterInventoryModal } from "./CharacterInventoryModal";

function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

function modStr(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

const typeColors: Record<string, string> = {
  player: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  npc: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  enemy: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  companion: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
};

const typeLabels: Record<string, string> = {
  player: "Игрок",
  npc: "NPC",
  enemy: "Враг",
  companion: "Спутник",
};

export interface RelationTier {
  label: string;
  badgeClass: string;
}

export function getRelationTier(relation: number = 0): RelationTier {
  if (relation <= -60) {
    return {
      label: "Заклятый враг",
      badgeClass: "bg-red-950/40 text-red-400 border-red-800/60 font-semibold",
    };
  }
  if (relation <= -25) {
    return {
      label: "Враждебно",
      badgeClass: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
    };
  }
  if (relation <= -5) {
    return {
      label: "Насторожен / Недоверие",
      badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    };
  }
  if (relation <= 10) {
    return {
      label: "Нейтрально",
      badgeClass: "bg-muted/40 text-muted-foreground border-border/50",
    };
  }
  if (relation <= 30) {
    return {
      label: "Знакомый / С симпатией",
      badgeClass: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
    };
  }
  if (relation <= 60) {
    return {
      label: "Доверяет / Союзник",
      badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    };
  }
  return {
    label: "Верный соратник",
    badgeClass: "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40 font-semibold",
  };
}

export function CharacterCard({
  character,
  onDelete,
  deleting,
  onToggleInScene,
  onCharacterUpdated,
}: {
  character: Character;
  onDelete?: (character: Character) => void;
  deleting?: boolean;
  onToggleInScene?: (character: Character, nextInScene: boolean) => void;
  onCharacterUpdated?: (updated: Character) => void;
}) {
  const [showTechnicalStats, setShowTechnicalStats] = useState(false);
  const [showInventoryModal, setShowInventoryModal] = useState(false);

  const isPlayer = character.type === "player";
  const inScene = character.inScene !== false;
  const hpPct = character.hpMax > 0 ? (character.hpCurrent / character.hpMax) * 100 : 0;
  const hpColor = hpPct > 60 ? "bg-emerald-500" : hpPct > 30 ? "bg-amber-500" : "bg-red-500";

  // Извлекаем качественный статус из заметок (например "[Статус: без сознания, похищен]")
  const statusMatch = character.notes?.match(/\[(?:Статус|Состояние):\s*([^\]]+)\]/i);
  const statusText = statusMatch ? statusMatch[1].trim() : null;
  const cleanNotes = character.notes
    ? character.notes.replace(/\[(?:Статус|Состояние):\s*[^\]]+\]/gi, "").trim()
    : "";

  return (
    <Card className={`transition-all ${!character.isAlive ? "opacity-60 border-destructive/40" : ""} ${!inScene && !isPlayer ? "opacity-75 bg-muted/20 border-dashed" : ""}`}>
      <CardHeader className="pb-2.5 pt-3.5 px-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5 flex-wrap">
              <span className="truncate">{character.name}</span>
              {!character.isAlive && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                  <Skull className="size-2.5 mr-1" />
                  Мёртв
                </Badge>
              )}
              {!inScene && !isPlayer && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground border-muted-foreground/30">
                  Вне сцены
                </Badge>
              )}
            </CardTitle>
            <div className="text-xs text-muted-foreground mt-0.5">
              {[character.race, character.class, isPlayer ? `${character.level} ур.` : null]
                .filter(Boolean)
                .join(" • ")}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="size-6 text-amber-600 dark:text-amber-400 hover:bg-amber-500/15"
              title="Открыть инвентарь и зелья"
              onClick={() => setShowInventoryModal(true)}
            >
              <Package className="size-3.5" />
            </Button>
            {!isPlayer && onToggleInScene && (
              <Button
                variant="ghost"
                size="icon"
                className={`size-6 transition-colors ${
                  inScene
                    ? "text-amber-600 dark:text-amber-400 hover:bg-amber-500/15"
                    : "text-muted-foreground hover:text-foreground opacity-60 hover:opacity-100"
                }`}
                title={
                  inScene
                    ? "Персонаж в активной сцене (кликните, чтобы переместить в 'Остальной мир')"
                    : "Персонаж вне сцены (кликните, чтобы вернуть в активную сцену)"
                }
                onClick={() => onToggleInScene(character, !inScene)}
              >
                {inScene ? (
                  <Eye className="size-3.5" />
                ) : (
                  <EyeOff className="size-3.5" />
                )}
              </Button>
            )}
            <Badge variant="outline" className={`text-[11px] px-2 py-0.5 ${typeColors[character.type] || ""}`}>
              {typeLabels[character.type] || character.type}
            </Badge>
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="size-6 text-muted-foreground hover:text-destructive"
                title="Удалить персонажа"
                disabled={deleting}
                onClick={() => onDelete(character)}
              >
                {deleting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-2.5 px-3.5 pb-3 pt-0">
        {/* ================= РЕЖИМ NPC / ВРАГОВ (НАРРАТИВНЫЙ) ================= */}
        {!isPlayer && (
          <>
            {/* Качественный статус NPC */}
            {statusText && (
              <div className="flex items-start gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-amber-500/10 border border-amber-500/25 text-amber-900 dark:text-amber-200">
                <Activity className="size-3.5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <span className="leading-snug">{statusText}</span>
              </div>
            )}

            {/* Локация */}
            {character.location && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="size-3 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="truncate">{character.location}</span>
              </div>
            )}

            {/* Нарративное описание / заметка */}
            {cleanNotes && (
              <p className="text-xs text-muted-foreground leading-relaxed italic bg-muted/30 p-2 rounded border border-border/40">
                {cleanNotes}
              </p>
            )}

            {/* Отношение к герою (качественный статус) */}
            {(() => {
              const relTier = getRelationTier(character.relation ?? 0);
              return (
                <div className="flex items-center justify-between text-xs pt-0.5">
                  <span className="text-muted-foreground">Отношение</span>
                  <Badge
                    variant="outline"
                    className={`text-[11px] font-medium px-2 py-0.5 transition-colors ${relTier.badgeClass}`}
                  >
                    {relTier.label}
                  </Badge>
                </div>
              );
            })()}

            {/* Скрываемый блок технических статов (для ДМа) */}
            <div className="pt-1 border-t border-border/40">
              <button
                type="button"
                onClick={() => setShowTechnicalStats(!showTechnicalStats)}
                className="flex items-center justify-between w-full text-[11px] text-muted-foreground hover:text-foreground transition-colors py-0.5 cursor-pointer"
              >
                <span className="flex items-center gap-1">
                  <Shield className="size-3" />
                  Технические характеристики
                </span>
                {showTechnicalStats ? (
                  <ChevronUp className="size-3" />
                ) : (
                  <ChevronDown className="size-3" />
                )}
              </button>

              {showTechnicalStats && (
                <div className="mt-2 space-y-2 pt-1 border-t border-border/30">
                  <div className="grid grid-cols-4 gap-1.5 text-center text-[11px]">
                    <div className="rounded border bg-muted/40 p-1">
                      <div className="text-muted-foreground text-[10px]">HP</div>
                      <div className="font-mono font-bold">{character.hpCurrent}/{character.hpMax}</div>
                    </div>
                    <div className="rounded border bg-muted/40 p-1">
                      <div className="text-muted-foreground text-[10px]">AC</div>
                      <div className="font-mono font-bold">{character.ac}</div>
                    </div>
                    <div className="rounded border bg-muted/40 p-1">
                      <div className="text-muted-foreground text-[10px]">Speed</div>
                      <div className="font-mono font-bold">{character.speed} фт</div>
                    </div>
                    <div className="rounded border bg-muted/40 p-1">
                      <div className="text-muted-foreground text-[10px]">Число</div>
                      <div className="font-mono font-bold">
                        {(character.relation ?? 0) > 0 ? `+${character.relation}` : (character.relation ?? 0)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-6 gap-1 text-center text-[9px]">
                    {([
                      ["STR", character.str],
                      ["DEX", character.dex],
                      ["CON", character.con],
                      ["INT", character.int],
                      ["WIS", character.wis],
                      ["CHA", character.cha],
                    ] as const).map(([ab, score]) => (
                      <div key={ab} className="rounded border bg-muted/20 p-0.5">
                        <div className="text-muted-foreground">{ab}</div>
                        <div className="font-mono font-bold text-[10px]">{score}</div>
                        <div className="text-muted-foreground text-[8px]">{modStr(abilityMod(score))}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ================= РЕЖИМ ПЕРСОНАЖА ИГРОКА (ПОЛНЫЙ ЛИСТ) ================= */}
        {isPlayer && (
          <>
            {/* HP */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Heart className="size-3 text-rose-500" /> Хиты (HP)
                </span>
                <span className="font-mono font-semibold">
                  {character.hpCurrent}/{character.hpMax}
                  {Boolean(character.hpTemp && character.hpTemp > 0) && (
                    <span className="text-blue-600 dark:text-blue-400 font-bold ml-1">
                      (+{character.hpTemp})
                    </span>
                  )}
                </span>
              </div>
              <Progress value={hpPct} className="h-2" indicatorClassName={hpColor} />
            </div>

            {/* AC / Speed / Prof */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-md border bg-muted/40 p-1.5">
                <div className="text-muted-foreground text-[10px]">КД (AC)</div>
                <div className="font-mono font-bold">{character.ac}</div>
              </div>
              <div className="rounded-md border bg-muted/40 p-1.5">
                <div className="text-muted-foreground text-[10px]">Скорость</div>
                <div className="font-mono font-bold">{character.speed} фт</div>
              </div>
              <div className="rounded-md border bg-muted/40 p-1.5">
                <div className="text-muted-foreground text-[10px]">Мастерство</div>
                <div className="font-mono font-bold">+{character.profBonus}</div>
              </div>
            </div>

            {/* Характеристики */}
            <div className="grid grid-cols-6 gap-1 text-center text-[10px]">
              {([
                ["STR", character.str],
                ["DEX", character.dex],
                ["CON", character.con],
                ["INT", character.int],
                ["WIS", character.wis],
                ["CHA", character.cha],
              ] as const).map(([ab, score]) => (
                <div
                  key={ab}
                  className="rounded border bg-muted/30 p-1 flex flex-col items-center"
                >
                  <div className="text-muted-foreground text-[9px]">{ab}</div>
                  <div className="font-mono font-bold text-xs">{score}</div>
                  <div className="text-muted-foreground text-[9px]">
                    {modStr(abilityMod(score))}
                  </div>
                </div>
              ))}
            </div>

            {/* Локация */}
            {character.location && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground pt-1">
                <MapPin className="size-3 text-amber-600" />
                <span className="truncate">{character.location}</span>
              </div>
            )}
          </>
        )}
      </CardContent>

      <CharacterInventoryModal
        open={showInventoryModal}
        onOpenChange={setShowInventoryModal}
        character={character}
        onCharacterUpdated={onCharacterUpdated}
      />
    </Card>
  );
}
