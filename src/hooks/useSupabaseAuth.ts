"use client";

import { useEffect, useState, useCallback } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function useSupabaseAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    // 0. Защита от недопустимого для браузеров адреса 0.0.0.0
    if (typeof window !== "undefined" && window.location.hostname === "0.0.0.0") {
      window.location.hostname = "localhost";
      return;
    }

    // 1. Проверяем URL hash на наличие токенов OAuth (Implicit Flow)
    if (typeof window !== "undefined" && window.location.hash.includes("access_token")) {
      const hashStr = window.location.hash.startsWith("#")
        ? window.location.hash.substring(1)
        : window.location.hash;
      const params = new URLSearchParams(hashStr);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (accessToken && refreshToken) {
        supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ data, error }) => {
          if (!error && data?.session) {
            setSession(data.session);
            setUser(data.user);
            setLoading(false);
            window.history.replaceState(null, "", window.location.pathname + window.location.search);
          }
        });
      }
    }

    // 2. Получаем текущую сессию из хранилища
    supabase.auth.getSession().then(({ data: { session: currentSession }, error: sessionError }) => {
      if (sessionError) {
        console.warn("[useSupabaseAuth] getSession warning:", sessionError.message);
      }
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);

      if (currentSession && typeof window !== "undefined") {
        const nextTarget = localStorage.getItem("auth_redirect_next");
        if (nextTarget && nextTarget.startsWith("/") && window.location.pathname !== nextTarget) {
          localStorage.removeItem("auth_redirect_next");
          window.location.href = nextTarget;
        }
      }
    });

    // 2. Слушаем изменения состояния авторизации (login, logout, refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);

      if (newSession && typeof window !== "undefined") {
        if (window.location.hash.includes("access_token")) {
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
        }
        const nextTarget = localStorage.getItem("auth_redirect_next");
        if (nextTarget && nextTarget.startsWith("/") && window.location.pathname !== nextTarget) {
          localStorage.removeItem("auth_redirect_next");
          window.location.href = nextTarget;
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;
      setSession(data.session);
      setUser(data.user);
      return { user: data.user, error: null };
    } catch (err: any) {
      const message = err?.message || "Ошибка входа в аккаунт";
      setError(message);
      return { user: null, error: message };
    } finally {
      setLoading(false);
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const redirectUrl = typeof window !== "undefined" ? `${window.location.origin}/api/auth/callback` : undefined;
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });
      if (signUpError) throw signUpError;
      return { user: data.user, error: null };
    } catch (err: any) {
      const message = err?.message || "Ошибка регистрации";
      setError(message);
      return { user: null, error: message };
    } finally {
      setLoading(false);
    }
  }, []);

  const signInWithGoogle = useCallback(async (redirectTo?: string) => {
    setError(null);
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const currentPath = typeof window !== "undefined" ? window.location.pathname : "/";
      const nextTarget = redirectTo || currentPath;
      if (typeof window !== "undefined") {
        localStorage.setItem("auth_redirect_next", nextTarget);
        document.cookie = `auth_redirect_next=${encodeURIComponent(nextTarget)}; path=/; max-age=300; SameSite=Lax`;
      }
      // Чистый URL БЕЗ query-параметров для 100% совпадения с whitelist в Supabase
      const rawOrigin = typeof window !== "undefined" ? window.location.origin : "";
      const safeOrigin = rawOrigin.replace("0.0.0.0", "localhost");
      const callbackUrl = safeOrigin ? `${safeOrigin}/api/auth/callback` : undefined;
      const { data, error: googleError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl,
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      });
      if (googleError) throw googleError;
      return { data, error: null };
    } catch (err: any) {
      const message = err?.message || "Ошибка входа через Google";
      setError(message);
      return { data: null, error: message };
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
    } catch (err: any) {
      console.warn("[useSupabaseAuth] signOut error:", err?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const instantSignIn = useCallback(async (targetEmail?: string) => {
    setError(null);
    setLoading(true);
    try {
      const email = targetEmail?.trim();
      if (!email) throw new Error("Укажите адрес электронной почты");
      const res = await fetch("/api/auth/instant-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Не удалось получить токен быстрого входа");
      }

      const supabase = getSupabaseBrowserClient();
      const { data: sessionData, error: otpError } = await supabase.auth.verifyOtp({
        token_hash: data.token_hash,
        type: "magiclink",
      });

      if (otpError) throw otpError;

      setSession(sessionData.session);
      setUser(sessionData.user);
      return { user: sessionData.user, error: null };
    } catch (err: any) {
      const message = err?.message || "Ошибка быстрого входа";
      setError(message);
      return { user: null, error: message };
    } finally {
      setLoading(false);
    }
  }, []);

  const signInAsGuest = useCallback(async (customName?: string) => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/guest-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: customName }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Не удалось создать гостевой аккаунт");
      }

      const supabase = getSupabaseBrowserClient();
      const { data: sessionData, error: otpError } = await supabase.auth.verifyOtp({
        token_hash: data.token_hash,
        type: "magiclink",
      });

      if (otpError) throw otpError;

      setSession(sessionData.session);
      setUser(sessionData.user);
      return { user: sessionData.user, session: sessionData.session, error: null };
    } catch (err: any) {
      const message = err?.message || "Ошибка гостевого входа";
      setError(message);
      return { user: null, session: null, error: message };
    } finally {
      setLoading(false);
    }
  }, []);

  const getAuthToken = useCallback(() => {
    return session?.access_token || null;
  }, [session]);

  return {
    user,
    session,
    loading,
    error,
    signInWithPassword,
    signInWithGoogle,
    instantSignIn,
    signInAsGuest,
    signUp,
    signOut,
    getAuthToken,
  };
}
