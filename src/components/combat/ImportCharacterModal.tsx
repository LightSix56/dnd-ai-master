"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";

interface ImportCharacterModalProps {
  combatId: string;
  gridWidth: number;
  gridHeight: number;
  onImported: () => void;
  onClose: () => void;
}

export function ImportCharacterModal({
  combatId,
  gridWidth,
  gridHeight,
  onImported,
  onClose,
}: ImportCharacterModalProps) {
  const [jsonText, setJsonText] = useState("");
  const [type, setType] = useState<"player" | "npc" | "enemy" | "companion">("player");
  const [x, setX] = useState(1);
  const [y, setY] = useState(Math.floor(gridHeight / 2));
  const [importing, setImporting] = useState(false);
  const [parsed, setParsed] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  /** Итог с сервера: что реально подтянулось в бойца */
  const [result, setResult] = useState<any>(null);

  function parseInput() {
    setError(null);
    setParsed(null);
    const trimmed = jsonText.trim();
    if (!trimmed) return;

    try {
      if (trimmed.startsWith("{")) {
        const data = JSON.parse(trimmed);
        setParsed(data);
        toast.success(`Распознан JSON: ${data.name || "?"}, ${data.className || ""} ${data.level || 1} ур.`);
        return;
      }

      // Парсинг листа персонажа из Markdown
      const result: any = {
        name: "Персонаж",
        className: "Друид",
        race: "Тортл",
        level: 1,
        hpMax: 10,
        hpCurrent: 10,
        armorClass: 10,
        speed: 30,
        abilityScores: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
        savingThrowProficiencies: {},
        attacks: [],
        spellSlots: {},
        cantrips: [],
        spellByLevel: {},
        featuresTraits: "",
        spellcastingClass: "",
        spellcastingAbility: "",
      };

      const nameMatch = trimmed.match(/#\s*(?:Лист персонажа:)?\s*([^\n\r]+)/i);
      if (nameMatch) {
        result.name = nameMatch[1].replace(/«|»|\([^\)]*\)/g, "").trim();
      }

      const classMatch = trimmed.match(/-\s*\*\*Класс[^\*]*\*\*:\s*([^\n\r\(\*]+)(?:\(([^\)]+)\))?\s*(\d+)?/i);
      if (classMatch) {
        result.className = classMatch[1].trim();
        if (classMatch[3]) result.level = parseInt(classMatch[3], 10);
      }
      const levelMatch = trimmed.match(/(\d+)\s*(?:ур|уровень|level)/i);
      if (levelMatch && (!result.level || result.level === 1)) {
        result.level = parseInt(levelMatch[1], 10);
      }

      const raceMatch = trimmed.match(/-\s*\*\*Раса\*\*:\s*([^\n\r\(—\*]+)/i);
      if (raceMatch) {
        result.race = raceMatch[1].trim();
      }

      const hpMatch = trimmed.match(/\*\*Хиты[^\*]*\*\*:\s*\*\*?(\d+)\s*(?:\/\s*(\d+))?\*\*?/i);
      if (hpMatch) {
        result.hpMax = parseInt(hpMatch[2] || hpMatch[1], 10);
        result.hpCurrent = parseInt(hpMatch[1], 10);
      }

      const acMatch = trimmed.match(/\*\*Класс Доспеха[^\*]*\*\*:\s*\*\*?(\d+)\*\*?/i);
      if (acMatch) {
        result.armorClass = parseInt(acMatch[1], 10);
      }

      const speedMatch = trimmed.match(/\*\*Скорость\*\*:\s*(\d+)/i);
      if (speedMatch) {
        result.speed = parseInt(speedMatch[1], 10);
      }

      const statRegexes = [
        { key: "STR", re: /(?:Сила|STR)[^\d\|]*\|\s*(\d+)/i },
        { key: "DEX", re: /(?:Ловкость|DEX)[^\d\|]*\|\s*(\d+)/i },
        { key: "CON", re: /(?:Телосложение|CON)[^\d\|]*\|\s*(\d+)/i },
        { key: "INT", re: /(?:Интеллект|INT)[^\d\|]*\|\s*(\d+)/i },
        { key: "WIS", re: /(?:Мудрость|WIS)[^\d\|]*\|\s*(\d+)/i },
        { key: "CHA", re: /(?:Харизма|CHA)[^\d\|]*\|\s*(\d+)/i },
      ];
      for (const { key, re } of statRegexes) {
        const m = trimmed.match(re);
        if (m) result.abilityScores[key] = parseInt(m[1], 10);
      }

      // Атаки
      const attackSection =
        trimmed.match(/##\s*6\.\s*Атаки[^\n]*\n([\s\S]*?)(?=\n##|\n---|$)/i) ||
        trimmed.match(/##\s*Атаки[^\n]*\n([\s\S]*?)(?=\n##|\n---|$)/i);
      if (attackSection) {
        const atkLines = attackSection[1].split("\n").filter((l) => l.trim().startsWith("-"));
        for (const line of atkLines) {
          const atkNameMatch = line.match(/-\s*\*\*([^\*:]+)\*\*:\s*(.*)/);
          if (atkNameMatch) {
            const aName = atkNameMatch[1].trim();
            const aDesc = atkNameMatch[2].trim();
            const bonusM = aDesc.match(/([+-]\d+)\s*(?:к попаданию|к атаке)?/i);
            const dmgM = aDesc.match(/(\d+d\d+(?:\s*[+-]\s*\d+)?|\d+)\s*([^\.,;]*)/i);
            result.attacks.push({
              name: aName,
              attackBonus: bonusM ? bonusM[1] : "+0",
              damageAndType: dmgM ? dmgM[0].trim() : "1d6",
              description: aDesc,
            });
          }
        }
      }

      // Заговоры
      const cantripMatches = trimmed.match(/Заговоры[^\n]*:\n([\s\S]*?)(?=\n###|\n##|\n---|$)/i);
      if (cantripMatches) {
        const cLines = cantripMatches[1].split("\n");
        for (const cl of cLines) {
          const sp = cl.match(/\*\*([^\*\(\:]+)(?:\(([^\)]+)\))?\*\*/);
          if (sp) {
            result.cantrips.push(sp[1].trim());
          }
        }
      }

      // Заклинания 1 круга
      const spellSection = trimmed.match(/заклинания 1-го круга[^\n]*:\n([\s\S]*?)(?=\n###|\n##|\n---|$)/i);
      if (spellSection) {
        result.spellByLevel[1] = [];
        const sLines = spellSection[1].split("\n");
        for (const sl of sLines) {
          const sp = sl.match(/\*\*([^\*\(\:]+)(?:\(([^\)]+)\))?\*\*/);
          if (sp) {
            result.spellByLevel[1].push(sp[1].trim());
          }
        }
      }

      const slotsMatch = trimmed.match(/Ячейки заклинаний 1-го круга[^\d]*(\d+)/i);
      if (slotsMatch) {
        result.spellSlots = { "1": parseInt(slotsMatch[1], 10) };
      } else {
        result.spellSlots = { "1": 2 };
      }

      result.spellcastingClass = result.className;
      result.spellcastingAbility =
        result.className.toLowerCase().includes("друид") || result.className.toLowerCase().includes("жрец")
          ? "МДР"
          : result.className.toLowerCase().includes("волшебник")
          ? "ИНТ"
          : "ХАР";

      setParsed(result);
      toast.success(`Распознан лист: ${result.name}, ${result.className} ${result.level} ур.`);
    } catch (e) {
      setError(`Ошибка разбора: ${(e as Error).message}`);
    }
  }

  async function doImport() {
    if (!parsed) {
      toast.error("Сначала распознай лист персонажа");
      return;
    }
    setImporting(true);
    try {
      const res = await fetch("/api/combat/import-character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          combatId,
          characterJson: parsed,
          type,
          x,
          y,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const p = data.parsed;
        setResult(p);
        toast.success(
          `${p.name}: атак ${p.attacks}, способностей ${p.abilities.length}, заклинаний ${p.spells.length}`
        );
        onImported();
        // Если часть заклинаний листа не нашлась в библиотеке — оставляем окно,
        // чтобы пользователь увидел список и добавил их вручную
        if (!p.unmatchedSpells?.length) onClose();
      } else {
        toast.error(data.error || "Ошибка импорта");
      }
    } catch (e) {
      toast.error(`Ошибка: ${(e as Error).message}`);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
      <Card className="!max-w-[92vw] sm:!max-w-[92vw] w-[92vw] max-h-[92vh] flex flex-col shadow-2xl">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Импорт персонажа (Markdown или JSON)</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto space-y-4">
          <div className="space-y-2">
            <Label htmlFor="json-input">Вставь лист персонажа (Markdown или JSON)</Label>
            <Textarea
              id="json-input"
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder='Вставь содержимое Markdown-листа или JSON...'
              className="min-h-[200px] max-h-[300px] font-mono text-xs"
            />
            {error && (
              <div className="text-sm text-red-600 bg-red-500/10 border border-red-500/30 rounded-md p-2">
                {error}
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={parseInput}
              disabled={!jsonText.trim()}
            >
              Распознать лист
            </Button>
          </div>

          {parsed && (
            <div className="space-y-3 p-3 border rounded-md bg-muted/30">
              <div className="text-sm font-medium">Распознано:</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Field label="Имя" value={parsed.name} />
                <Field label="Класс" value={parsed.className} />
                <Field label="Раса" value={parsed.race} />
                <Field label="Уровень" value={parsed.level} />
                <Field label="HP" value={`${parsed.hpMax} (тек: ${parsed.hpCurrent})`} />
                <Field label="AC" value={parsed.armorClass} />
                <Field label="Скорость" value={`${parsed.speed} фт`} />
                <Field label="Атак" value={(parsed.attacks || []).length} />
              </div>
              {(parsed.attacks || []).length > 0 && (
                <div className="text-xs">
                  <div className="font-medium mb-1">Атаки:</div>
                  {(parsed.attacks || []).map((a: any, i: number) => (
                    <div key={i} className="text-muted-foreground">
                      • {a.name}: {a.attackBonus}, {a.damageAndType}
                    </div>
                  ))}
                </div>
              )}
              {parsed.featuresTraits && (
                <div className="text-xs">
                  <div className="font-medium mb-1">Особенности (для анализа ИИ):</div>
                  <div className="text-muted-foreground line-clamp-3">
                    {parsed.featuresTraits.slice(0, 200)}...
                  </div>
                </div>
              )}
            </div>
          )}

          {result && (
            <div className="space-y-2 p-3 border rounded-md bg-emerald-500/10 border-emerald-500/30 text-xs">
              <div className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                {result.name} добавлен в бой
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Атак" value={result.attacks} />
                <Field label="Атак за действие" value={result.attacksPerAction} />
              </div>
              <div>
                <div className="font-medium">Способности ({result.abilities.length}):</div>
                <div className="text-muted-foreground">
                  {result.abilities.length ? result.abilities.join(", ") : "—"}
                </div>
              </div>
              <div>
                <div className="font-medium">Заклинания ({result.spells.length}):</div>
                <div className="text-muted-foreground">
                  {result.spells.length ? result.spells.join(", ") : "—"}
                </div>
              </div>
              {result.unmatchedSpells?.length > 0 && (
                <div className="p-2 rounded bg-amber-500/15 border border-amber-500/30">
                  <div className="font-medium text-amber-700 dark:text-amber-300">
                    Не найдено в библиотеке ({result.unmatchedSpells.length}):
                  </div>
                  <div className="text-amber-700/80 dark:text-amber-300/80">
                    {result.unmatchedSpells.join(", ")}
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    Добавь их через «Атаки и способности» → вкладка «Заклинания», либо прогони
                    сид библиотеки.
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Тип</Label>
              <Select value={type} onValueChange={(v) => setType(v as any)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="player">Игрок</SelectItem>
                  <SelectItem value="npc">NPC</SelectItem>
                  <SelectItem value="enemy">Враг</SelectItem>
                  <SelectItem value="companion">Спутник</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Позиция X</Label>
              <input
                type="number"
                className="w-full h-8 text-xs rounded border bg-background px-2"
                value={x}
                min={0}
                max={gridWidth - 1}
                onChange={(e) => setX(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Позиция Y</Label>
              <input
                type="number"
                className="w-full h-8 text-xs rounded border bg-background px-2"
                value={y}
                min={0}
                max={gridHeight - 1}
                onChange={(e) => setY(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>
              Отмена
            </Button>
            <Button onClick={doImport} disabled={importing || !parsed}>
              {importing ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Импорт...
                </>
              ) : (
                <>
                  <Upload className="size-4 mr-2" />
                  Импортировать
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="font-medium">{value ?? "—"}</div>
    </div>
  );
}
