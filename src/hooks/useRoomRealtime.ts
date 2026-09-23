"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useSupabaseAuth } from "./useSupabaseAuth";
import type { RoomWithParticipants, RoomParticipant, RoomTurn } from "@/lib/room/types";

export function useRoomRealtime(roomCode: string, initialRoom?: RoomWithParticipants | null) {
  const { user, getAuthToken } = useSupabaseAuth();
  const [room, setRoom] = useState<RoomWithParticipants | null>(initialRoom || null);
  const [activeTurn, setActiveTurn] = useState<RoomTurn | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, { characterName: string; timestamp: number }>>({});
  const [loading, setLoading] = useState(!initialRoom);
  const [error, setError] = useState<string | null>(null);

  const fetchActiveTurn = useCallback(async () => {
    if (!roomCode) return;
    try {
      const res = await fetch(`/api/room/${roomCode}/turn`);
      if (res.ok) {
        const data = await res.json();
        if (data.turn) {
          setActiveTurn(data.turn);
        }
      }
    } catch (err) {
      console.warn("[useRoomRealtime] fetchActiveTurn error:", err);
    }
  }, [roomCode]);

  const fetchRoom = useCallback(async () => {
    if (!roomCode) return;
    try {
      const res = await fetch(`/api/room/${roomCode}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError("Комната не найдена");
        } else {
          setError("Ошибка загрузки данных комнаты");
        }
        return;
      }
      const data = await res.json();
      setRoom(data.room);
      setError(null);
      if (data.room?.status === "active") {
        fetchActiveTurn();
      }
    } catch (err: any) {
      setError(err?.message || "Сетевая ошибка при загрузке комнаты");
    } finally {
      setLoading(false);
    }
  }, [roomCode, fetchActiveTurn]);

  useEffect(() => {
    fetchRoom();
  }, [fetchRoom]);

  // Периодическая очистка устаревших статусов набора текста (> 6 секунд)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers((prev) => {
        let changed = false;
        const next: Record<string, { characterName: string; timestamp: number }> = {};
        for (const [k, v] of Object.entries(prev)) {
          if (now - v.timestamp < 6000) {
            next[k] = v;
          } else {
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Подписка на Supabase Realtime
  const channelRef = useRef<any>(null);
  useEffect(() => {
    if (!roomCode || !room?.id) return;

    const supabase = getSupabaseBrowserClient();
    const channelName = `room:${room.id}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_participants",
          filter: `room_id=eq.${room.id}`,
        },
        () => {
          // При любых изменениях участников обновляем список
          fetchRoom();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${room.id}`,
        },
        (payload: any) => {
          // При обновлении статуса комнаты (например, переход в active или generating)
          setRoom((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              status: payload.new.status || prev.status,
              partyBond: payload.new.party_bond || prev.partyBond,
              storyArc: payload.new.story_arc || prev.storyArc,
            };
          });
          if (payload.new.status === "active") {
            fetchActiveTurn();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_turns",
          filter: `room_id=eq.${room.id}`,
        },
        (payload: any) => {
          if (payload.new) {
            setActiveTurn({
              id: payload.new.id,
              roomId: payload.new.room_id,
              roundNumber: payload.new.round_number,
              status: payload.new.status,
              playerInputs: payload.new.player_inputs || {},
              dmResponse: payload.new.dm_response,
              createdAt: payload.new.created_at,
            });
          }
        }
      )
      .on("broadcast", { event: "typing" }, ({ payload }: any) => {
        if (!payload || !payload.userId) return;
        setTypingUsers((prev) => {
          const next = { ...prev };
          if (payload.isTyping) {
            next[payload.userId] = {
              characterName: payload.characterName || "Герой",
              timestamp: Date.now(),
            };
          } else {
            delete next[payload.userId];
          }
          return next;
        });
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode, room?.id, fetchRoom, fetchActiveTurn]);

  const participants: RoomParticipant[] = room?.participants || [];
  const isHost = Boolean(user && room && room.hostUserId === user.id);
  const currentParticipant = participants.find((p) => p.userId === user?.id) || null;
  const isReady = Boolean(currentParticipant?.isReady);

  const sendTypingStatus = useCallback(
    (isTyping: boolean) => {
      if (!channelRef.current || !user) return;
      const charName = currentParticipant?.characterSnapshot?.name || "Герой";
      channelRef.current.send({
        type: "broadcast",
        event: "typing",
        payload: {
          userId: user.id,
          characterName: charName,
          isTyping,
        },
      });
    },
    [user, currentParticipant]
  );

  const submitAction = useCallback(
    async (actionText: string) => {
      if (!roomCode || !user) return false;
      try {
        const token = getAuthToken();
        const res = await fetch(`/api/room/${roomCode}/turn`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ actionText }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.turn) {
            setActiveTurn(data.turn);
          }
          sendTypingStatus(false);
          return true;
        }
        return false;
      } catch (err) {
        console.warn("[useRoomRealtime] submitAction error:", err);
        return false;
      }
    },
    [roomCode, user, getAuthToken, sendTypingStatus]
  );

  const resolveTurn = useCallback(
    async (gmWhisperDirective?: string, afkCharacters?: string[]) => {
      if (!roomCode || !isHost) return null;
      try {
        const token = getAuthToken();
        const res = await fetch(`/api/room/${roomCode}/turn/resolve`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ gmWhisperDirective, afkCharacters }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.nextTurn) {
            setActiveTurn(data.nextTurn);
          }
          return data;
        }
        return null;
      } catch (err) {
        console.warn("[useRoomRealtime] resolveTurn error:", err);
        return null;
      }
    },
    [roomCode, isHost, getAuthToken]
  );

  const toggleReady = useCallback(async () => {
    if (!roomCode || !currentParticipant) return;
    try {
      const token = getAuthToken();
      const nextReady = !currentParticipant.isReady;
      await fetch(`/api/room/${roomCode}/ready`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ isReady: nextReady }),
      });
      // Оптимистичное обновление
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          participants: prev.participants.map((p) =>
            p.id === currentParticipant.id ? { ...p, isReady: nextReady } : p
          ),
        };
      });
    } catch (e) {
      console.warn("[useRoomRealtime] toggleReady error:", e);
    }
  }, [roomCode, currentParticipant, getAuthToken]);

  return {
    room,
    participants,
    isHost,
    currentParticipant,
    isReady,
    loading,
    error,
    activeTurn,
    typingUsers,
    sendTypingStatus,
    submitAction,
    resolveTurn,
    toggleReady,
    refresh: fetchRoom,
  };
}
