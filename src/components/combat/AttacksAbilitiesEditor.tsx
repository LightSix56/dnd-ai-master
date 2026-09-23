"use client";

// Редактор «Атаки и способности» — работает для любого бойца: игрока, врага, NPC, спутника.
// Правит боевой набор через update-combatant: атаки, заклинания, способности, ячейки.

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { X, Plus, Trash2, Swords, Zap, Sparkles, Save } from "lucide-react";
import { toast } from "sonner";
import type {
  Combatant,
  Attack,
  AttackKind,
  ActionCost,
  CombatAbility,
  HotbarItem,
  ActionParameters,
  DamageRoll,
} from "@/lib/combat/types";
import { DAMAGE_TYPE_LABELS } from "@/lib/combat/types";

interface LibrarySpell {
  id: string;
  name: string;
  level: number;
  school?: string | null;
  parameters: ActionParameters;
}

interface LibraryAbility {
  id: string;
  name: string;
  className: string;
  minLevel: number;
  parameters: ActionParameters;
}

interface Props {
  combatant: Combatant;
  onSave: (updates: Record<string, unknown>) => Promise<void> | void;
  onClose: () => void;
}

type Tab = "attacks" | "spells" | "abilities";

const KIND_LABELS: Record<AttackKind, string> = {
  melee: "Ближний бой",
  ranged: "Дальний бой",
  spell: "Заклинательная атака",
};

const COST_OPTIONS: Array<{ value: ActionCost; label: string }> = [
  { value: "action", label: "Действие" },
  { value: "bonus", label: "Бонусное действие" },
  { value: "action+bonus", label: "Действие + бонусное (двойной удар)" },
  { value: "reaction", label: "Реакция" },
  { value: "free", label: "Бесплатно" },
];

