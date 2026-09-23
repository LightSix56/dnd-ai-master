"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, Save, Sparkles, Swords, Zap, Shield, Flame } from "lucide-react";
import { toast } from "sonner";
import type {
  AttackKind,
  ActionCost,
  AbilityKey,
  DamageRoll,
  ActionParameters,
} from "@/lib/combat/types";
import { DAMAGE_TYPE_LABELS } from "@/lib/combat/types";

export type LibraryCategory = "attack" | "spell" | "damage_ability" | "utility_ability";

export interface EditableLibraryItem {
  id?: string;
  category: LibraryCategory;
  name: string;
  level?: number;
  school?: string;
  className?: string;
  minLevel?: number;
  source?: string;
  description?: string;
  actionCost: ActionCost;
  // Дистанция и таргетинг
  rangeType?: "melee" | "ranged" | "self" | "touch" | "point" | "special";
  rangeNormal: number;
  rangeLong?: number;
  finesse?: boolean;
  // AoE
  hasAoe: boolean;
  aoeShape?: "sphere" | "cone" | "cube" | "line" | "cylinder";
  aoeSize?: number;
  // Урон
  damage: DamageRoll[];
  // Спасбросок
  hasSave: boolean;
  saveType?: AbilityKey;
  saveDC?: number | null;
  saveEffect?: "none" | "half";
  // Концентрация и эффекты
  concentration?: boolean;
  conditionType?: string;
  conditionDuration?: number;
  // Использования
  usesMax?: number;
  refresh?: "none" | "turn" | "short" | "long" | "round";
  selfHealDice?: string;
  selfHealMod?: number;
}

interface Props {
  initialItem?: Partial<EditableLibraryItem> | null;
  defaultCategory?: LibraryCategory;
  onSave: (item: EditableLibraryItem) => Promise<void> | void;
  onClose: () => void;
}

const DAMAGE_TYPES: Array<{ value: string; label: string }> = [
  { value: "slashing", label: "Рубящий" },
  { value: "piercing", label: "Колющий" },
  { value: "bludgeoning", label: "Дробящий" },
  { value: "fire", label: "Огонь" },
  { value: "cold", label: "Холод" },
  { value: "lightning", label: "Электричество" },
  { value: "acid", label: "Кислота" },
  { value: "poison", label: "Яд" },
  { value: "thunder", label: "Звук" },
  { value: "radiant", label: "Излучение" },
  { value: "necrotic", label: "Некротический" },
  { value: "force", label: "Силовое поле" },
  { value: "psychic", label: "Психический" },
  { value: "healing", label: "Исцеление" },
];

const COMMON_CONDITIONS = [
  { value: "poisoned", label: "Отравлен" },
  { value: "blinded", label: "Ослеплен" },
  { value: "paralyzed", label: "Парализован" },
  { value: "restrained", label: "Опутан" },
  { value: "stunned", label: "Ошеломлен" },
  { value: "frightened", label: "Испуган" },
  { value: "shielded", label: "Щит (+2 КД)" },
  { value: "cover_half", label: "Полу-укрытие (+2 КД, +2 ЛОВ)" },
  { value: "cover_three_quarters", label: "3/4 укрытие (+5 КД, +5 ЛОВ)" },
  { value: "burning", label: "Горит (периодический урон)" },
  { value: "dashing", label: "Рывок (удвоение скорости)" },
  { value: "dodging", label: "Уклонение (помеха врагам)" },
  { value: "disengaging", label: "Отход (без провокаций)" },
];

