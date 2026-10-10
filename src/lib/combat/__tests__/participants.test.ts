import { describe, it, expect } from "vitest";
import { selectParticipants } from "../participants";

const party = [
  { id: "1", name: "Добрун Каменный" },
  { id: "2", name: "Лира" },
  { id: "3", name: "Марта" },
];

describe("selectParticipants", () => {
  it("без списка в бой идёт весь отряд", () => {
    const r = selectParticipants(party, {});
    expect(r.fighters).toHaveLength(3);
    expect(r.benched).toHaveLength(0);
    expect(r.filtered).toBe(false);
  });

  it("берёт только названных, остальные остаются вне боя", () => {
    const r = selectParticipants(party, { names: ["лира", "Марта"] });
    expect(r.fighters.map((m) => m.name)).toEqual(["Лира", "Марта"]);
    expect(r.benched.map((m) => m.name)).toEqual(["Добрун Каменный"]);
    expect(r.filtered).toBe(true);
  });

  it("узнаёт неполное имя и ё/е", () => {
    expect(selectParticipants(party, { names: ["Добрун"] }).fighters.map((m) => m.id)).toEqual(["1"]);
    expect(selectParticipants([{ id: "9", name: "Фёдор" }, ...party], { names: ["федор"] }).fighters.map((m) => m.id)).toEqual(["9"]);
  });

  it("выбирает по id", () => {
    expect(selectParticipants(party, { ids: ["2"] }).fighters.map((m) => m.id)).toEqual(["2"]);
  });

  it("если ни одно имя не опознано, не оставляет бой без героев", () => {
    const r = selectParticipants(party, { names: ["Неизвестный"] });
    expect(r.fighters).toHaveLength(3);
    expect(r.unmatched).toEqual(["Неизвестный"]);
    expect(r.filtered).toBe(false);
  });

  it("неопознанные имена возвращает отдельно", () => {
    const r = selectParticipants(party, { names: ["Лира", "Призрак"] });
    expect(r.fighters.map((m) => m.id)).toEqual(["2"]);
    expect(r.unmatched).toEqual(["Призрак"]);
  });
});