function emptyAttack(): Attack {
  return {
    id: `atk_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    name: "Новая атака",
    attackBonus: 0,
    damage: [{ dice: "1d6", mod: 0, type: "slashing" }],
    kind: "melee",
    range: { normal: 5 },
    actionCost: "action",
  };
}

/** Хотбар пересобираем из актуального набора — иначе в нём остаются мёртвые ссылки */
function rebuildHotbar(
  attacks: Attack[],
  spellIds: string[],
  spellNames: Record<string, string>,
  abilities: CombatAbility[]
): HotbarItem[] {
  return [
    ...attacks.map((a) => ({ id: a.id, type: "attack" as const, name: a.name })),
    ...spellIds.map((id) => ({
      id: `spell_${id}`,
      type: "spell" as const,
      name: spellNames[id] || "Заклинание",
      libraryId: id,
    })),
    ...abilities.map((a) => ({ id: a.id, type: "ability" as const, name: a.name })),
  ];
}

export function AttacksAbilitiesEditor({ combatant, onSave, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("attacks");
  const [attacks, setAttacks] = useState<Attack[]>(combatant.attacks);
  const [abilities, setAbilities] = useState<CombatAbility[]>(combatant.abilities);
  const [knownSpells, setKnownSpells] = useState<string[]>(combatant.spells.known);
  const [slots, setSlots] = useState<Record<number, { max: number; used: number }>>(
    combatant.spells.slots
  );
  const [library, setLibrary] = useState<{ spells: LibrarySpell[]; abilities: LibraryAbility[] }>({
    spells: [],
    abilities: [],
  });
  const [saving, setSaving] = useState(false);
  const [spellFilter, setSpellFilter] = useState("");

  useEffect(() => {
    fetch("/api/library")
      .then((r) => r.json())
      .then((d) => {
        if (d.spells) setLibrary({ spells: d.spells, abilities: d.abilities ?? [] });
      })
      .catch(() => toast.error("Не удалось загрузить библиотеку"));
  }, []);

  const spellNames = useMemo(
    () => Object.fromEntries(library.spells.map((s) => [s.id, s.name])),
    [library.spells]
  );

  const filteredSpells = useMemo(() => {
    const q = spellFilter.trim().toLowerCase();
    if (!q) return library.spells;
    return library.spells.filter((s) => s.name.toLowerCase().includes(q));
  }, [library.spells, spellFilter]);

  async function save() {
    setSaving(true);
    try {
      await onSave({
        attacks,
        abilities,
        spells: { ...combatant.spells, known: knownSpells, prepared: knownSpells, slots },
        hotbar: rebuildHotbar(attacks, knownSpells, spellNames, abilities),
      });
      toast.success("Боевой набор сохранён");
      onClose();
    } catch (e) {
      toast.error(`Ошибка сохранения: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  function patchAttack(idx: number, patch: Partial<Attack>) {
    setAttacks((prev) => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  }

  function patchDamage(attackIdx: number, dmgIdx: number, patch: Partial<DamageRoll>) {
    setAttacks((prev) =>
      prev.map((a, i) =>
        i === attackIdx
          ? { ...a, damage: a.damage.map((d, j) => (j === dmgIdx ? { ...d, ...patch } : d)) }
          : a
      )
    );
  }

  function addAbilityFromLibrary(lib: LibraryAbility) {
    if (abilities.some((a) => a.libraryId === lib.id)) {
      toast.error("Эта способность уже добавлена");
      return;
    }
    const p = lib.parameters;
    const usesMax =
      p?.usesFormula === "profBonus"
        ? combatant.profBonus
        : p?.usesFormula === "level"
        ? combatant.level
        : p?.uses ?? 0;
    setAbilities((prev) => [
      ...prev,
      {
        id: `abl_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        libraryId: lib.id,
        name: lib.name,
        usesMax,
        usesUsed: 0,
        refresh: p?.refresh ?? "none",
        parameters: p,
      },
    ]);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[70]">
      <Card className="!max-w-[95vw] sm:!max-w-[95vw] w-[95vw] h-[92vh] flex flex-col shadow-2xl">
        <CardHeader className="flex-row items-center justify-between shrink-0 pb-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Swords className="size-4" />
              Атаки и способности — {combatant.name}
            </CardTitle>
            <div className="text-xs text-muted-foreground mt-1">
              {combatant.className || "без класса"} • {combatant.level} ур. • бонус мастерства +
              {combatant.profBonus} • атак за действие: {combatant.attacksPerAction}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </CardHeader>

        {/* Вкладки */}
        <div className="px-6 flex gap-1 shrink-0">
          <TabButton active={tab === "attacks"} onClick={() => setTab("attacks")}>
            <Swords className="size-3 mr-1" /> Атаки ({attacks.length})
          </TabButton>
          <TabButton active={tab === "spells"} onClick={() => setTab("spells")}>
            <Zap className="size-3 mr-1" /> Заклинания ({knownSpells.length})
          </TabButton>
          <TabButton active={tab === "abilities"} onClick={() => setTab("abilities")}>
            <Sparkles className="size-3 mr-1" /> Способности ({abilities.length})
          </TabButton>
        </div>

        <CardContent className="flex-1 overflow-y-auto pt-4 space-y-3">
          {/* ============ АТАКИ ============ */}
          {tab === "attacks" && (
            <>
              {attacks.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-6">
                  Атак нет. Добавь первую — она сразу появится в хотбаре.
                </div>
              )}
              {attacks.map((atk, idx) => (
                <div key={atk.id} className="border rounded-md p-3 space-y-2 bg-muted/20">
                  <div className="flex items-center gap-2">
                    <Input
                      className="h-8 text-sm font-medium"
                      value={atk.name}
                      onChange={(e) => patchAttack(idx, { name: e.target.value })}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-red-600 shrink-0"
                      onClick={() => setAttacks((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <Label className="text-[10px]">Тип</Label>
                      <select
                        className="w-full h-8 text-xs rounded border bg-background px-1"
                        value={atk.kind}
                        onChange={(e) => {
                          const kind = e.target.value as AttackKind;
                          // Дефолтная дальность под тип, чтобы не оставить ближний бой на 80 фт
                          const range =
                            kind === "melee"
                              ? { normal: 5 }
                              : kind === "ranged"
                              ? { normal: 80, long: 320 }
                              : { normal: 60 };
                          patchAttack(idx, { kind, range });
                        }}
                      >
                        {(Object.keys(KIND_LABELS) as AttackKind[]).map((k) => (
                          <option key={k} value={k}>
                            {KIND_LABELS[k]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label className="text-[10px]">Бонус атаки</Label>
                      <Input
                        type="number"
                        className="h-8 text-xs"
                        value={atk.attackBonus}
                        onChange={(e) =>
                          patchAttack(idx, { attackBonus: Number(e.target.value) })
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">Дальность, фт</Label>
                      <Input
                        type="number"
                        className="h-8 text-xs"
                        value={atk.range.normal}
                        onChange={(e) =>
                          patchAttack(idx, {
                            range: { ...atk.range, normal: Number(e.target.value) },
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">Макс. дальность</Label>
                      <Input
                        type="number"
                        className="h-8 text-xs"
                        placeholder="нет"
                        value={atk.range.long ?? ""}
                        onChange={(e) =>
                          patchAttack(idx, {
                            range: {
                              ...atk.range,
                              long: e.target.value ? Number(e.target.value) : undefined,
                            },
                          })
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-[10px]">Стоимость действия</Label>
                    <select
                      className="w-full h-8 text-xs rounded border bg-background px-1"
                      value={atk.actionCost}
                      onChange={(e) =>
                        patchAttack(idx, { actionCost: e.target.value as ActionCost })
                      }
                    >
                      {COST_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Урон */}
                  <div>
                    <Label className="text-[10px]">Урон</Label>
                    <div className="space-y-1">
                      {atk.damage.map((d, j) => (
                        <div key={j} className="flex gap-1 items-center">
                          <Input
                            className="h-8 text-xs w-20"
                            placeholder="1d8"
                            value={d.dice}
                            onChange={(e) => patchDamage(idx, j, { dice: e.target.value })}
                          />
                          <Input
                            type="number"
                            className="h-8 text-xs w-16"
                            value={d.mod}
                            onChange={(e) => patchDamage(idx, j, { mod: Number(e.target.value) })}
                          />
                          <select
                            className="h-8 text-xs rounded border bg-background px-1 flex-1"
                            value={d.type}
                            onChange={(e) => patchDamage(idx, j, { type: e.target.value })}
                          >
                            {Object.entries(DAMAGE_TYPE_LABELS).map(([k, label]) => (
                              <option key={k} value={k}>
                                {label}
                              </option>
                            ))}
                          </select>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-red-600"
                            disabled={atk.damage.length <= 1}
                            onClick={() =>
                              patchAttack(idx, {
                                damage: atk.damage.filter((_, k) => k !== j),
                              })
                            }
                          >
                            <X className="size-3" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() =>
                          patchAttack(idx, {
                            damage: [...atk.damage, { dice: "1d6", mod: 0, type: "fire" }],
                          })
                        }
                      >
                        <Plus className="size-3 mr-1" /> Добавить кость урона
                      </Button>
                    </div>
                  </div>

                  {/* Свойства оружия */}
                  <div className="flex gap-3 text-xs flex-wrap">
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={!!atk.finesse}
                        onChange={(e) => patchAttack(idx, { finesse: e.target.checked })}
                      />
                      Фехтовальное (нужно для Скрытой атаки)
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={!!atk.thrown}
                        onChange={(e) => patchAttack(idx, { thrown: e.target.checked })}
                      />
                      Метательное
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={!!atk.usesSpellAttack}
                        onChange={(e) => patchAttack(idx, { usesSpellAttack: e.target.checked })}
                      />
                      От заклинательной характеристики
                    </label>
                  </div>
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAttacks((prev) => [...prev, emptyAttack()])}
              >
                <Plus className="size-3 mr-1" /> Добавить атаку
              </Button>
            </>
          )}

          {/* ============ ЗАКЛИНАНИЯ ============ */}
          {tab === "spells" && (
            <>
              {/* Ячейки */}
              <div className="border rounded-md p-3 bg-muted/20">
                <div className="text-xs font-medium mb-2">Ячейки заклинаний</div>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <div key={lvl}>
                      <Label className="text-[10px]">{lvl} круг — всего</Label>
                      <Input
                        type="number"
                        min={0}
                        className="h-8 text-xs"
                        value={slots[lvl]?.max ?? 0}
                        onChange={(e) => {
                          const max = Math.max(0, Number(e.target.value));
                          setSlots((prev) => {
                            const next = { ...prev };
                            if (max === 0) delete next[lvl];
                            else next[lvl] = { max, used: Math.min(prev[lvl]?.used ?? 0, max) };
                            return next;
                          });
                        }}
                      />
                      {slots[lvl] && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          потрачено {slots[lvl].used}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Известные заклинания */}
              <div>
                <div className="text-xs font-medium mb-1">
                  Известные заклинания ({knownSpells.length})
                </div>
                {knownSpells.length === 0 ? (
                  <div className="text-xs text-muted-foreground">
                    Ничего не выбрано. Отметь заклинания в списке ниже.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {knownSpells.map((id) => (
                      <Badge
                        key={id}
                        variant="outline"
                        className="text-[10px] bg-blue-500/10 gap-1"
                      >
                        {spellNames[id] || id}
                        <button
                          onClick={() => setKnownSpells((prev) => prev.filter((s) => s !== id))}
                          className="text-red-600"
                        >
                          <X className="size-2.5" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              <Input
                className="h-8 text-xs"
                placeholder="Поиск по библиотеке заклинаний..."
                value={spellFilter}
                onChange={(e) => setSpellFilter(e.target.value)}
              />

              {library.spells.length === 0 && (
                <div className="text-xs text-amber-600">
                  Библиотека пуста — нажми «Спеллы» в шапке боя, чтобы её заполнить.
                </div>
              )}

              <div className="space-y-1">
                {filteredSpells.map((s) => {
                  const known = knownSpells.includes(s.id);
                  return (
                    <div
                      key={s.id}
                      className={`flex items-center gap-2 border rounded-md px-2 py-1.5 text-xs ${
                        known ? "bg-blue-500/10 border-blue-500/30" : "bg-background"
                      }`}
                    >
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {s.level === 0 ? "заговор" : `${s.level} кр`}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{s.name}</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {s.parameters?.description || s.school || ""}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={known ? "secondary" : "outline"}
                        className="h-7 text-[10px] shrink-0"
                        onClick={() =>
                          setKnownSpells((prev) =>
                            known ? prev.filter((x) => x !== s.id) : [...prev, s.id]
                          )
                        }
                      >
                        {known ? "Убрать" : "Добавить"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ============ СПОСОБНОСТИ ============ */}
          {tab === "abilities" && (
            <>
              <div className="text-xs font-medium">Способности бойца ({abilities.length})</div>
              {abilities.length === 0 && (
                <div className="text-xs text-muted-foreground">
                  Способностей нет. Добавь из библиотеки ниже.
                </div>
              )}
              {abilities.map((ab, idx) => (
                <div key={ab.id} className="border rounded-md p-2 space-y-2 bg-muted/20">
                  <div className="flex items-center gap-2">
                    <Input
                      className="h-8 text-sm font-medium"
                      value={ab.name}
                      onChange={(e) =>
                        setAbilities((prev) =>
                          prev.map((a, i) => (i === idx ? { ...a, name: e.target.value } : a))
                        )
                      }
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-red-600 shrink-0"
                      onClick={() => setAbilities((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-[10px]">Использований</Label>
                      <Input
                        type="number"
                        min={0}
                        className="h-8 text-xs"
                        value={ab.usesMax}
                        onChange={(e) =>
                          setAbilities((prev) =>
                            prev.map((a, i) =>
                              i === idx ? { ...a, usesMax: Number(e.target.value) } : a
                            )
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">Потрачено</Label>
                      <Input
                        type="number"
                        min={0}
                        className="h-8 text-xs"
                        value={ab.usesUsed}
                        onChange={(e) =>
                          setAbilities((prev) =>
                            prev.map((a, i) =>
                              i === idx ? { ...a, usesUsed: Number(e.target.value) } : a
                            )
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">Восстановление</Label>
                      <select
                        className="w-full h-8 text-xs rounded border bg-background px-1"
                        value={ab.refresh}
                        onChange={(e) =>
                          setAbilities((prev) =>
                            prev.map((a, i) =>
                              i === idx
                                ? { ...a, refresh: e.target.value as CombatAbility["refresh"] }
                                : a
                            )
                          )
                        }
                      >
                        <option value="none">не восстанавливается</option>
                        <option value="turn">каждый ход</option>
                        <option value="round">каждый раунд</option>
                        <option value="short">короткий отдых</option>
                        <option value="long">длинный отдых</option>
                      </select>
                    </div>
                  </div>
                  {ab.parameters?.description && (
                    <div className="text-[10px] text-muted-foreground">
                      {ab.parameters.description}
                    </div>
                  )}
                </div>
              ))}

              <Separator />

              <div className="text-xs font-medium">Библиотека способностей</div>
              {library.abilities.length === 0 && (
                <div className="text-xs text-amber-600">
                  Библиотека пуста — нажми «Спеллы» в шапке боя, чтобы её заполнить.
                </div>
              )}
              <div className="space-y-1">
                {library.abilities.map((lib) => {
                  const added = abilities.some((a) => a.libraryId === lib.id);
                  const tooHigh = lib.minLevel > combatant.level;
                  return (
                    <div
                      key={lib.id}
                      className="flex items-center gap-2 border rounded-md px-2 py-1.5 text-xs"
                    >
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {lib.className || "любой"} {lib.minLevel}+
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{lib.name}</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {lib.parameters?.description || ""}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px] shrink-0"
                        disabled={added}
                        onClick={() => addAbilityFromLibrary(lib)}
                        title={tooHigh ? `Обычно доступно с ${lib.minLevel} уровня` : undefined}
                      >
                        {added ? "Добавлено" : tooHigh ? "Добавить (не по ур.)" : "Добавить"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>

        <div className="border-t p-3 flex justify-end gap-2 shrink-0">
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={save} disabled={saving}>
            <Save className="size-4 mr-2" />
            {saving ? "Сохранение..." : "Сохранить"}
          </Button>
        </div>
      </Card>
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
      onClick={onClick}
      className={`px-3 py-1.5 text-xs rounded-t-md border-b-2 flex items-center transition-colors ${
        active
          ? "border-primary text-foreground font-medium"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