export function LibraryItemEditorModal({ initialItem, defaultCategory = "attack", onSave, onClose }: Props) {
  const [category, setCategory] = useState<LibraryCategory>(initialItem?.category || defaultCategory);
  const [name, setName] = useState(initialItem?.name || "");
  const [description, setDescription] = useState(initialItem?.description || "");
  const [actionCost, setActionCost] = useState<ActionCost>(initialItem?.actionCost || "action");
  
  // Заклинания / класс
  const [level, setLevel] = useState<number>(initialItem?.level ?? 0);
  const [school, setSchool] = useState<string>(initialItem?.school || "evocation");
  const [className, setClassName] = useState<string>(initialItem?.className || "");
  const [minLevel, setMinLevel] = useState<number>(initialItem?.minLevel ?? 1);

  // Дистанция
  const [rangeType, setRangeType] = useState<"melee" | "ranged" | "self" | "touch" | "point" | "special">(
    initialItem?.rangeType || (category === "attack" ? "melee" : "ranged")
  );
  const [rangeNormal, setRangeNormal] = useState<number>(initialItem?.rangeNormal ?? (category === "attack" ? 5 : 60));
  const [rangeLong, setRangeLong] = useState<number | undefined>(initialItem?.rangeLong);
  const [finesse, setFinesse] = useState<boolean>(initialItem?.finesse ?? false);

  // AoE
  const [hasAoe, setHasAoe] = useState<boolean>(initialItem?.hasAoe ?? false);
  const [aoeShape, setAoeShape] = useState<"sphere" | "cone" | "cube" | "line" | "cylinder">(
    initialItem?.aoeShape || "sphere"
  );
  const [aoeSize, setAoeSize] = useState<number>(initialItem?.aoeSize ?? 20);

  // Урон
  const [damage, setDamage] = useState<DamageRoll[]>(
    initialItem?.damage && initialItem.damage.length > 0
      ? initialItem.damage
      : category === "utility_ability"
        ? []
        : [{ dice: "1d6", mod: 0, type: "slashing" }]
  );

  // Спасбросок
  const [hasSave, setHasSave] = useState<boolean>(initialItem?.hasSave ?? false);
  const [saveType, setSaveType] = useState<AbilityKey>(initialItem?.saveType || "DEX");
  const [saveDC, setSaveDC] = useState<string>(initialItem?.saveDC ? String(initialItem.saveDC) : "");
  const [saveEffect, setSaveEffect] = useState<"none" | "half">(initialItem?.saveEffect || "half");

  // Концентрация и состояния
  const [concentration, setConcentration] = useState<boolean>(initialItem?.concentration ?? false);
  const [hasCondition, setHasCondition] = useState<boolean>(!!initialItem?.conditionType);
  const [conditionType, setConditionType] = useState<string>(initialItem?.conditionType || "poisoned");
  const [conditionDuration, setConditionDuration] = useState<number>(initialItem?.conditionDuration ?? 1);

  // Использования
  const [usesMax, setUsesMax] = useState<number>(initialItem?.usesMax ?? 0);
  const [refresh, setRefresh] = useState<"none" | "turn" | "short" | "long" | "round">(initialItem?.refresh || "none");
  const [saving, setSaving] = useState(false);

  function addDamageRoll() {
    setDamage([...damage, { dice: "1d6", mod: 0, type: "fire" }]);
  }

  function updateDamageRoll(index: number, patch: Partial<DamageRoll>) {
    setDamage(damage.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  function removeDamageRoll(index: number) {
    setDamage(damage.filter((_, i) => i !== index));
  }

  async function handleFormSubmit() {
    if (!name.trim()) {
      toast.error("Укажите название");
      return;
    }

    setSaving(true);
    try {
      const itemToSave: EditableLibraryItem = {
        id: initialItem?.id,
        category,
        name: name.trim(),
        description: description.trim(),
        actionCost,
        level: category === "spell" ? level : undefined,
        school: category === "spell" ? school : undefined,
        className: className.trim() || undefined,
        minLevel: category !== "attack" ? minLevel : undefined,
        rangeType,
        rangeNormal,
        rangeLong: rangeLong && rangeLong > rangeNormal ? rangeLong : undefined,
        finesse: category === "attack" ? finesse : undefined,
        hasAoe,
        aoeShape: hasAoe ? aoeShape : undefined,
        aoeSize: hasAoe ? aoeSize : undefined,
        damage,
        hasSave,
        saveType: hasSave ? saveType : undefined,
        saveDC: hasSave && saveDC ? parseInt(saveDC, 10) : null,
        saveEffect: hasSave ? saveEffect : undefined,
        concentration: category === "spell" ? concentration : false,
        conditionType: hasCondition ? conditionType : undefined,
        conditionDuration: hasCondition ? conditionDuration : undefined,
        usesMax,
        refresh,
      };

      await onSave(itemToSave);
      toast.success(`«${name}» успешно сохранено в библиотеку!`);
      onClose();
    } catch (e) {
      toast.error(`Ошибка при сохранении: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-4 pb-2 border-b bg-card/60">
          <DialogTitle className="flex items-center gap-2 text-lg">
            {category === "attack" && <Swords className="size-5 text-amber-500" />}
            {category === "spell" && <Sparkles className="size-5 text-indigo-400" />}
            {category === "damage_ability" && <Flame className="size-5 text-rose-500" />}
            {category === "utility_ability" && <Shield className="size-5 text-blue-400" />}
            {initialItem?.id ? "Редактирование элемента библиотеки" : "Создать новый элемент библиотеки"}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4 pr-2">
            {/* Категория и Название */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Категория</Label>
                <Select
                  value={category}
                  onValueChange={(val) => setCategory(val as LibraryCategory)}
                  disabled={!!initialItem?.id}
                >
                  <SelectTrigger className="h-8 mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="attack">⚔️ Удар / Оружие</SelectItem>
                    <SelectItem value="spell">🔮 Заклинание</SelectItem>
                    <SelectItem value="damage_ability">💥 Способность (Урон)</SelectItem>
                    <SelectItem value="utility_ability">🛡️ Способность (Утилита/Хил)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2">
                <Label className="text-xs">Название элемента</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Например: Рапира душ, Огненный шар..."
                  className="h-8 mt-1 text-xs"
                />
              </div>
            </div>

            {/* Класс / Круг / Действие */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Стоимость действия</Label>
                <Select value={actionCost} onValueChange={(val) => setActionCost(val as ActionCost)}>
                  <SelectTrigger className="h-8 mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="action">Действие</SelectItem>
                    <SelectItem value="bonus">Бонусное действие</SelectItem>
                    <SelectItem value="reaction">Реакция</SelectItem>
                    <SelectItem value="action+bonus">Действие + Бонусное</SelectItem>
                    <SelectItem value="free">Бесплатно</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {category === "spell" ? (
                <>
                  <div>
                    <Label className="text-xs">Круг заклинания</Label>
                    <Select value={String(level)} onValueChange={(v) => setLevel(Number(v))}>
                      <SelectTrigger className="h-8 mt-1 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0 (Заговор)</SelectItem>
                        <SelectItem value="1">1 круг</SelectItem>
                        <SelectItem value="2">2 круг</SelectItem>
                        <SelectItem value="3">3 круг</SelectItem>
                        <SelectItem value="4">4 круг</SelectItem>
                        <SelectItem value="5">5 круг</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Школа магии</Label>
                    <Input
                      value={school}
                      onChange={(e) => setSchool(e.target.value)}
                      placeholder="evocation, abjuration..."
                      className="h-8 mt-1 text-xs"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <Label className="text-xs">Класс / Источник</Label>
                    <Input
                      value={className}
                      onChange={(e) => setClassName(e.target.value)}
                      placeholder="Воин, Плут, Общее..."
                      className="h-8 mt-1 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Мин. уровень</Label>
                    <Input
                      type="number"
                      value={minLevel}
                      onChange={(e) => setMinLevel(Number(e.target.value))}
                      className="h-8 mt-1 text-xs"
                    />
                  </div>
                </>
              )}
            </div>

            <Separator />

            {/* Дальность и тип применения */}
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2">ДАЛЬНОСТЬ И ТАРГЕТИНГ</div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Тип дальности</Label>
                  <Select value={rangeType} onValueChange={(v: any) => setRangeType(v)}>
                    <SelectTrigger className="h-8 mt-1 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="melee">Ближний бой</SelectItem>
                      <SelectItem value="ranged">Дальний бой</SelectItem>
                      <SelectItem value="self">На себя (Self)</SelectItem>
                      <SelectItem value="touch">Касание (Touch)</SelectItem>
                      <SelectItem value="point">Точка на сетке</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {rangeType !== "self" && (
                  <div>
                    <Label className="text-xs">Дальность (футов)</Label>
                    <Input
                      type="number"
                      value={rangeNormal}
                      onChange={(e) => setRangeNormal(Number(e.target.value))}
                      className="h-8 mt-1 text-xs"
                    />
                  </div>
                )}

                {rangeType === "ranged" && (
                  <div>
                    <Label className="text-xs">Предельная (футов)</Label>
                    <Input
                      type="number"
                      value={rangeLong || ""}
                      onChange={(e) => setRangeLong(e.target.value ? Number(e.target.value) : undefined)}
                      placeholder="320"
                      className="h-8 mt-1 text-xs"
                    />
                  </div>
                )}

                {category === "attack" && (
                  <div className="flex items-center gap-2 pt-5">
                    <Checkbox id="finesse" checked={finesse} onCheckedChange={(v) => setFinesse(!!v)} />
                    <label htmlFor="finesse" className="text-xs cursor-pointer">
                      Фехтовальное (Finesse)
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* Область поражения (AoE) */}
            <div className="border rounded-md p-3 bg-muted/20 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox id="hasAoe" checked={hasAoe} onCheckedChange={(v) => setHasAoe(!!v)} />
                  <label htmlFor="hasAoe" className="text-xs font-semibold cursor-pointer">
                    Область поражения (AoE)
                  </label>
                </div>
                {hasAoe && <Badge variant="secondary" className="text-[10px]">Форма + Радиус</Badge>}
              </div>

              {hasAoe && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <Label className="text-xs">Форма области</Label>
                    <Select value={aoeShape} onValueChange={(v: any) => setAoeShape(v)}>
                      <SelectTrigger className="h-8 mt-1 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sphere">Сфера (Sphere)</SelectItem>
                        <SelectItem value="cone">Конус (Cone)</SelectItem>
                        <SelectItem value="cube">Куб (Cube)</SelectItem>
                        <SelectItem value="line">Линия (Line)</SelectItem>
                        <SelectItem value="cylinder">Цилиндр (Cylinder)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Размер (футов)</Label>
                    <Input
                      type="number"
                      value={aoeSize}
                      onChange={(e) => setAoeSize(Number(e.target.value))}
                      className="h-8 mt-1 text-xs"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Урон */}
            <div className="border rounded-md p-3 bg-muted/20 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold">УРОН И ФОРМУЛЫ</div>
                <Button size="sm" variant="outline" onClick={addDamageRoll} className="h-6 text-[11px]">
                  <Plus className="size-3 mr-1" /> Добавить кубы
                </Button>
              </div>

              {damage.length === 0 ? (
                <div className="text-xs text-muted-foreground italic py-1">Без прямого урона</div>
              ) : (
                <div className="space-y-2">
                  {damage.map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={d.dice}
                        onChange={(e) => updateDamageRoll(i, { dice: e.target.value })}
                        placeholder="1d8, 2d6..."
                        className="h-7 w-20 text-xs"
                      />
                      <span className="text-xs">+</span>
                      <Input
                        type="number"
                        value={d.mod || 0}
                        onChange={(e) => updateDamageRoll(i, { mod: Number(e.target.value) })}
                        className="h-7 w-16 text-xs"
                      />
                      <Select
                        value={d.type}
                        onValueChange={(val: any) => updateDamageRoll(i, { type: val })}
                      >
                        <SelectTrigger className="h-7 flex-1 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DAMAGE_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value} className="text-xs">
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeDamageRoll(i)}
                        className="size-7 text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Спасброски */}
            <div className="border rounded-md p-3 bg-muted/20 space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox id="hasSave" checked={hasSave} onCheckedChange={(v) => setHasSave(!!v)} />
                <label htmlFor="hasSave" className="text-xs font-semibold cursor-pointer">
                  Требуется спасбросок цели
                </label>
              </div>

              {hasSave && (
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div>
                    <Label className="text-xs">Характеристика</Label>
                    <Select value={saveType} onValueChange={(v: any) => setSaveType(v)}>
                      <SelectTrigger className="h-8 mt-1 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="STR">СИЛ (STR)</SelectItem>
                        <SelectItem value="DEX">ЛОВ (DEX)</SelectItem>
                        <SelectItem value="CON">ТЕЛ (CON)</SelectItem>
                        <SelectItem value="INT">ИНТ (INT)</SelectItem>
                        <SelectItem value="WIS">МУД (WIS)</SelectItem>
                        <SelectItem value="CHA">ХАР (CHA)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Сложность (СЛ / DC)</Label>
                    <Input
                      value={saveDC}
                      onChange={(e) => setSaveDC(e.target.value)}
                      placeholder="Авто или 15..."
                      className="h-8 mt-1 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">При успехе</Label>
                    <Select value={saveEffect} onValueChange={(v: any) => setSaveEffect(v)}>
                      <SelectTrigger className="h-8 mt-1 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="half">Половина урона</SelectItem>
                        <SelectItem value="none">Без эффекта</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            {/* Состояния и эффекты */}
            <div className="border rounded-md p-3 bg-muted/20 space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox id="hasCond" checked={hasCondition} onCheckedChange={(v) => setHasCondition(!!v)} />
                <label htmlFor="hasCond" className="text-xs font-semibold cursor-pointer">
                  Накладывает состояние / статус
                </label>
              </div>

              {hasCondition && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <Label className="text-xs">Состояние</Label>
                    <Select value={conditionType} onValueChange={setConditionType}>
                      <SelectTrigger className="h-8 mt-1 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COMMON_CONDITIONS.map((c) => (
                          <SelectItem key={c.value} value={c.value} className="text-xs">
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Длительность (раундов)</Label>
                    <Input
                      type="number"
                      value={conditionDuration}
                      onChange={(e) => setConditionDuration(Number(e.target.value))}
                      className="h-8 mt-1 text-xs"
                    />
                  </div>
                </div>
              )}

              {category === "spell" && (
                <div className="flex items-center gap-2 pt-2">
                  <Checkbox
                    id="conc"
                    checked={concentration}
                    onCheckedChange={(v) => setConcentration(!!v)}
                  />
                  <label htmlFor="conc" className="text-xs cursor-pointer">
                    Требует концентрации (Concentration)
                  </label>
                </div>
              )}
            </div>

            {/* Лимиты использований */}
            {category !== "attack" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Использований (0 = безлимит)</Label>
                  <Input
                    type="number"
                    value={usesMax}
                    onChange={(e) => setUsesMax(Number(e.target.value))}
                    className="h-8 mt-1 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">Восстановление</Label>
                  <Select value={refresh} onValueChange={(v: any) => setRefresh(v)}>
                    <SelectTrigger className="h-8 mt-1 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Без перезарядки</SelectItem>
                      <SelectItem value="turn">Каждый ход</SelectItem>
                      <SelectItem value="short">Короткий отдых</SelectItem>
                      <SelectItem value="long">Длинный отдых</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Описание */}
            <div>
              <Label className="text-xs">Текстовое описание / подсказка</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Подробности о правилах и эффектах..."
                className="h-16 mt-1 text-xs"
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="p-3 border-t bg-card/60 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Отмена
          </Button>
          <Button size="sm" onClick={handleFormSubmit} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            <Save className="size-3.5 mr-1" />
            {saving ? "Сохранение..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
