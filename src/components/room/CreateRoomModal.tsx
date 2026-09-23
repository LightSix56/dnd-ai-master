"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { SupabaseAuthModal } from "@/components/auth/SupabaseAuthModal";
import { Crown, Loader2, X, Dices } from "lucide-react";

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRoomCreated?: (code: string) => void;
}

export function CreateRoomModal({ isOpen, onClose, onRoomCreated }: CreateRoomModalProps) {
  const router = useRouter();
  const { user, getAuthToken } = useSupabaseAuth();

  const [name, setName] = useState("Поход искателей приключений");
  const [startingLevel, setStartingLevel] = useState(1);
  const [partyBond, setPartyBond] = useState<"strangers" | "established">("strangers");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  if (!isOpen) return null;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    if (!name.trim()) {
      setError("Укажите название комнаты");
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
          partyBond,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Не удалось создать комнату");
      }

      const { room } = await res.json();
      onRoomCreated?.(room.code);
      onClose();
      router.push(`/room/${room.code}`);
    } catch (err: any) {
      setError(err?.message || "Ошибка при создании комнаты");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[360] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="relative w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl text-zinc-950 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 font-sans">
          {/* Кнопка закрытия */}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 transition-colors cursor-pointer"
            title="Закрыть"
          >
            <X className="size-4" />
          </button>

          {/* Заголовок */}
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-100 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
              <Crown className="size-5" />
            </div>
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                Создать кооперативную комнату
              </h3>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                Вы станете Человеком-ДМ (Хостом) и сможете пригласить друзей по ссылке.
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleCreate} className="space-y-4 text-sm">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">Название стола</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Тени Побережья Мечей"
                required
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-hidden focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Стартовый уровень героев (1–20)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={startingLevel}
                  onChange={(e) => setStartingLevel(parseInt(e.target.value, 10))}
                  className="flex-1 accent-zinc-900 dark:accent-zinc-100"
                />
                <span className="flex h-9 w-12 items-center justify-center rounded-md border border-zinc-300 bg-zinc-50 text-sm font-semibold text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
                  {startingLevel}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-500">
                Все присоединяющиеся игроки должны будут выбрать героя ровно {startingLevel}-го уровня.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">Связь отряда в сюжете</label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setPartyBond("strangers")}
                  className={`rounded-lg border p-2.5 text-left transition-all cursor-pointer ${
                    partyBond === "strangers"
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 font-medium shadow-xs"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  <p className="text-sm font-medium">Незнакомцы</p>
                  <p className="text-[11px] opacity-80 mt-0.5">Встреча и знакомство в прологе</p>
                </button>

                <button
                  type="button"
                  onClick={() => setPartyBond("established")}
                  className={`rounded-lg border p-2.5 text-left transition-all cursor-pointer ${
                    partyBond === "established"
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 font-medium shadow-xs"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  <p className="text-sm font-medium">Слаженная группа</p>
                  <p className="text-[11px] opacity-80 mt-0.5">Давно путешествуют вместе</p>
                </button>
              </div>
            </div>

            {!user && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/50 dark:text-amber-300">
                Для создания комнаты необходимо войти под вашей учётной записью.
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-xs hover:bg-zinc-800 active:scale-[0.99] disabled:opacity-50 transition-all cursor-pointer dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Создание комнаты...</span>
                  </>
                ) : !user ? (
                  <span>Войти и создать комнату</span>
                ) : (
                  <>
                    <Dices className="size-4" />
                    <span>Открыть лобби для друзей</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      <SupabaseAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        title="Вход для создания комнаты"
      />
    </>
  );
}
