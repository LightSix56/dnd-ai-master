"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { SupabaseAuthModal } from "@/components/auth/SupabaseAuthModal";
import { CreateCampaignModal } from "@/components/campaign/CreateCampaignModal";

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRoomCreated?: (code: string) => void;
}

// Сетевая кампания создаётся тем же окном, что и соло (CreateCampaignModal): отличие только в запросе и входе в аккаунт
export function CreateRoomModal({ isOpen, onClose, onRoomCreated }: CreateRoomModalProps) {
  const router = useRouter();
  const { user, getAuthToken } = useSupabaseAuth();

  const [name, setName] = useState("");
  const [startingLevel, setStartingLevel] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  if (!isOpen) return null;

  async function handleCreate() {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    if (!name.trim()) {
      setError("Укажите название кампании");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const token = getAuthToken();
      const res = await fetch("/api/room/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: name.trim(),
          startingLevel,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Не удалось создать кампанию");
      }

      const { room } = await res.json();
      onRoomCreated?.(room.code);
      onClose();
      router.push(`/room/${room.code}`);
    } catch (err: any) {
      setError(err?.message || "Ошибка при создании кампании");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <CreateCampaignModal
        mode="network"
        name={name}
        startingLevel={startingLevel}
        creating={loading}
        error={error}
        submitLabel={user ? "Создать кампанию" : "Войти и создать кампанию"}
        notice={
          !user ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/50 dark:text-amber-300">
              Для сетевой игры необходимо войти под вашей учётной записью.
            </div>
          ) : undefined
        }
        onName={setName}
        onStartingLevel={setStartingLevel}
        onCreate={handleCreate}
        onClose={onClose}
      />

      <SupabaseAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        title="Вход для сетевой игры"
      />
    </>
  );
}
