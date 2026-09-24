"use client";

import { useState, useEffect, useRef, useCallback, useMemo, useSyncExternalStore } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

const emptySubscribe = () => () => {};

function useIsMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}
import { useDnDStore, type Character, type Campaign } from "@/lib/store";
import { copyToClipboard } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  Send,
  Dices,
  Trash2,
  Plus,
  Settings,
  BookOpen,
  Brain,
  Scroll,
  Users,
  Loader2,
  Sparkles,
  Swords,
  Coins,
  Globe,
  Search,
  PanelRightClose,
  PanelRightOpen,
  ChevronDown,
  ChevronUp,
  LogIn,
  Copy,
  ExternalLink,
  Lock,
  Crown,
  User,
  X,
  CheckCircle2,
  Radio,
  Clock,
  LogOut,
  Shield,
  Heart,
  Share2,
} from "lucide-react";
import { CharacterCard } from "./CharacterCard";
import { CombatView, type CombatEndSummary } from "@/components/combat/CombatView";
import { ModelPickerModal } from "./ModelPickerModal";
import { CostStatsModal } from "./CostStatsModal";
import { D20RollModal } from "./D20RollModal";
import { CreateRoomModal } from "@/components/room/CreateRoomModal";
import { JoinRoomModal } from "@/components/room/JoinRoomModal";
import { CharacterPickerModal } from "@/components/room/CharacterPickerModal";
import { SupabaseAuthModal } from "@/components/auth/SupabaseAuthModal";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { rollDie } from "@/lib/dnd/d20-helper";
import { formatRubles, formatTokens, type CampaignAiStats } from "@/lib/ai/cost";
import { toast } from "sonner";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

// Сюжетная арка — то, что отдаёт GET /api/campaign/arc
interface StoryAct {
  name: string;
  levelFrom: number;
  levelTo: number;
  goal: string;
  summary: string;
  scenes: Array<{ name: string; location: string; description: string; encounter: string }>;
  twist: string;
  branches: Array<{ ifPlayer: string; then: string }>;
  rewards: string;
}

interface StoryArc {
  title: string;
  premise: string;
  mainThreat: string;
  levelFrom: number;
  levelTo: number;
  villains: Array<{
    name: string;
    role: string;
    motivation: string;
    secret: string;
    appearsInAct?: number;
  }>;
  acts: StoryAct[];
  finale: string;
  generatedAt: string;
  model: string;
}

interface ArcState {
  status: "none" | "generating" | "ready" | "failed";
  progress: {
    stage: string;
    stageLabel: string;
    actsTotal: number;
    actsDone: number;
    error?: string;
  } | null;
  model: string | null;
  currentAct: number;
  levelFrom: number;
  levelTo: number;
  arc: StoryArc | null;
}

// Извлекает текст из UIMessage (AI SDK 7.x использует parts вместо content)
function getMessageText(m: {
  role: string;
  content?: string;
  parts?: Array<{ type: string; text?: string }>;
}): string {
  // Вариант 1: старый формат (content — строка)
  if (typeof m.content === "string" && m.content.length > 0) {
    return m.content;
  }
  // Вариант 2: новый формат (parts — массив объектов { type: 'text', text: '...' })
  if (Array.isArray(m.parts)) {
    return m.parts
      .filter((p) => p.type === "text" && typeof p.text === "string")
      .map((p) => p.text as string)
      .join("");
  }
  return "";
}

// Извлекает сообщение об ошибке из UIMessage (если стрим упал с ошибкой)
function getMessageError(m: {
  parts?: Array<{ type: string; errorText?: string }>;
}): string | null {
  if (!Array.isArray(m.parts)) return null;
  const errorPart = m.parts.find(
    (p) => (p.type === "error" || p.type === "step-error") && typeof p.errorText === "string"
  );
  return errorPart?.errorText || null;
}

