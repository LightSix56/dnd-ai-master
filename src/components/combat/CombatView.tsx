"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Swords,
  X,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  GripHorizontal,
  Plus,
  Trash2,
  Dice5,
  Heart,
  Shield,
  Eye,
  EyeOff,
  DoorClosed,
  BrickWall,
  Square,
  Mountain,
  TreePine,
  AppWindow,
  Upload,
  Sparkles,
  Bot,
  Play,
  Settings2,
  ScrollText,
  Check,
  BookOpen,
  Crown,
  User,
  Wifi,
  Copy,
  Layers,
  Waves,
  Flame,
  Map,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import { copyToClipboard } from "@/lib/utils";
import { CombatGrid } from "./CombatGrid";
import { InitiativeTracker } from "./InitiativeTracker";
import { Hotbar } from "./Hotbar";
import { ImportCharacterModal } from "./ImportCharacterModal";
import { AttacksAbilitiesEditor } from "./AttacksAbilitiesEditor";
import { LibraryManagerModal } from "./LibraryManagerModal";
import { RoleSelectorModal } from "./RoleSelectorModal";
import { WildShapeModal } from "./WildShapeModal";
import { PresetsModal } from "./PresetsModal";
import { MapPresetsModal } from "./MapPresetsModal";
import { createPresetFromCombatant } from "@/lib/combat/preset-data";
import type {
  Combat,
  Combatant,
  Attack,
  MapElementType,
  AttackKind,
  LogEntry,
  ActionParameters,
} from "@/lib/combat/types";
import type { CombatEffect, DamagePopup, CombatOutcomeType } from "@/lib/combat/animations";
import { detectWeaponAnimType, calculateAttackVector } from "@/lib/combat/animations";
import { TYPE_LABELS, CONDITION_EFFECTS } from "@/lib/combat/types";
import { remainingMovement, effectiveSpeed, effectiveAC } from "@/lib/combat/rules";
import { determineFacingTowards } from "@/lib/combat/movement";

export interface CombatEndSummary {
  combatId: string;
  name: string;
  rounds: number;
  outcome: "victory" | "defeat" | "ended";
  survivingCombatants: Array<{
    id: string;
    name: string;
    type: string;
    hpCurrent: number;
    hpMax: number;
  }>;
  awardedXP?: number;
  xpPerPlayer?: number;
}

export interface CombatViewProps {
  combatId?: string;
  campaignId?: string;
  onClose: () => void;
  onCombatEnd?: (summary: CombatEndSummary) => void | Promise<void>;
}

const ELEMENT_TYPES: Array<{ type: MapElementType; label: string; icon: React.ReactNode }> = [
  { type: "wall", label: "Стена", icon: <BrickWall className="size-3" /> },
  { type: "door", label: "Дверь", icon: <DoorClosed className="size-3" /> },
  { type: "window", label: "Окно", icon: <AppWindow className="size-3" /> },
  { type: "obstacle", label: "Препятствие", icon: <Mountain className="size-3" /> },
  { type: "cover", label: "Укрытие", icon: <Shield className="size-3" /> },
  { type: "difficult", label: "Трудн. местность", icon: <TreePine className="size-3" /> },
  { type: "water", label: "Вода", icon: <Waves className="size-3 text-cyan-500" /> },
  { type: "lava", label: "Лава", icon: <Flame className="size-3 text-orange-500" /> },
];

const LOG_ICONS: Record<LogEntry["kind"], string> = {
  attack: "⚔️",
  spell: "✨",
  ability: "✦",
  move: "👣",
  turn: "🔄",
  system: "ℹ️",
  damage: "💥",
  save: "🎲",
};

