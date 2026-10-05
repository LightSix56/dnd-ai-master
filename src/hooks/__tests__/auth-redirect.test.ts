import { describe, it, expect, beforeEach } from "vitest";
import { rememberRedirectTarget, consumeRedirectTarget, REDIRECT_KEY } from "../auth-redirect";

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  };
}

describe("цель возврата после входа", () => {
  let storage: Storage;
  const now = 1_000_000;
  beforeEach(() => {
    storage = memoryStorage();
  });

  it("сразу после входа возвращает на страницу, с которой входили, и забывает её", () => {
    rememberRedirectTarget(storage, "/campaign/abc", now);
    expect(consumeRedirectTarget(storage, "/", now + 10_000)).toBe("/campaign/abc");
    expect(storage.getItem(REDIRECT_KEY)).toBeNull();
  });

  it("если уже на нужной странице — никуда не ведёт, но запись удаляется", () => {
    rememberRedirectTarget(storage, "/", now);
    expect(consumeRedirectTarget(storage, "/", now + 10_000)).toBeNull();
    expect(storage.getItem(REDIRECT_KEY)).toBeNull();
    // Позже, уже вошедшим, открываем кампанию — главная не перехватывает
    expect(consumeRedirectTarget(storage, "/campaign/abc", now + 60_000)).toBeNull();
  });

  it("старая запись (вход был давно) не уводит со страницы", () => {
    rememberRedirectTarget(storage, "/", now);
    expect(consumeRedirectTarget(storage, "/campaign/abc", now + 6 * 60_000)).toBeNull();
    expect(storage.getItem(REDIRECT_KEY)).toBeNull();
  });

  it("запись старого формата (просто путь) считается устаревшей", () => {
    storage.setItem(REDIRECT_KEY, "/");
    expect(consumeRedirectTarget(storage, "/campaign/abc", now)).toBeNull();
    expect(storage.getItem(REDIRECT_KEY)).toBeNull();
  });

  it("чужие и небезопасные адреса игнорируются", () => {
    rememberRedirectTarget(storage, "//evil.example", now);
    expect(consumeRedirectTarget(storage, "/", now + 1000)).toBeNull();
  });
});
