"use client";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Heart, Skull } from "lucide-react";
import type { Combatant } from "@/lib/combat/types";
import { TYPE_LABELS } from "@/lib/combat/types";

interface InitiativeTrackerProps {
  combatants: Combatant[];
  /** Порядок ходов из боя — единственный источник истины */
  turnOrder: string[];
  currentTurnIndex: number;
  round: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function InitiativeTracker({
  combatants,
  turnOrder,
  currentTurnIndex,
  round,
  selectedId,
  onSelect,
}: InitiativeTrackerProps) {
  const byId = new Map(combatants.map((c) => [c.id, c]));
  // Порядок задаёт бой; те, кто ещё не в очереди (только что добавлены) — в конец
  const ordered = turnOrder.map((id) => byId.get(id)).filter((c): c is Combatant => !!c);
  const pending = combatants.filter((c) => !turnOrder.includes(c.id));
  const currentId = turnOrder[currentTurnIndex] ?? null;
  const current = currentId ? byId.get(currentId) ?? null : null;

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b bg-card/50">
        <div className="text-xs font-medium text-muted-foreground">ОЧЕРЕДЬ ХОДОВ</div>
        <div className="text-xs text-muted-foreground mt-1">
          Раунд {round} • {combatants.length} бойцов
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {combatants.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-8">
              Нет бойцов. Добавь через панель справа.
            </div>
          ) : (
            <>
              {ordered.map((c) => (
                <InitiativeRow
                  key={c.id}
                  combatant={c}
                  isCurrent={c.id === currentId}
                  isSelected={c.id === selectedId}
                  onSelect={onSelect}
                />
              ))}
              {pending.length > 0 && (
                <>
                  <div className="pt-2 text-[10px] text-muted-foreground px-1">
                    ВНЕ ОЧЕРЕДИ — брось инициативу
                  </div>
                  {pending.map((c) => (
                    <InitiativeRow
                      key={c.id}
                      combatant={c}
                      isCurrent={false}
                      isSelected={c.id === selectedId}
                      onSelect={onSelect}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </ScrollArea>
      {current && (
        <div className="p-3 border-t bg-card/50">
          <div className="text-[10px] text-muted-foreground">ТЕКУЩИЙ ХОД</div>
          <div className="text-sm font-medium truncate">{current.name}</div>
          <div className="text-[10px] text-muted-foreground">
            {current.isAIControlled ? "Ведёт бот" : "Ведёт игрок"}
          </div>
        </div>
      )}
    </div>
  );
}

function InitiativeRow({
  combatant: c,
  isCurrent,
  isSelected,
  onSelect,
}: {
  combatant: Combatant;
  isCurrent: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const isDead = c.hpCurrent <= 0;
  const hpPct = c.hpMax > 0 ? (c.hpCurrent / c.hpMax) * 100 : 0;
  const hpColor = hpPct > 60 ? "bg-emerald-500" : hpPct > 30 ? "bg-amber-500" : "bg-red-500";

  return (
    <button
      onClick={() => onSelect(c.id)}
      className={`w-full text-left rounded-md p-2 border transition-colors ${
        isCurrent
          ? "border-amber-500/50 bg-amber-500/10"
          : isSelected
          ? "border-blue-500/50 bg-blue-500/5"
          : "border-border bg-background/50 hover:bg-accent/30"
      } ${isDead ? "opacity-50" : ""}`}
    >
      <div className="flex items-center gap-2">
        <div className="size-7 rounded bg-slate-800 text-white text-xs font-bold flex items-center justify-center shrink-0">
          {c.initiative}
        </div>
        <div
          className="size-5 rounded-full shrink-0 flex items-center justify-center text-white text-[10px] font-bold"
          style={{ backgroundColor: c.color }}
        >
          {c.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate flex items-center gap-1">
            {c.name}
            {isCurrent && !isDead && <span className="text-amber-600 text-[10px]">●</span>}
            {isDead && <Skull className="size-3 text-red-600" />}
            {c.isHidden && !isDead && (
              <span className="text-[10px] text-muted-foreground">?</span>
            )}
          </div>
          <div className="text-[10px] text-muted-foreground flex items-center gap-1">
            {TYPE_LABELS[c.type]}
            {c.isAIControlled && <Badge variant="outline" className="text-[9px] px-1 py-0">бот</Badge>}
          </div>
        </div>
      </div>
      {!isDead && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <Heart className="size-2.5 text-red-500 shrink-0" />
          <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
            <div className={`h-full ${hpColor}`} style={{ width: `${hpPct}%` }} />
          </div>
          <span className="text-[10px] font-mono text-muted-foreground shrink-0">
            {c.hpCurrent}/{c.hpMax}
          </span>
        </div>
      )}
      {isDead && <div className="mt-1 text-[10px] text-red-600">Мёртв</div>}
      {c.conditions.length > 0 && !isDead && (
        <div className="mt-1 flex flex-wrap gap-0.5">
          {c.conditions.map((cond, i) => (
            <span
              key={i}
              className="text-[9px] px-1 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300"
            >
              {cond.type}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
