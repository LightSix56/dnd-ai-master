"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Heart, Shield, Footprints, Sparkles, Swords, Info, Zap } from "lucide-react";
import type { Combatant } from "@/lib/combat/types";
import { BEAST_FORMS, getAvailableBeastForms, type BeastForm } from "@/lib/combat/beast-forms";
import { DAMAGE_TYPE_LABELS } from "@/lib/combat/types";

interface WildShapeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  combatant: Combatant;
  onSelectForm: (formId: string) => void;
}

export function WildShapeModal({
  open,
  onOpenChange,
  combatant,
  onSelectForm,
}: WildShapeModalProps) {
  const [filter, setFilter] = useState<"all" | "combat" | "tactical" | "elemental">("all");
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);

  const isMoonDruid =
    combatant.className?.toLowerCase().includes("лун") ||
    combatant.className?.toLowerCase().includes("moon") ||
    combatant.abilities.some((a) => a.id.includes("combat_wild_shape") || a.name.toLowerCase().includes("боевой дикий облик"));

  const level = combatant.level ?? 1;
  const availableForms = getAvailableBeastForms(level, isMoonDruid);

  const filteredForms = availableForms.filter((f) => {
    if (filter === "elemental") return f.type === "elemental";
    if (filter === "combat") return f.hpMax >= 20 || f.attacks.some((a) => a.damage.length >= 2);
    if (filter === "tactical") return f.traits.length > 0 || f.climb || f.swim || f.fly || f.size === "tiny";
    return true;
  });

  const selectedForm = availableForms.find((f) => f.id === selectedFormId) || filteredForms[0];

  const wildShapeAbility = combatant.abilities.find(
    (a) => a.id === "wild_shape" || a.id.includes("wild_shape") || a.name.toLowerCase().includes("дикий облик")
  );
  const remainingUses = wildShapeAbility
    ? wildShapeAbility.usesMax > 0
      ? wildShapeAbility.usesMax - wildShapeAbility.usesUsed
      : 2
    : 2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[96vw] sm:!max-w-[96vw] w-[96vw] h-[92vh] flex flex-col p-5 bg-card/95 backdrop-blur border-emerald-500/30">
        <DialogHeader className="pb-2 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🐾</span>
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2 text-emerald-400">
                  Дикий облик друида
                  <Badge variant="outline" className="text-xs bg-emerald-500/10 border-emerald-500/30">
                    {isMoonDruid ? "Круг Луны (Бонусное действие)" : "Базовый друид (Основное действие)"}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Выберите форму зверя для превращения. Зверь даёт свой запас здоровья, КД и атаки.
                </DialogDescription>
              </div>
            </div>
            <Badge variant="secondary" className="px-3 py-1 bg-emerald-500/20 text-emerald-300 font-mono text-sm">
              Использования: {remainingUses}/2
            </Badge>
          </div>

          {/* Фильтры */}
          <div className="flex gap-2 pt-3">
            <Button
              size="sm"
              variant={filter === "all" ? "default" : "outline"}
              className={`h-7 text-xs ${filter === "all" ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
              onClick={() => setFilter("all")}
            >
              Все формы ({availableForms.length})
            </Button>
            <Button
              size="sm"
              variant={filter === "combat" ? "default" : "outline"}
              className={`h-7 text-xs ${filter === "combat" ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
              onClick={() => setFilter("combat")}
            >
              ⚔️ Боевые и Танки
            </Button>
            <Button
              size="sm"
              variant={filter === "tactical" ? "default" : "outline"}
              className={`h-7 text-xs ${filter === "tactical" ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
              onClick={() => setFilter("tactical")}
            >
              🕸️ Разведка и Контроль
            </Button>
            {isMoonDruid && level >= 10 && (
              <Button
                size="sm"
                variant={filter === "elemental" ? "default" : "outline"}
                className={`h-7 text-xs ${filter === "elemental" ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
                onClick={() => setFilter("elemental")}
              >
                🔥 Стихийные формы
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Сетка форм и деталей */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 min-h-0 pt-3">
          {/* Левая колонка: список карточек */}
          <ScrollArea className="md:col-span-5 h-[400px] pr-2">
            <div className="space-y-2">
              {filteredForms.map((form) => {
                const isSelected = selectedForm?.id === form.id;
                return (
                  <div
                    key={form.id}
                    onClick={() => setSelectedFormId(form.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-emerald-500/20 border-emerald-500 shadow-md ring-1 ring-emerald-400"
                        : "bg-card hover:bg-accent/40 border-border/60"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{form.icon}</span>
                        <span className="font-semibold text-sm">{form.name}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        CR {form.cr === 0.25 ? "1/4" : form.cr === 0.5 ? "1/2" : form.cr}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1 text-red-400 font-mono">
                        <Heart className="size-3" /> {form.hpMax} HP
                      </span>
                      <span className="flex items-center gap-1 text-blue-400 font-mono">
                        <Shield className="size-3" /> КД {form.ac}
                      </span>
                      <span className="flex items-center gap-1 text-amber-400 font-mono">
                        <Footprints className="size-3" /> {form.speed} фт
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {/* Правая колонка: подробный профиль выбранного зверя */}
          <div className="md:col-span-7 bg-card/60 border border-border/80 rounded-lg p-4 flex flex-col justify-between">
            {selectedForm ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-border/50 pb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">{selectedForm.icon}</span>
                    <div>
                      <h3 className="font-bold text-lg text-emerald-300">{selectedForm.name}</h3>
                      <p className="text-xs text-muted-foreground italic">{selectedForm.nameEn} • {selectedForm.size} {selectedForm.type}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-300 text-xs">
                      Опасность (CR) {selectedForm.cr === 0.25 ? "1/4" : selectedForm.cr === 0.5 ? "1/2" : selectedForm.cr}
                    </Badge>
                  </div>
                </div>

                {/* Базовые показатели */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-red-500/10 border border-red-500/20 rounded p-2">
                    <span className="text-[10px] text-muted-foreground uppercase block">Здоровье зверя</span>
                    <span className="font-mono font-bold text-base text-red-400">{selectedForm.hpMax} HP</span>
                  </div>
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded p-2">
                    <span className="text-[10px] text-muted-foreground uppercase block">Класс доспеха</span>
                    <span className="font-mono font-bold text-base text-blue-400">{selectedForm.ac}</span>
                  </div>
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded p-2">
                    <span className="text-[10px] text-muted-foreground uppercase block">Скорость</span>
                    <span className="font-mono font-bold text-base text-amber-400">
                      {selectedForm.speed} фт
                      {selectedForm.climb ? ` (лаз ${selectedForm.climb})` : ""}
                      {selectedForm.swimSpeed ? ` (плав ${selectedForm.swimSpeed})` : ""}
                      {selectedForm.flySpeed ? ` (полёт ${selectedForm.flySpeed})` : ""}
                    </span>
                  </div>
                </div>

                {/* Физические модификаторы */}
                <div className="flex items-center justify-around bg-muted/30 py-1.5 px-3 rounded text-xs">
                  <span>СИЛ: <strong className="font-mono text-emerald-400">{selectedForm.abilityMods.STR >= 0 ? `+${selectedForm.abilityMods.STR}` : selectedForm.abilityMods.STR}</strong></span>
                  <span>ЛОВ: <strong className="font-mono text-emerald-400">{selectedForm.abilityMods.DEX >= 0 ? `+${selectedForm.abilityMods.DEX}` : selectedForm.abilityMods.DEX}</strong></span>
                  <span>ТЕЛ: <strong className="font-mono text-emerald-400">{selectedForm.abilityMods.CON >= 0 ? `+${selectedForm.abilityMods.CON}` : selectedForm.abilityMods.CON}</strong></span>
                  <span className="text-muted-foreground text-[10px]">(ИНТ/МУД/ХАР от друида)</span>
                </div>

                {/* Атаки */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Swords className="size-3.5" /> Атаки зверя
                  </h4>
                  <div className="space-y-1.5">
                    {selectedForm.attacks.map((atk, i) => {
                      const dmgSummary = atk.damage
                        .map((d) => `${d.dice}${d.mod ? (d.mod > 0 ? `+${d.mod}` : d.mod) : ""} ${DAMAGE_TYPE_LABELS[d.type] || d.type}`)
                        .join(" + ");
                      return (
                        <div key={i} className="bg-background/60 border rounded p-2 text-xs">
                          <div className="flex items-center justify-between font-medium">
                            <span>{atk.name}</span>
                            <span className="font-mono text-emerald-400">+{atk.attackBonus} к атаке</span>
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            Урон: <strong className="text-foreground">{dmgSummary}</strong>
                            {atk.description && <span className="block italic text-muted-foreground mt-0.5">{atk.description}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Особенности */}
                {selectedForm.traits.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Sparkles className="size-3.5" /> Особенности формы
                    </h4>
                    <ul className="text-xs space-y-1 text-muted-foreground list-disc list-inside">
                      {selectedForm.traits.map((trait, i) => (
                        <li key={i} className="leading-snug">{trait}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-muted-foreground my-auto">Выберите форму зверя слева</div>
            )}

            <div className="pt-4 mt-auto border-t border-border/50 flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                Отмена
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-2 shadow-md"
                disabled={!selectedForm || remainingUses <= 0}
                onClick={() => {
                  if (selectedForm) {
                    onSelectForm(selectedForm.id);
                    onOpenChange(false);
                  }
                }}
              >
                <Zap className="size-4" />
                Принять облик {selectedForm?.name} ({selectedForm?.hpMax} HP)
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
