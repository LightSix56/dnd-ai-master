"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import type { Room, RoomParticipant } from "@/lib/room/types";
import type { TypingUser } from "./LiveTypingIndicator";
import { CharacterPickerModal } from "./CharacterPickerModal";
import { RoomCampaignSetupModal, CampaignSetupFormValues } from "./RoomCampaignSetupModal";
import { SupabaseAuthModal } from "@/components/auth/SupabaseAuthModal";
import { CoopTurnBar } from "./CoopTurnBar";
import { copyToClipboard } from "@/lib/utils";
import {
  Dices,
  Link,
  Shield,
  Heart,
  Crown,
  User,
  CheckCircle2,
  Clock,
  Sparkles,
  Swords,
  Loader2,
} from "lucide-react";

interface RoomLobbyProps {
  roomCode: string;
  onLeave?: () => void;
  onCampaignStarted?: (campaignId: string) => void;
  onStartStorySetup?: () => void;
}

export function RoomLobby({
  roomCode,
  onLeave,
  onCampaignStarted,
  onStartStorySetup,
}: RoomLobbyProps) {
  const { user, getAuthToken } = useSupabaseAuth();

  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [activeTurn, setActiveTurn] = useState<any>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, TypingUser>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [showPicker, setShowPicker] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/room/${encodeURIComponent(roomCode)}`);
      if (!res.ok) {
        throw new Error("Не удалось загрузить данные комнаты");
      }
      const data = await res.json();
      setRoom(data.room);
      setParticipants(data.participants || []);
      setActiveTurn(data.activeTurn || null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [roomCode]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 2500);
    return () => clearInterval(interval);
  }, [refresh]);

  const currentParticipant = participants.find((p) => p.userId === user?.id) || null;
  const isHost = currentParticipant?.isHost ?? false;
  const isReady = currentParticipant?.isReady ?? false;

  async function toggleReady() {
    if (!currentParticipant) return;
    try {
      const token = getAuthToken();
      await fetch(`/api/room/${encodeURIComponent(roomCode)}/ready`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ isReady: !isReady }),
      });
      refresh();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleStartCampaign(values: CampaignSetupFormValues) {
    setIsGeneratingStory(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/room/${encodeURIComponent(roomCode)}/start-campaign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Не удалось запустить кампанию");
      }

      const json = await res.json();
      setShowSetupModal(false);
      refresh();
      if (onCampaignStarted && json.campaignId) {
        onCampaignStarted(json.campaignId);
      }
    } finally {
      setIsGeneratingStory(false);
    }
  }

  async function handleCopyInviteLink() {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/room/${roomCode}`;
    await copyToClipboard(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function sendTypingStatus(isTyping: boolean) {
    if (!user) return;
    setTypingUsers((prev) => {
      const next = { ...prev };
      if (!isTyping) {
        delete next[user.id];
      } else {
        next[user.id] = {
          characterName: currentParticipant?.characterSnapshot?.name || user.email || "Игрок",
          timestamp: Date.now(),
        };
      }
      return next;
    });
  }

  async function submitAction(actionText: string): Promise<boolean> {
    const token = getAuthToken();
    const res = await fetch(`/api/room/${encodeURIComponent(roomCode)}/turn`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ actionText }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.error || "Не удалось отправить действие");
    }
    await refresh();
    return true;
  }

  async function resolveTurn() {
    const token = getAuthToken();
    const res = await fetch(`/api/room/${encodeURIComponent(roomCode)}/turn/resolve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.error || "Не удалось разрешить раунд");
    }
    await refresh();
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-zinc-500 font-sans">
        <Loader2 className="size-8 animate-spin" />
        <p className="mt-3 text-sm font-medium">Загрузка лобби комнаты...</p>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-white p-6 text-center shadow-lg dark:border-red-900/50 dark:bg-zinc-950 font-sans">
        <h3 className="text-xl font-semibold text-red-600 dark:text-red-400">Ошибка комнаты</h3>
        <p className="mt-2 text-xs text-zinc-500">{error || "Комната не найдена."}</p>
        <button
          type="button"
          onClick={onLeave || (() => window.history.back())}
          className="mt-4 rounded-md bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 cursor-pointer"
        >
          Вернуться назад
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-6 font-sans text-zinc-950 dark:text-zinc-50">
      {/* ── Шапка комнаты ── */}
      <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-100 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 shrink-0">
              <Dices className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                  {room.name}
                </h1>
                <span className="rounded-md border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                  {room.startingLevel} уровень
                </span>
                <span className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 font-mono">
                  {room.code}
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Сбор отряда перед началом приключения. ИИ-Мастер начнёт рассказ после сбора героев.
              </p>
            </div>
          </div>

          {/* Кнопка приглашения */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyInviteLink}
              className="flex items-center gap-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3.5 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 shadow-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 active:scale-95 transition-all cursor-pointer"
            >
              <Link className="size-3.5" />
              <span>{copied ? "Ссылка скопирована! ✓" : "Скопировать ссылку для друзей"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Блок активной кампании и пошаговой игры ── */}
      {room.status === "active" && (
        <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-3">
            <div className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
              <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
              <span>
                {(room.storyArc as any)?.act1?.title ||
                  (room.campaignSettings as any)?.title ||
                  "Акт 1: Начало приключения"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                const campId =
                  room.campaignId ||
                  (room.campaignSettings as Record<string, any>)?.campaignId;
                if (campId && onCampaignStarted) {
                  onCampaignStarted(campId);
                } else if (onLeave) {
                  onLeave();
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 cursor-pointer shadow-xs"
            >
              <Swords className="size-3.5" />
              <span>Открыть полный лист и журнал</span>
            </button>
          </div>

          {/* Хроника и последнее описание Мастера */}
          <div className="space-y-2 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
            {activeTurn?.dmResponse ? (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 p-3.5 italic">
                <div className="mb-1 text-xs font-semibold not-italic uppercase tracking-wider text-zinc-500">
                  Ведущий (Dungeon Master) • Раунд {Math.max(1, (activeTurn.roundNumber || 1) - 1)}:
                </div>
                <div className="whitespace-pre-line text-zinc-900 dark:text-zinc-100">{activeTurn.dmResponse}</div>
              </div>
            ) : (room.storyArc as any)?.act1?.synopsis ? (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 p-3.5">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Вводная сцена Акта 1:
                </div>
                <p className="whitespace-pre-line text-zinc-900 dark:text-zinc-100">
                  {(room.storyArc as any)?.act1?.synopsis}
                </p>
              </div>
            ) : (
              <p className="text-xs text-zinc-500">
                Кампания активна. Опишите действия своих персонажей в строке ниже.
              </p>
            )}
          </div>

          {/* Интерактивная строка совместного хода */}
          <CoopTurnBar
            roomCode={roomCode}
            activeTurn={activeTurn}
            participants={participants}
            currentParticipant={currentParticipant}
            isHost={isHost}
            typingUsers={typingUsers}
            onSendTyping={sendTypingStatus}
            onSubmitAction={submitAction}
            onResolveTurn={resolveTurn}
            className="rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-xs"
          />
        </div>
      )}

      {/* ── Сетка отряда ── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <User className="size-4 text-zinc-600 dark:text-zinc-400" />
            <span>Отряд приключенцев ({participants.length} игроков)</span>
          </h2>
          <span className="text-xs text-zinc-500">
            Требуется ровно <strong className="text-zinc-900 dark:text-zinc-100 font-medium">{room.startingLevel}-й уровень</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {participants.map((p) => {
            const char = p.characterSnapshot;
            const isMe = p.userId === user?.id;

            return (
              <div
                key={p.id}
                className={`relative flex flex-col rounded-xl border p-4 transition-all shadow-xs ${
                  p.isReady
                    ? "border-emerald-500/40 bg-white dark:bg-zinc-900"
                    : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
                }`}
              >
                {/* Бейджи роли и готовности */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    {p.isHost ? (
                      <span className="flex items-center gap-1 rounded-md bg-zinc-900 px-2 py-0.5 text-[11px] font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
                        <Crown className="size-3" />
                        Ведущий
                      </span>
                    ) : (
                      <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        Игрок {isMe ? "(Вы)" : ""}
                      </span>
                    )}
                  </div>

                  {p.isReady ? (
                    <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400 text-[11px]">
                      <CheckCircle2 className="size-3.5" />
                      Готов
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-zinc-500 text-[11px]">
                      <Clock className="size-3.5" />
                      Выбирает...
                    </span>
                  )}
                </div>

                {/* Аватар и имена */}
                <div className="mt-3 flex items-center gap-3">
                  {char && (char as Record<string, unknown>).portraitUrl ? (
                    <img
                      src={String((char as Record<string, unknown>).portraitUrl)}
                      alt={char ? String((char as Record<string, unknown>).name || "Персонаж") : "Персонаж"}
                      className="h-12 w-12 rounded-full border border-zinc-200 dark:border-zinc-700 object-cover shrink-0"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 shrink-0">
                      <User className="size-5" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {char ? String((char as Record<string, unknown>).name || "Персонаж без имени") : "Выбирает героя..."}
                    </h3>
                    <p className="truncate text-xs text-zinc-500 mt-0.5">
                      {char
                        ? `${String((char as Record<string, unknown>).race || "Раса не указана")} • ${String((char as Record<string, unknown>).className || "Класс не указан")}`
                        : "Ожидание выбора"}
                    </p>
                    {char && (
                      <span className="inline-block mt-1 rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700 dark:text-zinc-300">
                        {String((char as Record<string, unknown>).level || room.startingLevel)} ур.
                      </span>
                    )}
                  </div>
                </div>

                {/* Параметры героя */}
                {char && (
                  <div className="mt-3 flex items-center gap-4 border-t border-zinc-100 dark:border-zinc-800 pt-2 text-xs text-zinc-600 dark:text-zinc-400">
                    {(char as Record<string, unknown>).hpMax !== undefined && (char as Record<string, unknown>).hpMax !== null && (
                      <div className="flex items-center gap-1">
                        <Heart className="size-3.5 text-zinc-500" />
                        <span className="font-medium text-zinc-800 dark:text-zinc-200">{String((char as Record<string, unknown>).hpMax)} HP</span>
                      </div>
                    )}
                    {(char as Record<string, unknown>).armorClass !== undefined && (char as Record<string, unknown>).armorClass !== null && (
                      <div className="flex items-center gap-1">
                        <Shield className="size-3.5 text-zinc-500" />
                        <span className="font-medium text-zinc-800 dark:text-zinc-200">{String((char as Record<string, unknown>).armorClass)} КД</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Карточка-заглушка для приглашения сопартийцев */}
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/30 p-6 text-center text-zinc-500 min-h-[140px]">
            <Sparkles className="size-5 text-zinc-400 mb-1.5" />
            <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200">Ожидание сопартийцев...</p>
            <p className="mt-1 text-[11px] text-zinc-500 max-w-xs">
              Отправьте ссылку друзьям, чтобы они присоединились к приключению.
            </p>
          </div>
        </div>
      </div>

      {/* ── Нижняя панель действий ── */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-zinc-600 dark:text-zinc-400">
            {!user ? (
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                Войдите в учётную запись, чтобы выбрать персонажа и занять место в отряде.
              </span>
            ) : currentParticipant ? (
              <span>
                Вы играете за героя:{" "}
                <strong className="text-zinc-900 dark:text-zinc-100 font-medium">{currentParticipant.characterSnapshot.name}</strong>{" "}
                ({currentParticipant.isReady ? "Готов к походу ✓" : "Готовность не подтверждена ⏳"})
              </span>
            ) : (
              <span>Вы в комнате как наблюдатель. Выберите персонажа, чтобы войти в отряд.</span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {!user ? (
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="rounded-md bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 cursor-pointer"
              >
                Войти в учётную запись
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setShowPicker(true)}
                  className="rounded-md border border-zinc-300 bg-white px-3.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  {currentParticipant ? "Сменить персонажа" : "Выбрать персонажа"}
                </button>

                {currentParticipant && (
                  <button
                    type="button"
                    onClick={toggleReady}
                    className={`rounded-md border px-4 py-2 text-xs font-medium transition-all cursor-pointer shadow-xs ${
                      isReady
                        ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
                        : "border-zinc-300 bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                    }`}
                  >
                    {isReady ? "Готов к игре ✓" : "Подтвердить готовность"}
                  </button>
                )}

                {isHost && (
                  <button
                    type="button"
                    onClick={onStartStorySetup || (() => setShowSetupModal(true))}
                    disabled={participants.length === 0}
                    className="flex items-center gap-1.5 rounded-md bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    <Crown className="size-3.5" />
                    <span>Настроить и запустить кампанию</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Модалки */}
      <RoomCampaignSetupModal
        isOpen={showSetupModal}
        onClose={() => setShowSetupModal(false)}
        room={room}
        participants={participants}
        onStartCampaign={handleStartCampaign}
        isGenerating={isGeneratingStory}
      />

      <CharacterPickerModal
        isOpen={showPicker}
        roomCode={roomCode}
        startingLevel={room.startingLevel}
        campaignId={room.campaignId || (room.campaignSettings as any)?.campaignId}
        onSelect={() => {
          refresh();
        }}
        onClose={() => setShowPicker(false)}
      />

      <SupabaseAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={() => {
          refresh();
        }}
      />
    </div>
  );
}
