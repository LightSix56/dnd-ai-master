"use client";

import React, { useState } from "react";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { KeyRound, User, Loader2, Info, X } from "lucide-react";

interface SupabaseAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess?: () => void;
  title?: string;
  description?: string;
}

export function SupabaseAuthModal({
  isOpen,
  onClose,
  onAuthSuccess,
  title = "Вход в учётную запись",
  description = "Войдите под тем же аккаунтом, что и на сайте с листом персонажа, чтобы получить доступ к вашим героям.",
}: SupabaseAuthModalProps) {
  const {
    signInWithPassword,
    signInWithGoogle,
    instantSignIn,
    signUp,
    loading,
    error: authHookError,
  } = useSupabaseAuth();

  const [activeTab, setActiveTab] = useState<"instant" | "password" | "signup">("instant");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleInstantLogin(targetEmail?: string) {
    setLocalError(null);
    setSuccessMessage(null);
    const chosenEmail = (targetEmail || email).trim();
    if (!chosenEmail || !chosenEmail.includes("@")) {
      setLocalError("Укажите адрес электронной почты");
      return;
    }
    const { user, error } = await instantSignIn(chosenEmail);
    if (error) {
      setLocalError(error);
    } else if (user) {
      setSuccessMessage(`Успешный вход: ${user.email}`);
      setTimeout(() => {
        onAuthSuccess?.();
        onClose();
      }, 500);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    setSuccessMessage(null);

    if (!email.trim() || !password.trim()) {
      setLocalError("Заполните почту и пароль");
      return;
    }

    if (activeTab === "signup") {
      const { error } = await signUp(email, password);
      if (error) {
        setLocalError(error);
      } else {
        setSuccessMessage("Учётная запись создана! Проверьте почту для подтверждения или войдите.");
      }
    } else {
      const { user, error } = await signInWithPassword(email, password);
      if (error) {
        setLocalError(error);
      } else if (user) {
        onAuthSuccess?.();
        onClose();
      }
    }
  }

  const displayError = localError || authHookError;

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl text-zinc-950 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 font-sans">
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
        <div className="mb-5 text-center">
          <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-800 border border-zinc-200 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-800">
            <KeyRound className="size-5" />
          </div>
          <h3 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{title}</h3>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{description}</p>
        </div>

        {/* Переключатель способов входа */}
        <div className="mb-3 flex rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 p-1 text-xs">
          <button
            type="button"
            onClick={() => {
              setActiveTab("instant");
              setLocalError(null);
            }}
            className={`flex-1 rounded-md py-1.5 font-medium transition-all cursor-pointer ${
              activeTab === "instant"
                ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100 font-semibold"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            Без пароля (Email)
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("password");
              setLocalError(null);
            }}
            className={`flex-1 rounded-md py-1.5 font-medium transition-all cursor-pointer ${
              activeTab === "password"
                ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100 font-semibold"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            Пароль
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("signup");
              setLocalError(null);
            }}
            className={`flex-1 rounded-md py-1.5 font-medium transition-all cursor-pointer ${
              activeTab === "signup"
                ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100 font-semibold"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            Регистрация
          </button>
        </div>

        {/* Формы */}
        {activeTab === "instant" ? (
          <div className="space-y-3 text-sm">
            <div className="rounded-md border border-amber-200/60 bg-amber-50/50 p-2 text-[11px] text-amber-800 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300">
              ⚡ <strong>Мгновенный вход прямо на этом сервере:</strong> введите email вашего аккаунта (тот же, что и на листе персонажа). Вход происходит без редиректов на другие сайты!
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Email вашего аккаунта
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-hidden focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
            <button
              type="button"
              onClick={() => handleInstantLogin()}
              disabled={loading || !email.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-xs hover:bg-zinc-800 active:scale-[0.99] disabled:opacity-50 transition-all cursor-pointer dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <KeyRound className="size-4" />
              <span>Войти без пароля</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handlePasswordSubmit} className="space-y-3 text-sm">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Электронная почта
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-hidden focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">Пароль</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-hidden focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-xs hover:bg-zinc-800 active:scale-[0.99] disabled:opacity-50 transition-all cursor-pointer dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Вход...</span>
                </>
              ) : activeTab === "signup" ? (
                <>
                  <User className="size-4" />
                  <span>Создать аккаунт</span>
                </>
              ) : (
                <>
                  <KeyRound className="size-4" />
                  <span>Войти в аккаунт</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Разделитель «или» */}
        <div className="my-4 flex items-center gap-2">
          <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          <span className="text-xs text-zinc-400">или через аккаунт Google</span>
          <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        </div>

        {/* Кнопка входа через Google */}
        <button
          type="button"
          onClick={() => signInWithGoogle()}
          disabled={loading}
          className="mb-1.5 flex w-full items-center justify-center gap-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 py-2.5 px-4 text-sm font-medium text-zinc-800 dark:text-zinc-200 shadow-xs hover:bg-zinc-50 dark:hover:bg-zinc-800/80 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          <span>Войти через Google</span>
        </button>
        {displayError && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300">
            {displayError}
          </div>
        )}

        {successMessage && (
          <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/50 dark:text-emerald-300">
            {successMessage}
          </div>
        )}
      </div>
    </div>
  );
}