export function DnDApp({ initialRoomCode }: { initialRoomCode?: string } = {}) {
  const [sidebarTab, setSidebarTab] = useState<string>("characters");
  const [input, setInput] = useState("");
  const [showSetup, setShowSetup] = useState(false);
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  const [showCampaignList, setShowCampaignList] = useState(false);
  const [showCombatView, setShowCombatView] = useState(false);
  const [activeCombat, setActiveCombat] = useState<{ id: string; name: string; round: number } | null>(null);

  // Параметры создания новой кампании
  const [newCampaignName, setNewCampaignName] = useState("");
  const [newCampaignStartingLevel, setNewCampaignStartingLevel] = useState(1);
  const [newCampaignSetting, setNewCampaignSetting] = useState("Forgotten Realms");
  const [newCampaignTone, setNewCampaignTone] = useState("heroic");
  const [newCampaignDifficulty, setNewCampaignDifficulty] = useState("normal");
  const [newCampaignLanguage, setNewCampaignLanguage] = useState("ru");
  const [newCampaignDmStyle, setNewCampaignDmStyle] = useState("balanced");
  const [newCampaignRuleStrictness, setNewCampaignRuleStrictness] = useState("standard");
  const [newCampaignRestFrequency, setNewCampaignRestFrequency] = useState("standard");
  const [newCampaignWorldDescription, setNewCampaignWorldDescription] = useState("");
  const [newCampaignCustomDmNotes, setNewCampaignCustomDmNotes] = useState("");
  const [newCampaignPartyTies, setNewCampaignPartyTies] = useState("tight_knit");
  const [creatingInProgress, setCreatingInProgress] = useState(false);

  // Сюжетная арка активной кампании
  const [arcState, setArcState] = useState<ArcState | null>(null);
  const [showArcDebug, setShowArcDebug] = useState(false);
  const [arcSpoilerConfirmed, setArcSpoilerConfirmed] = useState(false);
  const [showStoryConfig, setShowStoryConfig] = useState(false);
  const [savingStorySettings, setSavingStorySettings] = useState(false);

  // Список существующих кампаний
  const [campaignsList, setCampaignsList] = useState<Campaign[]>([]);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingCharacterId, setDeletingCharacterId] = useState<string | null>(null);

  // Состояние проверки ключа
  const [testingKey, setTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ valid: boolean; message: string } | null>(null);

  // Импорт персонажа с сайта-генератора
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [shareCode, setShareCode] = useState("");
  const [importType, setImportType] = useState("player");

  // Защита от SSR Hydration Mismatch: хук isMounted через useSyncExternalStore
  const isMounted = useIsMounted();

  const [apiKey, setApiKey] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("ai_api_key") || "";
  });
  const [model, setModel] = useState(() => {
    if (typeof window === "undefined") return "deepseek/deepseek-v4.1-flash";
    return localStorage.getItem("ai_model") || "deepseek/deepseek-v4.1-flash";
  });
  // Дешёвая модель для служебных шагов (бухгалтерия) и сжатия истории.
  const [cheapModel, setCheapModel] = useState(() => {
    if (typeof window === "undefined") return "deepseek/deepseek-v4-flash";
    return localStorage.getItem("ai_cheap_model") || "deepseek/deepseek-v4-flash";
  });
  // Модель для генерации сюжетной арки и адаптивных глав.
  const [storyModel, setStoryModel] = useState(() => {
    if (typeof window === "undefined") return "deepseek/deepseek-v4.1-flash";
    return localStorage.getItem("ai_story_model") || "deepseek/deepseek-v4.1-flash";
  });
  const [authMode, setAuthMode] = useState<"bearer" | "x-api-key" | "raw">(() => {
    if (typeof window === "undefined") return "bearer";
    return (localStorage.getItem("ai_auth_mode") as "bearer" | "x-api-key" | "raw") || "bearer";
  });
  const [baseURL, setBaseURL] = useState(() => {
    if (typeof window === "undefined") return "https://polza.ai/api/v1";
    return localStorage.getItem("ai_base_url") || "https://polza.ai/api/v1";
  });
  // Статистика трат и токенов за кампанию/сессию
  const [campaignStats, setCampaignStats] = useState<CampaignAiStats>(() => {
    if (typeof window === "undefined") {
      return { totalCostRub: 0, totalTokens: 0, inputTokens: 0, outputTokens: 0, cachedTokens: 0, turnsCount: 0 };
    }
    try {
      const saved = localStorage.getItem("ai_campaign_stats");
      if (saved) return JSON.parse(saved);
    } catch {}
    return { totalCostRub: 0, totalTokens: 0, inputTokens: 0, outputTokens: 0, cachedTokens: 0, turnsCount: 0 };
  });
  const [showCostModal, setShowCostModal] = useState(false);
  const [showD20Modal, setShowD20Modal] = useState(false);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showJoinRoomModal, setShowJoinRoomModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const { user, signOut: supabaseSignOut, getAuthToken } = useSupabaseAuth();
  const [accountCharacters, setAccountCharacters] = useState<Array<{
    id: string;
    name: string;
    race: string;
    className: string;
    level: number;
    ac: number;
    hp: string;
    portrait_url: string | null;
    rawSheet: Record<string, any>;
  }>>([]);
  const [loadingAccountCharacters, setLoadingAccountCharacters] = useState(false);

  const loadAccountCharacters = useCallback(async () => {
    if (!user) {
      setAccountCharacters([]);
      return;
    }
    setLoadingAccountCharacters(true);
    try {
      const token = getAuthToken();
      const res = await fetch("/api/account/characters", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (res.ok && data.characters) {
        setAccountCharacters(data.characters);
      }
    } catch (err) {
      console.error("Failed to load account characters", err);
    } finally {
      setLoadingAccountCharacters(false);
    }
  }, [user, getAuthToken]);

  useEffect(() => {
    if (showImport && user) {
      loadAccountCharacters();
    }
  }, [showImport, user, loadAccountCharacters]);

  const [showOutOfScene, setShowOutOfScene] = useState(false);
  const [activePickerRole, setActivePickerRole] = useState<"dm" | "cheap" | "story" | null>(null);
  // Список моделей с провайдера
  const [modelsList, setModelsList] = useState<Array<{
    id: string;
    name: string;
    supports_tools?: boolean;
    context_length?: number;
    pricing?: { input?: number; output?: number; cache_read?: number };
  }>>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Состояние боковой панели (ширина и сворачивание)
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    if (typeof window === "undefined") return 340;
    try {
      const saved = localStorage.getItem("dnd_sidebar_width");
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 260 && parsed <= 650) return parsed;
      }
    } catch {}
    return 340;
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("dnd_sidebar_collapsed") === "true";
    } catch {}
    return false;
  });
  const isResizingSidebarRef = useRef(false);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("dnd_sidebar_collapsed", next ? "true" : "false");
      } catch {}
      return next;
    });
  }, []);

  const handleStartResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingSidebarRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingSidebarRef.current) return;
      const newWidth = Math.min(650, Math.max(260, window.innerWidth - moveEvent.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      isResizingSidebarRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      setSidebarWidth((curr) => {
        try {
          localStorage.setItem("dnd_sidebar_width", curr.toString());
        } catch {}
        return curr;
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, []);

  const {
    activeCampaign,
    setActiveCampaign,
    characters,
    setCharacters,
    memories,
    setMemories,
    events,
    setEvents,
    setChatMessages,
  } = useDnDStore();

  const refreshMemory = useCallback(
    async (campaignId?: string) => {
      const cid = campaignId || activeCampaign?.id;
      if (!cid) return;
      try {
        const res = await fetch(`/api/memory?campaignId=${cid}`);
        if (res.ok) {
          const data = await res.json();
          setMemories(data.memories || []);
          setEvents(data.events || []);
        }
      } catch (e) {
        console.error(e);
      }
    },
    [activeCampaign?.id, setMemories, setEvents]
  );

  const refreshActiveCampaign = useCallback(async () => {
    try {
      const res = await fetch("/api/campaign/active");
      if (res.ok) {
        const data = await res.json();
        setActiveCampaign(data.campaign);
        if (data.campaign) {
          setCharacters(data.campaign.characters || []);
          refreshMemory(data.campaign.id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, [setActiveCampaign, setCharacters, refreshMemory]);

  const refreshData = useCallback(async () => {
    await refreshActiveCampaign();
  }, [refreshActiveCampaign]);

  const playerCharacters = useMemo(
    () => characters.filter((c) => c.type === "player"),
    [characters]
  );

  const targetLevel = useMemo(() => {
    if (playerCharacters.length > 0) {
      return Math.max(...playerCharacters.map((c) => Number(c.level || 1)));
    }
    return activeCampaign?.startingLevel ?? activeCampaign?.levelFrom ?? 1;
  }, [playerCharacters, activeCampaign?.startingLevel, activeCampaign?.levelFrom]);

  // Сетевая комната активной кампании
  const [activeRoom, setActiveRoom] = useState<{
    id: string;
    code: string;
    name: string;
    status: string;
    startingLevel: number;
    hostUserId?: string;
    campaign_settings?: any;
    participants?: any[];
  } | null>(null);
  const [loadingRoom, setLoadingRoom] = useState(false);
  const [closingRoom, setClosingRoom] = useState(false);
  const prevCampaignIdRef = useRef<string | null>(null);

  // При смене кампании: деактивируем сетевую комнату предыдущей кампании и запрашиваем активную для новой
  useEffect(() => {
    const currentId = activeCampaign?.id;
    const prevId = prevCampaignIdRef.current;

    if (prevId && prevId !== currentId) {
      if (!initialRoomCode) {
        fetch(`/api/room/campaign/${prevId}`, { method: "DELETE" }).catch(() => {});
        setActiveRoom(null);
      }
    }

    prevCampaignIdRef.current = currentId || null;

    if (currentId) {
      setLoadingRoom(true);
      fetch(`/api/room/campaign/${currentId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data?.room && data.room.status === "active") {
            setActiveRoom({
              ...data.room,
              participants: data.participants || data.room.participants || [],
            });
          } else if (!initialRoomCode) {
            setActiveRoom(null);
          }
        })
        .catch(() => {
          if (!initialRoomCode) setActiveRoom(null);
        })
        .finally(() => setLoadingRoom(false));
    } else if (!initialRoomCode) {
      setActiveRoom(null);
    }
  }, [activeCampaign?.id, initialRoomCode]);

  // Подключение к комнате по прямой ссылке /room/[code]
  useEffect(() => {
    if (!initialRoomCode) return;
    const cleanCode = initialRoomCode.trim().toUpperCase();

    setLoadingRoom(true);
    fetch(`/api/room/${encodeURIComponent(cleanCode)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then(async (data) => {
        if (data?.room) {
          const roomObj = {
            ...data.room,
            participants: data.participants || data.room.participants || [],
          };
          setActiveRoom(roomObj);
          setSidebarTab("room");

          // Если у комнаты есть привязанная кампания, активируем её для игрока
          const campId = data.room.campaignId || data.room.campaignSettings?.campaignId || data.room.campaign_settings?.campaignId;
          if (campId) {
            try {
              await fetch("/api/campaign/activate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ campaignId: campId }),
              });
            } catch (e) {
              console.error("Не удалось активировать кампанию комнаты:", e);
            }
            refreshActiveCampaign();
          }

          // Если пользователь авторизован, но ещё не в отряде комнаты со снапшотом героя — предлагаем выбрать персонажа
          const isParticipant = roomObj.participants.some(
            (p: any) => p.userId === user?.id && p.characterSnapshot
          );
          if (user && !isParticipant) {
            setShowPicker(true);
          }
        } else {
          toast.error(`Сетевая комната "${cleanCode}" не найдена`);
        }
      })
      .catch((err) => {
        console.error("Ошибка загрузки комнаты:", err);
        toast.error("Не удалось загрузить данные сетевой комнаты");
      })
      .finally(() => setLoadingRoom(false));
  }, [initialRoomCode, refreshActiveCampaign, user]);

  const handleRoomJoined = useCallback(
    async (room: any, participants: any[]) => {
      const roomObj = {
        ...room,
        participants: participants || room.participants || [],
      };
      setActiveRoom(roomObj);
      setSidebarTab("room");

      // Обновляем адресную строку браузера без перезагрузки
      try {
        if (typeof window !== "undefined" && room.code) {
          window.history.pushState({}, "", `/room/${encodeURIComponent(room.code)}`);
        }
      } catch {}

      // Если к комнате привязана кампания, активируем её
      const campId = room.campaignId || room.campaignSettings?.campaignId || room.campaign_settings?.campaignId;
      if (campId) {
        try {
          await fetch("/api/campaign/activate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ campaignId: campId }),
          });
          await refreshActiveCampaign();
        } catch (e) {
          console.error("Не удалось активировать кампанию комнаты:", e);
        }
      }

      // Проверяем, есть ли текущий пользователь среди участников комнаты с персонажем
      const isParticipant = (participants || room.participants || []).some(
        (p: any) => p.userId === user?.id && p.characterSnapshot
      );

      if (user && !isParticipant) {
        setShowPicker(true);
      } else if (!user) {
        toast.info("Войдите в аккаунт, чтобы привязать своего героя к столу");
      }
    },
    [user, refreshActiveCampaign]
  );

  async function openCampaignForFriends() {
    if (!activeCampaign) return;
    setLoadingRoom(true);
    try {
      const token = getAuthToken();
      const res = await fetch("/api/room/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          campaignId: activeCampaign.id,
          name: activeCampaign.name,
          startingLevel: targetLevel,
          partyBond: "strangers",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(`Ошибка открытия комнаты: ${err.error || res.status}`);
        return;
      }

      const data = await res.json();
      setActiveRoom({
        ...data.room,
        participants: data.participants || data.room.participants || [],
      });
      setSidebarTab("room");
      toast.success(`Комната ${data.room.code} открыта для друзей!`);
    } catch (e: any) {
      toast.error(`Ошибка: ${e.message}`);
    } finally {
      setLoadingRoom(false);
    }
  }

  async function closeCampaignForFriends() {
    if (!activeCampaign) return;
    setClosingRoom(true);
    try {
      const res = await fetch(`/api/room/campaign/${activeCampaign.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(`Ошибка: ${err.error || "Не удалось закрыть комнату"}`);
        return;
      }
      setActiveRoom(null);
      setSidebarTab("characters");
      toast.info("Сетевая комната закрыта");
    } catch (e: any) {
      toast.error(`Ошибка: ${e.message}`);
    } finally {
      setClosingRoom(false);
    }
  }

  async function leaveRoom() {
    if (!activeRoom) return;
    setActiveRoom(null);
    setSidebarTab("characters");
    if (initialRoomCode && typeof window !== "undefined") {
      window.history.pushState({}, "", "/");
    }
    toast.info("Вы вышли из сетевой комнаты");
  }

  async function copyRoomLink() {
    if (!activeRoom) return;
    const link = `${window.location.origin}/room/${activeRoom.code}`;
    const ok = await copyToClipboard(link);
    if (ok) {
      toast.success("Ссылка на комнату скопирована!");
    } else {
      toast.info(`Ссылка на комнату: ${link}`);
    }
  }

  // В AI SDK 7.x опции api/body задаются на транспорте, а не на useChat.
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({
          campaignId: activeCampaign?.id,
          apiKey,
          model,
          cheapModel,
          authMode,
          baseURL,
        }),
      }),
    [activeCampaign?.id, apiKey, model, cheapModel, authMode, baseURL]
  );

  const { messages, setMessages, status, error, sendMessage, regenerate, stop } = useChat({
    transport,
    onError: (err) => {
      console.error("Chat error:", err);
      toast.error(`Ошибка чата: ${err.message}`);
    },
    onFinish: (message) => {
      refreshData();
      // Фоновый scene-synchronizer (deepseek-v4-flash) обновляет статус сцены/NPC за ~2-4.5с.
      // Двухэтапный опрос (2.5с и 5.5с) гарантирует отображение без ручной перезагрузки (F5)
      setTimeout(() => {
        refreshActiveCampaign();
      }, 2500);
      setTimeout(() => {
        refreshActiveCampaign();
      }, 5500);
      // Извлекаем расход токенов и стоимость из metadata ответа
      const meta = (message as any)?.metadata;
      if (meta && meta.usage) {
        setCampaignStats((prev) => {
          const u = meta.usage;
          const cost = meta.costRub ?? 0;
          return {
            totalCostRub: Number((prev.totalCostRub + cost).toFixed(4)),
            totalTokens: prev.totalTokens + (u.totalTokens || 0),
            inputTokens: prev.inputTokens + (u.inputTokens || 0),
            outputTokens: prev.outputTokens + (u.outputTokens || 0),
            cachedTokens: prev.cachedTokens + (u.cachedTokens || 0),
            turnsCount: prev.turnsCount + 1,
          };
        });
      }
    },
  });

  // Алиасы для совместимости со старым кодом
  const isLoading = status === "submitted" || status === "streaming";

  // Загружаем активную кампанию при старте
  useEffect(() => {
    refreshActiveCampaign();
  }, [refreshActiveCampaign]);

  // Периодический опрос участников комнаты, кампании и истории чата в мультиплеере
  useEffect(() => {
    if (!activeRoom || !activeCampaign) return;

    const interval = setInterval(async () => {
      // 1. Обновляем участников комнаты
      try {
        const res = await fetch(`/api/room/${encodeURIComponent(activeRoom.code)}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.room) {
            setActiveRoom((prev) => {
              if (!prev) return data.room;
              return {
                ...prev,
                ...data.room,
                participants: data.participants || data.room.participants || prev.participants || [],
              };
            });
          }
        }
      } catch {}

      // 2. Обновляем состояние персонажей кампании
      refreshActiveCampaign();

      // 3. Синхронизируем чат, если мы сейчас сами не стримим
      if (!isLoading) {
        try {
          const chatRes = await fetch(`/api/chat/history?campaignId=${activeCampaign.id}`);
          if (chatRes.ok) {
            const chatData = await chatRes.json();
            if (Array.isArray(chatData.messages) && chatData.messages.length > 0) {
              setMessages((prev) => {
                if (chatData.messages.length !== prev.length) {
                  return chatData.messages;
                }
                const lastPrev = prev[prev.length - 1];
                const lastNew = chatData.messages[chatData.messages.length - 1];
                if (lastPrev?.id !== lastNew?.id) {
                  return chatData.messages;
                }
                return prev;
              });
            }
          }
        } catch {}
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [activeRoom?.code, activeCampaign?.id, isLoading, refreshActiveCampaign, setMessages]);

  // История чата из БД: useChat стартует с пустого списка, поэтому после
  // перезагрузки страницы диалог нужно восстановить вручную. Зависимость —
  // только id: refreshData() создаёт новый объект кампании после каждого
  // ответа, и реакция на сам объект стирала бы только что полученные сообщения.
  const loadedHistoryFor = useRef<string | null>(null);
  useEffect(() => {
    const campaignId = activeCampaign?.id;
    if (!campaignId || loadedHistoryFor.current === campaignId) return;
    loadedHistoryFor.current = campaignId;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/chat/history?campaignId=${campaignId}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        // Ставим всегда, в том числе пустой список: при переходе в другую
        // кампанию иначе остались бы сообщения предыдущей.
        if (Array.isArray(data.messages)) {
          setMessages(data.messages);

          // Если в текущей сессии счётчик пуст, а в истории есть метаданные — восстановим сумму
          setCampaignStats((prev) => {
            if (prev.turnsCount > 0) return prev;
            let histCost = 0;
            let histTotal = 0;
            let histInput = 0;
            let histOutput = 0;
            let histCached = 0;
            let turns = 0;
            for (const msg of data.messages) {
              const meta = (msg as any)?.metadata;
              if (msg.role === "assistant" && meta?.usage) {
                turns++;
                histCost += meta.costRub || 0;
                histTotal += meta.usage.totalTokens || 0;
                histInput += meta.usage.inputTokens || 0;
                histOutput += meta.usage.outputTokens || 0;
                histCached += meta.usage.cachedTokens || 0;
              }
            }
            if (turns > 0) {
              return {
                totalCostRub: Number(histCost.toFixed(4)),
                totalTokens: histTotal,
                inputTokens: histInput,
                outputTokens: histOutput,
                cachedTokens: histCached,
                turnsCount: turns,
              };
            }
            return prev;
          });
        }
      } catch (e) {
        console.error("Не удалось загрузить историю чата:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeCampaign?.id, setMessages]);

  // Сохраняем настройки при изменении (только на смонтированном клиенте)
  useEffect(() => {
    if (!isMounted) return;
    localStorage.setItem("ai_api_key", apiKey);
  }, [apiKey, isMounted]);
  useEffect(() => {
    if (!isMounted) return;
    localStorage.setItem("ai_base_url", baseURL);
  }, [baseURL, isMounted]);
  useEffect(() => {
    if (!isMounted) return;
    localStorage.setItem("ai_campaign_stats", JSON.stringify(campaignStats));
  }, [campaignStats, isMounted]);
  useEffect(() => {
    if (!isMounted) return;
    localStorage.setItem("ai_model", model);
  }, [model, isMounted]);
  useEffect(() => {
    if (!isMounted) return;
    localStorage.setItem("ai_cheap_model", cheapModel);
  }, [cheapModel, isMounted]);
  useEffect(() => {
    if (!isMounted) return;
    localStorage.setItem("ai_story_model", storyModel);
  }, [storyModel, isMounted]);
  useEffect(() => {
    if (!isMounted) return;
    localStorage.setItem("ai_auth_mode", authMode);
  }, [authMode, isMounted]);

  // Автоскролл вниз. Восстановленную историю прокручиваем мгновенно: плавная
  // анимация через сотню сообщений тянулась бы несколько секунд.
  const didInitialScroll = useRef(false);
  useEffect(() => {
    if (messages.length === 0) return;
    messagesEndRef.current?.scrollIntoView({
      behavior: didInitialScroll.current ? "smooth" : "auto",
    });
    didInitialScroll.current = true;
  }, [messages]);

  async function createCampaign() {
    if (!newCampaignName.trim()) {
      toast.error("Введите название кампании");
      return;
    }
    setCreatingInProgress(true);
    try {
      const res = await fetch("/api/campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCampaignName.trim(),
          startingLevel: newCampaignStartingLevel,
          levelFrom: newCampaignStartingLevel,
          levelTo: Math.min(20, newCampaignStartingLevel + 4),
          setting: newCampaignSetting,
          tone: newCampaignTone,
          difficulty: newCampaignDifficulty,
          language: newCampaignLanguage,
          dmStyle: newCampaignDmStyle,
          ruleStrictness: newCampaignRuleStrictness,
          restFrequency: newCampaignRestFrequency,
          partyTies: newCampaignPartyTies,
          makeActive: true,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(`Ошибка: ${err.error || "Не удалось создать кампанию"}`);
        return;
      }

      toast.success("Кампания создана и выбрана!");
      setCreatingCampaign(false);
      setNewCampaignName("");
      setNewCampaignStartingLevel(1);
      await refreshActiveCampaign();
    } catch (e) {
      toast.error(`Ошибка: ${(e as Error).message}`);
    } finally {
      setCreatingInProgress(false);
    }
  }

  // Запуск генерации арки. Сервер отвечает сразу, дальше следим через опрос.
  async function startArcGeneration(campaignId: string, force = false) {
    try {
      const res = await fetch("/api/campaign/arc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          model,
          apiKey,
          authMode,
          baseURL,
          force,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(`Не удалось запустить генерацию: ${err.error || res.status}`);
        return;
      }
      const data = await res.json();
      toast.info("Генерирую завязку мира и вводный Акт 1 (~20-30 сек).");
      const lvlFrom = activeCampaign?.startingLevel ?? activeCampaign?.levelFrom ?? 1;
      const lvlTo = activeCampaign?.levelTo ?? Math.min(20, lvlFrom + 4);
      setArcState({
        status: "generating",
        progress: {
          stage: "skeleton",
          stageLabel: "Создаю макро-завязку и вводный Акт 1...",
          actsTotal: data.actsTotal,
          actsDone: 0,
        },
        model: data.model,
        currentAct: 0,
        levelFrom: lvlFrom,
        levelTo: lvlTo,
        arc: null,
      });
    } catch (e) {
      toast.error(`Ошибка запуска генерации: ${(e as Error).message}`);
    }
  }

  const [generatingNextAct, setGeneratingNextAct] = useState(false);

  // Запуск генерации следующего акта (подтверждение человека-мастера)
  async function startNextActGeneration(campaignId: string, outcome?: string) {
    if (!apiKey && !process.env.NEXT_PUBLIC_AI_API_KEY) {
      toast.error("Введите API ключ в настройках перед генерацией следующего акта");
      openSetup();
      return;
    }
    setGeneratingNextAct(true);
    try {
      const res = await fetch("/api/campaign/arc/next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          outcome,
          model,
          apiKey,
          authMode,
          baseURL,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(`Не удалось запустить генерацию акта: ${err.error || res.status}`);
        return;
      }
      toast.info("Генерирую следующий акт на основе выборов героев (~20-30 сек)...");
      await loadArcState(campaignId);
    } catch (e: any) {
      toast.error(`Ошибка генерации следующего акта: ${e.message}`);
    } finally {
      setGeneratingNextAct(false);
    }
  }

  const loadArcState = useCallback(async (campaignId: string) => {
    try {
      const res = await fetch(`/api/campaign/arc?campaignId=${campaignId}`);
      if (!res.ok) return null;
      const data: ArcState = await res.json();
      setArcState(data);
      return data;
    } catch (e) {
      console.error("Не удалось загрузить состояние истории:", e);
      return null;
    }
  }, []);

  // Состояние истории при смене кампании
  useEffect(() => {
    const campaignId = activeCampaign?.id;
    if (!campaignId) return;

    setShowStoryConfig(false);
    if (activeCampaign.setting) setNewCampaignSetting(activeCampaign.setting);
    if (activeCampaign.tone) setNewCampaignTone(activeCampaign.tone);
    if (activeCampaign.difficulty) setNewCampaignDifficulty(activeCampaign.difficulty);
    if (activeCampaign.dmStyle) setNewCampaignDmStyle(activeCampaign.dmStyle);
    if (activeCampaign.customDmNotes) setNewCampaignCustomDmNotes(activeCampaign.customDmNotes);
    if (activeCampaign.partyTies) setNewCampaignPartyTies(activeCampaign.partyTies);

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/campaign/arc?campaignId=${campaignId}`);
        if (!res.ok || cancelled) return;
        const data: ArcState = await res.json();
        if (!cancelled) {
          setArcState(data);
        }
      } catch (e) {
        console.error("Не удалось загрузить состояние истории:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeCampaign]);

  const loadActiveCombat = useCallback(async (campaignId: string) => {
    try {
      const res = await fetch(`/api/combat/active?campaignId=${campaignId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.combat && data.combat.status === "active") {
          setActiveCombat({
            id: data.combat.id,
            name: data.combat.name,
            round: data.combat.round,
          });
        } else {
          setActiveCombat(null);
        }
      }
    } catch (e) {
      console.error("Failed to load active combat:", e);
    }
  }, []);

  useEffect(() => {
    const campaignId = activeCampaign?.id;
    if (!campaignId) {
      setActiveCombat(null);
      return;
    }

    // Сразу сбрасываем бой предыдущей кампании, чтобы не было мерцания чужого боя
    setActiveCombat(null);

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/combat/active?campaignId=${campaignId}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) {
          if (data.combat && data.combat.status === "active") {
            setActiveCombat({
              id: data.combat.id,
              name: data.combat.name,
              round: data.combat.round,
            });
          } else {
            setActiveCombat(null);
          }
        }
      } catch (e) {
        console.error("Failed to load active combat:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeCampaign?.id, messages.length]);

  // Пока история пишется — опрашиваем прогресс. Генерация идёт минутами,
  // поэтому раз в 3 секунды: чаще незачем, этапы всё равно длинные.
  useEffect(() => {
    const campaignId = activeCampaign?.id;
    if (!campaignId || arcState?.status !== "generating") return;
    const timer = setInterval(async () => {
      const data = await loadArcState(campaignId);
      if (data?.status === "ready") {
        toast.success(`История «${data.arc?.title || "готова"}» написана!`);
      } else if (data?.status === "failed") {
        toast.error(`Не удалось написать историю: ${data.progress?.error || "неизвестная ошибка"}`);
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [activeCampaign?.id, arcState?.status, loadArcState]);

  async function loadCampaignsList() {
    try {
      const res = await fetch("/api/campaign/list");
      if (res.ok) {
        const data = await res.json();
        setCampaignsList(data.campaigns || []);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function activateCampaign(campaignId: string) {
    setActivatingId(campaignId);
    try {
      const res = await fetch("/api/campaign/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId }),
      });
      if (res.ok) {
        toast.success("Кампания активирована!");
        setShowCampaignList(false);
        await refreshActiveCampaign();
      } else {
        toast.error("Не удалось активировать кампанию");
      }
    } catch (e) {
      toast.error(`Ошибка: ${(e as Error).message}`);
    } finally {
      setActivatingId(null);
    }
  }

  async function deleteCampaign(campaignId: string, campaignName: string) {
    // Используем confirm через window — простой и надёжный способ
    const confirmed = window.confirm(
      `Удалить кампанию "${campaignName}"?\n\n` +
        `Будут удалены ВСЕ данные: персонажи, события, памяти, сообщения чата.\n` +
        `Это действие НЕЛЬЗЯ отменить.`
    );
    if (!confirmed) return;

    setDeletingId(campaignId);
    try {
      const res = await fetch("/api/campaign/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || "Кампания удалена");
        // Обновляем список
        await loadCampaignsList();
        // Если удалили активную — обновим activeCampaign
        if (activeCampaign?.id === campaignId) {
          await refreshActiveCampaign();
        }
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(`Ошибка: ${err.error || "Не удалось удалить"}`);
      }
    } catch (e) {
      toast.error(`Ошибка: ${(e as Error).message}`);
    } finally {
      setDeletingId(null);
    }
  }

  async function deleteCharacter(character: { id: string; name: string }) {
    const confirmed = window.confirm(
      `Удалить персонажа "${character.name}"?\n\n` +
        `Он исчезнет из памяти Мастера и из контекста сцены.\n` +
        `Это действие НЕЛЬЗЯ отменить.`
    );
    if (!confirmed) return;

    setDeletingCharacterId(character.id);
    try {
      const res = await fetch(`/api/character?id=${encodeURIComponent(character.id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success(`Персонаж "${character.name}" удалён`);
        await refreshActiveCampaign();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(`Ошибка: ${err.error || "Не удалось удалить"}`);
      }
    } catch (e) {
      toast.error(`Ошибка: ${(e as Error).message}`);
    } finally {
      setDeletingCharacterId(null);
    }
  }

  async function toggleCharacterInScene(character: Character, nextInScene: boolean) {
    // Оптимистичное обновление локального состояния
    setCharacters(
      characters.map((c) =>
        c.id === character.id ? { ...c, inScene: nextInScene } : c
      )
    );
    try {
      const res = await fetch("/api/character", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: character.id,
          inScene: nextInScene,
        }),
      });
      if (res.ok) {
        toast.success(
          nextInScene
            ? `«${character.name}» в активной сцене`
            : `«${character.name}» перемещён в «Остальной мир»`
        );
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(`Ошибка: ${err.error || "Не удалось обновить статус сцены"}`);
        await refreshActiveCampaign();
      }
    } catch (e) {
      toast.error(`Ошибка: ${(e as Error).message}`);
      await refreshActiveCampaign();
    }
  }

  async function testApiKey() {
    if (!apiKey.trim()) {
      setTestResult({ valid: false, message: "Введите API ключ" });
      return;
    }
    setTestingKey(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/test-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          model: model.trim(),
          baseURL: baseURL.trim(),
          authMode,
        }),
      });
      const data = await res.json();
      if (data.valid) {
        setTestResult({ valid: true, message: data.message || "✅ Ключ валиден!" });
        toast.success("API ключ работает!");
      } else {
        setTestResult({ valid: false, message: data.error || "Ключ невалиден" });
        toast.error(data.error || "Ключ невалиден");
      }
    } catch (e) {
      const msg = `Сетевая ошибка: ${(e as Error).message}`;
      setTestResult({ valid: false, message: msg });
      toast.error(msg);
    } finally {
      setTestingKey(false);
    }
  }

  async function loadModels(customBaseURL?: string) {
    setLoadingModels(true);
    const targetBase = (customBaseURL ?? baseURL).trim();
    try {
      const q = new URLSearchParams();
      if (targetBase) q.set("baseURL", targetBase);
      if (apiKey.trim()) q.set("apiKey", apiKey.trim());

      const res = await fetch(`/api/models?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.models && data.models.length > 0) {
          setModelsList(data.models);
          // Если текущая модель не в списке — переключим на рекомендуемую доступную
          if (!data.models.find((m: any) => m.id === model)) {
            const fallback = data.models.find((m: any) => m.id === "deepseek/deepseek-v4.1-flash")?.id || data.models[0].id;
            setModel(fallback);
          }
        }
      }
    } catch (e) {
      console.error("loadModels error:", e);
    } finally {
      setLoadingModels(false);
    }
  }

  const openSetup = useCallback(() => {
    setShowSetup(true);
    if (modelsList.length === 0 && !loadingModels) {
      loadModels();
    }
  }, [modelsList.length, loadingModels]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    if (!activeCampaign) {
      toast.error("Сначала создайте кампанию");
      return;
    }
    if (!apiKey) {
      toast.error("Введите API ключ в настройках");
      openSetup();
      return;
    }
    const userMessage = input.trim();
    setInput("");
    await sendMessage({ text: userMessage });
  }

  async function handleGenerateStory() {
    if (!activeCampaign) return;
    if (!apiKey && !process.env.NEXT_PUBLIC_AI_API_KEY) {
      toast.error("Введите API ключ в настройках перед генерацией сюжета");
      openSetup();
      return;
    }
    setSavingStorySettings(true);
    try {
      const res = await fetch("/api/campaign", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: activeCampaign.id,
          setting: newCampaignSetting,
          tone: newCampaignTone,
          difficulty: newCampaignDifficulty,
          dmStyle: newCampaignDmStyle,
          customDmNotes: newCampaignCustomDmNotes,
          partyTies: newCampaignPartyTies,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.campaign) {
          setActiveCampaign(data.campaign);
        }
      }
      setShowStoryConfig(false);
      await startArcGeneration(activeCampaign.id, true);
    } catch (e: any) {
      toast.error(`Ошибка генерации сюжета: ${e.message}`);
    } finally {
      setSavingStorySettings(false);
    }
  }

  async function startCampaignGame() {
    if (!activeCampaign) return;
    if (!apiKey && !process.env.NEXT_PUBLIC_AI_API_KEY) {
      toast.error("Введите API ключ в настройках перед началом игры");
      openSetup();
      return;
    }
    const startPrompt = "Мастер, наш отряд готов к приключению! Опиши вступительную сцену, атмосферу и завязку сюжета для героев в соответствии с выбранным сеттингом и созданной сюжетной аркой.";
    await sendMessage({ text: startPrompt });
  }

  const rollPlainDie = useCallback((sides: number) => {
    const result = rollDie(sides);
    setInput((prev) => (prev ? `${prev} (${result}) ` : `(${result}) `));
    toast.success(`Бросок d${sides}: [${result}]`);
  }, []);

  const handleD20RollSelect = useCallback((rollText: string) => {
    setInput((prev) => (prev ? `${prev} ${rollText} ` : `${rollText} `));
    toast.success(rollText);
  }, []);

  async function quickRoll(notation: string) {
    setInput((prev) => `${prev}${prev ? " " : ""}Бросок ${notation}`);
  }

  // ── Импорт персонажа из генератора листа ──
  const runImport = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!activeCampaign) {
        toast.error("Сначала создайте или активируйте кампанию");
        return;
      }
      setImporting(true);
      try {
        const res = await fetch("/api/character/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ campaignId: activeCampaign.id, type: importType, ...payload }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data?.error || "Не удалось импортировать персонажа");
          return;
        }
        toast.success(data.message || "Персонаж импортирован");
        setShareCode("");
        setShowImport(false);
        await refreshActiveCampaign();
      } catch (e) {
        toast.error(`Ошибка: ${(e as Error).message}`);
      } finally {
        setImporting(false);
      }
    },
    [activeCampaign, importType, refreshActiveCampaign]
  );

  function importFromFile() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const character = JSON.parse(await file.text());
        const charLevel = Number(character.level || character.data?.level || 1);
        if (importType === "player" && charLevel !== targetLevel) {
          toast.error(`Персонаж имеет ${charLevel} ур. Для этой кампании требуется ровно ${targetLevel} ур.`);
          return;
        }
        await runImport({ character });
      } catch {
        toast.error("Не удалось прочитать JSON-файл");
      }
    };
    input.click();
  }

  async function importFromCode() {
    const code = shareCode.trim();
    if (!code) {
      toast.error("Введите код или ссылку с сайта");
      return;
    }
    await runImport({ shareCode: code });
  }

  return (
    <div className="h-screen flex flex-col bg-background max-w-full overflow-x-hidden">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/30 shrink-0">
        <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 gap-2">
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-foreground text-background flex items-center justify-center font-bold">
                <Dices className="size-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">AI Dungeon Master</h1>
                <p className="text-xs text-muted-foreground">D&D 5e Solo Adventure</p>
              </div>
            </div>
            {activeCampaign && (
              <>
                <Separator orientation="vertical" className="h-8" />
                <div className="hidden sm:block">
                  <div className="font-medium text-sm">{activeCampaign.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Стартовый уровень: {activeCampaign.startingLevel || activeCampaign.levelFrom || 1}
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* 0. Кнопка «Войти по коду» */}
            <button
              type="button"
              onClick={() => setShowJoinRoomModal(true)}
              className="shrink-0 h-8 px-2.5 sm:px-3 rounded-md text-xs font-medium border border-border bg-background hover:bg-accent text-foreground transition shadow-xs flex items-center cursor-pointer"
              title="Присоединиться к сетевой комнате по коду"
            >
              <Radio className="size-3.5 mr-1.5 shrink-0 text-emerald-500 animate-pulse" />
              <span>Войти по коду</span>
            </button>

            {/* 1. Кнопка «Кампании» */}
            <button
              type="button"
              onClick={() => {
                loadCampaignsList();
                setShowCampaignList(true);
              }}
              className="shrink-0 h-8 px-3 rounded-md text-xs font-medium border border-border bg-background hover:bg-accent text-foreground transition shadow-xs flex items-center cursor-pointer"
            >
              <BookOpen className="size-3.5 mr-1.5 shrink-0" />
              <span>Кампании</span>
            </button>

            {/* 2. Кнопка «Настройки» */}
            <button
              type="button"
              onClick={() => openSetup()}
              className="shrink-0 h-8 px-3 rounded-md text-xs font-medium border border-border bg-background hover:bg-accent text-foreground transition shadow-xs flex items-center cursor-pointer"
              title="Настройки AI (API-ключ и выбор моделей)"
            >
              <Settings className="size-3.5 mr-1.5 shrink-0" />
              <span>Настройки</span>
            </button>

            {/* 3. Блок «Аккаунт» */}
            {user ? (
              <div className="flex items-center gap-1 shrink-0">
                <div
                  className="h-8 px-2.5 rounded-md text-xs font-medium border border-border bg-accent/40 text-foreground flex items-center gap-1.5 shadow-xs"
                  title={`Вы вошли как: ${user.email || "Игрок"}`}
                >
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="max-w-[120px] truncate font-sans">{user.email?.split("@")[0] || "Герой"}</span>
                </div>
                <button
                  type="button"
                  onClick={() => supabaseSignOut()}
                  title="Выйти из аккаунта"
                  className="h-8 px-2 rounded-md text-xs font-medium border border-border bg-background hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition cursor-pointer shadow-xs"
                >
                  Выйти
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                title="Войти в аккаунт через Google или почту"
                className="shrink-0 h-8 px-2.5 rounded-md text-xs font-medium border border-border bg-foreground text-background hover:bg-foreground/90 transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <LogIn className="size-3.5 shrink-0" />
                <span className="hidden sm:inline">Войти в аккаунт</span>
                <span className="sm:hidden">Войти</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat area */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0">
          {!activeCampaign ? (
            activeRoom ? (
              <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex items-center justify-center">
                <Card className="max-w-2xl w-full border border-border bg-card shadow-lg font-sans">
                  <CardHeader className="pb-3 border-b border-border/40">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <Radio className="size-5 animate-pulse" />
                        </div>
                        <div>
                          <CardTitle className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                            {activeRoom.name || "Сетевая комната стола"}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Сетевое лобби стола • Ожидание ведущего или других игроков
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-500/30 font-medium">
                        {activeRoom.status === "active" ? "Игра идёт" : "В лобби"}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-5 pt-4">
                    {/* Блок с кодом комнаты и ссылкой */}
                    <div className="rounded-lg border border-border bg-muted/30 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground font-medium">Код стола для друзей:</div>
                        <div className="font-mono text-xl sm:text-2xl font-bold tracking-widest text-foreground select-all">
                          {activeRoom.code}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={copyRoomLink}
                          className="gap-1.5 text-xs h-9 cursor-pointer"
                        >
                          <Copy className="size-3.5" />
                          <span>Копировать ссылку</span>
                        </Button>
                      </div>
                    </div>

                    {/* Текущий статус персонажа пользователя */}
                    {(() => {
                      const currentParticipant = activeRoom.participants?.find(
                        (p: any) => p.userId === user?.id
                      );

                      if (!user) {
                        return (
                          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-xs space-y-2.5">
                            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-semibold text-sm">
                              <LogIn className="size-4 shrink-0" />
                              <span>Вы вошли как гость без аккаунта</span>
                            </div>
                            <p className="text-muted-foreground text-xs leading-relaxed">
                              Чтобы присоединиться к отряду своим персонажем и видеть броски кубиков от своего имени, войдите в аккаунт через Google или почту.
                            </p>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setShowAuthModal(true)}
                              className="border-amber-500/40 text-amber-900 dark:text-amber-200 hover:bg-amber-500/10 cursor-pointer"
                            >
                              Войти в аккаунт
                            </Button>
                          </div>
                        );
                      }

                      if (!currentParticipant) {
                        return (
                          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-xs space-y-2.5">
                            <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                              <User className="size-4 text-primary shrink-0" />
                              <span>Вы за столом, но герой ещё не выбран!</span>
                            </div>
                            <p className="text-muted-foreground text-xs leading-relaxed">
                              Выберите своего персонажа из листа персонажей или создайте нового под уровень стола ({activeRoom.startingLevel || 1} ур.).
                            </p>
                            <Button
                              size="sm"
                              onClick={() => setShowPicker(true)}
                              className="cursor-pointer gap-1.5"
                            >
                              <Plus className="size-3.5" />
                              Выбрать персонажа
                            </Button>
                          </div>
                        );
                      }

                      const charSnap = currentParticipant.characterSnapshot || {};
                      return (
                        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {charSnap.portraitUrl ? (
                              <img
                                src={charSnap.portraitUrl}
                                alt={charSnap.name || "Герой"}
                                className="size-11 rounded-full object-cover border border-emerald-500/30 shrink-0"
                              />
                            ) : (
                              <div className="size-11 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/30 shrink-0">
                                <User className="size-5" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                                Ваш герой в игре:
                              </div>
                              <div className="font-semibold text-sm text-foreground truncate">
                                {charSnap.name || "Герой"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {charSnap.race || ""} {charSnap.className || "Искатель приключений"} • {charSnap.level || activeRoom.startingLevel || 1} ур.
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowPicker(true)}
                            className="shrink-0 text-xs h-8 cursor-pointer"
                          >
                            Сменить
                          </Button>
                        </div>
                      );
                    })()}

                    {/* Список участников за столом */}
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                        <span>Участники за столом ({activeRoom.participants?.length || 0})</span>
                        <span className="text-[11px] text-muted-foreground font-normal">
                          Стартовый уровень: {activeRoom.startingLevel || 1}
                        </span>
                      </div>
                      {(!activeRoom.participants || activeRoom.participants.length === 0) ? (
                        <div className="text-center text-xs text-muted-foreground py-6 border border-dashed rounded-lg">
                          Пока никто не подключился. Поделитесь кодом комнаты!
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {activeRoom.participants.map((p: any) => {
                            const snap = p.characterSnapshot || {};
                            const isMe = user?.id && p.userId === user.id;
                            return (
                              <div
                                key={p.id || p.userId}
                                className={`p-2.5 rounded-lg border flex items-center gap-2.5 ${
                                  isMe ? "border-emerald-500/40 bg-emerald-500/5" : "border-border bg-card"
                                }`}
                              >
                                {snap.portraitUrl ? (
                                  <img
                                    src={snap.portraitUrl}
                                    alt={snap.name || "Герой"}
                                    className="size-8 rounded-full object-cover border border-border shrink-0"
                                  />
                                ) : (
                                  <div className="size-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0 border border-border">
                                    <User className="size-4" />
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-semibold text-xs text-foreground truncate">
                                      {snap.name || "Безымянный"}
                                    </span>
                                    {p.isHost && (
                                      <span title="Ведущий комнаты">
                                        <Crown className="size-3 text-amber-500 fill-amber-500 shrink-0" />
                                      </span>
                                    )}
                                    {isMe && (
                                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 text-emerald-600 border-emerald-500/40">
                                        Вы
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground truncate">
                                    {snap.className || "Персонаж"} • {snap.level || activeRoom.startingLevel || 1} ур.
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Действия стола */}
                    <div className="pt-2 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={leaveRoom}
                        className="text-xs text-muted-foreground hover:text-destructive cursor-pointer w-full sm:w-auto"
                      >
                        <LogOut className="size-3.5 mr-1.5" />
                        Покинуть комнату
                      </Button>

                      <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCreatingCampaign(true)}
                          className="text-xs cursor-pointer w-full sm:w-auto"
                        >
                          <Plus className="size-3.5 mr-1.5" />
                          Создать приключение
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            loadCampaignsList();
                            setShowCampaignList(true);
                          }}
                          className="text-xs cursor-pointer w-full sm:w-auto"
                        >
                          <BookOpen className="size-3.5 mr-1.5" />
                          Выбрать кампанию
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8">
                <Card className="max-w-lg w-full">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="size-5 text-amber-500" />
                      Добро пожаловать, странник
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Это AI Dungeon Master для D&D 5e. Нейросеть будет вести твою
                      кампанию, бросать кубики, помнить персонажей и события.
                    </p>
                    <div className="flex flex-col gap-2">
                      <Button onClick={() => setCreatingCampaign(true)} size="lg">
                        <Plus className="size-4 mr-2" />
                        Создать новую кампанию
                      </Button>
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={() => setShowJoinRoomModal(true)}
                        className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 cursor-pointer"
                      >
                        <Radio className="size-4 mr-2 text-emerald-500 animate-pulse" />
                        Присоединиться к комнате по коду
                      </Button>
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={() => {
                          loadCampaignsList();
                          setShowCampaignList(true);
                        }}
                      >
                        <BookOpen className="size-4 mr-2" />
                        Выбрать из существующих
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openSetup()}
                      >
                        <Settings className="size-4 mr-2" />
                        Открыть настройки API
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )
          ) : (
            <>
              {/* Прогресс генерации истории. Играть можно и не дожидаясь, но
                  мастер до готовности арки ведёт без сюжетного плана. */}
              {arcState?.status === "generating" && arcState.progress && (
                <div className="border-b bg-amber-500/10 px-4 py-2">
                  <div className="max-w-3xl mx-auto space-y-1.5">
                    <div className="flex items-center gap-2 text-sm">
                      <Loader2 className="size-4 animate-spin text-amber-600" />
                      <span className="font-medium">Пишу историю кампании</span>
                      <span className="text-muted-foreground">
                        {arcState.progress.stageLabel}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-amber-500/20">
                      <div
                        className="h-full rounded-full bg-amber-600 transition-all duration-500"
                        style={{
                          width: `${Math.round(
                            ((arcState.progress.actsDone + 0.5) /
                              (arcState.progress.actsTotal + 1)) *
                              100
                          )}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Актов готово: {arcState.progress.actsDone} из{" "}
                      {arcState.progress.actsTotal}. Можно начинать играть — сюжет
                      подключится, как только будет готов.
                    </p>
                  </div>
                </div>
              )}
              {arcState?.status === "failed" && (
                <div className="border-b bg-red-500/10 px-4 py-2">
                  <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
                    <p className="text-sm text-red-600">
                      Не удалось написать историю: {arcState.progress?.error || "ошибка"}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => activeCampaign && startArcGeneration(activeCampaign.id, true)}
                    >
                      Повторить
                    </Button>
                  </div>
                </div>
              )}

              {/* Баннер активного боя */}
              {activeCombat && (
                <div className="border-b bg-rose-500/10 border-rose-500/20 px-4 py-2.5">
                  <div className="max-w-3xl mx-auto flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Swords className="size-4 text-rose-500 animate-pulse" />
                      <div className="text-sm">
                        <span className="font-semibold text-rose-500">Идёт тактический бой:</span>{" "}
                        <span className="font-medium">{activeCombat.name}</span>{" "}
                        <span className="text-xs text-muted-foreground">(Раунд {activeCombat.round})</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="bg-rose-600 hover:bg-rose-700 text-white text-xs h-7 gap-1"
                      onClick={() => setShowCombatView(true)}
                    >
                      <Swords className="size-3.5" />
                      Перейти к сетке боя
                    </Button>
                  </div>
                </div>
              )}

              {/* Сетевой баннер открытой кампании */}
              {activeRoom && (
                <div className="border-b bg-muted/40 px-4 py-2 text-xs border-border">
                  <div className="max-w-3xl mx-auto flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="font-semibold text-foreground">
                        Сетевая комната открыта
                      </span>
                      <span className="font-mono bg-background px-2 py-0.5 rounded border border-border font-bold">
                        {activeRoom.code}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1 border-border cursor-pointer"
                        onClick={copyRoomLink}
                      >
                        <Copy className="size-3" />
                        Скопировать ссылку
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-7 text-xs gap-1 cursor-pointer"
                        onClick={() => {
                          setSidebarTab("room");
                          if (sidebarCollapsed) toggleSidebar();
                        }}
                      >
                        <Radio className="size-3 text-emerald-500" />
                        Панель сети ({activeRoom.participants?.length || 1})
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-muted-foreground hover:text-destructive cursor-pointer"
                        onClick={activeRoom.hostUserId === user?.id ? closeCampaignForFriends : leaveRoom}
                        disabled={closingRoom}
                      >
                        {closingRoom ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : activeRoom.hostUserId === user?.id ? (
                          "Закрыть доступ"
                        ) : (
                          "Покинуть"
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Информационная строка текущего акта кампании с кнопкой генерации следующего акта */}
              {arcState?.status === "ready" && arcState.arc && (
                <div className="border-b bg-card/60 px-3 sm:px-4 py-2 text-xs border-border shrink-0">
                  <div className="max-w-3xl mx-auto flex items-center justify-between gap-2.5 flex-wrap">
                    <div className="flex items-center gap-2 truncate">
                      <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 text-[11px] h-5 px-1.5 font-medium shrink-0">
                        Акт {(arcState.currentAct ?? 0) + 1} из {arcState.arc.acts?.length || 1}
                      </Badge>
                      <span className="font-semibold text-foreground truncate max-w-[240px] sm:max-w-xs md:max-w-md">
                        {arcState.arc.acts?.[arcState.currentAct ?? 0]?.name || arcState.arc.title}
                      </span>
                      <span className="text-muted-foreground hidden sm:inline text-[11px]">
                        (ур. {arcState.arc.acts?.[arcState.currentAct ?? 0]?.levelFrom}–{arcState.arc.acts?.[arcState.currentAct ?? 0]?.levelTo})
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                        onClick={() => setShowArcDebug(true)}
                        title="Посмотреть структуру сюжета"
                      >
                        <BookOpen className="size-3 mr-1" />
                        Сюжет
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={generatingNextAct}
                        className="h-7 px-2.5 text-xs font-medium border-amber-600/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition cursor-pointer flex items-center gap-1 shadow-xs"
                        onClick={() => activeCampaign && startNextActGeneration(activeCampaign.id)}
                        title="Сгенерировать следующий акт на основе выборов героев (подтверждение человека-мастера)"
                      >
                        {generatingNextAct ? (
                          <>
                            <Loader2 className="size-3 animate-spin" />
                            Генерирую Акт {(arcState.arc.acts?.length || 1) + 1}...
                          </>
                        ) : (
                          <>
                            <Sparkles className="size-3" />
                            Сгенерировать следующий акт
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Messages. min-h-0 обязателен: без него flex-элемент не сжимается
                  меньше содержимого, высота ScrollArea растёт бесконечно и
                  прокрутки не возникает. */}
              <ScrollArea className="flex-1 min-h-0">
                <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
                  {messages.length === 0 && (
                    <div className="py-6 space-y-6">
                      {/* Карточка: Сбор отряда и Сетевой доступ */}
                      <Card className="border-border">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div>
                              <CardTitle className="text-lg flex items-center gap-2">
                                <Users className="size-5" />
                                Сбор отряда героев
                              </CardTitle>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Уровень героев для этой кампании:{" "}
                                <Badge variant="secondary" className="font-mono text-xs font-semibold">
                                  {targetLevel} ур.
                                </Badge>
                              </p>
                            </div>
                            {!activeRoom ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={openCampaignForFriends}
                                disabled={loadingRoom}
                                className="h-8 text-xs gap-1.5 border-border font-medium cursor-pointer"
                              >
                                {loadingRoom ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <Globe className="size-3.5" />
                                )}
                                ОТКРЫТЬ КАМПАНИЮ ДЛЯ ДРУЗЕЙ
                              </Button>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                                  ● Сеть открыта ({activeRoom.code})
                                </Badge>
                              </div>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {playerCharacters.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-border p-6 text-center space-y-2.5 bg-muted/20">
                              <Users className="size-8 mx-auto text-muted-foreground opacity-40" />
                              <div className="font-medium text-sm">В отряде пока нет персонажей</div>
                              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                                Добавьте хотя бы одного героя (загрузите свой лист или откройте кампанию друзьям по ссылке), чтобы разблокировать настройку сюжета и начать приключение.
                              </p>
                              <div className="pt-2 flex justify-center gap-2 flex-wrap">
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setImportType("player");
                                    setShowImport(true);
                                  }}
                                  className="h-8 text-xs gap-1.5 cursor-pointer"
                                >
                                  <Plus className="size-3.5" />
                                  Загрузить персонажа ({targetLevel} ур.)
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {playerCharacters.map((c) => (
                                  <div
                                    key={c.id}
                                    className="rounded-lg border border-border bg-card/60 p-3 flex items-center justify-between gap-2"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <div className="font-semibold text-sm truncate">{c.name}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {c.race || "Герой"} • {c.class || "Искатель"} {c.level || targetLevel} ур.
                                      </div>
                                      <div className="text-[11px] text-muted-foreground mt-0.5">
                                        КД: {c.ac || 10} • HP: {c.hpCurrent ?? 10}/{c.hpMax ?? 10}
                                      </div>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="text-muted-foreground hover:text-destructive h-8 w-8 p-0 cursor-pointer"
                                      onClick={() => deleteCharacter({ id: c.id, name: c.name })}
                                      disabled={deletingCharacterId === c.id}
                                      title="Удалить из отряда"
                                    >
                                      {deletingCharacterId === c.id ? (
                                        <Loader2 className="size-3.5 animate-spin" />
                                      ) : (
                                        <Trash2 className="size-3.5" />
                                      )}
                                    </Button>
                                  </div>
                                ))}
                              </div>
                              <div className="flex justify-end pt-1">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs gap-1 cursor-pointer"
                                  onClick={() => {
                                    setImportType("player");
                                    setShowImport(true);
                                  }}
                                >
                                  <Plus className="size-3" />
                                  Добавить ещё персонажа
                                </Button>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Карточка: Сюжет заблокирован при 0 персонажей */}
                      {playerCharacters.length === 0 ? (
                        <Card className="border-border opacity-70">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
                              <Lock className="size-4" />
                              Генерация сюжета заблокирована
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-xs text-muted-foreground">
                              Для составления сюжета мастер должен знать персонажей отряда, их предыстории и способности. Добавьте хотя бы одного героя в отряд выше.
                            </p>
                          </CardContent>
                        </Card>
                      ) : arcState?.status === "generating" ? (
                        /* Карточка: Процесс генерации сюжета */
                        <Card className="border-border bg-card/60">
                          <CardHeader className="pb-3">
                            <div className="flex items-center gap-2.5">
                              <Loader2 className="size-5 animate-spin text-amber-500" />
                              <div>
                                <CardTitle className="text-base font-semibold">
                                  Мастер придумывает сюжет приключения...
                                </CardTitle>
                                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                                  {arcState.progress?.stageLabel || "Создаю завязку и первый акт для вашего отряда..."}
                                </CardDescription>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-amber-500 to-amber-600 animate-pulse w-full rounded-full" />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Генерация завязки и первого акта обычно занимает 20–35 секунд. Сюжет будет адаптирован под состав отряда ({playerCharacters.map((p) => p.name).join(", ")}).
                            </p>
                          </CardContent>
                        </Card>
                      ) : arcState?.status === "ready" && arcState.arc && !showStoryConfig ? (
                        /* Карточка: Сюжет готов, кнопка НАЧАТЬ КАМПАНИЮ */
                        <Card className="border-border bg-card/60">
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                              <div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 text-xs">
                                    ✨ Сюжет сформирован
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {arcState.arc.acts?.length || 1} {arcState.arc.acts?.length === 1 ? "акт" : "акта"}
                                  </span>
                                </div>
                                <CardTitle className="text-lg font-bold mt-1.5 text-foreground">
                                  {arcState.arc.title}
                                </CardTitle>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowStoryConfig(true)}
                                className="text-xs h-7 text-muted-foreground hover:text-foreground cursor-pointer"
                              >
                                <Settings className="size-3.5 mr-1" />
                                Перенастроить
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="text-sm text-foreground/90 leading-relaxed bg-background/50 p-3.5 rounded-lg border border-border/60">
                              {arcState.arc.premise}
                            </div>

                            {arcState.arc.mainThreat && (
                              <div className="text-xs text-muted-foreground flex items-start gap-1.5">
                                <span className="font-semibold text-foreground">Главная угроза:</span>
                                <span>{arcState.arc.mainThreat}</span>
                              </div>
                            )}

                            {/* Большая акцентная кнопка: НАЧАТЬ КАМПАНИЮ */}
                            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border/50">
                              <div className="text-xs text-muted-foreground">
                                Отряд из {playerCharacters.length} {playerCharacters.length === 1 ? "героя" : "героев"} готов к началу игры.
                              </div>
                              <Button
                                type="button"
                                size="lg"
                                onClick={startCampaignGame}
                                disabled={isLoading}
                                className="w-full sm:w-auto h-11 px-7 text-sm font-bold bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 hover:from-amber-500 hover:to-amber-700 text-amber-50 border border-amber-600/60 shadow-md flex items-center justify-center gap-2 cursor-pointer"
                              >
                                {isLoading ? (
                                  <>
                                    <Loader2 className="size-4 animate-spin" />
                                    Мастер открывает сцену...
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="size-4" />
                                    ⚔️ НАЧАТЬ КАМПАНИЮ
                                  </>
                                )}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ) : (
                        /* Карточка: Настройка параметров сюжета и кнопка Сгенерировать сюжет */
                        <Card className="border-border bg-card/60">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div>
                                <CardTitle className="text-base flex items-center gap-2">
                                  <Sparkles className="size-4 text-amber-500" />
                                  Параметры сюжета и мира
                                </CardTitle>
                                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                                  Настройте мир и атмосферу приключения для вашего отряда ({playerCharacters.length} {playerCharacters.length === 1 ? "герой" : "героя"}).
                                </CardDescription>
                              </div>
                              {arcState?.status === "ready" && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setShowStoryConfig(false)}
                                  className="text-xs h-7 text-muted-foreground cursor-pointer"
                                >
                                  Назад к готовому сюжету
                                </Button>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {/* Сеттинг */}
                              <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Сеттинг мира</Label>
                                <Select value={newCampaignSetting} onValueChange={setNewCampaignSetting}>
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Сеттинг" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Forgotten Realms">Forgotten Realms (Забытые Королевства)</SelectItem>
                                    <SelectItem value="Ravenloft">Ravenloft (Тёмное фэнтези / Гримдарк)</SelectItem>
                                    <SelectItem value="Eberron">Eberron (Магопанк и технологии)</SelectItem>
                                    <SelectItem value="Dragonlance">Dragonlance (Сага о Копьях)</SelectItem>
                                    <SelectItem value="Planescape">Planescape (Мультивселенная / Сигил)</SelectItem>
                                    <SelectItem value="Dark Sun">Dark Sun (Пустынный пост-апокалипсис)</SelectItem>
                                    <SelectItem value="Custom">Авторский мир</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Тон */}
                              <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Тон повествования</Label>
                                <Select value={newCampaignTone} onValueChange={setNewCampaignTone}>
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Тон" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="heroic">Героический эпос</SelectItem>
                                    <SelectItem value="dark">Мрачный гримдарк</SelectItem>
                                    <SelectItem value="mystery">Мистический детектив</SelectItem>
                                    <SelectItem value="classic">Классическое приключение D&D</SelectItem>
                                    <SelectItem value="lighthearted">Легкомысленный / Приключенческий</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Стиль мастера */}
                              <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Стиль Мастера (DM)</Label>
                                <Select value={newCampaignDmStyle} onValueChange={setNewCampaignDmStyle}>
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Стиль мастера" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="balanced">Сбалансированный</SelectItem>
                                    <SelectItem value="narrative">Атмосферный нарратив и отыгрыш</SelectItem>
                                    <SelectItem value="tactical">Тактические бои и сложные испытания</SelectItem>
                                    <SelectItem value="sandbox">Песочница и свобода выбора</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Сложность */}
                              <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Сложность</Label>
                                <Select value={newCampaignDifficulty} onValueChange={setNewCampaignDifficulty}>
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Сложность" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="easy">Сюжетная (мягкие бои)</SelectItem>
                                    <SelectItem value="normal">Нормальная (баланс D&D 5e)</SelectItem>
                                    <SelectItem value="hard">Опасная (умные враги)</SelectItem>
                                    <SelectItem value="deadly">Смертоносная (хардкор)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Отношения в отряде (Динамика группы) */}
                              <div className="space-y-1.5 sm:col-span-2">
                                <Label className="text-xs font-semibold">Отношения в отряде (Динамика группы)</Label>
                                <Select value={newCampaignPartyTies} onValueChange={setNewCampaignPartyTies}>
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Отношения в группе" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="tight_knit">Слаженный боевой отряд (давние соратники, прикрывают спины)</SelectItem>
                                    <SelectItem value="strangers">Незнакомцы (судьба свела вместе, присматриваются и не знают чужих тайн)</SelectItem>
                                    <SelectItem value="mercenaries">Наёмники (общий контракт или гильдия, деловой расчёт)</SelectItem>
                                    <SelectItem value="friends">Друзья детства / Соклановцы (крепкая эмоциональная связь, преданность)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {/* Пожелания к сюжету */}
                            <div className="space-y-1.5">
                              <Label className="text-xs font-semibold">Пожелания мастера к сюжету и миру (опционально)</Label>
                              <Textarea
                                value={newCampaignCustomDmNotes}
                                onChange={(e) => setNewCampaignCustomDmNotes(e.target.value)}
                                placeholder="Например: Отряд начинает в таверне прибрежного города перед бурей, или в древней крипте в поисках реликвии..."
                                className="min-h-[54px] max-h-[140px] text-xs resize-none"
                              />
                            </div>

                            <div className="flex justify-end pt-1">
                              <Button
                                type="button"
                                onClick={handleGenerateStory}
                                disabled={savingStorySettings}
                                className="h-9 px-4 text-xs font-semibold bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 hover:from-amber-500 hover:to-amber-700 text-amber-50 border border-amber-600/60 shadow-xs flex items-center gap-1.5 cursor-pointer"
                              >
                                {savingStorySettings ? (
                                  <>
                                    <Loader2 className="size-3.5 animate-spin" />
                                    Сохраняю и запускаю...
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="size-3.5" />
                                    Сгенерировать сюжет
                                  </>
                                )}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}
                  {messages.map((m) => {
                    const text = getMessageText(m);
                    const errorMsg = getMessageError(m);
                    if (!text && !errorMsg) return null;
                    return (
                      <MessageBubble
                        key={m.id}
                        role={m.role}
                        content={text}
                        error={errorMsg}
                        metadata={(m as any).metadata}
                      />
                    );
                  })}
                  {isLoading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground pl-2">
                      <Loader2 className="size-4 animate-spin" />
                      Мастер обдумывает...
                    </div>
                  )}
                  {error && !messages.some((m) => getMessageError(m)) && (
                    <div className="text-sm text-red-600 bg-red-500/10 border border-red-500/30 rounded-md p-3">
                      {error.message || "Произошла ошибка. Проверьте API-ключ в настройках."}
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Input area */}
              <div className="border-t bg-card/30 backdrop-blur p-4">
                <div className="max-w-3xl mx-auto">
                  {/* Quick dice */}
                  <div className="flex gap-1.5 mb-2 flex-wrap items-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2.5 text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30 flex items-center gap-1.5 shadow-xs cursor-pointer"
                      onClick={() => setShowD20Modal(true)}
                      disabled={isLoading}
                      title="Интерактивный бросок d20 (навыки, спасброски, атаки персонажа)"
                    >
                      <Dices className="size-3.5 text-amber-500" />
                      <span>🎲 Бросок d20</span>
                    </Button>

                    <div className="h-4 w-px bg-border/60 mx-0.5 hidden sm:block" />

                    {[4, 6, 8, 10, 12, 100].map((sides) => (
                      <Button
                        key={sides}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs font-mono opacity-80 hover:opacity-100 cursor-pointer"
                        onClick={() => rollPlainDie(sides)}
                        disabled={isLoading}
                        title={`Случайный бросок 1d${sides}`}
                      >
                        d{sides}
                      </Button>
                    ))}

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                      onClick={() => setInput("Вспомни последние события и важных NPC")}
                      disabled={isLoading}
                    >
                      <Brain className="size-3 mr-1" />
                      Вспомни
                    </Button>
                  </div>
                  <form onSubmit={handleSubmit} className="flex gap-2">
                    <Textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Что ты делаешь? Опиши действие или спроси мастера..."
                      className="min-h-[60px] max-h-[200px] resize-none"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmit(e);
                        }
                      }}
                      disabled={isLoading}
                    />
                    <div className="flex flex-col gap-1">
                      <Button
                        type="submit"
                        size="icon"
                        disabled={isLoading || !input.trim()}
                      >
                        <Send className="size-4" />
                      </Button>
                      {isLoading && (
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          onClick={stop}
                        >
                          <Loader2 className="size-4 animate-spin" />
                        </Button>
                      )}
                      {!isLoading && messages.length > 0 && (
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          onClick={() => regenerate()}
                          title="Повторить последний ответ"
                        >
                          <Dices className="size-4" />
                        </Button>
                      )}
                    </div>
                  </form>
                </div>
              </div>
            </>
          )}
        </main>

        {/* Sidebar */}
        {(activeCampaign || activeRoom) && (
          sidebarCollapsed ? (
            <aside
              onClick={toggleSidebar}
              className="hidden md:flex flex-col items-center py-4 border-l bg-card/40 hover:bg-card/70 transition-colors cursor-pointer w-10 text-muted-foreground hover:text-foreground group select-none relative"
              title="Развернуть боковую панель (Персы, Сеть, Память, Журнал)"
            >
              <div className="p-1.5 rounded group-hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 mb-3 transition">
                <PanelRightOpen className="size-4" />
              </div>
              <div className="flex-1 flex items-center justify-center">
                <span className="[writing-mode:vertical-rl] rotate-180 text-xs font-medium tracking-wider uppercase opacity-70 group-hover:opacity-100 flex items-center gap-2">
                  <Users className="size-3 rotate-90 inline" /> {activeRoom ? "Сеть • Персы" : "Персы • Память"}
                </span>
              </div>
            </aside>
          ) : (
            <aside
              style={{ width: `${sidebarWidth}px` }}
              className="border-l bg-card/30 hidden md:flex flex-col min-h-0 relative select-text"
            >
              {/* Левый край для растягивания (drag to resize) */}
              <div
                onMouseDown={handleStartResize}
                className="absolute -left-1.5 top-0 bottom-0 w-3 cursor-col-resize z-30 group flex items-center justify-center hover:bg-amber-500/20 active:bg-amber-500/40 transition-colors"
                title="Потяните влево/вправо для изменения ширины панели"
              >
                <div className="w-0.5 h-8 bg-border group-hover:bg-amber-500 rounded transition-colors" />
              </div>

              <Tabs value={sidebarTab} onValueChange={setSidebarTab} className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center gap-1 mx-2 mt-2">
                  <TabsList className={`grid ${activeCampaign ? (activeRoom ? "grid-cols-4" : "grid-cols-3") : (activeRoom ? "grid-cols-2" : "grid-cols-3")} flex-1`}>
                    <TabsTrigger value="characters" className="text-xs">
                      <Users className="size-3 mr-1" />
                      Персы
                    </TabsTrigger>
                    {activeRoom && (
                      <TabsTrigger value="room" className="text-xs relative">
                        <Radio className="size-3 mr-1 text-emerald-500 animate-pulse" />
                        Сеть
                        {activeRoom.participants && activeRoom.participants.length > 0 && (
                          <span className="ml-1 text-[10px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-1 py-0.2 rounded-full font-bold">
                            {activeRoom.participants.length}
                          </span>
                        )}
                      </TabsTrigger>
                    )}
                    {activeCampaign && (
                      <>
                        <TabsTrigger value="memory" className="text-xs">
                          <Brain className="size-3 mr-1" />
                          Память
                        </TabsTrigger>
                        <TabsTrigger value="events" className="text-xs">
                          <Scroll className="size-3 mr-1" />
                          Журнал
                        </TabsTrigger>
                      </>
                    )}
                  </TabsList>
                  <button
                    type="button"
                    onClick={toggleSidebar}
                    className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition cursor-pointer"
                    title="Свернуть боковую панель"
                  >
                    <PanelRightClose className="size-4" />
                  </button>
                </div>

              <TabsContent value="characters" className="flex-1 m-0 min-h-0">
                <ScrollArea className="h-full">
                  <div className="p-3 space-y-3">
                    <div className="flex items-center justify-between pb-1 border-b border-border/40">
                      <span className="text-xs font-semibold text-muted-foreground">Отряд ({characters.length})</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-6 px-1.5 text-[11px] gap-1 cursor-pointer"
                        onClick={() => {
                          setImportType("player");
                          setShowImport(true);
                        }}
                        title={`Импортировать персонажа (${targetLevel} ур.)`}
                      >
                        <Plus className="size-3" />
                        Импорт
                      </Button>
                    </div>
                    {characters.length === 0 ? (
                      <div className="text-center text-xs text-muted-foreground py-8">
                        Персонажи появятся по ходу игры
                      </div>
                    ) : (() => {
                      const inSceneChars = characters.filter((c) => c.type === "player" || c.inScene !== false);
                      const outOfSceneChars = characters.filter((c) => c.type !== "player" && c.inScene === false);

                      return (
                        <>
                          {outOfSceneChars.length > 0 && (
                            <div className="text-[11px] font-medium tracking-wide uppercase text-amber-700/80 dark:text-amber-300/80 px-1 pt-1 flex items-center justify-between">
                              <span>В этой сцене</span>
                              <span className="text-[10px] text-muted-foreground font-normal">
                                {inSceneChars.length} {inSceneChars.length === 1 ? "персонаж" : inSceneChars.length < 5 ? "персонажа" : "персонажей"}
                              </span>
                            </div>
                          )}

                          {inSceneChars.length === 0 ? (
                            <div className="text-center text-xs text-muted-foreground py-4 border border-dashed rounded-lg">
                              В текущей сцене нет активных персонажей
                            </div>
                          ) : (
                            inSceneChars.map((c) => (
                              <CharacterCard
                                key={c.id}
                                character={c}
                                onDelete={deleteCharacter}
                                deleting={deletingCharacterId === c.id}
                                onToggleInScene={toggleCharacterInScene}
                                onCharacterUpdated={(updated) => {
                                  setCharacters(characters.map((ch) => (ch.id === updated.id ? updated : ch)));
                                }}
                              />
                            ))
                          )}

                          {outOfSceneChars.length > 0 && (
                            <div className="pt-2 border-t border-border/50">
                              <button
                                type="button"
                                onClick={() => setShowOutOfScene((prev) => !prev)}
                                className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-accent/60 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                              >
                                <span className="flex items-center gap-1.5">
                                  <span>Остальной мир</span>
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                    {outOfSceneChars.length}
                                  </Badge>
                                </span>
                                {showOutOfScene ? (
                                  <ChevronUp className="size-3.5" />
                                ) : (
                                  <ChevronDown className="size-3.5" />
                                )}
                              </button>

                              {showOutOfScene && (
                                <div className="mt-2 space-y-3">
                                  {outOfSceneChars.map((c) => (
                                    <CharacterCard
                                      key={c.id}
                                      character={c}
                                      onDelete={deleteCharacter}
                                      deleting={deletingCharacterId === c.id}
                                      onToggleInScene={toggleCharacterInScene}
                                      onCharacterUpdated={(updated) => {
                                        setCharacters(characters.map((ch) => (ch.id === updated.id ? updated : ch)));
                                      }}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </ScrollArea>
              </TabsContent>

              {activeRoom && (
                <TabsContent value="room" className="flex-1 m-0 min-h-0">
                  <ScrollArea className="h-full">
                    <div className="p-3 space-y-3 font-sans">
                      {/* Карточка комнаты */}
                      <div className="rounded-lg border bg-card p-3 space-y-2 border-border shadow-xs">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Radio className="size-4 text-emerald-500 animate-pulse shrink-0" />
                            <h3 className="font-semibold text-xs sm:text-sm text-foreground truncate">
                              {activeRoom.name || "Сетевая комната"}
                            </h3>
                          </div>
                          <Badge variant="outline" className="text-[10px] px-1.5 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 shrink-0">
                            {activeRoom.status === "active" ? "Игра идёт" : "Лобби"}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40">
                          <span>Уровень отряда:</span>
                          <span className="font-semibold text-foreground">{activeRoom.startingLevel || targetLevel || 1} ур.</span>
                        </div>

                        {/* Код комнаты и кнопка копирования */}
                        <div className="flex items-center justify-between gap-2 bg-muted/40 p-1.5 rounded border border-border/50">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-muted-foreground">Код:</span>
                            <span className="font-mono text-xs font-bold text-foreground tracking-wider">
                              {activeRoom.code}
                            </span>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-[11px] gap-1 cursor-pointer"
                            onClick={copyRoomLink}
                          >
                            <Copy className="size-3" />
                            Копировать ссылку
                          </Button>
                        </div>
                      </div>

                      {/* Статус текущего игрока в комнате */}
                      {(() => {
                        const currentParticipant = activeRoom.participants?.find(
                          (p: any) => p.userId === user?.id
                        );

                        if (!user) {
                          return (
                            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs space-y-2 text-center">
                              <p className="text-amber-800 dark:text-amber-300 font-medium">
                                Вы вошли как гость без авторизации
                              </p>
                              <p className="text-muted-foreground text-[11px]">
                                Войдите в аккаунт, чтобы выбрать своего персонажа и играть вместе с друзьями.
                              </p>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="w-full text-xs h-7 gap-1 border-amber-500/40 text-amber-900 dark:text-amber-200 cursor-pointer"
                                onClick={() => setShowAuthModal(true)}
                              >
                                <LogIn className="size-3" />
                                Войти в аккаунт
                              </Button>
                            </div>
                          );
                        }

                        if (!currentParticipant) {
                          return (
                            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs space-y-2">
                              <p className="font-medium text-foreground">
                                Вы подключены к комнате!
                              </p>
                              <p className="text-muted-foreground text-[11px]">
                                Выберите своего героя из аккаунта или создайте нового, чтобы вступить в отряд.
                              </p>
                              <Button
                                type="button"
                                size="sm"
                                className="w-full text-xs h-7 gap-1 cursor-pointer"
                                onClick={() => setShowPicker(true)}
                              >
                                <User className="size-3" />
                                Выбрать персонажа
                              </Button>
                            </div>
                          );
                        }

                        const charSnap = currentParticipant.characterSnapshot || {};
                        return (
                          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5 text-xs flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                                Ваш персонаж в комнате:
                              </div>
                              <div className="font-semibold text-foreground truncate">
                                {charSnap.name || "Герой"} ({charSnap.className || "Игрок"}, {charSnap.level || activeRoom.startingLevel} ур.)
                              </div>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                              onClick={() => setShowPicker(true)}
                            >
                              Сменить
                            </Button>
                          </div>
                        );
                      })()}

                      {/* Список участников */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between pb-1 border-b border-border/40">
                          <span className="text-xs font-semibold text-muted-foreground">
                            Герои в комнате ({activeRoom.participants?.length || 0})
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-6 px-1.5 text-[11px] gap-1 cursor-pointer"
                            onClick={() => setShowPicker(true)}
                            title="Выбрать персонажа"
                          >
                            <Plus className="size-3" />
                            Герой
                          </Button>
                        </div>

                        {(!activeRoom.participants || activeRoom.participants.length === 0) ? (
                          <div className="text-center text-xs text-muted-foreground py-6 border border-dashed rounded-lg">
                            Пока нет участников. Отправьте друзьям ссылку на комнату!
                          </div>
                        ) : (
                          activeRoom.participants.map((p: any) => {
                            const snap = p.characterSnapshot || {};
                            const isMe = user?.id && p.userId === user.id;

                            return (
                              <div
                                key={p.id || p.userId}
                                className={`rounded-lg border p-2.5 text-xs space-y-1.5 transition-colors ${
                                  isMe
                                    ? "border-emerald-500/40 bg-emerald-500/5"
                                    : "border-border bg-card"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    {snap.portraitUrl ? (
                                      <img
                                        src={snap.portraitUrl}
                                        alt={snap.name || "Герой"}
                                        className="size-7 rounded-full object-cover border border-border shrink-0"
                                      />
                                    ) : (
                                      <div className="size-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0 border border-border">
                                        <User className="size-3.5" />
                                      </div>
                                    )}
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-semibold text-foreground truncate">
                                          {snap.name || "Безымянный"}
                                        </span>
                                        {p.isHost && (
                                          <span title="Ведущий комнаты">
                                            <Crown className="size-3 text-amber-500 fill-amber-500 shrink-0 inline-block" />
                                          </span>
                                        )}
                                        {isMe && (
                                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 text-emerald-600 border-emerald-500/40">
                                            Вы
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-[11px] text-muted-foreground truncate">
                                        {snap.race || "Герой"} • {snap.className || snap.class || "Приключенец"} ({snap.level || activeRoom.startingLevel} ур.)
                                      </p>
                                    </div>
                                  </div>

                                  <div className="shrink-0 flex items-center gap-1">
                                    {p.isReady ? (
                                      <span className="flex items-center gap-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                                        <CheckCircle2 className="size-3" />
                                        Готов
                                      </span>
                                    ) : (
                                      <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                        <Clock className="size-3" />
                                        В сборе
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {(snap.hpMax !== undefined || snap.armorClass !== undefined) && (
                                  <div className="flex items-center gap-3 pt-1 border-t border-border/30 text-[10px] text-muted-foreground font-mono">
                                    {snap.hpMax !== undefined && (
                                      <span className="flex items-center gap-0.5">
                                        <Heart className="size-2.5 text-red-500" />
                                        {snap.hpMax} HP
                                      </span>
                                    )}
                                    {snap.armorClass !== undefined && (
                                      <span className="flex items-center gap-0.5">
                                        <Shield className="size-2.5 text-amber-500" />
                                        {snap.armorClass} КД
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Кнопки управления комнатой */}
                      <div className="pt-2 border-t border-border/50 flex flex-col gap-2">
                        {activeRoom.hostUserId === user?.id ? (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="w-full text-xs h-8 gap-1.5 cursor-pointer"
                            onClick={closeCampaignForFriends}
                            disabled={closingRoom}
                          >
                            <X className="size-3.5" />
                            Закрыть сетевую комнату
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full text-xs h-8 gap-1.5 text-muted-foreground hover:text-destructive border-border cursor-pointer"
                            onClick={leaveRoom}
                          >
                            <LogOut className="size-3.5" />
                            Покинуть комнату
                          </Button>
                        )}
                      </div>
                    </div>
                  </ScrollArea>
                </TabsContent>
              )}

              <TabsContent value="memory" className="flex-1 m-0 min-h-0">
                <ScrollArea className="h-full">
                  <div className="p-3 space-y-2">
                    {memories.length === 0 ? (
                      <div className="text-center text-xs text-muted-foreground py-8">
                        Важные факты появятся по ходу игры
                      </div>
                    ) : (
                      memories.map((m) => (
                        <MemoryCard key={m.id} memory={m} />
                      ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="events" className="flex-1 m-0 min-h-0">
                <ScrollArea className="h-full">
                  <div className="p-3 space-y-2">
                    {events.length === 0 ? (
                      <div className="text-center text-xs text-muted-foreground py-8">
                        События появятся по ходу игры
                      </div>
                    ) : (
                      events.map((e) => (
                        <EventCard key={e.id} event={e} />
                      ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </aside>
        )
      )}
      </div>

      {/* Setup modal */}
      {showCombatView && (
        <CombatView
          campaignId={activeCampaign?.id}
          combatId={activeCombat?.id}
          onClose={() => {
            setShowCombatView(false);
            if (activeCampaign?.id) loadActiveCombat(activeCampaign.id);
          }}
          onCombatEnd={async (summary: CombatEndSummary) => {
            setShowCombatView(false);
            setActiveCombat(null);
            await refreshActiveCampaign();
            const surv = summary.survivingCombatants.filter((c) => c.type === "player" || c.type === "companion");
            const survText = surv.map((c) => `${c.name} (HP: ${c.hpCurrent}/${c.hpMax})`).join(", ");
            const outcomeRu =
              summary.outcome === "victory"
                ? "Победа (все враги повержены)"
                : summary.outcome === "defeat"
                ? "Поражение отряда"
                : "Бой завершён";

            if (summary.outcome === "victory" && summary.xpPerPlayer && summary.xpPerPlayer > 0) {
              toast.success(`Победа! Каждый герой получает +${summary.xpPerPlayer} XP! (Всего ${summary.awardedXP} XP)`);
            } else {
              toast.success(`Бой завершён: ${outcomeRu}`);
            }

            const xpNote = summary.xpPerPlayer && summary.xpPerPlayer > 0 ? ` Награда отряду: +${summary.xpPerPlayer} XP каждому (всего ${summary.awardedXP} XP).` : "";
            const prompt = `[Тактический бой '${summary.name}' завершён за ${summary.rounds} раунд(ов). Результат: ${outcomeRu}.${xpNote} Состояние отряда: ${survText || "все живы"}. Опиши завершение битвы и продолжение приключения.]`;
            await sendMessage({ text: prompt });
          }}
        />
      )}

      {showSetup && (
        <SetupModal
          apiKey={apiKey}
          baseURL={baseURL}
          model={model}
          cheapModel={cheapModel}
          storyModel={storyModel}
          authMode={authMode}
          modelsList={modelsList}
          loadingModels={loadingModels}
          onApiKey={setApiKey}
          onBaseURL={setBaseURL}
          onModel={setModel}
          onCheapModel={setCheapModel}
          onStoryModel={setStoryModel}
          onAuthMode={setAuthMode}
          onReloadModels={() => loadModels(baseURL)}
          onOpenModelPicker={(role) => setActivePickerRole(role)}
          onClose={() => {
            setShowSetup(false);
            setTestResult(null);
          }}
          testingKey={testingKey}
          testResult={testResult}
          onTestKey={testApiKey}
        />
      )}

      {showCostModal && (
        <CostStatsModal
          isOpen={showCostModal}
          onClose={() => setShowCostModal(false)}
          stats={campaignStats}
          onResetStats={() => {
            setCampaignStats({
              totalCostRub: 0,
              totalTokens: 0,
              inputTokens: 0,
              outputTokens: 0,
              cachedTokens: 0,
              turnsCount: 0,
            });
            localStorage.removeItem("ai_campaign_stats");
            toast.success("Счётчик затрат сброшен");
          }}
          activeDmModel={model}
          activeCheapModel={cheapModel}
          activeStoryModel={storyModel}
          campaignName={activeCampaign?.name}
        />
      )}

      <D20RollModal
        open={showD20Modal}
        onOpenChange={setShowD20Modal}
        characters={characters}
        onRollSelect={handleD20RollSelect}
      />

      {activePickerRole && (
        <ModelPickerModal
          isOpen={Boolean(activePickerRole)}
          onClose={() => setActivePickerRole(null)}
          selectedModelId={
            activePickerRole === "dm"
              ? model
              : activePickerRole === "cheap"
              ? cheapModel
              : storyModel
          }
          onSelectModel={(selectedId) => {
            if (activePickerRole === "dm") setModel(selectedId);
            else if (activePickerRole === "cheap") setCheapModel(selectedId);
            else if (activePickerRole === "story") setStoryModel(selectedId);
          }}
          modelsList={modelsList}
          title={
            activePickerRole === "dm"
              ? "Выбор модели Ведущего (Основной ДМ)"
              : activePickerRole === "cheap"
              ? "Выбор служебной модели (Бухгалтерия)"
              : "Выбор модели сюжета (Арки и главы)"
          }
          roleBadge={
            activePickerRole === "dm"
              ? "Ведущий ДМ"
              : activePickerRole === "cheap"
              ? "Бухгалтер"
              : "Сюжетная арка"
          }
          description={
            activePickerRole === "dm"
              ? "Отвечает за нарратив, диалоги, принятие решений и тактику врагов в бою."
              : activePickerRole === "cheap"
              ? "Записывает воспоминания, журнал, сжимает старые сообщения и обновляет состояния NPC."
              : "Генерирует структуру кампании, злодеев и адаптивные новые главы на основе выборов игрока."
          }
        />
      )}

      {/* Create campaign modal */}
      {creatingCampaign && (
        <CreateCampaignModal
          name={newCampaignName}
          startingLevel={newCampaignStartingLevel}
          creating={creatingInProgress}
          onName={setNewCampaignName}
          onStartingLevel={setNewCampaignStartingLevel}
          onCreate={createCampaign}
          onClose={() => setCreatingCampaign(false)}
        />
      )}

      {/* Campaign list modal */}
      {showCampaignList && (
        <CampaignListModal
          campaigns={campaignsList}
          activeCampaignId={activeCampaign?.id}
          activatingId={activatingId}
          deletingId={deletingId}
          onActivate={activateCampaign}
          onDelete={deleteCampaign}
          onCreate={() => {
            setShowCampaignList(false);
            setCreatingCampaign(true);
          }}
          onClose={() => setShowCampaignList(false)}
        />
      )}

      {/* Story arc debug modal */}
      {showArcDebug && (
        <StoryArcModal
          arcState={arcState}
          spoilerConfirmed={arcSpoilerConfirmed}
          onConfirmSpoiler={() => setArcSpoilerConfirmed(true)}
          onGenerate={() => activeCampaign && startArcGeneration(activeCampaign.id, true)}
          onGenerateNextAct={() => activeCampaign && startNextActGeneration(activeCampaign.id)}
          generatingNextAct={generatingNextAct}
          onClose={() => setShowArcDebug(false)}
        />
      )}

      {/* Multiplayer Create Room modal */}
      <CreateRoomModal
        isOpen={showCreateRoom}
        onClose={() => setShowCreateRoom(false)}
      />

      {/* Multiplayer Join Room modal */}
      <JoinRoomModal
        isOpen={showJoinRoomModal}
        onClose={() => setShowJoinRoomModal(false)}
        onJoined={handleRoomJoined}
      />

      {/* Character Picker for Multiplayer Room */}
      {activeRoom && (
        <CharacterPickerModal
          isOpen={showPicker}
          roomCode={activeRoom.code}
          startingLevel={activeRoom.startingLevel || targetLevel || 1}
          onSelect={async (selected) => {
            if (activeRoom?.code) {
              try {
                const res = await fetch(`/api/room/${encodeURIComponent(activeRoom.code)}`);
                if (res.ok) {
                  const data = await res.json();
                  if (data?.room) {
                    setActiveRoom({
                      ...data.room,
                      participants: data.participants || data.room.participants || [],
                    });
                  }
                }
              } catch {}
            }
            refreshActiveCampaign();
            toast.success(`Персонаж ${selected.name} присоединился к отряду!`);
          }}
          onClose={() => setShowPicker(false)}
        />
      )}

      {/* Supabase Auth Modal */}
      <SupabaseAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={() => setShowAuthModal(false)}
      />

      {/* Import character modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="size-5" />
                Импорт персонажа
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Перенос листа из генератора персонажей. Характеристики, снаряжение,
                заклинания и предыстория попадут в память мастера.
              </p>

              <div className="space-y-2">
                <Label>Роль в кампании</Label>
                <Select value={importType} onValueChange={setImportType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="player">Персонаж игрока</SelectItem>
                    <SelectItem value="companion">Спутник</SelectItem>
                    <SelectItem value="npc">NPC</SelectItem>
                    <SelectItem value="enemy">Враг</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Выбор из аккаунта Supabase */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold text-sm flex items-center gap-1.5">
                    <span>🧙 Персонажи из вашего аккаунта</span>
                    {user && (
                      <span className="text-[11px] text-muted-foreground">({user.email})</span>
                    )}
                  </Label>
                  {user && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs px-2"
                      onClick={loadAccountCharacters}
                      disabled={loadingAccountCharacters}
                    >
                      {loadingAccountCharacters ? <Loader2 className="size-3 animate-spin" /> : "Обновить"}
                    </Button>
                  )}
                </div>

                {user ? (
                  loadingAccountCharacters ? (
                    <div className="flex items-center justify-center p-4 border rounded-md bg-muted/20 text-xs text-muted-foreground gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      Загрузка ваших персонажей из облака...
                    </div>
                  ) : accountCharacters.length > 0 ? (
                    <div className="max-h-48 overflow-y-auto space-y-1.5 border rounded-md p-2 bg-muted/10">
                      {accountCharacters.map((char) => {
                        const targetCampaignLevel = activeCampaign?.startingLevel ?? activeCampaign?.levelFrom ?? 1;
                        const isLevelMatch = importType !== "player" || char.level === targetCampaignLevel;

                        return (
                          <div
                            key={char.id}
                            className={`flex items-center justify-between p-2 rounded border transition text-xs ${
                              isLevelMatch
                                ? "bg-card hover:border-zinc-400 dark:hover:border-zinc-600"
                                : "bg-muted/20 border-dashed opacity-60"
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-foreground truncate">{char.name}</span>
                                {importType === "player" && (
                                  isLevelMatch ? (
                                    <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30 px-1 py-0 h-4 font-normal">
                                      ✓ Подходит
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px] text-zinc-500 border-zinc-300 dark:border-zinc-700 px-1 py-0 h-4 font-normal">
                                      Нужен {targetCampaignLevel} ур.
                                    </Badge>
                                  )
                                )}
                              </div>
                              <div className="text-[11px] text-muted-foreground truncate">
                                {char.race} • {char.className} • {char.level} ур. • КД {char.ac} • HP {char.hp}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              className="h-7 text-xs shrink-0 cursor-pointer"
                              disabled={importing || !isLevelMatch}
                              title={!isLevelMatch ? `Для этой кампании требуется ровно ${targetCampaignLevel} уровень` : undefined}
                              onClick={() => runImport({ character: char.rawSheet })}
                            >
                              Выбрать
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-3 border rounded-md bg-muted/20 text-xs text-muted-foreground text-center">
                      В вашем аккаунте пока нет сохранённых персонажей.
                    </div>
                  )
                ) : (
                  <div className="p-3 border border-border rounded-md bg-muted/30 flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">
                      Войдите в аккаунт, чтобы загрузить персонажей в 1 клик.
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs shrink-0 cursor-pointer"
                      onClick={() => setShowAuthModal(true)}
                    >
                      Войти
                    </Button>
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Код с сайта</Label>
                <div className="flex gap-2">
                  <Input
                    value={shareCode}
                    onChange={(e) => setShareCode(e.target.value)}
                    placeholder="Например ABCD2345 или ссылка"
                    disabled={importing}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") importFromCode();
                    }}
                  />
                  <Button onClick={importFromCode} disabled={importing || !shareCode.trim()}>
                    {importing ? <Loader2 className="size-4 animate-spin" /> : "Загрузить"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  На сайте-генераторе нажмите «🔗 Поделиться» — код скопируется в буфер.
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Или файл JSON</Label>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={importFromFile}
                  disabled={importing}
                >
                  {importing ? (
                    <Loader2 className="size-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="size-4 mr-2" />
                  )}
                  Выбрать файл, скачанный кнопкой «💾 JSON»
                </Button>
              </div>

              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setShowImport(false)}
                disabled={importing}
              >
                Закрыть
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ============ MESSAGE BUBBLE ============

function MessageBubble({
  role,
  content,
  error,
  metadata,
}: {
  role: "user" | "assistant" | "system";
  content: string;
  error?: string | null;
  metadata?: any;
}) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2 max-w-[80%]">
          <p className="text-sm whitespace-pre-wrap">{content}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="bg-card border rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%]">
        <div className="flex items-center gap-1.5 mb-1.5 text-xs text-muted-foreground">
          <Dices className="size-3" />
          Мастер
        </div>
        {content && (
          <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
            <MarkdownRenderer content={content} />
          </div>
        )}
        {role === "assistant" && metadata?.usage && (
          <div className="mt-2.5 pt-1.5 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
            <div className="flex items-center gap-1.5">
              <span>⏱️ {formatTokens(metadata.usage.totalTokens)} токенов</span>
              {metadata.usage.cachedTokens > 0 && (
                <span className="text-emerald-600 dark:text-emerald-400 text-[10px]">
                  (кеш: {formatTokens(metadata.usage.cachedTokens)})
                </span>
              )}
            </div>
            {metadata.costRub != null && (
              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                ~{formatRubles(metadata.costRub)}
              </span>
            )}
          </div>
        )}
        {error && (
          <div className="mt-2 text-sm text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/30 rounded-md p-2.5">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

// Простой markdown-рендерер
function MarkdownRenderer({ content }: { content: string }) {
  // Базовое форматирование: **bold**, *italic*, `code`, # заголовки
  const lines = content.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-2" />;
        // Заголовки
        if (line.startsWith("### "))
          return (
            <h3 key={i} className="font-bold text-base mt-2">
              {line.slice(4)}
            </h3>
          );
        if (line.startsWith("## "))
          return (
            <h2 key={i} className="font-bold text-lg mt-2">
              {line.slice(3)}
            </h2>
          );
        // Inline форматирование
        return (
          <p key={i} className="leading-relaxed">
            {formatInline(line)}
          </p>
        );
      })}
    </div>
  );
}

function formatInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // **bold**
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // *italic*
    const italicMatch = remaining.match(/\*(.+?)\*/);
    // `code`
    const codeMatch = remaining.match(/`(.+?)`/);

    const matches = [
      boldMatch ? { type: "bold" as const, match: boldMatch } : null,
      italicMatch ? { type: "italic" as const, match: italicMatch } : null,
      codeMatch ? { type: "code" as const, match: codeMatch } : null,
    ].filter(Boolean) as { type: "bold" | "italic" | "code"; match: RegExpMatchArray }[];

    if (matches.length === 0) {
      parts.push(remaining);
      break;
    }

    // Берём первое совпадение по позиции
    matches.sort((a, b) => (a.match.index || 0) - (b.match.index || 0));
    const first = matches[0];
    const idx = first.match.index || 0;

    if (idx > 0) {
      parts.push(remaining.slice(0, idx));
    }

    if (first.type === "bold") {
      parts.push(
        <strong key={key++} className="font-bold">
          {first.match[1]}
        </strong>
      );
    } else if (first.type === "italic") {
      parts.push(
        <em key={key++} className="italic">
          {first.match[1]}
        </em>
      );
    } else if (first.type === "code") {
      parts.push(
        <code
          key={key++}
          className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono"
        >
          {first.match[1]}
        </code>
      );
    }

    remaining = remaining.slice(idx + first.match[0].length);
  }

  return parts;
}

// ============ MEMORY CARD ============

function MemoryCard({ memory }: { memory: any }) {
  const categoryColors: Record<string, string> = {
    character: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    location: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    quest: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    world: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
    item: "bg-pink-500/15 text-pink-700 dark:text-pink-300",
    relationship: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    prophecy: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
    decision: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  };

  return (
    <div className="rounded-lg border bg-background/50 p-2.5 text-xs">
      <div className="flex items-center justify-between gap-2 mb-1">
        <Badge
          variant="outline"
          className={`text-[10px] px-1.5 ${categoryColors[memory.category] || ""}`}
        >
          {memory.category}
        </Badge>
        <span className="text-[10px] text-muted-foreground">
          ★{memory.importance}
        </span>
      </div>
      <div className="font-semibold mb-0.5">{memory.subject}</div>
      <div className="text-muted-foreground">{memory.content}</div>
    </div>
  );
}

// ============ EVENT CARD ============

function EventCard({ event }: { event: any }) {
  const typeIcons: Record<string, string> = {
    combat_start: "⚔️",
    combat_end: "🏁",
    exploration: "🧭",
    social: "💬",
    story: "📖",
    rest: "💤",
    level_up: "⬆️",
    death: "💀",
    quest: "📜",
    discovery: "🔍",
    character_update: "✏️",
  };

  return (
    <div
      className={`rounded-lg border p-2.5 text-xs ${
        event.isImportant
          ? "bg-amber-500/5 border-amber-500/30"
          : "bg-background/50"
      }`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-sm">{typeIcons[event.type] || "•"}</span>
        <Badge variant="outline" className="text-[10px] px-1.5">
          {event.type}
        </Badge>
      </div>
      <div className="text-foreground">{event.description}</div>
      {event.location && (
        <div className="text-[10px] text-muted-foreground mt-1">
          📍 {event.location}
        </div>
      )}
    </div>
  );
}

// ============ SETUP MODAL ============

function SetupModal({
  apiKey,
  baseURL,
  model,
  cheapModel,
  storyModel,
  authMode,
  modelsList,
  loadingModels,
  onApiKey,
  onBaseURL,
  onModel: _onModel,
  onCheapModel: _onCheapModel,
  onStoryModel: _onStoryModel,
  onAuthMode,
  onReloadModels,
  onOpenModelPicker,
  onClose,
  testingKey,
  testResult,
  onTestKey,
}: {
  apiKey: string;
  baseURL: string;
  model: string;
  cheapModel: string;
  storyModel: string;
  authMode: "bearer" | "x-api-key" | "raw";
  modelsList: Array<{
    id: string;
    name: string;
    supports_tools?: boolean;
    context_length?: number;
    pricing?: { input?: number; output?: number; cache_read?: number; prompt?: string; completion?: string; cache?: string };
  }>;
  loadingModels: boolean;
  onApiKey: (v: string) => void;
  onBaseURL: (v: string) => void;
  onModel: (v: string) => void;
  onCheapModel: (v: string) => void;
  onStoryModel: (v: string) => void;
  onAuthMode: (v: "bearer" | "x-api-key" | "raw") => void;
  onReloadModels: () => void;
  onOpenModelPicker: (role: "dm" | "cheap" | "story") => void;
  onClose: () => void;
  testingKey: boolean;
  testResult: { valid: boolean; message: string } | null;
  onTestKey: () => void;
}) {
  const renderModelCard = (
    roleId: "dm" | "cheap" | "story",
    title: string,
    badgeText: string,
    currentModelId: string,
    description: string,
    recommendation: string
  ) => {
    const currentModel = modelsList.find((m) => m.id === currentModelId);
    const ctx = currentModel?.context_length
      ? currentModel.context_length >= 1000000
        ? "1M"
        : `${Math.round(currentModel.context_length / 1000)}k`
      : null;
    const promptPrice = currentModel?.pricing?.prompt ?? (currentModel?.pricing?.input != null ? `${currentModel.pricing.input} ₽` : null);
    const compPrice = currentModel?.pricing?.completion ?? (currentModel?.pricing?.output != null ? `${currentModel.pricing.output} ₽` : null);

    return (
      <div className="space-y-2 p-3 rounded-lg border bg-card/60">
        <div className="flex items-center justify-between">
          <Label className="font-semibold text-sm">{title}</Label>
          <Badge variant="secondary" className="text-[10px]">{badgeText}</Badge>
        </div>
        <div className="flex items-center justify-between gap-3 p-2.5 rounded-md border bg-background/60">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-xs truncate text-foreground">
                {currentModel?.name || currentModelId}
              </span>
              {currentModel?.supports_tools && (
                <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 font-normal">
                  tools
                </Badge>
              )}
              {ctx && (
                <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5 font-normal">
                  {ctx}
                </Badge>
              )}
            </div>
            <div className="text-[11px] font-mono text-muted-foreground truncate mt-0.5">
              {currentModelId}
              {promptPrice && compPrice && (
                <span className="ml-2 text-amber-600 dark:text-amber-400">
                  ({promptPrice} / {compPrice})
                </span>
              )}
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs shrink-0 gap-1"
            onClick={() => onOpenModelPicker(roleId)}
          >
            <Search className="size-3" />
            Выбрать...
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground leading-normal">
          {description} <strong>Рекомендуется:</strong> {recommendation}
        </p>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Настройки AI (API и Модели)</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={onReloadModels}
              disabled={loadingModels}
              title="Обновить каталог моделей с провайдера"
            >
              {loadingModels ? <Loader2 className="size-3 mr-1 animate-spin" /> : null}
              Обновить модели
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Base URL (Кастомный API провайдера / прокси) */}
          <div className="space-y-1.5 p-3 rounded-lg border bg-card/60">
            <div className="flex items-center justify-between">
              <Label htmlFor="base-url" className="font-semibold text-sm flex items-center gap-1.5">
                <Globe className="size-3.5 text-amber-500" />
                API Base URL (Провайдер / Прокси / Зеркало)
              </Label>
              {baseURL !== "https://polza.ai/api/v1" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={() => onBaseURL("https://polza.ai/api/v1")}
                >
                  Сбросить на Polza.ai
                </Button>
              )}
            </div>
            <Input
              id="base-url"
              value={baseURL}
              onChange={(e) => onBaseURL(e.target.value)}
              placeholder="https://polza.ai/api/v1"
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Стандартный: <code>https://polza.ai/api/v1</code>. Поддерживает любые OpenAI-совместимые API, прокси или локальные серверы (LiteLLM, Ollama, OpenRouter).
            </p>
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key (Токен авторизации)</Label>
            <Input
              id="api-key"
              type="password"
              value={apiKey}
              onChange={(e) => onApiKey(e.target.value)}
              placeholder="Вставьте ваш API-токен"
            />
            <p className="text-xs text-muted-foreground">
              Получите ключ на <a href="https://polza.ai" target="_blank" rel="noreferrer" className="underline text-amber-600 dark:text-amber-400">polza.ai</a> (или у вашего провайдера). Ключ сохраняется локально в браузере.
            </p>
          </div>

          {/* Режим авторизации */}
          <div className="space-y-2">
            <Label htmlFor="auth-mode">Режим авторизации</Label>
            <Select value={authMode} onValueChange={(v) => onAuthMode(v as "bearer" | "x-api-key" | "raw")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bearer">Bearer (стандартный для Polza.ai / OpenAI)</SelectItem>
                <SelectItem value="x-api-key">x-api-key (Anthropic-стиль)</SelectItem>
                <SelectItem value="raw">Raw (без префикса)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 1. Основной ДМ */}
          {renderModelCard(
            "dm",
            "1. Основной ДМ (Ведущий игры)",
            "Нарратив и бои",
            model,
            "Ведёт рассказ, отыгрывает NPC, принимает решения и ведёт тактический бой.",
            "DeepSeek V4.1 Flash (1M контекст, 16.5₽/49.4₽, кеш 0.49₽)."
          )}

          {/* 2. Служебная модель */}
          {renderModelCard(
            "cheap",
            "2. Служебный помощник (Бухгалтерия)",
            "Экономия до 95%",
            cheapModel,
            "Запись памяти (record), обновление состояний NPC и сжатие старой истории.",
            "DeepSeek V4 Flash (4.18₽/8.37₽)."
          )}

          {/* 3. Генератор историй */}
          {renderModelCard(
            "story",
            "3. Генератор сюжета (Арки и главы)",
            "Just-in-Time сюжет",
            storyModel,
            "Генерация скелета кампании, злодеев и адаптивных новых глав по ходу игры.",
            "DeepSeek V4.1 Flash."
          )}

          {/* Тест ключа */}
          <Button
            variant="secondary"
            className="w-full"
            onClick={onTestKey}
            disabled={testingKey || !apiKey.trim()}
          >
            {testingKey ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Проверка подключения к API...
              </>
            ) : (
              "Проверить ключ и подключение"
            )}
          </Button>

          {testResult && (
            <div
              className={`text-sm rounded-md p-3 border ${
                testResult.valid
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                  : "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300"
              }`}
            >
              {testResult.message}
            </div>
          )}

          <div className="rounded-md bg-muted/50 p-3 text-xs space-y-1">
            <div className="font-medium text-foreground">Параметры подключения:</div>
            <div>• Эндпоинт: <code className="text-[10px]">{baseURL}</code></div>
            <div>• Кеширование: <span className="text-emerald-600 dark:text-emerald-400 font-medium">97% скидка на повторные токены контекста</span></div>
            <div>• Формат запросов: OpenAI-compatible <code>/chat/completions</code></div>
          </div>
          <div className="flex justify-end">
            <Button onClick={onClose}>Сохранить</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============ CREATE CAMPAIGN MODAL ============

function CreateCampaignModal({
  name,
  startingLevel,
  creating,
  onName,
  onStartingLevel,
  onCreate,
  onClose,
}: {
  name: string;
  startingLevel: number;
  creating: boolean;
  onName: (v: string) => void;
  onStartingLevel: (v: number) => void;
  onCreate: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Новая кампания</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Название */}
          <div className="space-y-2">
            <Label htmlFor="name">Название кампании *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => onName(e.target.value)}
              placeholder="Например: Забытые Королевства"
              autoFocus
            />
          </div>

          {/* Стартовый уровень */}
          <div className="space-y-2">
            <Label htmlFor="startingLevel">Стартовый уровень (1–20)</Label>
            <Input
              id="startingLevel"
              type="number"
              min={1}
              max={20}
              value={startingLevel}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                  onStartingLevel(Math.min(20, Math.max(1, val)));
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Все персонажи в этой кампании должны соответствовать текущему уровню отряда (на старте: {startingLevel} ур.).
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={creating}>
              Отмена
            </Button>
            <Button onClick={onCreate} disabled={!name.trim() || creating}>
              {creating ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Создаю...
                </>
              ) : (
                "Создать кампанию"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============ CAMPAIGN LIST MODAL ============

function CampaignListModal({
  campaigns,
  activeCampaignId,
  activatingId,
  deletingId,
  onActivate,
  onDelete,
  onCreate,
  onClose,
}: {
  campaigns: Campaign[];
  activeCampaignId?: string;
  activatingId: string | null;
  deletingId: string | null;
  onActivate: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  onCreate: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="max-w-2xl w-full max-h-[90vh] flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Мои кампании ({campaigns.length})</span>
            <Button variant="ghost" size="sm" onClick={onClose}>
              ✕
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto space-y-3">
          {campaigns.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="size-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm text-muted-foreground">
                У вас пока нет кампаний.
              </p>
              <Button className="mt-4" onClick={onCreate}>
                <Plus className="size-4 mr-2" />
                Создать первую
              </Button>
            </div>
          ) : (
            campaigns.map((c) => (
              <div
                key={c.id}
                className={`border rounded-lg p-4 transition ${
                  c.id === activeCampaignId
                    ? "border-primary/50 bg-accent/40"
                    : "border-border bg-card/50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-base truncate">{c.name}</h3>
                      {c.id === activeCampaignId && (
                        <Badge variant="secondary" className="border-border">
                          Выбрана
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-1.5">
                      <span>Стартовый уровень: {c.startingLevel || c.levelFrom || 1}</span>
                    </div>
                    {c.description && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                        {c.description}
                      </p>
                    )}
                    {c._count && (
                      <div className="text-[10px] text-muted-foreground mt-2 flex gap-3 flex-wrap">
                        <span>👤 {c._count.characters || 0} перс.</span>
                        <span>📜 {c._count.events || 0} соб.</span>
                        <span>🧠 {c._count.memories || 0} восп.</span>
                        <span>💬 {c._count.chatMessages || 0} сообщ.</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    {c.id === activeCampaignId ? (
                      <Button variant="outline" size="sm" disabled>
                        Выбрана
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => onActivate(c.id)}
                        disabled={activatingId === c.id || deletingId === c.id}
                      >
                        {activatingId === c.id ? (
                          <Loader2 className="size-3 mr-1 animate-spin" />
                        ) : null}
                        Выбрать
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-500/10"
                      onClick={() => onDelete(c.id, c.name)}
                      disabled={deletingId === c.id || activatingId === c.id}
                      title="Удалить кампанию"
                    >
                      {deletingId === c.id ? (
                        <Loader2 className="size-3 mr-1 animate-spin" />
                      ) : (
                        <Trash2 className="size-3 mr-1" />
                      )}
                      Удалить
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
        {campaigns.length > 0 && (
          <div className="border-t p-4 flex justify-between">
            <Button variant="ghost" onClick={onClose}>
              Закрыть
            </Button>
            <Button onClick={onCreate}>
              <Plus className="size-4 mr-2" />
              Создать кампанию
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

// ============ STORY ARC MODAL (дебаг сюжета) ============

// Кнопка видна всегда, но содержимое закрыто предупреждением: это полные
// спойлеры кампании, включая финал и тайны злодеев.
function StoryArcModal({
  arcState,
  spoilerConfirmed,
  onConfirmSpoiler,
  onGenerate,
  onGenerateNextAct,
  generatingNextAct,
  onClose,
}: {
  arcState: ArcState | null;
  spoilerConfirmed: boolean;
  onConfirmSpoiler: () => void;
  onGenerate: () => void;
  onGenerateNextAct?: () => void;
  generatingNextAct?: boolean;
  onClose: () => void;
}) {
  const arc = arcState?.arc ?? null;
  const status = arcState?.status ?? "none";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-3xl max-h-[90vh] flex flex-col">
        <CardHeader className="shrink-0">
          <CardTitle className="flex items-center gap-2">
            <Scroll className="size-5 text-amber-500" />
            Сюжет кампании
            <Badge variant="outline" className="ml-1 text-xs font-normal">
              дебаг
            </Badge>
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 min-h-0 overflow-y-auto space-y-4">
          {status === "none" && (
            <div className="space-y-3 py-4 text-center">
              <p className="text-sm text-muted-foreground">
                Для этой кампании история заранее не писалась. Мастер ведёт игру
                импровизируя.
              </p>
              <Button onClick={onGenerate}>
                <Sparkles className="size-4 mr-2" />
                Сгенерировать историю сейчас
              </Button>
            </div>
          )}

          {status === "generating" && (
            <div className="py-8 text-center space-y-2">
              <Loader2 className="size-8 mx-auto animate-spin text-amber-500" />
              <p className="text-sm font-medium">{arcState?.progress?.stageLabel}</p>
              <p className="text-xs text-muted-foreground">
                Готово актов: {arcState?.progress?.actsDone ?? 0} из{" "}
                {arcState?.progress?.actsTotal ?? "?"}
              </p>
            </div>
          )}

          {status === "failed" && (
            <div className="space-y-3 py-4 text-center">
              <p className="text-sm text-red-600">
                История не сгенерировалась: {arcState?.progress?.error || "ошибка"}
              </p>
              <Button variant="outline" onClick={onGenerate}>
                Попробовать снова
              </Button>
            </div>
          )}

          {status === "ready" && !spoilerConfirmed && (
            <div className="space-y-4 py-8 text-center">
              <div className="text-4xl">⚠️</div>
              <div className="space-y-1">
                <p className="font-medium">Здесь полные спойлеры</p>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Дальше — вся история целиком: повороты, тайны злодеев и финал.
                  Прочитав это, ты лишишь себя всей интриги кампании.
                </p>
              </div>
              <div className="flex justify-center gap-2">
                <Button variant="outline" onClick={onClose}>
                  Не показывать
                </Button>
                <Button variant="destructive" onClick={onConfirmSpoiler}>
                  Всё равно показать
                </Button>
              </div>
            </div>
          )}

          {status === "ready" && spoilerConfirmed && arc && (
            <div className="space-y-5">
              <div className="space-y-1">
                <h3 className="text-lg font-bold">{arc.title}</h3>
                <p className="text-xs text-muted-foreground">
                  Уровни {arc.levelFrom}–{arc.levelTo} • {arc.acts.length} актов • модель{" "}
                  {arc.model}
                </p>
              </div>

              <section className="space-y-1">
                <h4 className="text-sm font-semibold text-amber-600">Завязка</h4>
                <p className="text-sm whitespace-pre-wrap">{arc.premise}</p>
              </section>

              <section className="space-y-1">
                <h4 className="text-sm font-semibold text-amber-600">Главная угроза</h4>
                <p className="text-sm whitespace-pre-wrap">{arc.mainThreat}</p>
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-semibold text-amber-600">Злодеи</h4>
                {arc.villains.map((v, i) => (
                  <div key={i} className="rounded-md border p-3 space-y-1 text-sm">
                    <div className="font-medium">
                      {v.name}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        — {v.role}
                        {v.appearsInAct ? ` • появляется в акте ${v.appearsInAct}` : ""}
                      </span>
                    </div>
                    <p>
                      <span className="text-muted-foreground">Мотив: </span>
                      {v.motivation}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Тайна: </span>
                      {v.secret}
                    </p>
                  </div>
                ))}
              </section>

              <section className="space-y-3">
                <h4 className="text-sm font-semibold text-amber-600">Акты</h4>
                {arc.acts.map((a, i) => (
                  <div
                    key={i}
                    className={`rounded-md border p-3 space-y-2 text-sm ${
                      i === (arcState?.currentAct ?? 0) ? "border-amber-500/60 bg-amber-500/5" : ""
                    }`}
                  >
                    <div className="font-medium">
                      Акт {i + 1}: {a.name}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        уровни {a.levelFrom}–{a.levelTo}
                      </span>
                      {i === (arcState?.currentAct ?? 0) && (
                        <Badge className="ml-2 text-xs">текущий</Badge>
                      )}
                    </div>
                    <p>
                      <span className="text-muted-foreground">Цель: </span>
                      {a.goal}
                    </p>
                    <p className="whitespace-pre-wrap">{a.summary}</p>

                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-muted-foreground">Сцены</div>
                      {a.scenes.map((s, j) => (
                        <div key={j} className="pl-3 border-l-2 border-muted space-y-0.5">
                          <div className="font-medium text-xs">
                            {s.name}{" "}
                            <span className="font-normal text-muted-foreground">
                              ({s.location})
                            </span>
                          </div>
                          <p className="text-xs">{s.description}</p>
                          <p className="text-xs text-muted-foreground">
                            Энкаунтер: {s.encounter}
                          </p>
                        </div>
                      ))}
                    </div>

                    <p className="text-xs">
                      <span className="font-semibold text-amber-600">Поворот: </span>
                      {a.twist}
                    </p>

                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold text-muted-foreground">Развилки</div>
                      {a.branches.map((b, j) => (
                        <p key={j} className="text-xs pl-3">
                          Если игрок {b.ifPlayer} → {b.then}
                        </p>
                      ))}
                    </div>

                    <p className="text-xs">
                      <span className="text-muted-foreground">Награды: </span>
                      {a.rewards}
                    </p>
                  </div>
                ))}
              </section>

              <section className="space-y-1">
                <h4 className="text-sm font-semibold text-amber-600">Финал</h4>
                <p className="text-sm whitespace-pre-wrap">{arc.finale}</p>
              </section>
            </div>
          )}
        </CardContent>

        <div className="border-t p-4 flex justify-between items-center gap-2 shrink-0 flex-wrap">
          <Button variant="ghost" onClick={onClose}>
            Закрыть
          </Button>
          <div className="flex items-center gap-2">
            {status === "ready" && onGenerateNextAct && (
              <Button
                variant="outline"
                className="border-amber-600/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20"
                onClick={onGenerateNextAct}
                disabled={generatingNextAct}
              >
                {generatingNextAct ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Генерирую Акт {(arc?.acts?.length || 1) + 1}...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4 mr-2 text-amber-500" />
                    Сгенерировать следующий акт
                  </>
                )}
              </Button>
            )}
            {status === "ready" && (
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={onGenerate}>
                Переписать заново
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
