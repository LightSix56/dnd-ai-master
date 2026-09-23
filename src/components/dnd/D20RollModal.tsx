"use client";

import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dices,
  Shield,
  Swords,
  Sparkles,
  Search,
  User,
  Star,
} from "lucide-react";
import type { Character } from "@/lib/store";
import {
  ABILITY_META_LIST,
  DND_SKILLS,
  parseCharacterProficiencies,
  getSkillBonus,
  getSaveBonus,
  formatD20RollResult,
  abilityModifier,
  rollD20,
  type SkillDef,
  type AbilityKey,
} from "@/lib/dnd/d20-helper";

interface D20RollModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  characters: Character[];
  onRollSelect: (rollText: string) => void;
}

export function D20RollModal({
  open,
  onOpenChange,
  characters,
  onRollSelect,
}: D20RollModalProps) {
  const [selectedCharIdOverride, setSelectedCharIdOverride] = useState<string | null>(null);

  const activePlayerChar = useMemo(() => {
    return characters.find((c) => c.type === "player") || characters[0] || null;
  }, [characters]);

  const selectedChar = useMemo(() => {
    if (selectedCharIdOverride) {
      const found = characters.find((c) => c.id === selectedCharIdOverride);
      if (found) return found;
    }
    return activePlayerChar;
  }, [characters, selectedCharIdOverride, activePlayerChar]);

  const selectedCharId = selectedChar?.id || "";

  const sortedCharacters = useMemo(() => {
    return [...characters].sort((a, b) => {
      if (a.type === "player" && b.type !== "player") return -1;
      if (a.type !== "player" && b.type === "player") return 1;
      return a.name.localeCompare(b.name);
    });
  }, [characters]);
  const [activeTab, setActiveTab] = useState<string>("skills");
  const [skillSearch, setSkillSearch] = useState<string>("");
  const [customBonus, setCustomBonus] = useState<number>(0);



  const parsedProfs = useMemo(() => {
    if (!selectedChar) return null;
    return parseCharacterProficiencies(selectedChar.notes, selectedChar.class);
  }, [selectedChar]);

  const filteredSkills = useMemo(() => {
    const q = skillSearch.trim().toLowerCase();
    if (!q) return DND_SKILLS;
    return DND_SKILLS.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.ability.toLowerCase().includes(q) ||
        (ABILITY_META_LIST.find((a) => a.key === s.ability)?.ruFull.toLowerCase() || "").includes(q)
    );
  }, [skillSearch]);

  function executeRoll(label: string, bonus: number) {
    const d20 = rollD20();
    const formatted = formatD20RollResult(label, d20, bonus);
    onRollSelect(formatted);
    onOpenChange(false);
  }

  function handleSkillRoll(skill: SkillDef) {
    if (!selectedChar || !parsedProfs) return;
    const bonus = getSkillBonus(selectedChar, skill, parsedProfs);
    const abilityMeta = ABILITY_META_LIST.find((a) => a.key === skill.ability);
    const label = `${abilityMeta?.ruFull || skill.ability.toUpperCase()} (${skill.name})`;
    executeRoll(label, bonus);
  }

  function handleSaveRoll(ability: AbilityKey) {
    if (!selectedChar || !parsedProfs) return;
    const bonus = getSaveBonus(selectedChar, ability, parsedProfs);
    const abilityMeta = ABILITY_META_LIST.find((a) => a.key === ability);
    const label = `Спасбросок ${abilityMeta?.ruGenitive || abilityMeta?.ruFull || ability.toUpperCase()}`;
    executeRoll(label, bonus);
  }

  function handleAttackRoll(name: string, bonus: number) {
    executeRoll(`Атака: ${name}`, bonus);
  }

  function handleCustomRoll() {
    executeRoll("Бросок d20", customBonus);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col p-5 gap-4">
        <DialogHeader className="pb-1">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <div className="size-8 rounded-lg bg-gradient-to-br from-amber-600 to-rose-700 flex items-center justify-center text-white shadow-sm">
              <Dices className="size-5" />
            </div>
            <span>Интерактивный бросок d20</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Выберите действие или навык: значение кубика и бонус персонажа автоматически посчитаются и добавятся в ответ.
          </DialogDescription>
        </DialogHeader>

        {/* Выбор персонажа */}
        {characters.length > 1 && (
          <div className="flex items-center gap-2 bg-muted/30 p-2 rounded-lg border border-border/40">
            <User className="size-4 text-muted-foreground ml-1" />
            <span className="text-xs text-muted-foreground font-medium">Персонаж:</span>
            <select
              value={selectedCharId || ""}
              onChange={(e) => setSelectedCharIdOverride(e.target.value)}
              className="flex-1 bg-background border border-border rounded px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              {sortedCharacters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.type === "player" ? "⭐ (Игрок)" : `(${c.type})`} — {c.race || ""} {c.class || ""} {c.level} ур.
                </option>
              ))}
            </select>
          </div>
        )}

        {selectedChar && (
          <div className="flex items-center justify-between text-xs px-1 text-muted-foreground">
            <div>
              <span className="font-semibold text-foreground">{selectedChar.name}</span>
              <span className="opacity-70">
                {" "}• {selectedChar.class || "Без класса"} {selectedChar.level} ур.
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-mono">
              <Badge variant="outline" className="text-[11px] py-0">
                Мастерство: +{selectedChar.profBonus || 2}
              </Badge>
            </div>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="skills" className="text-xs flex items-center gap-1 py-1.5">
              <Sparkles className="size-3.5" />
              <span>Навыки</span>
            </TabsTrigger>
            <TabsTrigger value="saves" className="text-xs flex items-center gap-1 py-1.5">
              <Shield className="size-3.5" />
              <span>Спасброски</span>
            </TabsTrigger>
            <TabsTrigger value="attacks" className="text-xs flex items-center gap-1 py-1.5">
              <Swords className="size-3.5" />
              <span>Атаки</span>
            </TabsTrigger>
            <TabsTrigger value="custom" className="text-xs flex items-center gap-1 py-1.5">
              <Dices className="size-3.5" />
              <span>Свой</span>
            </TabsTrigger>
          </TabsList>

          {/* Вкладка 1: Проверка навыков */}
          <TabsContent value="skills" className="flex-1 flex flex-col min-h-0 pt-2 space-y-2">
            <div className="relative">
              <Search className="size-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Поиск навыка (внимательность, атлетика...)"
                value={skillSearch}
                onChange={(e) => setSkillSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-muted/20"
              />
            </div>
            <ScrollArea className="flex-1 max-h-[360px] pr-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pb-2">
                {filteredSkills.map((skill) => {
                  if (!selectedChar || !parsedProfs) return null;
                  const bonus = getSkillBonus(selectedChar, skill, parsedProfs);
                  const profState = parsedProfs.skills.get(skill.name);
                  const abilityMeta = ABILITY_META_LIST.find((a) => a.key === skill.ability);

                  return (
                    <button
                      key={skill.id}
                      type="button"
                      onClick={() => handleSkillRoll(skill)}
                      className="flex items-center justify-between p-2 rounded-md border border-border/60 bg-card/60 hover:bg-amber-500/10 hover:border-amber-500/40 transition text-left cursor-pointer group"
                    >
                      <div className="min-w-0 pr-1">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-medium truncate group-hover:text-amber-700 dark:group-hover:text-amber-300">
                            {skill.name}
                          </span>
                          {profState === "expertise" && (
                            <span title="Компетенция (х2)"><Star className="size-3 text-amber-500 fill-amber-500 shrink-0" /></span>
                          )}
                          {profState === "proficient" && (
                            <div className="size-1.5 rounded-full bg-emerald-500 shrink-0" title="Владение" />
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {abilityMeta?.ruShort || skill.ability.toUpperCase()}
                        </span>
                      </div>
                      <span
                        className={`font-mono text-xs font-bold px-1.5 py-0.5 rounded ${
                          profState
                            ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {bonus >= 0 ? `+${bonus}` : bonus}
                      </span>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Вкладка 2: Спасброски */}
          <TabsContent value="saves" className="flex-1 min-h-0 pt-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pb-2">
              {ABILITY_META_LIST.map((ab) => {
                if (!selectedChar || !parsedProfs) return null;
                const score = selectedChar[ab.key] ?? 10;
                const baseMod = abilityModifier(score);
                const saveBonus = getSaveBonus(selectedChar, ab.key, parsedProfs);
                const isProf = parsedProfs.savingThrows.has(ab.ruShort);

                return (
                  <button
                    key={ab.key}
                    type="button"
                    onClick={() => handleSaveRoll(ab.key)}
                    className="flex flex-col p-3 rounded-lg border border-border/60 bg-card/60 hover:bg-amber-500/10 hover:border-amber-500/40 transition text-left cursor-pointer group"
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-semibold text-xs text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400">
                        {ab.ruFull}
                      </span>
                      {isProf && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                          Владение
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-baseline justify-between mt-auto pt-2 border-t border-border/40 w-full">
                      <span className="text-[10px] text-muted-foreground font-mono">
                        Стат: {score} ({baseMod >= 0 ? `+${baseMod}` : baseMod})
                      </span>
                      <span className="font-mono text-sm font-bold text-amber-700 dark:text-amber-300">
                        Спас: {saveBonus >= 0 ? `+${saveBonus}` : saveBonus}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </TabsContent>

          {/* Вкладка 3: Атаки */}
          <TabsContent value="attacks" className="flex-1 min-h-0 pt-2">
            {parsedProfs && parsedProfs.attacks.length > 0 ? (
              <div className="space-y-2 pb-2">
                {parsedProfs.attacks.map((att, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleAttackRoll(att.name, att.bonus)}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-border/60 bg-card/60 hover:bg-amber-500/10 hover:border-amber-500/40 transition text-left cursor-pointer group"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-medium text-xs text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400">
                        {att.name}
                      </div>
                      {att.damageAndType && (
                        <div className="text-[11px] text-muted-foreground font-mono">
                          Урон: {att.damageAndType}
                        </div>
                      )}
                    </div>
                    <span className="font-mono text-xs font-bold px-2 py-1 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0">
                      Попадание: {att.bonus >= 0 ? `+${att.bonus}` : att.bonus}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center text-xs text-muted-foreground py-8">
                В карточке персонажа не найдено готового оружия. Вы можете использовать проверку Силы/Ловкости или вкладку «Свой».
              </div>
            )}
          </TabsContent>

          {/* Вкладка 4: Свой бросок d20 */}
          <TabsContent value="custom" className="flex-1 min-h-0 pt-2 space-y-4">
            <div className="p-4 rounded-lg border border-border/60 bg-card/40 space-y-3">
              <div className="text-xs text-muted-foreground">
                Бросок чистого d20 с произвольным модификатором:
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 flex-1">
                  <span className="text-xs font-medium text-muted-foreground">Модификатор:</span>
                  <Input
                    type="number"
                    value={customBonus}
                    onChange={(e) => setCustomBonus(parseInt(e.target.value, 10) || 0)}
                    className="w-24 h-8 text-center font-mono font-bold text-xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCustomRoll}
                  className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-md text-xs font-semibold shadow transition cursor-pointer flex items-center gap-1.5"
                >
                  <Dices className="size-4" />
                  Бросить 1d20{customBonus !== 0 ? (customBonus > 0 ? `+${customBonus}` : customBonus) : ""}
                </button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
