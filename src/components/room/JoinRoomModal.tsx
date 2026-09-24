"use client";

import React, { useState } from "react";
import { Radio, X, Loader2, ArrowRight } from "lucide-react";
import { normalizeRoomCode } from "@/lib/room/code-gen";

export interface JoinRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoined: (room: any, participants: any[]) => void;
}

export function JoinRoomModal({ isOpen, onClose, onJoined }: JoinRoomModalProps) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanCode = normalizeRoomCode(code);
    if (!cleanCode) {
      setError("Введите код комнаты");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/room/${encodeURIComponent(cleanCode)}`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Комната с таким кодом не найдена");
      }

      const data = await res.json();
      if (!data?.room) {
        throw new Error("Комната не найдена");
      }

      const participants = data.participants || data.room.participants || [];
      onJoined(data.room, participants);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Ошибка подключения к комнате");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[360] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl text-zinc-950 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 font-sans">
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
            <Radio className="size-5 text-emerald-500 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Войти в комнату
            </h3>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Введите код комнаты, полученный от ведущего или друга.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Код комнаты
            </label>
            <input
              type="text"
              autoFocus
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                if (error) setError(null);
              }}
              placeholder="Например, DRAGON-42"
              required
              className="w-full font-mono text-center text-lg tracking-wider font-bold uppercase rounded-md border border-zinc-300 bg-white px-3 py-2.5 text-zinc-900 placeholder:text-zinc-400 placeholder:normal-case placeholder:font-normal placeholder:tracking-normal placeholder:text-sm focus:border-zinc-500 focus:outline-hidden focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900 cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="flex items-center gap-1.5 rounded-md bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {loading ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Поиск стола...</span>
                </>
              ) : (
                <>
                  <span>Присоединиться</span>
                  <ArrowRight className="size-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
