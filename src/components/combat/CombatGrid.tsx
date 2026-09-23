"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import type { Combat, Combatant, Cell, AttackKind, FacingDirection, VisibilityStatus } from "@/lib/combat/types";
import type { CombatEffect, DamagePopup } from "@/lib/combat/animations";
import { CombatEffectsLayer } from "./CombatEffectsLayer";
import { getReachableCells, getAoeCells, computeVisibilityStatus, getFacingVector, hasLineOfSight } from "@/lib/combat/movement";
import { remainingMovement, hasCondition } from "@/lib/combat/rules";
import { cellKey } from "@/lib/combat/grid";
import { ELEMENT_COLORS } from "@/lib/combat/types";

interface CombatGridProps {
  combat: Combat;
  selectedCombatantId: string | null;
  drawMode: import("@/lib/combat/types").MapElementType | null;
  deleteMode: boolean;
  onCellClick: (x: number, y: number) => void;
  onCombatantClick: (combatantId: string) => void;
  onCombatantMove: (combatantId: string, x: number, y: number) => void;
  onToggleDoor: (elementId: string) => void;
  onDeleteElement: (elementId: string) => void;
  onRotateCombatant?: (combatantId: string, facing: FacingDirection) => void;
  isDM?: boolean;
  onCombatantReposition?: (combatantId: string, x: number, y: number) => void;
  targetingRange: { kind: AttackKind; normal: number; long?: number } | null;
  targetingAoe?: { shape: string; size: number } | null;
  attackerPosition: { x: number; y: number } | null;
  effects?: CombatEffect[];
  popups?: Record<string, DamagePopup> | DamagePopup[];
  tokenShifts?: Record<string, { shiftX: number; shiftY: number }>;
}