export function CombatView({ combatId, campaignId, onClose, onCombatEnd }: CombatViewProps) {
  const [combat, setCombat] = useState<Combat | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedCombatantId, setSelectedCombatantId] = useState<string | null>(null);

  // Кооперативный режим (LAN): роль мастера "dm" или id конкретного персонажа игрока
  const [userRole, setUserRole] = useState<string>("dm");
  const [showRoleSelector, setShowRoleSelector] = useState(false);
  const [lanUrl, setLanUrl] = useState<string | null>(null);
  const [radminUrl, setRadminUrl] = useState<string | null>(null);

  const [drawMode, setDrawMode] = useState<MapElementType | null>(null);
  const [deleteMode, setDeleteMode] = useState(false);
  const [showAddCombatant, setShowAddCombatant] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showFullLog, setShowFullLog] = useState(false);
  const [showWildShapeModal, setShowWildShapeModal] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [showMapPresets, setShowMapPresets] = useState(false);
  const [libraryTargetCombatant, setLibraryTargetCombatant] = useState<Combatant | null>(null);
  const [editorForId, setEditorForId] = useState<string | null>(null);
  // Таргетинг: двухшаговый выбор цели
  const [targeting, setTargeting] = useState<{
    type: "attack" | "spell" | "ability";
    id: string;
    name: string;
    range?: { kind: AttackKind; normal: number; long?: number };
    /** Для AoE цель — клетка, а не существо */
    aoe?: { shape: string; size: number };
    /** Для телепортации цель — свободная клетка на сетке */
    isTeleport?: boolean;
  } | null>(null);
  const [multiTargets, setMultiTargets] = useState<string[]>([]);
  const [advantage, setAdvantage] = useState(false);
  const [disadvantage, setDisadvantage] = useState(false);
  // Шаги хода бота: показываем и ждём «Продолжить»
  const [botSteps, setBotSteps] = useState<string[] | null>(null);
  const [botRunning, setBotRunning] = useState(false);
  const [outcome, setOutcome] = useState<"players" | "enemies" | null>(null);
  const [spellNames, setSpellNames] = useState<Record<string, string>>({});
  /** Параметры заклинаний из библиотеки — нужны, чтобы понять AoE это или точечная цель */
  const [spellParams, setSpellParams] = useState<Record<string, ActionParameters>>({});
  const [newCombatant, setNewCombatant] = useState({
    name: "",
    type: "enemy" as "player" | "npc" | "enemy" | "companion",
    hpMax: 10,
    ac: 12,
    speed: 30,
    dexMod: 0,
  });

  // Растягиваемый по высоте нижний лог боя
  const [logHeight, setLogHeight] = useState<number>(72);
  const isDraggingLogRef = useRef(false);
  const logDragStartY = useRef(0);
  const logDragStartHeight = useRef(72);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Активные направленные визуальные эффекты и анимации оружия
  const [activeEffects, setActiveEffects] = useState<CombatEffect[]>([]);

  // 2-секундные всплывающие цифры урона (по одной на каждую цель, мгновенно заменяются при повторном ударе)
  const [activePopups, setActivePopups] = useState<Record<string, DamagePopup>>({});

  // Таймированные физические смещения токенов (отдача цели, уклонение, выпад нападающего)
  const [tokenShifts, setTokenShifts] = useState<Record<string, { shiftX: number; shiftY: number }>>({});

  const triggerTokenShift = useCallback((combatantId: string, shiftX: number, shiftY: number, durationMs = 260) => {
    setTokenShifts((prev) => ({ ...prev, [combatantId]: { shiftX, shiftY } }));
    setTimeout(() => {
      setTokenShifts((prev) => {
        const next = { ...prev };
        delete next[combatantId];
        return next;
      });
    }, durationMs);
  }, []);

  const triggerDamagePopup = useCallback(
    (
      targetId: string,
      x: number,
      y: number,
      text: string,
      outcome: CombatOutcomeType,
      isCrit: boolean
    ) => {
      const id = `pop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newPopup: DamagePopup = {
        id,
        targetId,
        x,
        y,
        text,
        outcome,
        isCrit,
        createdAt: Date.now(),
      };

      // Мгновенно обновляем/перезаписываем урон для этой цели (без наложения цифр!)
      setActivePopups((prev) => ({
        ...prev,
        [targetId]: newPopup,
      }));

      // Цифра висит 2 секунды
      setTimeout(() => {
        setActivePopups((prev) => {
          if (prev[targetId]?.id === id) {
            const next = { ...prev };
            delete next[targetId];
            return next;
          }
          return prev;
        });
      }, 2050);
    },
    []
  );

  const playCombatAnimation = useCallback(
    (
      attacker: Combatant,
      target: Combatant,
      attackOrSpell?: Partial<Attack> | { name: string; isSpell?: boolean } | null,
      outcomeData?: { hit?: boolean; crit?: boolean; damage?: number; isDodge?: boolean; isBlock?: boolean; text?: string }
    ) => {
      if (!combat) return;

      const vector = calculateAttackVector(
        { x: attacker.x, y: attacker.y },
        { x: target.x, y: target.y },
        combat.cellSize
      );

      // Авто-разворот атакующего (и цели) лицом друг к другу перед ударом
      const attackerFacing = determineFacingTowards(
        { x: attacker.x, y: attacker.y },
        { x: target.x, y: target.y }
      );
      const targetFacing = determineFacingTowards(
        { x: target.x, y: target.y },
        { x: attacker.x, y: attacker.y }
      );

      setCombat((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          combatants: prev.combatants.map((c) => {
            if (c.id === attacker.id) return { ...c, facing: attackerFacing };
            if (c.id === target.id && c.hpCurrent > 0) return { ...c, facing: targetFacing };
            return c;
          }),
        };
      });

      const isSpell = !!(attackOrSpell as any)?.isSpell;
      const weaponType = detectWeaponAnimType(attackOrSpell as any, { isSpell });

      const isCrit = !!outcomeData?.crit;
      const isHit = outcomeData?.hit !== false;
      const isDodge = !isHit && (outcomeData?.isDodge || Math.random() > 0.4);
      const isBlock = !isHit && !isDodge;

      const outcome: CombatOutcomeType = isCrit
        ? "crit"
        : isHit
        ? "hit"
        : isDodge
        ? "dodge"
        : "block";

      // Чётко синхронизированные тайминги анимаций и моментов удара
      const isRanged = weaponType === "bow" || weaponType === "spell_projectile";
      const isDagger = weaponType === "dagger_main" || weaponType === "dagger_off" || weaponType === "dagger_dual";
      const durationMs = isRanged ? 760 : isDagger ? 520 : 640;
      const impactRatio = isRanged ? 0.75 : 0.44;
      const impactDelay = Math.round(durationMs * impactRatio);

      const popupText = outcomeData?.text ?? (
        isCrit
          ? (outcomeData?.damage !== undefined ? `-${outcomeData.damage}!` : "Крит!")
          : isHit
          ? (outcomeData?.damage !== undefined ? `-${outcomeData.damage}` : "Попадание")
          : isDodge
          ? "Уклонение"
          : "Блок"
      );

      const newEffect: CombatEffect = {
        id: `fx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: weaponType,
        attackerId: attacker.id,
        targetId: target.id,
        fromPx: vector.fromPx,
        toPx: vector.toPx,
        angleDeg: vector.angleDeg,
        distancePx: vector.distancePx,
        outcome,
        damage: outcomeData?.damage,
        damageText: popupText,
        isCrit,
        durationMs,
        createdAt: Date.now(),
      };

      setActiveEffects((prev) => [...prev, newEffect]);

      // 1. Выпад нападающего вперед в начале удара (для ближнего боя)
      if (!isRanged) {
        const atkRad = (vector.angleDeg * Math.PI) / 180;
        triggerTokenShift(attacker.id, Math.cos(atkRad) * 10, Math.sin(atkRad) * 10, Math.round(durationMs * 0.65));
      }

      // 2. Импакт цели (отдача / отскок уклонения / блок) и урон — СТРОГО в момент прилета стрелы / удара клинка!
      setTimeout(() => {
        const rad = (vector.angleDeg * Math.PI) / 180;
        let defShiftX = 0;
        let defShiftY = 0;

        if (outcome === "hit" || outcome === "crit") {
          const force = isCrit ? 20 : 15;
          defShiftX = Math.cos(rad) * force;
          defShiftY = Math.sin(rad) * force;
        } else if (outcome === "dodge") {
          defShiftX = -Math.sin(rad) * 16 + Math.cos(rad) * 8;
          defShiftY = Math.cos(rad) * 16 + Math.sin(rad) * 8;
        } else if (outcome === "block") {
          defShiftX = -Math.cos(rad) * 6;
          defShiftY = -Math.sin(rad) * 6;
        }

        if (defShiftX !== 0 || defShiftY !== 0) {
          triggerTokenShift(target.id, defShiftX, defShiftY, 260);
        }

        triggerDamagePopup(target.id, vector.toPx.x, vector.toPx.y, popupText, outcome, isCrit);
      }, impactDelay);

      setTimeout(() => {
        setActiveEffects((prev) => prev.filter((e) => e.id !== newEffect.id));
      }, durationMs + 400);
    },
    [combat, triggerDamagePopup, triggerTokenShift]
  );

  const handleLogResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingLogRef.current = true;
    logDragStartY.current = e.clientY;
    logDragStartHeight.current = logHeight;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "ns-resize";

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingLogRef.current) return;
      const delta = logDragStartY.current - moveEvent.clientY;
      const newH = Math.max(38, Math.min(500, logDragStartHeight.current + delta));
      setLogHeight(newH);
    };

    const onMouseUp = () => {
      isDraggingLogRef.current = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [logHeight]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [combat?.log.length, logHeight]);

  // Инициализация роли из localStorage
  useEffect(() => {
    const saved = localStorage.getItem("dnd_combat_role");
    if (saved) {
      setUserRole(saved);
    } else {
      setShowRoleSelector(true);
    }
  }, []);

  const loadCombat = useCallback(async () => {
    try {
      const url = combatId
        ? `/api/combat/${combatId}`
        : campaignId
        ? `/api/combat/active?campaignId=${campaignId}`
        : `/api/combat/active`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setCombat(data.combat);
        const currentPort = typeof window !== "undefined" && window.location.port ? window.location.port : (data.port || 3000);
        if (data.radminIp) {
          setRadminUrl(`http://${data.radminIp}:${currentPort}`);
        }
        if (data.lanIp) {
          setLanUrl(`http://${data.lanIp}:${currentPort}`);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [combatId, campaignId]);

  const loadSpellNames = useCallback(async () => {
    try {
      const res = await fetch("/api/library");
      if (!res.ok) return;
      const data = await res.json();
      const list: Array<{ id: string; name: string; parameters?: ActionParameters }> =
        data.spells ?? [];
      const nameMap: Record<string, string> = {};
      const paramMap: Record<string, ActionParameters> = {};
      for (const s of list) {
        nameMap[s.id] = s.name;
        nameMap[s.name] = s.name;
        if (s.parameters) {
          paramMap[s.id] = s.parameters;
          paramMap[s.name] = s.parameters;
        }
      }
      setSpellNames(nameMap);
      setSpellParams(paramMap);
    } catch {
      /* библиотека необязательна для показа боя */
    }
  }, []);

  useEffect(() => {
    loadCombat();
    loadSpellNames();
  }, [loadCombat, loadSpellNames]);

  // Живая синхронизация с сервером (Live Sync в реальном времени)
  useEffect(() => {
    if (!combat) return;

    let isSubscribed = true;
    const interval = setInterval(async () => {
      // Не опрашиваем во время рисования карты, удаления или прицеливания
      if (drawMode || deleteMode || targeting || botRunning) return;

      try {
        const res = await fetch("/api/combat/active", { cache: "no-store" });
        if (!res.ok || !isSubscribed) return;
        const data = await res.json();
        if (!data.combat) return;

        setCombat((prev) => {
          if (!prev) return data.combat;

          // Быстрая проверка изменений
          const hasLogChange = prev.log.length !== data.combat.log.length;
          const hasTurnChange =
            prev.currentTurnIndex !== data.combat.currentTurnIndex ||
            prev.round !== data.combat.round;
          const hasCombatantChange =
            JSON.stringify(prev.combatants) !== JSON.stringify(data.combat.combatants);
          const hasMapChange =
            JSON.stringify(prev.mapElements) !== JSON.stringify(data.combat.mapElements);

          if (hasLogChange || hasTurnChange || hasCombatantChange || hasMapChange) {
            // Визуализируем новые атаки из лога боя (ходы ИИ-Мастера и других участников)
            if (prev.log.length < data.combat.log.length) {
              const newEntries = data.combat.log.slice(prev.log.length);
              for (const entry of newEntries) {
                if (entry.kind === "attack") {
                  const match = entry.text.match(/^(?:Провоцированная атака:\s*)?([^→]+)\s*→\s*([^:]+):\s*(.*)$/);
                  if (match) {
                    const attackerName = match[1].trim();
                    const targetName = match[2].trim();
                    const rest = match[3];

                    const attacker = data.combat.combatants.find((c: any) => c.name === attackerName);
                    const target = data.combat.combatants.find((c: any) => c.name === targetName);
                    if (attacker && target) {
                      const isCrit = rest.includes("крит") || rest.includes("КРИТ");
                      const isMiss = rest.includes("промах") || rest.includes("не попал");
                      const isHit = isCrit || !isMiss;
                      const dmgMatch = rest.match(/(?:,\s*|\s+)(\d+)\s*(?:урона|урон|ед\.\s*урона)/i) ||
                                       rest.match(/урон[^\d]*(\d+)/i) ||
                                       rest.match(/(\d+)\s*(?:хитов|хита)/i);
                      const dmg = dmgMatch ? parseInt(dmgMatch[1], 10) : undefined;
                      const actionName = rest.split(":")[0]?.trim() || "Атака";

                      playCombatAnimation(attacker, target, { name: actionName }, {
                        hit: isHit,
                        crit: isCrit,
                        damage: isHit ? dmg : undefined,
                        isDodge: isMiss,
                      });
                    }
                  }
                }
              }
            }

            // Если наступил ход игрока, а до этого был ход врага/бота — оповещаем
            const prevTurnId = prev.turnOrder[prev.currentTurnIndex];
            const nextTurnId = data.combat.turnOrder[data.combat.currentTurnIndex];
            if (prevTurnId !== nextTurnId) {
              const nextCreature = data.combat.combatants.find((c: any) => c.id === nextTurnId);
              if (nextCreature && !nextCreature.isAIControlled && nextCreature.type === "player") {
                toast.info(`Ваш ход: ${nextCreature.name}!`, { duration: 3000 });
              }
            }
            return data.combat;
          }
          return prev;
        });
      } catch {
        // Игнорируем фоновые ошибки сети
      }
    }, 750);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [combat?.id, drawMode, deleteMode, targeting, botRunning, playCombatAnimation]);

  // Real-time synchronization with dnd5e-character-sheet tab via BroadcastChannel
  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined" || !combat?.id) return;
    try {
      const channel = new BroadcastChannel("dnd5e_character_sync");
      channel.onmessage = async (event) => {
        if (event.data?.type === "CHARACTER_SHEET_UPDATED" && event.data?.character) {
          const sheetChar = event.data.character;
          const matchingCombatant = combat.combatants.find(
            (c) => c.name.trim().toLowerCase() === (sheetChar.name || "").trim().toLowerCase()
          );
          if (matchingCombatant) {
            toast.info(`Лист персонажа «${matchingCombatant.name}» обновлён в реальном времени`, { duration: 3000 });
            await loadCombat();
          }
        }
      };
      return () => {
        channel.close();
      };
    } catch {
      // Ignore broadcast errors
    }
  }, [combat?.id, combat?.combatants]);

  // ===== Производные значения =====

  const currentTurnId = combat?.turnOrder[combat.currentTurnIndex] ?? null;
  const currentCombatant = useMemo(
    () => (combat && currentTurnId ? combat.combatants.find((c) => c.id === currentTurnId) ?? null : null),
    [combat, currentTurnId]
  );

  const isDM = userRole === "dm";
  const myCombatant = useMemo(
    () => (!isDM && combat ? combat.combatants.find((c) => c.id === userRole) ?? null : null),
    [isDM, combat, userRole]
  );
  const isMyTurn = isDM ? true : currentTurnId === userRole;

  const selectedCombatant = useMemo(
    () => combat?.combatants.find((c) => c.id === selectedCombatantId) ?? null,
    [combat, selectedCombatantId]
  );

  const handleSelectRole = useCallback(
    (role: string) => {
      setUserRole(role);
      localStorage.setItem("dnd_combat_role", role);
      setShowRoleSelector(false);
      if (role === "dm") {
        toast.success("Режим Dungeon Master активирован");
      } else {
        const hero = combat?.combatants.find((c) => c.id === role);
        toast.success(`Вы играете за: ${hero?.name ?? "Персонажа"}`);
        setSelectedCombatantId(role);
      }
    },
    [combat?.combatants]
  );

  useEffect(() => {
    if (currentTurnId) {
      if (isDM) {
        setSelectedCombatantId(currentTurnId);
      } else if (currentTurnId === userRole) {
        setSelectedCombatantId(userRole);
      }
    }
  }, [currentTurnId, isDM, userRole]);
  const editorCombatant = useMemo(
    () => combat?.combatants.find((c) => c.id === editorForId) ?? null,
    [combat, editorForId]
  );
  // Ходит бот — игрок не действует, только смотрит и жмёт «Ход бота»
  const isBotTurn = !!currentCombatant?.isAIControlled;
  // Атакующий — тот, чей сейчас ход; выбор токена нужен только для осмотра
  const actorId = currentTurnId;

  async function createCombat() {
    setCreating(true);
    try {
      const res = await fetch("/api/combat/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Бой", addTestEnemies: true }),
      });
      if (res.ok) {
        const data = await res.json();
        setCombat(data.combat);
        toast.success("Бой начат! Брось инициативу.");
      } else {
        toast.error("Не удалось создать бой");
      }
    } catch (e) {
      toast.error(`Ошибка: ${(e as Error).message}`);
    } finally {
      setCreating(false);
    }
  }

  /** Единая точка вызова боевого API. Лог ведёт сервер, здесь только тосты. */
  async function doAction(
    action: string,
    payload: Record<string, unknown> = {}
  ): Promise<Record<string, any> | null> {
    if (!combat) return null;
    try {
      const res = await fetch("/api/combat/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, combatId: combat.id, ...payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Нарушение правил движок отдаёт как 400 с понятным текстом
        toast.error(data.error || "Действие не удалось");
        return null;
      }
      if (data.combat) setCombat(data.combat);
      else await loadCombat();
      if (data.outcome) setOutcome(data.outcome);
      return data;
    } catch (e) {
      toast.error(`Ошибка: ${(e as Error).message}`);
      return null;
    }
  }

  // === ДЕЙСТВИЯ ИЗ ХОТБАРА ===

  function startAttack(attackId: string) {
    if (!currentCombatant) {
      toast.error("Порядок ходов не задан — брось инициативу");
      return;
    }
    const atk = currentCombatant.attacks.find((a) => a.id === attackId);
    if (!atk) return;
    setTargeting({
      type: "attack",
      id: attackId,
      name: atk.name,
      range: { kind: atk.kind, normal: atk.range.normal, long: atk.range.long },
    });
  }

  async function startSpell(spellId: string) {
    if (!currentCombatant) return;
    const p = spellParams[spellId];
    const name = spellNames[spellId] || "Заклинание";

    // Заклинания исключительно на себя без области действия (Щит, Обнаружение магии)
    if (p?.targeting === "self" && !p?.aoe) {
      await doAction("cast-spell", {
        casterId: currentCombatant.id,
        spellId,
        targetIds: [],
        center: null,
      });
      return;
    }

    const isTeleport =
      name.toLowerCase().includes("шаг") ||
      name.toLowerCase().includes("телепорт") ||
      name.toLowerCase().includes("teleport");

    const isTouch = p?.range?.type === "touch" || p?.range?.value === 5;
    const isSelfAoe = p?.range?.type === "self" && p?.aoe;
    const normalRange =
      p?.range?.value ??
      (isTouch ? 5 : isSelfAoe ? p?.aoe?.size : isTeleport ? 30 : undefined);

    setMultiTargets([]);
    setTargeting({
      type: "spell",
      id: spellId,
      name,
      range: normalRange ? { kind: "spell", normal: normalRange } : undefined,
      aoe: p?.aoe ? { shape: p.aoe.shape, size: p.aoe.size } : undefined,
      isTeleport,
    });
  }

  async function startAbility(abilityId: string) {
    const ab = currentCombatant?.abilities.find((a) => a.id === abilityId);
    if (!ab || !currentCombatant) return;

    // Способности телепортации или нацеливания на клетку (Теневой шаг, Туманный шаг, Шаг сквозь тень)
    const isTeleport =
      ab.name.toLowerCase().includes("шаг") ||
      ab.name.toLowerCase().includes("телепорт") ||
      ab.name.toLowerCase().includes("teleport") ||
      ab.parameters?.name?.toLowerCase().includes("шаг") ||
      ab.parameters?.name?.toLowerCase().includes("teleport");

    const mode = ab.parameters?.targeting;
    const rangeVal = ab.parameters?.range?.value ?? 30;

    if (isTeleport || mode === "point") {
      setMultiTargets([]);
      setTargeting({
        type: "ability",
        id: abilityId,
        name: ab.name,
        range: { kind: "spell", normal: rangeVal },
        isTeleport: true,
      });
      return;
    }

    // Способности без внешней цели (Второе дыхание, Порыв действия, Ярость) применяем сразу на себя
    const needsTarget = mode === "creature" || mode === "ally";
    if (!needsTarget) {
      await doAction("use-ability", {
        combatantId: currentCombatant.id,
        abilityId,
        targetIds: [],
      });
      return;
    }
    setMultiTargets([]);
    setTargeting({
      type: "ability",
      id: abilityId,
      name: ab.name,
      range: ab.parameters?.range?.value ? { kind: "spell", normal: ab.parameters.range.value } : undefined,
    });
  }

  function cancelTargeting() {
    setTargeting(null);
    setMultiTargets([]);
    setAdvantage(false);
    setDisadvantage(false);
  }

  // Нажатие Escape отменяет текущий выбор действия без расхода ресурсов
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && targeting) {
        cancelTargeting();
        toast.info("Выбор действия отменён");
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [targeting]);

  /** Шаг 2 таргетинга: досягаемость и помехи проверяет сервер */
  async function executeOnTarget(targetId: string) {
    if (!targeting || !actorId) return;

    if (targeting.type === "attack") {
      const attacker = combat?.combatants.find((c) => c.id === actorId);
      const target = combat?.combatants.find((c) => c.id === targetId);
      const atk = attacker?.attacks.find((a) => a.id === targeting.id);

      const data = await doAction("attack", {
        attackerId: actorId,
        targetId,
        attackId: targeting.id,
        advantage,
        disadvantage,
      });

      if (attacker && target && data?.result) {
        playCombatAnimation(attacker, target, atk, {
          hit: data.result.hit,
          crit: data.result.crit,
          damage: data.result.damage,
        });
      }

      setTargeting(null);
      setAdvantage(false);
      setDisadvantage(false);
    } else if (targeting.type === "spell") {
      const p = spellParams[targeting.id];
      const maxTargets = p?.maxTargets ?? 1;
      const attacker = combat?.combatants.find((c) => c.id === actorId);
      const spellName = spellNames[targeting.id] || targeting.name;

      if (maxTargets > 1) {
        const next = [...multiTargets, targetId];
        const targetName = combat?.combatants.find((c) => c.id === targetId)?.name ?? "Цель";
        if (next.length < maxTargets) {
          setMultiTargets(next);
          toast.info(`Выбрано ${next.length}/${maxTargets} целей (${targetName}). Выберите ещё или нажмите «Применить».`);
          return;
        }
        // Набрали максимум целей
        const data = await doAction("cast-spell", {
          casterId: actorId,
          spellId: targeting.id,
          targetIds: next,
        });
        if (attacker) {
          for (const tid of next) {
            const tgt = combat?.combatants.find((c) => c.id === tid);
            if (tgt) {
              const tRes = data?.result?.targets?.find((t: any) => t.name === tgt.name);
              playCombatAnimation(
                attacker,
                tgt,
                { name: spellName, isSpell: true },
                {
                  hit: tRes?.hit ?? (tRes?.saved === false ? true : (tRes?.amount ?? 0) > 0),
                  damage: tRes?.amount,
                }
              );
            }
          }
        }
        setMultiTargets([]);
        setTargeting(null);
        setAdvantage(false);
        setDisadvantage(false);
        return;
      }

      const target = combat?.combatants.find((c) => c.id === targetId);
      const data = await doAction("cast-spell", {
        casterId: actorId,
        spellId: targeting.id,
        targetIds: [targetId],
      });

      if (attacker && target) {
        const tRes =
          data?.result?.targets?.find((t: any) => t.name === target.name) ??
          data?.result?.targets?.[0];
        playCombatAnimation(
          attacker,
          target,
          { name: spellName, isSpell: true },
          {
            hit: tRes?.hit ?? (tRes?.saved === false ? true : (tRes?.amount ?? 0) > 0),
            damage: tRes?.amount,
          }
        );
      }

      setTargeting(null);
      setAdvantage(false);
      setDisadvantage(false);
    } else {
      await doAction("use-ability", {
        combatantId: actorId,
        abilityId: targeting.id,
        targetIds: [targetId],
      });
      setTargeting(null);
      setAdvantage(false);
      setDisadvantage(false);
    }
  }

  /** Принудительное применение многоцелевого заклинания до набора maxTargets */
  async function applyMultiSpell() {
    if (!targeting || targeting.type !== "spell" || !actorId || multiTargets.length === 0) return;
    const attacker = combat?.combatants.find((c) => c.id === actorId);
    const spellName = spellNames[targeting.id] || targeting.name;

    const data = await doAction("cast-spell", {
      casterId: actorId,
      spellId: targeting.id,
      targetIds: multiTargets,
    });

    if (attacker) {
      for (const tid of multiTargets) {
        const tgt = combat?.combatants.find((c) => c.id === tid);
        if (tgt) {
          const tRes = data?.result?.targets?.find((t: any) => t.name === tgt.name);
          playCombatAnimation(
            attacker,
            tgt,
            { name: spellName, isSpell: true },
            {
              hit: tRes?.hit ?? (tRes?.saved === false ? true : (tRes?.amount ?? 0) > 0),
              damage: tRes?.amount,
            }
          );
        }
      }
    }

    setMultiTargets([]);
    setTargeting(null);
    setAdvantage(false);
    setDisadvantage(false);
  }

  /** Ход бота: считаем, показываем шаги, ждём «Продолжить» */
  async function runBotTurn() {
    setBotRunning(true);
    try {
      const data = await doAction("bot-turn");
      if (data) {
        const steps: string[] = (data.steps ?? []).map((s: { text: string }) => s.text);
        setBotSteps(steps.length ? steps : ["Бот не нашёл, что сделать"]);
        // Воспроизводим анимации из шагов бота
        if (combat) {
          for (const step of data.steps ?? []) {
            const match = step.text.match(/^([^→]+)\s*→\s*([^:]+):\s*(.*)$/);
            if (match) {
              const attackerName = match[1].trim();
              const targetName = match[2].trim();
              const rest = match[3];
              const attacker = combat.combatants.find((c) => c.name === attackerName);
              const target = combat.combatants.find((c) => c.name === targetName);
              if (attacker && target) {
                const isCrit = rest.includes("крит") || rest.includes("КРИТ");
                const isMiss = rest.includes("промах") || rest.includes("не попал");
                const isHit = isCrit || !isMiss;
                const dmgMatch = rest.match(/(?:,\s*|\s+)(\d+)\s*(?:урона|урон|ед\.\s*урона)/i) ||
                                 rest.match(/урон[^\d]*(\d+)/i) ||
                                 rest.match(/(\d+)\s*(?:хитов|хита)/i);
                const dmg = dmgMatch ? parseInt(dmgMatch[1], 10) : undefined;
                const actionName = rest.split(":")[0]?.trim() || "Атака";
                playCombatAnimation(attacker, target, { name: actionName }, {
                  hit: isHit,
                  crit: isCrit,
                  damage: isHit ? dmg : undefined,
                  isDodge: isMiss,
                });
              }
            }
          }
        }
      }
    } finally {
      setBotRunning(false);
    }
  }

  async function continueAfterBot() {
    setBotSteps(null);
    await doAction("end-turn");
  }

  async function endCombat() {
    if (!confirm("Завершить бой? Вернуться к нему будет нельзя.")) return;
    const isVictory = outcome === "players";
    const data = await doAction("end-combat", { outcome: isVictory ? "victory" : "ended" });
    if (onCombatEnd && combat) {
      const surv = (combat.combatants || []).map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        hpCurrent: c.hpCurrent,
        hpMax: c.hpMax,
      }));
      await onCombatEnd({
        combatId: combat.id,
        name: combat.name,
        rounds: combat.round,
        outcome: outcome === "players" ? "victory" : outcome === "enemies" ? "defeat" : "ended",
        survivingCombatants: surv,
        awardedXP: data?.xpAward?.totalXP,
        xpPerPlayer: data?.xpAward?.xpPerPlayer,
      });
    }
    onClose();
  }

  async function handleCellClick(x: number, y: number) {
    if (drawMode) {
      await doAction("add-element", { type: drawMode, x, y, width: 1, height: 1 });
      return;
    }
    if (targeting) {
      // 1. Способность с выбором клетки / телепортация (Теневой шаг, Туманный шаг и др.)
      if (targeting.type === "ability" && (targeting.isTeleport || targeting.range) && actorId) {
        await doAction("use-ability", {
          combatantId: actorId,
          abilityId: targeting.id,
          center: { x, y },
          centerCell: { x, y },
        });
        cancelTargeting();
        return;
      }

      // 2. Заклинание телепортации на точку (Туманный шаг и т.д.)
      if (targeting.type === "spell" && targeting.isTeleport && actorId) {
        await doAction("cast-spell", {
          casterId: actorId,
          spellId: targeting.id,
          targetIds: [],
          center: { x, y },
        });
        cancelTargeting();
        return;
      }

      // 3. AoE заклинание наводится на клетку
      if (targeting.aoe && targeting.type === "spell" && actorId) {
        const attacker = combat?.combatants.find((c) => c.id === actorId);
        const spellName = spellNames[targeting.id] || targeting.name;
        const data = await doAction("cast-spell", {
          casterId: actorId,
          spellId: targeting.id,
          targetIds: [],
          center: { x, y },
        });
        if (attacker && data?.result?.targets) {
          for (const tRes of data.result.targets) {
            const tgt = combat?.combatants.find((c) => c.name === tRes.name);
            if (tgt) {
              playCombatAnimation(
                attacker,
                tgt,
                { name: spellName, isSpell: true },
                {
                  hit: tRes?.hit ?? (tRes?.saved === false ? true : (tRes?.amount ?? 0) > 0),
                  damage: tRes?.amount,
                }
              );
            }
          }
        }
        cancelTargeting();
        return;
      }

      // Обычное действие/атака — клик в пустую клетку отменяет наведение
      cancelTargeting();
      return;
    }
    setSelectedCombatantId(null);
  }

  async function handleCombatantClick(combatantId: string) {
    if (targeting) {
      if (targeting.isTeleport) {
        toast.error("Нельзя телепортироваться в клетку, занятую другим существом!");
        return;
      }
      // Если заклинание по площади (AoE) — центрируем его на клетке выбранного существа
      if (targeting.aoe && targeting.type === "spell" && actorId) {
        const target = combat?.combatants.find((c) => c.id === combatantId);
        if (target) {
          const attacker = combat?.combatants.find((c) => c.id === actorId);
          const spellName = spellNames[targeting.id] || targeting.name;
          const data = await doAction("cast-spell", {
            casterId: actorId,
            spellId: targeting.id,
            targetIds: [combatantId],
            center: { x: target.x, y: target.y },
          });
          if (attacker && data?.result?.targets) {
            for (const tRes of data.result.targets) {
              const tgt = combat?.combatants.find((c) => c.name === tRes.name);
              if (tgt) {
                playCombatAnimation(
                  attacker,
                  tgt,
                  { name: spellName, isSpell: true },
                  {
                    hit: tRes?.hit ?? (tRes?.saved === false ? true : (tRes?.amount ?? 0) > 0),
                    damage: tRes?.amount,
                  }
                );
              }
            }
          }
          cancelTargeting();
          return;
        }
      }

      await executeOnTarget(combatantId);
      return;
    }
    setSelectedCombatantId(combatantId);
    setDrawMode(null);
    setDeleteMode(false);
  }

  async function handleCombatantMove(combatantId: string, x: number, y: number) {
    if (!isDM && combatantId !== userRole) {
      toast.error(`Вы можете перемещать только своего персонажа (${myCombatant?.name ?? "своего"})!`);
      return;
    }
    if (isDM && combatantId !== currentTurnId) {
      await doAction("reposition-combatant", { combatantId, x, y });
      return;
    }
    if (combatantId !== currentTurnId) {
      toast.error("Сейчас не ваш ход!");
      return;
    }
    const data = await doAction("move-combatant", { combatantId, x, y });
    const opps = data?.opportunityAttacks || data?.result?.opportunityAttacks;
    if (opps?.length && combat) {
      toast.warning(`Провокация: ${opps.length} атак(и) вслед!`);
      const mover = combat.combatants.find((c) => c.id === combatantId);
      for (const opp of opps) {
        const attacker = combat.combatants.find((c) => c.id === opp.attackerId);
        if (attacker && mover) {
          playCombatAnimation(attacker, mover, opp.attack || { name: "Удар оружием" }, {
            hit: opp.hit,
            crit: opp.crit,
            damage: opp.damage,
            isDodge: !opp.hit,
          });
        }
      }
    }
  }

  async function handleCombatantReposition(combatantId: string, x: number, y: number) {
    if (!isDM) return;
    await doAction("reposition-combatant", { combatantId, x, y });
  }

  async function addCombatant() {
    if (!newCombatant.name.trim() || !combat) return;
    const isEnemy = newCombatant.type === "enemy";
    const targetX = isEnemy
      ? Math.max(1, Math.min(combat.gridWidth - 5, Math.floor(combat.gridWidth * 0.7)))
      : Math.max(1, Math.min(3, Math.floor(combat.gridWidth * 0.2)));
    let x = targetX;
    let y = Math.max(1, Math.min(combat.gridHeight - 2, Math.floor(combat.gridHeight / 2)));

    // Check occupied cells and walls/obstacles
    const blocked = new Set<string>();
    for (const c of combat.combatants) {
      blocked.add(`${c.x},${c.y}`);
    }
    if (combat.mapElements) {
      for (const el of combat.mapElements) {
        if (el.type === "wall" || el.type === "obstacle") {
          for (let dx = 0; dx < (el.width || 1); dx++) {
            for (let dy = 0; dy < (el.height || 1); dy++) {
              blocked.add(`${el.x + dx},${el.y + dy}`);
            }
          }
        }
      }
    }

    let attempts = 0;
    while (blocked.has(`${x},${y}`) && attempts < combat.gridWidth * combat.gridHeight) {
      y = (y + 1) % combat.gridHeight;
      if (y === 0) {
        y = 1;
        x = isEnemy ? Math.max(1, x - 1) : Math.min(combat.gridWidth - 2, x + 1);
      }
      attempts++;
    }

    await doAction("add-combatant", { ...newCombatant, x, y });
    setNewCombatant({ ...newCombatant, name: "" });
    setShowAddCombatant(false);
  }

  async function seedLibrary() {
    const res = await fetch("/api/library/seed", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      toast.success(
        `Заклинаний: +${data.spells.created} новых, ${data.spells.updated} обновлено. ` +
          `Способностей: +${data.abilities.created} новых, ${data.abilities.updated} обновлено.`
      );
      await loadSpellNames();
    } else {
      toast.error("Ошибка заполнения библиотеки");
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex items-center justify-center">
        <div className="text-muted-foreground">Загрузка боя...</div>
      </div>
    );
  }

  if (!combat) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Swords className="size-5" />
              Боевой режим
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Активного боя нет. Создать новый? На карту встанут тестовые враги, а персонажей
              можно импортировать из JSON.
            </p>
            <div className="flex gap-2">
              <Button onClick={createCombat} disabled={creating} className="flex-1">
                <Swords className="size-4 mr-2" />
                {creating ? "Создание..." : "Начать бой"}
              </Button>
              <Button variant="outline" onClick={onClose}>
                Отмена
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const noTurnOrder = combat.turnOrder.length === 0;

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur px-4 py-2 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Swords className="size-5 text-rose-600 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="font-semibold truncate">{combat.name}</div>
              <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/30 bg-emerald-500/10 gap-1 h-5 px-1.5 font-normal flex items-center shrink-0">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                LIVE
              </Badge>

              {/* Переключатель роли (DM / Игрок) */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRoleSelector(true)}
                className={`h-6 text-xs px-2 gap-1 rounded-full font-medium ${
                  isDM
                    ? "border-amber-500/40 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20"
                    : "border-blue-500/40 text-blue-300 bg-blue-500/10 hover:bg-blue-500/20"
                }`}
                title="Нажмите, чтобы сменить роль или персонажа"
              >
                {isDM ? <Crown className="size-3 text-amber-400" /> : <User className="size-3 text-blue-400" />}
                <span>{isDM ? "👑 DM (Мастер)" : `🎮 ${myCombatant?.name ?? "Игрок"}`}</span>
              </Button>

              {/* Radmin VPN ссылка для друзей */}
              {isDM && radminUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    const ok = await copyToClipboard(radminUrl);
                    if (ok) {
                      toast.success(`Ссылка для Radmin VPN скопирована: ${radminUrl}`);
                    } else {
                      toast.info(`Ссылка для Radmin VPN: ${radminUrl}`);
                    }
                  }}
                  className="h-6 text-[11px] text-amber-200 hover:text-white bg-amber-950/60 hover:bg-amber-900/80 border border-amber-500/40 px-2 gap-1"
                  title="Нажмите, чтобы скопировать ссылку для друзей через Radmin VPN"
                >
                  <Globe className="size-3 text-amber-400 animate-pulse" />
                  <span>Radmin: <span className="font-mono text-amber-300 font-bold">{radminUrl}</span></span>
                  <Copy className="size-2.5 ml-0.5 text-amber-400" />
                </Button>
              )}

              {/* LAN Ссылка для подключения друзей по Wi-Fi / сети (для DM) */}
              {isDM && lanUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    const ok = await copyToClipboard(lanUrl);
                    if (ok) {
                      toast.success(`Ссылка для локальной сети скопирована: ${lanUrl}`);
                    } else {
                      toast.info(`Ссылка для локальной сети: ${lanUrl}`);
                    }
                  }}
                  className="h-6 text-[11px] text-zinc-300 hover:text-white bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/60 px-2 gap-1"
                  title="Нажмите, чтобы скопировать ссылку для подключения друзей в локальной сети"
                >
                  <Wifi className="size-3 text-emerald-400 animate-pulse" />
                  <span>LAN: <span className="font-mono text-emerald-400 font-bold">{lanUrl}</span></span>
                  <Copy className="size-2.5 ml-0.5 text-zinc-400" />
                </Button>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              Раунд {combat.round} • {combat.combatants.length} бойцов • {combat.gridWidth}×{combat.gridHeight}
              {currentCombatant && <> • ходит {currentCombatant.name}</>}
            </div>
          </div>
        </div>

        {/* Панель кнопок */}
        <div className="flex items-center gap-2">
          {isDM && (
            <>
              <Button size="sm" variant="outline" onClick={() => setShowMapPresets(true)}>
                <Map className="size-4 mr-1 text-emerald-500" />
                <span className="hidden sm:inline">Карты биомов (24)</span>
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowPresets(true)}>
                <Layers className="size-4 mr-1 text-purple-500" />
                <span className="hidden sm:inline">Пресеты & Бестиарий</span>
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowImport(true)}>
                <Upload className="size-4 mr-1" />
                <span className="hidden sm:inline">Импорт JSON</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setLibraryTargetCombatant(selectedCombatant || currentCombatant || null);
                  setShowLibrary(true);
                }}
              >
                <BookOpen className="size-4 mr-1 text-blue-500" />
                <span className="hidden sm:inline">Библиотека</span>
              </Button>
              <Button size="sm" variant="secondary" onClick={() => doAction("roll-initiative")}>
                <Dice5 className="size-4 mr-1" />
                <span className="hidden sm:inline">Инициатива</span>
              </Button>
            </>
          )}

          {/* След. ход / Закончить ход */}
          <Button
            size="sm"
            onClick={() => doAction("end-turn")}
            disabled={noTurnOrder || (!isDM && !isMyTurn)}
            className={!isDM && isMyTurn ? "bg-emerald-600 hover:bg-emerald-700 font-bold animate-pulse text-white" : ""}
          >
            <ChevronRight className="size-4 mr-1" />
            <span className="hidden sm:inline">{!isDM ? "Закончить ход" : "След. ход"}</span>
          </Button>

          {isDM && (
            <Button size="sm" variant="outline" onClick={endCombat}>
              Завершить
            </Button>
          )}

          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
      </header>

      {/* Кооперативный баннер для игроков */}
      {!isDM && (
        <div
          className={`px-4 py-2 text-sm border-b font-medium flex items-center justify-between transition-colors ${
            isMyTurn
              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
              : "bg-blue-500/10 border-blue-500/20 text-blue-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {isMyTurn ? (
              <>
                <span className="text-base">⚔️</span>
                <span>
                  <strong>ТВОЙ ХОД, {myCombatant?.name ?? "Герой"}!</strong> Выберите перемещение и совершите действие на панели внизу.
                </span>
              </>
            ) : (
              <>
                <span className="text-base">⏳</span>
                <span>
                  Ожидание своего хода. Сейчас ходит: <strong>{currentCombatant?.name ?? "..."}</strong>
                </span>
              </>
            )}
          </div>
          {isMyTurn && (
            <Button
              size="sm"
              onClick={() => doAction("end-turn")}
              className="bg-emerald-600 hover:bg-emerald-700 h-7 text-xs font-bold text-white"
            >
              Закончить ход
            </Button>
          )}
        </div>
      )}

      {/* Бой окончен */}
      {outcome && (
        <div
          className={`px-4 py-2 text-sm border-b ${
            outcome === "players"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
              : "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300"
          }`}
        >
          {outcome === "players" ? "🏆 Враги побеждены!" : "💀 Отряд повержен."}
          <Button size="sm" variant="ghost" className="ml-2 h-6" onClick={() => setOutcome(null)}>
            Скрыть
          </Button>
        </div>
      )}

      {/* Порядок ходов не задан */}
      {noTurnOrder && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-sm">
          ⚠️ Очередь ходов пуста. Нажми <strong>«Инициатива»</strong>, чтобы начать раунд.
        </div>
      )}

      {/* Ход бота */}
      {isBotTurn && !noTurnOrder && (
        <div className="bg-slate-500/10 border-b border-slate-500/30 px-4 py-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <Bot className="size-4" />
              Ходит <strong>{currentCombatant?.name}</strong> (бот)
            </span>
            {botSteps ? (
              <Button size="sm" onClick={continueAfterBot} className="bg-emerald-600 hover:bg-emerald-700">
                <Play className="size-3 mr-1" />
                Продолжить
              </Button>
            ) : (
              <Button size="sm" onClick={runBotTurn} disabled={botRunning}>
                <Bot className="size-3 mr-1" />
                {botRunning ? "Думает..." : "Ход бота"}
              </Button>
            )}
          </div>
          {botSteps && (
            <ul className="mt-2 space-y-0.5 text-xs font-mono text-muted-foreground">
              {botSteps.map((s, i) => (
                <li key={i}>• {s}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Таргетинг */}
      {targeting && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-sm flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span>
              🎯 <strong>{currentCombatant?.name ?? "Боец"}</strong> → {targeting.name}
              {targeting.range?.normal ? ` (${targeting.range.normal} фт / ${Math.floor(targeting.range.normal / 5)} кл.)` : ""}.{" "}
              {targeting.isTeleport
                ? `Выберите свободную клетку на сетке в пределах ${targeting.range?.normal ?? 30} фт для мгновенной телепортации.`
                : targeting.aoe
                  ? `Кликни по клетке на сетке — центру/направлению области (${targeting.aoe.size} фт).`
                  : spellParams[targeting.id]?.maxTargets && spellParams[targeting.id]!.maxTargets! > 1
                    ? `Выберите до ${spellParams[targeting.id]!.maxTargets} целей на сетке. Выбрано: ${multiTargets.length}/${spellParams[targeting.id]!.maxTargets}.`
                    : "Кликни по цели на сетке."}
            </span>
            {advantage && <Badge variant="secondary" className="bg-blue-500/20 text-blue-300">Преимущество</Badge>}
            {disadvantage && <Badge variant="secondary" className="bg-red-500/20 text-red-300">Помеха</Badge>}
            {multiTargets.length > 0 && (
              <span className="text-xs text-muted-foreground">
                ({multiTargets.map((id) => combat.combatants.find((c) => c.id === id)?.name ?? id).join(", ")})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {multiTargets.length > 0 && (
              <Button size="sm" onClick={applyMultiSpell} className="bg-amber-600 hover:bg-amber-700 text-xs h-7">
                <Check className="size-3.5 mr-1" />
                Применить ({multiTargets.length})
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-amber-500/40 text-amber-300 hover:bg-amber-500/20"
              onClick={cancelTargeting}
            >
              Отменить ({targeting.name}) <kbd className="ml-1 px-1 bg-black/40 rounded text-[10px]">Esc</kbd>
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Initiative */}
        <aside className="w-64 border-r bg-card/30 shrink-0">
          <InitiativeTracker
            combatants={combat.combatants}
            turnOrder={combat.turnOrder}
            currentTurnIndex={combat.currentTurnIndex}
            round={combat.round}
            selectedId={selectedCombatantId}
            onSelect={handleCombatantClick}
          />
        </aside>

        {/* Center: Grid */}
        <main className="flex-1 overflow-auto bg-muted/20 p-4">
          <CombatGrid
            combat={combat}
            selectedCombatantId={selectedCombatantId || currentTurnId}
            drawMode={drawMode}
            onCellClick={handleCellClick}
            onCombatantClick={handleCombatantClick}
            onCombatantMove={handleCombatantMove}
            onCombatantReposition={handleCombatantReposition}
            isDM={isDM}
            onToggleDoor={(elementId) => doAction("toggle-door", { elementId })}
            onDeleteElement={(elementId) => doAction("remove-element", { elementId })}
            onRotateCombatant={(combatantId, facing) => doAction("set-facing", { combatantId, facing })}
            deleteMode={deleteMode}
            targetingRange={targeting?.range ?? null}
            targetingAoe={targeting?.aoe ?? null}
            attackerPosition={
              currentCombatant
                ? { x: currentCombatant.x, y: currentCombatant.y }
                : selectedCombatant
                  ? { x: selectedCombatant.x, y: selectedCombatant.y }
                  : null
            }
            effects={activeEffects}
            popups={activePopups}
            tokenShifts={tokenShifts}
          />
        </main>

        {/* Right: details + toolbar */}
        <aside className="w-72 border-l bg-card/30 shrink-0 overflow-y-auto">
          <div className="p-3 space-y-3">
            {isDM && (
              <>
                {/* Карта */}
                <div>
                  <div className="text-xs font-medium mb-2 text-muted-foreground">КАРТА</div>
                  <div className="grid grid-cols-2 gap-1">
                    <Button
                      size="sm"
                      variant={drawMode === null && !deleteMode ? "default" : "outline"}
                      onClick={() => {
                        setDrawMode(null);
                        setDeleteMode(false);
                      }}
                      className="text-xs"
                    >
                      <Square className="size-3 mr-1" />
                      Выбор
                    </Button>
                    <Button
                      size="sm"
                      variant={deleteMode ? "destructive" : "outline"}
                      onClick={() => {
                        setDeleteMode(!deleteMode);
                        setDrawMode(null);
                        setSelectedCombatantId(null);
                      }}
                      className="text-xs"
                    >
                      <Trash2 className="size-3 mr-1" />
                      Удалить
                    </Button>
                    {ELEMENT_TYPES.map((el) => (
                      <Button
                        key={el.type}
                        size="sm"
                        variant={drawMode === el.type ? "default" : "outline"}
                        onClick={() => {
                          setDrawMode(drawMode === el.type ? null : el.type);
                          setDeleteMode(false);
                          setSelectedCombatantId(null);
                        }}
                        className="text-xs"
                      >
                        {el.icon}
                        <span className="ml-1 truncate">{el.label}</span>
                      </Button>
                    ))}
                  </div>

                  {/* Расширение сетки в любую сторону */}
                  <div className="space-y-1 mt-2.5 pt-2 border-t">
                    <div className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                      <span>РАСШИРИТЬ ПОЛЕ</span>
                      <span className="font-mono text-[10px] text-amber-400">
                        {combat.gridWidth}×{combat.gridHeight} кл.
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-[10px] h-6 px-1 bg-muted/30 hover:bg-muted border-dashed"
                        onClick={() => doAction("expand-grid-direction", { direction: "top", count: 2 })}
                        title="Добавить 2 клетки сверху (бойцы сдвинутся вниз)"
                      >
                        + Верх
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-[10px] h-6 px-1 bg-muted/30 hover:bg-muted border-dashed"
                        onClick={() => doAction("expand-grid-direction", { direction: "bottom", count: 2 })}
                        title="Добавить 2 клетки снизу"
                      >
                        + Низ
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-[10px] h-6 px-1 bg-muted/30 hover:bg-muted border-dashed"
                        onClick={() => doAction("expand-grid-direction", { direction: "left", count: 2 })}
                        title="Добавить 2 клетки слева (бойцы сдвинутся вправо)"
                      >
                        + Лево
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-[10px] h-6 px-1 bg-muted/30 hover:bg-muted border-dashed"
                        onClick={() => doAction("expand-grid-direction", { direction: "right", count: 2 })}
                        title="Добавить 2 клетки справа"
                      >
                        + Право
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Добавить бойца */}
                <div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowAddCombatant(!showAddCombatant)}
                  >
                    <Plus className="size-3 mr-1" />
                    Добавить бойца
                  </Button>
                  {showAddCombatant && (
                    <div className="mt-2 space-y-2 p-2 border rounded-md bg-background/50">
                      <Input
                        placeholder="Имя"
                        value={newCombatant.name}
                        onChange={(e) => setNewCombatant({ ...newCombatant, name: e.target.value })}
                        className="h-7 text-sm"
                      />
                      <select
                        className="text-xs h-7 w-full rounded border bg-background px-1"
                        value={newCombatant.type}
                        onChange={(e) =>
                          setNewCombatant({
                            ...newCombatant,
                            type: e.target.value as typeof newCombatant.type,
                          })
                        }
                      >
                        <option value="enemy">Враг</option>
                        <option value="npc">NPC</option>
                        <option value="player">Игрок</option>
                        <option value="companion">Спутник</option>
                      </select>
                      <div className="grid grid-cols-2 gap-1 text-xs items-center">
                        <Label className="text-[10px]">HP</Label>
                        <Input
                          type="number"
                          className="h-7 text-xs"
                          value={newCombatant.hpMax}
                          onChange={(e) =>
                            setNewCombatant({ ...newCombatant, hpMax: Number(e.target.value) })
                          }
                        />
                        <Label className="text-[10px]">AC</Label>
                        <Input
                          type="number"
                          className="h-7 text-xs"
                          value={newCombatant.ac}
                          onChange={(e) =>
                            setNewCombatant({ ...newCombatant, ac: Number(e.target.value) })
                          }
                        />
                        <Label className="text-[10px]">Скорость</Label>
                        <Input
                          type="number"
                          className="h-7 text-xs"
                          value={newCombatant.speed}
                          onChange={(e) =>
                            setNewCombatant({ ...newCombatant, speed: Number(e.target.value) })
                          }
                        />
                        <Label className="text-[10px]">ЛОВ мод</Label>
                        <Input
                          type="number"
                          className="h-7 text-xs"
                          value={newCombatant.dexMod}
                          onChange={(e) =>
                            setNewCombatant({ ...newCombatant, dexMod: Number(e.target.value) })
                          }
                        />
                      </div>
                      <Button size="sm" className="w-full" onClick={addCombatant}>
                        Добавить
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Детали выбранного */}
            {selectedCombatant ? (
              <CombatantDetails
                key={selectedCombatant.id}
                combatant={selectedCombatant}
                isDM={isDM}
                onUpdate={(updates) =>
                  doAction("update-combatant", { combatantId: selectedCombatant.id, updates })
                }
                onOpenEditor={() => setEditorForId(selectedCombatant.id)}
                onOpenLibrary={() => {
                  setLibraryTargetCombatant(selectedCombatant);
                  setShowLibrary(true);
                }}
                onResetTurn={() =>
                  doAction("reset-turn", { combatantId: selectedCombatant.id })
                }
                onRemoveCondition={(conditionType) =>
                  doAction("remove-condition", {
                    combatantId: selectedCombatant.id,
                    conditionType,
                  })
                }
                onRemove={() => {
                  if (confirm(`Удалить ${selectedCombatant.name} из боя?`)) {
                    doAction("remove-combatant", { combatantId: selectedCombatant.id });
                  }
                }}
              />
            ) : (
              <div className="text-xs text-muted-foreground text-center py-8">
                {isDM ? "Выбери бойца на сетке или в списке слева" : "Кликните по существу на сетке для осмотра"}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Лог боя — с возможностью растягивания по высоте */}
      {combat.log.length > 0 && (
        <div
          className="border-t bg-card/85 backdrop-blur flex flex-col font-mono relative transition-[height] duration-75"
          style={{ height: `${logHeight}px` }}
        >
          {/* Ресайз-хэндл сверху для вытягивания вверх */}
          <div
            onMouseDown={handleLogResizeStart}
            className="group absolute -top-2 inset-x-0 h-4 cursor-ns-resize flex items-center justify-center z-10 select-none hover:bg-primary/20 transition-colors"
            title="Потяните вверх или вниз, чтобы изменить высоту лога"
          >
            <div className="w-16 h-1.5 rounded-full bg-muted-foreground/40 group-hover:bg-primary transition-colors flex items-center justify-center">
              <GripHorizontal className="size-3 text-background opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          {/* Содержимое лога и кнопки */}
          <div className="flex-1 flex overflow-hidden">
            {/* Список записей */}
            <div
              ref={logContainerRef}
              className="flex-1 overflow-y-auto px-4 py-1.5 space-y-1 text-xs select-text scroll-smooth"
            >
              {combat.log.map((entry, i) => {
                const isLatest = i === combat.log.length - 1;
                return (
                  <div
                    key={i}
                    className={`flex items-baseline gap-1.5 leading-relaxed ${
                      isLatest ? "text-foreground font-semibold" : "text-muted-foreground"
                    }`}
                  >
                    <span className="opacity-50 text-[10px] shrink-0 font-mono">
                      [Р{entry.round}]
                    </span>
                    <span className="shrink-0">{LOG_ICONS[entry.kind] ?? "•"}</span>
                    <span className={logHeight > 90 ? "break-words" : "truncate"}>
                      {entry.text}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Кнопки управления справа */}
            <div className="px-3 py-1.5 border-l flex flex-col justify-between items-center gap-1 shrink-0 bg-muted/20">
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-6 text-muted-foreground hover:text-foreground"
                  onClick={() => setLogHeight((h) => (h > 140 ? 40 : 220))}
                  title={logHeight > 140 ? "Свернуть лог" : "Развернуть лог"}
                >
                  {logHeight > 140 ? (
                    <ChevronDown className="size-3.5" />
                  ) : (
                    <ChevronUp className="size-3.5" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-6 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowFullLog(true)}
                  title="Открыть полный лог"
                >
                  <ScrollText className="size-3.5" />
                </Button>
              </div>
              <div className="text-[9px] text-muted-foreground font-mono">
                {combat.log.length} записей
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Хотбар */}
      {(isDM ? currentCombatant : (isMyTurn ? currentCombatant : myCombatant)) && (
        <Hotbar
          combatant={(isDM ? currentCombatant : (isMyTurn ? currentCombatant : myCombatant))!}
          isMyTurn={isDM ? true : isMyTurn}
          spellNames={spellNames}
          spellParams={spellParams}
          onAttack={startAttack}
          onCastSpell={startSpell}
          onUseAbility={startAbility}
          onDash={() => doAction("dash", { combatantId: (isDM ? currentCombatant : myCombatant)!.id })}
          onDodge={() => doAction("dodge", { combatantId: (isDM ? currentCombatant : myCombatant)!.id })}
          onDisengage={() => doAction("disengage", { combatantId: (isDM ? currentCombatant : myCombatant)!.id })}
          onHelp={() => {
            doAction("help", {
              combatantId: (isDM ? currentCombatant : myCombatant)!.id,
              targetId: selectedCombatantId,
            });
          }}
          onHide={() => doAction("hide", { combatantId: (isDM ? currentCombatant : myCombatant)!.id })}
          onStandUp={() => doAction("stand-up", { combatantId: (isDM ? currentCombatant : myCombatant)!.id })}
          onDropProne={() => doAction("drop-prone", { combatantId: (isDM ? currentCombatant : myCombatant)!.id })}
          onSetFacing={(facing) => doAction("set-facing", { combatantId: (isDM ? currentCombatant : myCombatant)!.id, facing })}
          activeTargeting={targeting}
          onCancelTargeting={cancelTargeting}
          onEndTurn={() => doAction("end-turn")}
          advantage={advantage}
          disadvantage={disadvantage}
          onToggleAdvantage={() => {
            setAdvantage(!advantage);
            if (disadvantage) setDisadvantage(false);
          }}
          onToggleDisadvantage={() => {
            setDisadvantage(!disadvantage);
            if (advantage) setAdvantage(false);
          }}
          onOpenWildShape={() => setShowWildShapeModal(true)}
          onRevertWildShape={() => doAction("revert-wild-shape", { combatantId: (isDM ? currentCombatant : myCombatant)!.id })}
          onDrinkPotion={async (potionId) => {
            const activeId = (isDM ? currentCombatant : myCombatant)?.id;
            if (!activeId) return;
            const res = await doAction("drink-potion", {
              combatantId: activeId,
              potionId,
            });
            if (res?.potionResult) {
              toast.success(`Выпито «${res.potionResult.potionName}»!`, { duration: 3000 });
            }
          }}
        />
      )}

      {/* Выбор формы дикого облика */}
      {showWildShapeModal && (isDM ? currentCombatant : (isMyTurn ? currentCombatant : myCombatant)) && (
        <WildShapeModal
          open={showWildShapeModal}
          onOpenChange={setShowWildShapeModal}
          combatant={(isDM ? currentCombatant : (isMyTurn ? currentCombatant : myCombatant))!}
          onSelectForm={(formId) => {
            doAction("transform-wild-shape", {
              combatantId: (isDM ? currentCombatant : (isMyTurn ? currentCombatant : myCombatant))!.id,
              formId,
            });
          }}
        />
      )}

      {/* Импорт */}
      {showImport && (
        <ImportCharacterModal
          combatId={combat.id}
          gridWidth={combat.gridWidth}
          gridHeight={combat.gridHeight}
          onImported={loadCombat}
          onClose={() => setShowImport(false)}
        />
      )}

      {/* Менеджер Библиотеки */}
      {showLibrary && (
        <LibraryManagerModal
          combatId={combat.id}
          targetCombatant={libraryTargetCombatant}
          onAddedToCombatant={loadCombat}
          onClose={() => {
            setShowLibrary(false);
            setLibraryTargetCombatant(null);
            loadCombat();
            loadSpellNames();
          }}
        />
      )}

      {/* Редактор атак и способностей — для любого типа бойца */}
      {editorCombatant && (
        <AttacksAbilitiesEditor
          combatant={editorCombatant}
          onSave={async (updates) => {
            await doAction("update-combatant", {
              combatantId: editorCombatant.id,
              updates,
            });
          }}
          onClose={() => setEditorForId(null)}
        />
      )}

      {/* Модальное окно полной истории боя */}
      <Dialog open={showFullLog} onOpenChange={setShowFullLog}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScrollText className="size-5" />
              Полная история боя ({combat.log.length} записей)
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-1 font-mono text-xs p-3 border rounded-md bg-muted/20 max-h-[60vh]">
            {combat.log.map((entry, i) => (
              <div key={i} className="py-1 border-b border-border/30 last:border-0 flex items-start gap-2">
                <Badge variant="outline" className="text-[10px] shrink-0 font-mono px-1 py-0">
                  Р{entry.round}
                </Badge>
                <span className="shrink-0">{LOG_ICONS[entry.kind] ?? "•"}</span>
                <span className="text-foreground/90">{entry.text}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Модальное окно выбора роли / персонажа */}
      {showRoleSelector && (
        <RoleSelectorModal
          combatants={combat.combatants}
          currentRole={userRole}
          onSelectRole={handleSelectRole}
          onClose={() => setShowRoleSelector(false)}
        />
      )}

      {/* Модальное окно тактических карт биомов (24) */}
      {showMapPresets && (
        <MapPresetsModal
          isOpen={showMapPresets}
          onClose={() => setShowMapPresets(false)}
          combatId={combat.id}
          onMapApplied={async (updatedCombat) => {
            setCombat(updatedCombat);
            await loadCombat();
          }}
        />
      )}

      {/* Модальное окно пресетов и бестиария */}
      {showPresets && (
        <PresetsModal
          isOpen={showPresets}
          onClose={() => setShowPresets(false)}
          combatId={combat.id}
          onSpawnPreset={async (preset, count) => {
            const res = await fetch("/api/combat/presets/spawn", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ combatId: combat.id, presetId: preset.id, count: count || 1 }),
            });
            if (res.ok) {
              await loadCombat();
            }
          }}
        />
      )}
    </div>
  );
}

// ============ COMBATANT DETAILS ============

function CombatantDetails({
  combatant,
  isDM = true,
  onUpdate,
  onRemove,
  onOpenEditor,
  onOpenLibrary,
  onSaveAsPreset,
  onResetTurn,
  onRemoveCondition,
}: {
  combatant: Combatant;
  isDM?: boolean;
  onUpdate: (updates: Record<string, unknown>) => void;
  onRemove: () => void;
  onOpenEditor: () => void;
  onOpenLibrary?: () => void;
  onSaveAsPreset?: (c: Combatant) => void;
  onResetTurn: () => void;
  onRemoveCondition: (conditionType: string) => void;
}) {
  const [hpInput, setHpInput] = useState(combatant.hpCurrent);
  const [initiativeInput, setInitiativeInput] = useState(combatant.initiative);

  const hpPct = combatant.hpMax > 0 ? (combatant.hpCurrent / combatant.hpMax) * 100 : 0;
  const hpColor = hpPct > 60 ? "bg-emerald-500" : hpPct > 30 ? "bg-amber-500" : "bg-red-500";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div
            className="size-6 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-bold"
            style={{ backgroundColor: combatant.color }}
          >
            {combatant.name.charAt(0).toUpperCase()}
          </div>
          <CardTitle className="text-sm truncate">{combatant.name}</CardTitle>
        </div>
        <div className="flex gap-1 flex-wrap">
          <Badge variant="outline" className="text-[10px]">
            {TYPE_LABELS[combatant.type]}
          </Badge>
          {combatant.className && (
            <Badge variant="outline" className="text-[10px]">
              {combatant.className} {combatant.level}
            </Badge>
          )}
          {combatant.isAIControlled && (
            <Badge variant="outline" className="text-[10px]">
              бот
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        {/* Управление набором (для DM) */}
        {isDM && (
          <div className="grid grid-cols-3 gap-1">
            <Button size="sm" variant="secondary" className="h-7 text-[11px] px-1" onClick={onOpenEditor} title="Редактор статов">
              <Settings2 className="size-3 mr-0.5" />
              Редактор
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-[11px] px-1" onClick={onOpenLibrary} title="Добавить из библиотеки">
              <BookOpen className="size-3 mr-0.5 text-blue-500" />
              Библиотека
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px] px-1 border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 text-purple-900 dark:text-purple-300 font-semibold"
              onClick={() => onSaveAsPreset?.(combatant)}
              title="Сохранить бойца в шаблоны пресетов"
            >
              <Sparkles className="size-3 mr-0.5 text-purple-600 dark:text-purple-400" />
              В пресет
            </Button>
          </div>
        )}

        {/* HP */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="flex items-center gap-1">
              <Heart className="size-3" /> HP
            </span>
            <span className="font-mono">
              {combatant.hpCurrent}/{combatant.hpMax}
              {combatant.hpTemp > 0 && <span className="text-blue-500"> +{combatant.hpTemp}</span>}
            </span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
            <div className={`h-full ${hpColor}`} style={{ width: `${hpPct}%` }} />
          </div>
          {isDM && (
            <>
              <div className="flex gap-1">
                <Input
                  type="number"
                  className="h-7 text-xs"
                  value={hpInput}
                  onChange={(e) => setHpInput(Number(e.target.value))}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2"
                  onClick={() => onUpdate({ hpCurrent: hpInput })}
                >
                  OK
                </Button>
              </div>
              <div className="flex gap-1 mt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-xs flex-1"
                  onClick={() => onUpdate({ hpCurrent: Math.max(0, combatant.hpCurrent - 5) })}
                >
                  −5
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-xs flex-1"
                  onClick={() => onUpdate({ hpCurrent: Math.max(0, combatant.hpCurrent - 10) })}
                >
                  −10
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-xs flex-1"
                  onClick={() =>
                    onUpdate({ hpCurrent: Math.min(combatant.hpMax, combatant.hpCurrent + 5) })
                  }
                >
                  +5
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Статы */}
        <div className="grid grid-cols-3 gap-1 text-center">
          <div className="rounded border bg-muted/30 p-1">
            <div className="text-[10px] text-muted-foreground">AC</div>
            <div className="font-mono font-bold">{effectiveAC(combatant)}</div>
          </div>
          <div className="rounded border bg-muted/30 p-1">
            <div className="text-[10px] text-muted-foreground">Движение</div>
            <div className="font-mono font-bold">
              {remainingMovement(combatant)}/{effectiveSpeed(combatant)}
            </div>
          </div>
          <div className="rounded border bg-muted/30 p-1">
            <div className="text-[10px] text-muted-foreground">ЛОВ</div>
            <div className="font-mono font-bold">
              {combatant.dexMod >= 0 ? "+" : ""}
              {combatant.dexMod}
            </div>
          </div>
        </div>

        {/* Состояния */}
        {combatant.conditions.length > 0 && (
          <div>
            <Label className="text-[10px]">Состояния</Label>
            <div className="flex flex-wrap gap-1 mt-1">
              {combatant.conditions.map((c, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="text-[10px] bg-amber-500/10 gap-1"
                  title={CONDITION_EFFECTS[c.type]?.description}
                >
                  {CONDITION_EFFECTS[c.type]?.name || c.type}
                  {c.duration ? ` (${c.duration})` : ""}
                  {isDM && (
                    <button className="text-red-600" onClick={() => onRemoveCondition(c.type)}>
                      <X className="size-2.5" />
                    </button>
                  )}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Инициатива (для DM) */}
        {isDM && (
          <div>
            <Label className="text-[10px]">Инициатива</Label>
            <div className="flex gap-1">
              <Input
                type="number"
                className="h-7 text-xs"
                value={initiativeInput}
                onChange={(e) => setInitiativeInput(Number(e.target.value))}
              />
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2"
                onClick={() => onUpdate({ initiative: initiativeInput })}
              >
                OK
              </Button>
            </div>
          </div>
        )}

        <div className="text-[10px] text-muted-foreground">
          Позиция: ({combatant.x}, {combatant.y}) • Взгляд:{" "}
          <span className="font-semibold text-amber-500 font-mono">
            {combatant.facing || (combatant.type === "enemy" ? "W" : "E")}
          </span>{" "}
          • Атак: {combatant.attacksPerAction}
        </div>

        {/* Управление (только для DM) */}
        {isDM && (
          <>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-7 text-xs"
                onClick={() => onUpdate({ isAIControlled: !combatant.isAIControlled })}
              >
                {combatant.isAIControlled ? "Отдать игроку" : "Отдать боту"}
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onResetTurn}>
                Сброс ресурсов
              </Button>
            </div>

            <Button
              size="sm"
              variant="outline"
              className="w-full h-7 text-xs"
              onClick={() => onUpdate({ isHidden: !combatant.isHidden })}
            >
              {combatant.isHidden ? (
                <>
                  <EyeOff className="size-3 mr-1" /> Скрыт
                </>
              ) : (
                <>
                  <Eye className="size-3 mr-1" /> Видим
                </>
              )}
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="w-full h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-500/10"
              onClick={onRemove}
            >
              <Trash2 className="size-3 mr-1" />
              Удалить из боя
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
