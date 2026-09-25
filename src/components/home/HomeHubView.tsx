"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Radio,
  Swords,
  BookOpen,
  Plus,
  Users,
  Settings,
  Sparkles,
  Loader2,
  Share2,
  LogIn,
} from "lucide-react";
import { toast } from "sonner";
import { useDnDStore, type Campaign } from "@/lib/store";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { CreateRoomModal } from "@/components/room/CreateRoomModal";
import { CreateCampaignModal } from "@/components/campaign/CreateCampaignModal";
import { SetupModal } from "@/components/dnd/SetupModal";
import { ModelPickerModal } from "@/components/dnd/ModelPickerModal";
import { SupabaseAuthModal } from "@/components/auth/SupabaseAuthModal";

export function HomeHubView() {
  const router = useRouter();
  const { user, getAuthToken, signOut: supabaseSignOut } = useSupabaseAuth();
  const {
    campaigns,
    setCampaigns,
  } = useDnDStore();

  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [joiningRoom, setJoiningRoom] = useState(false);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showCreateCampaign, setShowCreateCampaign] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState("");
  const [newCampaignLevel, setNewCampaignLevel] = useState(1);
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // API settings state
  const [apiKey, setApiKey] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("ai_api_key") || "";
  });
  const [model, setModel] = useState(() => {
    if (typeof window === "undefined") return "deepseek/deepseek-v4.1-flash";
    return localStorage.getItem("ai_model") || "deepseek/deepseek-v4.1-flash";
  });
  const [cheapModel, setCheapModel] = useState(() => {
    if (typeof window === "undefined") return "deepseek/deepseek-v4-flash";
    return localStorage.getItem("ai_cheap_model") || "deepseek/deepseek-v4-flash";
  });
  const [storyModel, setStoryModel] = useState(() => {
    if (typeof window === "undefined") return "deepseek/deepseek-v4.1-flash";
    return localStorage.getItem("ai_story_model") || "deepseek/deepseek-v4.1-flash";
  });
  const [baseURL, setBaseURL] = useState(() => {
    if (typeof window === "undefined") return "https://polza.ai/api/v1";
    return localStorage.getItem("ai_base_url") || "https://polza.ai/api/v1";
  });
  const [authMode, setAuthMode] = useState<"bearer" | "x-api-key" | "raw">(() => {
    if (typeof window === "undefined") return "bearer";
    return (localStorage.getItem("ai_auth_mode") as any) || "bearer";
  });
  const [modelsList, setModelsList] = useState<any[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [activePickerRole, setActivePickerRole] = useState<"dm" | "cheap" | "story" | null>(null);
  const [testingKey, setTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ valid: boolean; message: string } | null>(null);

  const loadModels = useCallback(async (customBaseURL?: string) => {
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
        }
      }
    } catch (e) {
      console.error("loadModels error:", e);
    } finally {
      setLoadingModels(false);
    }
  }, [baseURL, apiKey]);

  const testApiKey = async () => {
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
  };

  const handleSaveSettings = () => {
    localStorage.setItem("ai_api_key", apiKey);
    localStorage.setItem("ai_base_url", baseURL);
    localStorage.setItem("ai_model", model);
    localStorage.setItem("ai_cheap_model", cheapModel);
    localStorage.setItem("ai_story_model", storyModel);
    localStorage.setItem("ai_auth_mode", authMode);
    toast.success("Настройки AI сохранены!");
    setShowSettings(false);
    setTestResult(null);
  };

  const loadInitialData = useCallback(async () => {
    try {
      const token = getAuthToken();
      const campRes = await fetch("/api/campaign", {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      }).catch(() => null);
      if (campRes && campRes.ok) {
        const data = await campRes.json().catch(() => null);
        if (Array.isArray(data?.campaigns)) {
          setCampaigns(data.campaigns);
        }
      }
    } catch {}
  }, [setCampaigns, getAuthToken]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Быстрый переход в комнату по коду
  const handleJoinByCode = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = roomCodeInput.trim().toUpperCase();
    if (!clean) {
      toast.error("Введите код стола (например, TAVERN-612)");
      return;
    }
    setJoiningRoom(true);
    router.push(`/room/${encodeURIComponent(clean)}`);
  };

  // Создание новой кампании
  const handleCreateCampaign = async () => {
    if (!newCampaignName.trim()) return;
    setCreatingCampaign(true);
    try {
      const token = getAuthToken();
      const res = await fetch("/api/campaign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: newCampaignName.trim(),
          startingLevel: newCampaignLevel,
          levelFrom: newCampaignLevel,
          levelTo: Math.min(20, newCampaignLevel + 4),
          setting: "Forgotten Realms",
          tone: "heroic",
          difficulty: "normal",
          language: "ru",
          makeActive: true,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.campaign) {
        toast.error(data?.error || `Ошибка при создании кампании (код ${res.status})`);
        return;
      }
      toast.success("Кампания успешно создана!");
      setShowCreateCampaign(false);
      setNewCampaignName("");
      setNewCampaignLevel(1);
      await loadInitialData();
      router.push(`/campaign/${data.campaign.id}`);
    } catch (err: any) {
      toast.error(`Ошибка: ${err?.message || "Сбой связи с сервером"}`);
    } finally {
      setCreatingCampaign(false);
    }
  };

  // Открыть стол для кампании
  const handleOpenRoomForCampaign = async (camp: Campaign) => {
    try {
      const token = getAuthToken();
      const res = await fetch("/api/room/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          campaignId: camp.id,
          name: `Стол: ${camp.name}`,
          startingLevel: camp.startingLevel || camp.levelFrom || 1,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.room) {
        toast.error(data?.error || `Не удалось создать комнату стола (код ${res.status})`);
        return;
      }
      toast.success(`Сетевой стол создан! Код: ${data.room.code}`);
      router.push(`/room/${data.room.code}`);
    } catch (err: any) {
      toast.error(`Ошибка: ${err?.message || "Сбой при открытии стола"}`);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Шапка хаба */}
      <header className="border-b border-border/40 bg-card/60 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Swords className="size-5" />
            </div>
            <div>
              <span className="font-bold text-base sm:text-lg tracking-tight">D&D AI Master</span>
              <span className="hidden sm:inline-block ml-2 text-xs text-muted-foreground">
                • Персональный ИИ-Мастер Подземелий
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowSettings(true);
                if (modelsList.length === 0 && !loadingModels) {
                  loadModels();
                }
              }}
              className="gap-1.5 text-xs h-9 cursor-pointer"
            >
              <Settings className="size-3.5" />
              <span>Настройки</span>
            </Button>

            {user ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <div
                  className="h-9 px-2.5 rounded-md text-xs font-medium border border-border bg-accent/40 text-foreground flex items-center gap-1.5 shadow-xs"
                  title={`Вы вошли как: ${user.email || "Игрок"}`}
                >
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="max-w-[130px] truncate font-sans">{user.email?.split("@")[0] || "Герой"}</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => supabaseSignOut()}
                  title="Выйти из аккаунта"
                  className="h-9 px-2.5 rounded-md text-xs font-medium text-muted-foreground hover:text-destructive cursor-pointer"
                >
                  Выйти
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={() => setShowAuthModal(true)}
                title="Войти в аккаунт через Google или почту"
                className="h-9 px-3 rounded-md text-xs font-medium gap-1.5 cursor-pointer shadow-xs"
              >
                <LogIn className="size-3.5 shrink-0" />
                <span className="hidden sm:inline">Войти в аккаунт</span>
                <span className="sm:hidden">Войти</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Основной контент дашборда */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 space-y-8">
        {/* Приветственный блок и быстрые действия */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Карточка 1: Вход по коду стола */}
          <Card className="border border-border/80 bg-card shadow-sm hover:border-emerald-500/40 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Radio className="size-4 animate-pulse" />
                </div>
                <div>
                  <CardTitle className="text-base sm:text-lg">Присоединиться к столу</CardTitle>
                  <CardDescription className="text-xs">
                    Для игроков: введите код, полученный от вашего ведущего
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleJoinByCode} className="flex gap-2">
                <Input
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                  placeholder="TAVERN-612"
                  className="font-mono uppercase tracking-wider text-sm font-semibold"
                />
                <Button
                  type="submit"
                  disabled={joiningRoom || !roomCodeInput.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 cursor-pointer"
                >
                  {joiningRoom ? <Loader2 className="size-4 animate-spin" /> : "Войти в стол"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Карточка 2: Создать сетевой стол */}
          <Card className="border border-border/80 bg-card shadow-sm hover:border-amber-500/40 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Users className="size-4" />
                </div>
                <div>
                  <CardTitle className="text-base sm:text-lg">Создать сетевой стол</CardTitle>
                  <CardDescription className="text-xs">
                    Соберите друзей для совместной игры с пошаговыми ходами отряда
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Быстрый старт лобби с генератором кода</span>
              <Button
                onClick={() => setShowCreateRoom(true)}
                className="bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
              >
                <Plus className="size-4 mr-1.5" />
                Создать комнату
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Секция: Кампании и сюжеты */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="size-5 text-amber-500" />
              <h2 className="text-lg font-bold tracking-tight">Кампании и приключения</h2>
              {campaigns.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {campaigns.length}
                </Badge>
              )}
            </div>
            <Button
              size="sm"
              onClick={() => setShowCreateCampaign(true)}
              className="gap-1.5 text-xs cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>Новая кампания</span>
            </Button>
          </div>

          {campaigns.length === 0 ? (
            <Card className="border-dashed border-border bg-card/40 p-8 text-center space-y-3">
              <div className="mx-auto size-12 rounded-full bg-muted/40 flex items-center justify-center text-muted-foreground">
                <Sparkles className="size-6 text-amber-500" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold">У вас пока нет созданных кампаний</h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Создайте новую кампанию для одиночной игры с ИИ-Мастером или откройте сетевой стол для игры с друзьями.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateCampaign(true)}
                className="text-xs cursor-pointer"
              >
                <Plus className="size-3.5 mr-1" />
                Создать первое приключение
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {campaigns.map((camp) => (
                <Card
                  key={camp.id}
                  className="border border-border/80 bg-card hover:shadow-md transition-shadow flex flex-col justify-between"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base font-bold truncate">{camp.name}</CardTitle>
                      <Badge variant="outline" className="text-[11px] shrink-0">
                        {camp.startingLevel || camp.levelFrom || 1} ур.
                      </Badge>
                    </div>
                    <CardDescription className="text-xs line-clamp-2">
                      {camp.description || `${camp.setting || "Forgotten Realms"} • ${camp.tone || "Героическое"}`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/campaign/${camp.id}`)}
                      className="flex-1 text-xs h-8 cursor-pointer"
                    >
                      <span>Играть соло</span>
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleOpenRoomForCampaign(camp)}
                      className="flex-1 text-xs h-8 bg-amber-600 hover:bg-amber-700 text-white cursor-pointer gap-1"
                    >
                      <Share2 className="size-3" />
                      <span>Открыть стол</span>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Модальное окно создания кампании */}
      {showCreateCampaign && (
        <CreateCampaignModal
          name={newCampaignName}
          startingLevel={newCampaignLevel}
          creating={creatingCampaign}
          onName={setNewCampaignName}
          onStartingLevel={setNewCampaignLevel}
          onCreate={handleCreateCampaign}
          onClose={() => setShowCreateCampaign(false)}
        />
      )}

      {/* Модальное окно создания комнаты стола */}
      {showCreateRoom && (
        <CreateRoomModal
          isOpen={showCreateRoom}
          onClose={() => setShowCreateRoom(false)}
          onRoomCreated={(roomCode) => {
            setShowCreateRoom(false);
            router.push(`/room/${roomCode}`);
          }}
        />
      )}

      {/* Модальное окно настроек AI */}
      {showSettings && (
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
          onClose={handleSaveSettings}
          testingKey={testingKey}
          testResult={testResult}
          onTestKey={testApiKey}
        />
      )}

      {/* Модальное окно выбора модели из каталога */}
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
              ? "Выбор служебной модели (быстрые ответы, механики)"
              : "Выбор модели генератора сюжета"
          }
        />
      )}

      {/* Supabase Auth Modal */}
      <SupabaseAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={() => {
          setShowAuthModal(false);
          loadInitialData();
        }}
      />
    </div>
  );
}