export function CombatGrid({
  combat,
  selectedCombatantId,
  drawMode,
  deleteMode,
  onCellClick,
  onCombatantClick,
  onCombatantMove,
  onCombatantReposition,
  isDM = false,
  onToggleDoor,
  onDeleteElement,
  onRotateCombatant,
  targetingRange,
  targetingAoe,
  attackerPosition,
  effects,
  popups,
  tokenShifts,
}: CombatGridProps) {
  const { gridWidth: W, gridHeight: H, cellSize: CS } = combat;
  const [dragState, setDragState] = useState<{
    combatantId: string;
    fromX: number;
    fromY: number;
  } | null>(null);
  const [hoverCell, setHoverCell] = useState<Cell | null>(null);
  const [showTacticalOverlay, setShowTacticalOverlay] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);

  const selectedCombatant = combat.combatants.find((c) => c.id === selectedCombatantId) || null;

  // Карта видимости («Глаз») для всех бойцов
  const visibilityMap = useMemo(() => {
    const map = new Map<string, { status: VisibilityStatus; seenBy: string[] }>();
    for (const c of combat.combatants) {
      if (c.hpCurrent > 0) {
        map.set(c.id, computeVisibilityStatus(c, combat.combatants, combat.mapElements));
      }
    }
    return map;
  }, [combat.combatants, combat.mapElements]);

  // Достижимые клетки для выделенного бойца (бюджет в футах считает движок)
  const reachableCells = useMemo(() => {
    if (!selectedCombatant || selectedCombatant.hpCurrent <= 0) return new Map<string, number>();
    const budgetFt = remainingMovement(selectedCombatant);
    if (budgetFt <= 0) return new Map<string, number>();
    return getReachableCells(
      selectedCombatant,
      budgetFt,
      combat.mapElements,
      combat.combatants,
      W,
      H
    );
  }, [selectedCombatant, combat.mapElements, combat.combatants, W, H]);

  // Подсветка области поражения AoE способности при hover
  const aoeCells = useMemo(() => {
    if (!targetingAoe || !hoverCell) return [];
    const shape = (targetingAoe.shape as any) || "sphere";
    return getAoeCells(
      hoverCell,
      shape,
      targetingAoe.size,
      attackerPosition,
      W,
      H
    );
  }, [targetingAoe, hoverCell, attackerPosition, W, H]);

  const aoeCellKeys = useMemo(() => new Set(aoeCells.map((c) => cellKey(c))), [aoeCells]);

  // Клетки в пределах дальности атаки / способности (для таргетинга)
  const { effectiveRangeCells, longRangeCells } = useMemo(() => {
    if (!targetingRange || !attackerPosition) {
      return { effectiveRangeCells: new Set<string>(), longRangeCells: new Set<string>() };
    }
    const eff = new Set<string>();
    const lng = new Set<string>();
    const effCells = Math.max(1, Math.floor(targetingRange.normal / 5));
    const longCells = targetingRange.long ? Math.floor(targetingRange.long / 5) : effCells;
    const { x: ax, y: ay } = attackerPosition;

    for (let dy = -longCells; dy <= longCells; dy++) {
      for (let dx = -longCells; dx <= longCells; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = ax + dx;
        const ny = ay + dy;
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;

        // Для таргетинга проверяем прямую видимость (стены блокируют наведение)
        if (!hasLineOfSight(attackerPosition, { x: nx, y: ny }, combat.mapElements)) {
          continue;
        }

        const dist = Math.max(Math.abs(dx), Math.abs(dy)); // Чебышев
        const key = `${nx},${ny}`;
        if (dist <= effCells) eff.add(key);
        else if (dist <= longCells) lng.add(key);
      }
    }
    return { effectiveRangeCells: eff, longRangeCells: lng };
  }, [targetingRange, attackerPosition, combat.mapElements, W, H]);

  // Текущий ходящий боец — порядок хранится в бою, пересортировка запрещена
  const currentTurnId = combat.turnOrder[combat.currentTurnIndex] ?? null;
  const currentTurnCombatant = currentTurnId
    ? combat.combatants.find((c) => c.id === currentTurnId) ?? null
    : null;

  // Показываем ли движение? Скрываем если активен таргетинг ИЛИ если выбранный боец не ходит сейчас
  const showMovement = !targetingRange && selectedCombatant && currentTurnCombatant &&
    selectedCombatant.id === currentTurnCombatant.id;

  // SVG координаты
  const totalW = W * CS;
  const totalH = H * CS;

  // Нативное матричное преобразование браузера — 100% точность без смещений
  function getCellFromEvent(e: React.MouseEvent | MouseEvent): Cell | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const svgP = pt.matrixTransform(ctm.inverse());
    const x = Math.floor(svgP.x / CS);
    const y = Math.floor(svgP.y / CS);
    if (x < 0 || x >= W || y < 0 || y >= H) return null;
    return { x, y };
  }

  // Глобальный слушатель мыши при перетаскивании для предотвращения застревания
  useEffect(() => {
    if (!dragState) return;

    function handleGlobalMouseUp(e: MouseEvent) {
      if (!dragState) return;
      const cell = getCellFromEvent(e);
      if (cell && (cell.x !== dragState.fromX || cell.y !== dragState.fromY)) {
        if (isDM && onCombatantReposition && (!reachableCells.has(cellKey(cell)) || dragState.combatantId !== currentTurnId)) {
          onCombatantReposition(dragState.combatantId, cell.x, cell.y);
        } else if (reachableCells.has(cellKey(cell))) {
          onCombatantMove(dragState.combatantId, cell.x, cell.y);
        } else if (isDM && onCombatantReposition) {
          onCombatantReposition(dragState.combatantId, cell.x, cell.y);
        }
      }
      setDragState(null);
    }

    function handleGlobalMouseMove(e: MouseEvent) {
      const cell = getCellFromEvent(e);
      setHoverCell(cell);
    }

    window.addEventListener("mouseup", handleGlobalMouseUp);
    window.addEventListener("mousemove", handleGlobalMouseMove);
    return () => {
      window.removeEventListener("mouseup", handleGlobalMouseUp);
      window.removeEventListener("mousemove", handleGlobalMouseMove);
    };
  }, [dragState, reachableCells, onCombatantMove, onCombatantReposition, isDM, currentTurnId]);

  function handleSvgClick(e: React.MouseEvent) {
    const cell = getCellFromEvent(e);
    if (!cell) return;
    onCellClick(cell.x, cell.y);
  }

  function handleSvgMouseMove(e: React.MouseEvent) {
    const cell = getCellFromEvent(e);
    setHoverCell(cell);
  }

  function handleSvgMouseLeave() {
    if (!dragState) setHoverCell(null);
  }

  // Начало перетаскивания бойца
  function handleCombatantMouseDown(e: React.MouseEvent, combatant: Combatant) {
    e.stopPropagation();
    onCombatantClick(combatant.id);
    // При рисовании или активном таргетинге перетаскивание заблокировано
    if (drawMode || targetingRange || targetingAoe) {
      return;
    }
    if (combatant.hpCurrent <= 0 && !isDM) return;
    // Игроки могут перетаскивать ТОЛЬКО текущего ходящего бойца; Мастер (DM) может двигать любых комбатантов
    if (!isDM && combatant.id !== currentTurnId) return;
    setDragState({
      combatantId: combatant.id,
      fromX: combatant.x,
      fromY: combatant.y,
    });
  }

  function handleSvgMouseUp(e: React.MouseEvent) {
    if (!dragState) return;
    const cell = getCellFromEvent(e);
    if (!cell) {
      setDragState(null);
      return;
    }
    // Если мышь отпустили на исходной клетке — это был просто клик, а не перемещение
    if (cell.x === dragState.fromX && cell.y === dragState.fromY) {
      setDragState(null);
      return;
    }
    // Проверяем, можно ли туда переместиться
    const combatant = combat.combatants.find((c) => c.id === dragState.combatantId);
    if (!combatant) {
      setDragState(null);
      return;
    }
    if (isDM && onCombatantReposition && (!reachableCells.has(cellKey(cell)) || combatant.id !== currentTurnId)) {
      onCombatantReposition(combatant.id, cell.x, cell.y);
    } else if (reachableCells.has(cellKey(cell))) {
      onCombatantMove(combatant.id, cell.x, cell.y);
    } else if (isDM && onCombatantReposition) {
      onCombatantReposition(combatant.id, cell.x, cell.y);
    }
    setDragState(null);
  }

  // Клик по элементу карты
  function handleElementClick(e: React.MouseEvent, el: Combat["mapElements"][0]) {
    e.stopPropagation();
    // В режиме удаления — удаляем
    if (deleteMode) {
      onDeleteElement(el.id);
      return;
    }
    // В режиме рисования — не кликаем по существующим элементам
    if (drawMode) return;
    // Дверь — toggles open/close
    if (el.type === "door") {
      onToggleDoor(el.id);
    }
  }

  // Текущая позиция курсора для drag-превью
  const dragPreview = dragState && hoverCell && (isDM || reachableCells.has(cellKey(hoverCell)))
    ? hoverCell
    : null;

  return (
    <div
      className="inline-block bg-zinc-950 border border-zinc-800 rounded-lg shadow-md overflow-hidden"
      style={{ userSelect: "none", WebkitUserSelect: "none" }}
    >
      {/* Верхняя компактная панель управления картой */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 text-xs font-sans">
        <div className="flex items-center gap-2">
          <span className="font-medium text-zinc-100">
            🗺️ {combat.name || "Тактическая карта"}
          </span>
          <span className="text-[11px] text-zinc-400 font-mono">
            ({W}×{H} клеток • {W * 5}×{H * 5} фт)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowTacticalOverlay((v) => !v)}
            className={`px-2.5 py-0.5 rounded text-[11px] font-sans border transition-all cursor-pointer ${
              showTacticalOverlay
                ? "bg-zinc-800 text-zinc-100 border-zinc-700 font-medium"
                : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200"
            }`}
            title="Переключить отображение тактических линий и маркеров стен/укрытий"
          >
            {showTacticalOverlay ? "🛡️ Разметка: Вкл" : "👁️ Разметка: Скрыта"}
          </button>
        </div>
      </div>

      <svg
        ref={svgRef}
        width={totalW}
        height={totalH}
        viewBox={`0 0 ${totalW} ${totalH}`}
        onClick={handleSvgClick}
        onMouseMove={handleSvgMouseMove}
        onMouseLeave={handleSvgMouseLeave}
        onMouseUp={handleSvgMouseUp}
        style={{ overflow: "visible", cursor: deleteMode ? "not-allowed" : drawMode ? "crosshair" : "default", maxWidth: "100%" }}
      >
        {/* Базовый тёмный фон для предотвращения белых артефактов */}
        <rect width={totalW} height={totalH} fill="#181411" />

        {/* Растровый top-down фон карты */}
        <image
          href={combat.backgroundUrl || "/maps/dungeon.png"}
          x={0}
          y={0}
          width={totalW}
          height={totalH}
          preserveAspectRatio="none"
        />

        {/* Полупрозрачная тактическая VTT-сетка поверх арта */}
        {Array.from({ length: W + 1 }).map((_, i) => (
          <line
            key={`v${i}`}
            x1={i * CS}
            y1={0}
            x2={i * CS}
            y2={totalH}
            stroke="rgba(255, 255, 255, 0.22)"
            strokeWidth={i % 5 === 0 ? 1.5 : 0.6}
          />
        ))}
        {Array.from({ length: H + 1 }).map((_, i) => (
          <line
            key={`h${i}`}
            x1={0}
            y1={i * CS}
            x2={totalW}
            y2={i * CS}
            stroke="rgba(255, 255, 255, 0.22)"
            strokeWidth={i % 5 === 0 ? 1.5 : 0.6}
          />
        ))}

        {/* Элементы карты (VTT тактический слой) */}
        {showTacticalOverlay && combat.mapElements.map((el) => {
          const x = el.x * CS;
          const y = el.y * CS;
          const w = el.width * CS;
          const h = el.height * CS;
          const isDoor = el.type === "door";
          const isOpen = (() => {
            try {
              const props = typeof el.properties === "string" ? JSON.parse(el.properties) : el.properties;
              return props?.isOpen;
            } catch { return false; }
          })();

          if (el.type === "wall") {
            return (
              <g key={el.id} onClick={(e) => handleElementClick(e, el)} className="cursor-not-allowed">
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  fill="rgba(0, 0, 0, 0.38)"
                  stroke="#ef4444"
                  strokeWidth={1.8}
                  rx={1}
                />
              </g>
            );
          }

          if (isDoor) {
            return (
              <g key={el.id} onClick={(e) => handleElementClick(e, el)} style={{ cursor: "pointer" }}>
                <rect
                  x={x + 2}
                  y={y + 2}
                  width={w - 4}
                  height={h - 4}
                  fill={isOpen ? "rgba(16, 185, 129, 0.35)" : "rgba(6, 182, 212, 0.55)"}
                  stroke={isOpen ? "#10b981" : "#00e5ff"}
                  strokeWidth={2.5}
                  rx={3}
                />
                <text
                  x={x + w / 2}
                  y={y + h / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#ffffff"
                  fontSize={CS * 0.42}
                  fontWeight="bold"
                  className="select-none pointer-events-none drop-shadow"
                >
                  {isOpen ? "🚪↔" : "🚪🔒"}
                </text>
              </g>
            );
          }

          if (el.type === "cover") {
            return (
              <g key={el.id} onClick={(e) => handleElementClick(e, el)}>
                <rect
                  x={x + 1}
                  y={y + 1}
                  width={w - 2}
                  height={h - 2}
                  fill="rgba(245, 158, 11, 0.2)"
                  stroke="#f59e0b"
                  strokeWidth={1.6}
                  strokeDasharray="4 2"
                  rx={2}
                />
                <text
                  x={x + w / 2}
                  y={y + h / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#fbbf24"
                  fontSize={CS * 0.32}
                  className="select-none pointer-events-none drop-shadow"
                >
                  🛡️
                </text>
              </g>
            );
          }

          if (el.type === "difficult") {
            return (
              <g key={el.id} onClick={(e) => handleElementClick(e, el)}>
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  fill="rgba(168, 85, 247, 0.16)"
                  stroke="rgba(168, 85, 247, 0.6)"
                  strokeWidth={1.2}
                  strokeDasharray="3 3"
                />
              </g>
            );
          }

          if (el.type === "water") {
            return (
              <g key={el.id} onClick={(e) => handleElementClick(e, el)}>
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  fill="rgba(2, 132, 199, 0.22)"
                  stroke="#0284c7"
                  strokeWidth={1.4}
                />
                <text
                  x={x + w / 2}
                  y={y + h / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={Math.min(w, h) * 0.4}
                  className="select-none opacity-80 pointer-events-none"
                >
                  🌊
                </text>
              </g>
            );
          }

          if (el.type === "lava") {
            return (
              <g key={el.id} onClick={(e) => handleElementClick(e, el)}>
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  fill="rgba(220, 38, 38, 0.3)"
                  stroke="#dc2626"
                  strokeWidth={2}
                />
                <text
                  x={x + w / 2}
                  y={y + h / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={Math.min(w, h) * 0.4}
                  className="select-none opacity-90 pointer-events-none animate-pulse"
                >
                  🔥
                </text>
              </g>
            );
          }

          // По умолчанию (obstacle, window и т.д.)
          const color = ELEMENT_COLORS[el.type] || "#6b7280";
          return (
            <g key={el.id} onClick={(e) => handleElementClick(e, el)}>
              <rect
                x={x + 1}
                y={y + 1}
                width={w - 2}
                height={h - 2}
                fill="rgba(75, 85, 99, 0.25)"
                stroke={color}
                strokeWidth={1.4}
                strokeDasharray="4 2"
                rx={2}
              />
              {el.type === "window" && (
                <text
                  x={x + w / 2}
                  y={y + h / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="white"
                  fontSize={CS * 0.4}
                  className="select-none pointer-events-none"
                >
                  ▦
                </text>
              )}
            </g>
          );
        })}

        {/* Достижимые клетки (движение) — только если нет таргетинга */}
        {showMovement && selectedCombatant && reachableCells.size > 0 && Array.from(reachableCells.entries()).map(([key, costFt]) => {
          const [cx, cy] = key.split(",").map(Number);
          return (
            <g key={`r-${key}`}>
              <rect
                x={cx * CS + 2}
                y={cy * CS + 2}
                width={CS - 4}
                height={CS - 4}
                fill="rgba(59, 130, 246, 0.18)"
                stroke="rgba(59, 130, 246, 0.55)"
                strokeWidth={1}
                strokeDasharray="2,2"
                rx={3}
              />
              <text
                x={cx * CS + CS - 5}
                y={cy * CS + CS - 4}
                textAnchor="end"
                fill="rgba(147, 197, 253, 0.95)"
                fontSize={CS * 0.2}
                pointerEvents="none"
              >
                {costFt}
              </text>
            </g>
          );
        })}

        {/* Эффективная дальность атаки (оружие ближнего и дальнего боя) — полупрозрачный синий */}
        {effectiveRangeCells.size > 0 && Array.from(effectiveRangeCells).map((key) => {
          const [cx, cy] = key.split(",").map(Number);
          return (
            <rect
              key={`eff-${key}`}
              x={cx * CS + 2}
              y={cy * CS + 2}
              width={CS - 4}
              height={CS - 4}
              fill="rgba(59, 130, 246, 0.22)"
              stroke="rgba(96, 165, 250, 0.85)"
              strokeWidth={1.5}
              rx={3}
            />
          );
        })}

        {/* Максимальная дальность атаки (дальний бой с помехой) — мягкий полупрозрачный синий */}
        {longRangeCells.size > 0 && Array.from(longRangeCells).map((key) => {
          const [cx, cy] = key.split(",").map(Number);
          return (
            <rect
              key={`lng-${key}`}
              x={cx * CS + 2}
              y={cy * CS + 2}
              width={CS - 4}
              height={CS - 4}
              fill="rgba(37, 99, 235, 0.12)"
              stroke="rgba(59, 130, 246, 0.45)"
              strokeWidth={1}
              strokeDasharray="3,2"
              rx={3}
            />
          );
        })}

        {/* Подсветка области поражения AoE способности (полупрозрачный синий стиль) */}
        {aoeCells.length > 0 && aoeCells.map((cell) => {
          const key = cellKey(cell);
          const hasCombatant = combat.combatants.some(
            (c) => c.x === cell.x && c.y === cell.y && c.hpCurrent > 0
          );
          return (
            <rect
              key={`aoe-${key}`}
              x={cell.x * CS + 1}
              y={cell.y * CS + 1}
              width={CS - 2}
              height={CS - 2}
              fill={hasCombatant ? "rgba(99, 102, 241, 0.32)" : "rgba(59, 130, 246, 0.2)"}
              stroke={hasCombatant ? "rgba(129, 140, 248, 0.95)" : "rgba(96, 165, 250, 0.85)"}
              strokeWidth={1.5}
              strokeDasharray={hasCombatant ? "none" : "3,2"}
              rx={3}
              pointerEvents="none"
            />
          );
        })}

        {/* Drag preview */}
        {dragPreview && (
          <rect
            x={dragPreview.x * CS + 2}
            y={dragPreview.y * CS + 2}
            width={CS - 4}
            height={CS - 4}
            fill="rgba(59, 130, 246, 0.3)"
            stroke="rgba(96, 165, 250, 0.9)"
            strokeWidth={2}
            rx={3}
          />
        )}

        {/* Hover cell (в режиме рисования) */}
        {drawMode && hoverCell && (
          <rect
            x={hoverCell.x * CS}
            y={hoverCell.y * CS}
            width={CS}
            height={CS}
            fill={ELEMENT_COLORS[drawMode]}
            fillOpacity={0.4}
            stroke={ELEMENT_COLORS[drawMode]}
            strokeWidth={2}
          />
        )}

        {/* Hover preview для таргетинга способностей и телепортации */}
        {!drawMode && !dragState && hoverCell && targetingRange && effectiveRangeCells.has(cellKey(hoverCell)) && (
          <g pointerEvents="none">
            <rect
              x={hoverCell.x * CS + 2}
              y={hoverCell.y * CS + 2}
              width={CS - 4}
              height={CS - 4}
              fill="rgba(99, 102, 241, 0.35)"
              stroke="rgba(165, 180, 252, 0.95)"
              strokeWidth={2}
              rx={3}
            />
            <circle
              cx={hoverCell.x * CS + CS / 2}
              cy={hoverCell.y * CS + CS / 2}
              r={CS * 0.16}
              fill="rgba(255, 255, 255, 0.9)"
            />
          </g>
        )}

        {/* Токены бойцов */}
        {combat.combatants.map((c) => {
          const cx = c.x * CS + CS / 2;
          const cy = c.y * CS + CS / 2;
          const r = CS * 0.4;
          const isSelected = c.id === selectedCombatantId;
          const isCurrent = c.id === currentTurnId;
          const isDead = c.hpCurrent <= 0;
          const isProne = hasCondition(c, "prone");
          const isInvisible = hasCondition(c, "invisible");
          const inAoe = aoeCellKeys.has(cellKey({ x: c.x, y: c.y }));
          const hpPct = c.hpMax > 0 ? (c.hpCurrent / c.hpMax) * 100 : 0;
          const hpColor = hpPct > 60 ? "#10b981" : hpPct > 30 ? "#f59e0b" : "#ef4444";

          // Сектор обзора 120° (Полупрозрачная трапеция по направлению взгляда)
          const fVec = getFacingVector(c.facing || (c.type === "enemy" ? "W" : "E"));
          const facingRad = (fVec.angle * Math.PI) / 180;
          const dNear = r;
          const dFar = r + CS * 1.25;
          const nearHalfAngle = (28 * Math.PI) / 180; // малое основание у фишки
          const farHalfAngle = (60 * Math.PI) / 180;  // 120° полное раскрытие сектора

          const p1X = cx + Math.cos(facingRad - nearHalfAngle) * dNear;
          const p1Y = cy + Math.sin(facingRad - nearHalfAngle) * dNear;
          const p2X = cx + Math.cos(facingRad - farHalfAngle) * dFar;
          const p2Y = cy + Math.sin(facingRad - farHalfAngle) * dFar;
          const p3X = cx + Math.cos(facingRad + farHalfAngle) * dFar;
          const p3Y = cy + Math.sin(facingRad + farHalfAngle) * dFar;
          const p4X = cx + Math.cos(facingRad + nearHalfAngle) * dNear;
          const p4Y = cy + Math.sin(facingRad + nearHalfAngle) * dNear;

          const fovColor = isSelected
            ? "#3b82f6"
            : isCurrent
            ? "#f59e0b"
            : c.type === "enemy"
            ? "#ef4444"
            : "#10b981";

          // Статус видимости («Глаз»)
          const visInfo = visibilityMap.get(c.id);
          const visStatus = visInfo?.status ?? "visible";

          // Динамическое смещение токена (синхронизировано по времени с моментом касания стрелы/клинка)
          const shift = tokenShifts?.[c.id] || { shiftX: 0, shiftY: 0 };
          const shiftX = shift.shiftX;
          const shiftY = shift.shiftY;

          return (
            <g
              key={c.id}
              transform={shiftX !== 0 || shiftY !== 0 ? `translate(${shiftX.toFixed(1)}, ${shiftY.toFixed(1)})` : undefined}
              onMouseDown={(e) => handleCombatantMouseDown(e, c)}
              onClick={(e) => { e.stopPropagation(); }}
              style={{ cursor: isDead ? "default" : "pointer" }}
              opacity={isDead ? 0.35 : isInvisible ? 0.6 : 1}
              className="transition-all duration-150 ease-out"
            >
              {/* Сектор обзора (Полупрозрачная трапеция 120°) */}
              {!isDead && (
                <g pointerEvents="none">
                  <polygon
                    className="transition-all duration-300 ease-out"
                    points={`${p1X.toFixed(1)},${p1Y.toFixed(1)} ${p2X.toFixed(1)},${p2Y.toFixed(1)} ${p3X.toFixed(1)},${p3Y.toFixed(1)} ${p4X.toFixed(1)},${p4Y.toFixed(1)}`}
                    fill={fovColor}
                    fillOpacity={isSelected || isCurrent ? 0.22 : 0.12}
                    stroke={fovColor}
                    strokeOpacity={isSelected || isCurrent ? 0.65 : 0.35}
                    strokeWidth={1.2}
                    strokeLinejoin="round"
                  />
                  {/* Осевая линия взгляда */}
                  <line
                    className="transition-all duration-300 ease-out"
                    x1={cx + Math.cos(facingRad) * r}
                    y1={cy + Math.sin(facingRad) * r}
                    x2={cx + Math.cos(facingRad) * (dFar - 2)}
                    y2={cy + Math.sin(facingRad) * (dFar - 2)}
                    stroke={fovColor}
                    strokeOpacity={isSelected || isCurrent ? 0.45 : 0.25}
                    strokeWidth={1}
                    strokeDasharray="3,2"
                  />
                </g>
              )}
              {/* Кольцо под AoE ударом */}
              {inAoe && !isDead && (
                <circle
                  className="transition-all duration-300 ease-out"
                  cx={cx}
                  cy={cy}
                  r={r + 6}
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth={2.5}
                  strokeDasharray="4,2"
                />
              )}
              {/* Кольцо невидимости */}
              {isInvisible && !isDead && (
                <circle
                  className="transition-all duration-300 ease-out"
                  cx={cx}
                  cy={cy}
                  r={r + 4}
                  fill="none"
                  stroke="#a855f7"
                  strokeWidth={2}
                  strokeDasharray="3,2"
                />
              )}
              {/* Кольцо выделения */}
              {isSelected && (
                <circle
                  className="transition-all duration-300 ease-out"
                  cx={cx}
                  cy={cy}
                  r={r + 4}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth={3}
                />
              )}
              {/* Кольцо текущего хода */}
              {isCurrent && !isDead && (
                <circle
                  className="transition-all duration-300 ease-out"
                  cx={cx}
                  cy={cy}
                  r={r + 2}
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth={2}
                  strokeDasharray="3,2"
                />
              )}
              {/* Основной токен */}
              <circle
                className="transition-all duration-300 ease-out"
                cx={cx}
                cy={cy}
                r={r}
                fill={c.color}
                stroke={isDead ? "#000" : isProne ? "#ea580c" : "white"}
                strokeWidth={isProne ? 2.5 : 2}
                strokeDasharray={isProne ? "3,2" : "none"}
              />
              {/* Инициалы */}
              <text
                className="transition-all duration-300 ease-out"
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="central"
                fill="white"
                fontSize={CS * 0.35}
                fontWeight="bold"
                pointerEvents="none"
              >
                {c.name.charAt(0).toUpperCase()}
              </text>
              {/* HP бар */}
              {!isDead && (
                <>
                  <rect
                    className="transition-all duration-300 ease-out"
                    x={cx - r}
                    y={cy + r - 2}
                    width={r * 2}
                    height={3}
                    fill="#737373"
                    rx={1}
                  />
                  <rect
                    className="transition-all duration-300 ease-out"
                    x={cx - r}
                    y={cy + r - 2}
                    width={(r * 2 * Math.max(0, hpPct)) / 100}
                    height={3}
                    fill={hpColor}
                    rx={1}
                  />
                </>
              )}
              {/* Мёртв — крест */}
              {isDead && (
                <text
                  className="transition-all duration-300 ease-out"
                  x={cx}
                  y={cy + r + 8}
                  textAnchor="middle"
                  fill="#dc2626"
                  fontSize={CS * 0.4}
                  fontWeight="bold"
                >
                  ✕
                </text>
              )}
              {/* Скрыт */}
              {c.isHidden && !isDead && (
                <g className="transition-all duration-300 ease-out">
                  <circle
                    className="transition-all duration-300 ease-out"
                    cx={cx + r - 2}
                    cy={cy - r + 2}
                    r={CS * 0.16}
                    fill="#0f172a"
                    stroke="#38bdf8"
                    strokeWidth={1}
                  />
                  <text
                    className="transition-all duration-300 ease-out"
                    x={cx + r - 2}
                    y={cy - r + 3}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#38bdf8"
                    fontSize={CS * 0.16}
                    fontWeight="bold"
                  >
                    🤫
                  </text>
                </g>
              )}
              {/* Невидим */}
              {isInvisible && !isDead && !c.isHidden && (
                <g className="transition-all duration-300 ease-out">
                  <circle
                    className="transition-all duration-300 ease-out"
                    cx={cx + r - 2}
                    cy={cy - r + 2}
                    r={CS * 0.16}
                    fill="#3b0764"
                    stroke="#c084fc"
                    strokeWidth={1}
                  />
                  <text
                    className="transition-all duration-300 ease-out"
                    x={cx + r - 2}
                    y={cy - r + 3}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#c084fc"
                    fontSize={CS * 0.16}
                    fontWeight="bold"
                  >
                    ✨
                  </text>
                </g>
              )}
              {/* Индикатор видимости («Глаз») — только для игрока и союзников */}
              {!isDead && c.type !== "enemy" && (
                <g className="transition-all duration-300 ease-out">
                  <title>
                    {visStatus === "visible"
                      ? `Виден врагам: ${visInfo?.seenBy.join(", ") || "на виду"}`
                      : visStatus === "cover"
                      ? `В укрытии относительно: ${visInfo?.seenBy.join(", ")}`
                      : "Никто из врагов не видит вас (можно спрятаться)"}
                  </title>
                  <circle
                    className="transition-all duration-300 ease-out"
                    cx={cx - r + 2}
                    cy={cy + r - 2}
                    r={CS * 0.15}
                    fill={visStatus === "visible" ? "#7f1d1d" : visStatus === "cover" ? "#1e3a8a" : "#064e3b"}
                    stroke={visStatus === "visible" ? "#ef4444" : visStatus === "cover" ? "#60a5fa" : "#34d399"}
                    strokeWidth={1}
                  />
                  <text
                    className="transition-all duration-300 ease-out"
                    x={cx - r + 2}
                    y={cy + r - 1}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="white"
                    fontSize={CS * 0.16}
                    pointerEvents="none"
                  >
                    {visStatus === "visible" ? "👁️" : visStatus === "cover" ? "🌓" : "🙈"}
                  </text>
                </g>
              )}
              {/* Имя (с защитой от обрезки в верхней строке и четкой обводкой) */}
              <text
                className="transition-all duration-300 ease-out"
                x={cx}
                y={c.y === 0 ? cy + r + 13 : cy - r - 4}
                textAnchor="middle"
                fill={c.type === "enemy" ? "#fca5a5" : "#f8fafc"}
                stroke="#090d16"
                strokeWidth="3.2"
                strokeLinejoin="round"
                paintOrder="stroke fill"
                fontSize={CS * 0.23}
                fontWeight="700"
                pointerEvents="none"
              >
                {c.name.length > 10 ? c.name.slice(0, 9) + "…" : c.name}
              </text>
            </g>
          );
        })}

        {/* Координаты по краям (каждая 5-я) */}
        {Array.from({ length: Math.floor(W / 5) }).map((_, i) => (
          <text
            key={`cx${i}`}
            x={(i + 1) * 5 * CS}
            y={12}
            textAnchor="middle"
            fill="#a8a29e"
            fontSize={10}
          >
            {(i + 1) * 5}
          </text>
        ))}
        {Array.from({ length: Math.floor(H / 5) }).map((_, i) => (
          <text
            key={`cy${i}`}
            x={4}
            y={(i + 1) * 5 * CS + 4}
            fill="#a8a29e"
            fontSize={10}
          >
            {(i + 1) * 5}
          </text>
        ))}

        {/* Слой визуальных боевых анимаций и эффектов */}
        <CombatEffectsLayer effects={effects || []} popups={popups} />
      </svg>

      {/* Подсказка */}
      <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/30 border-t">
        {targetingRange && attackerPosition ? (
          <span>
            {targetingRange.long && targetingRange.long > targetingRange.normal ? (
              <>
                🟢 Зелёные — эффективная дальность ({targetingRange.normal} фт).
                🟠 Оранжевые — максимальная ({targetingRange.long} фт, помеха на атаку).
                Кликни по цели.
              </>
            ) : (
              <>🟢 Зелёные — дальность {targetingRange.normal} фт. Кликни по цели.</>
            )}
          </span>
        ) : drawMode ? (
          <span>🖱️ Кликай по клеткам — добавляешь «{drawMode}». Выбери «Выбор» чтобы выйти.</span>
        ) : deleteMode ? (
          <span>🗑️ Кликай по элементам карты чтобы удалить. Выбери «Выбор» чтобы выйти.</span>
        ) : showMovement && selectedCombatant ? (
          <span>
            🟦 Синие клетки — куда может дойти <strong>{selectedCombatant.name}</strong> (осталось{" "}
            {remainingMovement(selectedCombatant)} фт). Перетащи токен на синюю клетку.
          </span>
        ) : selectedCombatant ? (
          <span>
            👁️ <strong>{selectedCombatant.name}</strong> — сейчас не его ход, движение скрыто.
          </span>
        ) : (
          <span>🖱️ Кликни по бойцу чтобы выбрать. Кликни по двери чтобы открыть/закрыть.</span>
        )}
      </div>
    </div>
  );
}
