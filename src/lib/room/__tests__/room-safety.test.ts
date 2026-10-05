// Надёжность сетевой комнаты: одновременные ходы, зависшая блокировка, занятые персонажи,
// управление чужим героем в бою, сюжет не из первого акта.
import { describe, it, expect, vi, beforeEach } from "vitest";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    combatant: { findUnique: vi.fn() },
    combat: { findUnique: vi.fn() },
    campaign: { findUnique: vi.fn() },
    character: { id: "sheet-1", findMany: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/supabase/client", () => ({
  getSupabaseAdminClient: vi.fn(() => ({})),
  getAuthUserFromRequest: vi.fn(async () => ({ user: null, error: "no" })),
}));

import { RoomService, RoomRuleError, STALE_RESOLVE_LOCK_SECONDS } from "../room-service";
import { checkCombatControl, actorIdForAction, resetCombatAccessCaches } from "../combat-access";
import { buildRoomDmSystemPrompt } from "../resolve-turn-helper";
import { parseStoryArc } from "@/lib/ai/story-arc";
import { stripVolatileNotes } from "@/lib/ai/caching/frozen-prefix";

/** Цепочка запросов Supabase: запоминает вызовы и отдаёт заданный результат на завершающем шаге */
function chain(result: unknown, log: Array<[string, unknown[]]> = []) {
  const c: any = {};
  for (const m of ["from", "select", "update", "insert", "eq", "neq", "lt", "order", "limit", "filter", "upsert"]) {
    c[m] = (...args: unknown[]) => {
      log.push([m, args]);
      return c;
    };
  }
  c.single = async () => result;
  c.maybeSingle = async () => result;
  c.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return c;
}

const turnRow = (over: Record<string, unknown> = {}) => ({
  id: "turn-1",
  room_id: "room-1",
  round_number: 3,
  status: "waiting",
  player_inputs: {},
  dm_response: null,
  created_at: "2026-10-04T00:00:00Z",
  ...over,
});

const input = { userId: "u1", characterName: "Торин", actionText: "Бью орка", submittedAt: 1 };

describe("ход игрока в раунде", () => {
  it("пишется атомарно через функцию БД, а не чтением-записью всего JSON", async () => {
    const rpc = vi.fn(async () => ({ data: [turnRow({ player_inputs: { u2: { actionText: "x" }, u1: input } })], error: null }));
    const client: any = { ...chain({ data: turnRow({ player_inputs: { u2: { actionText: "x" } } }), error: null }), rpc };
    const service = new RoomService(client);

    const turn = await service.submitPlayerAction("room-1", "u1", input);

    expect(rpc).toHaveBeenCalledWith("room_submit_turn_input", { p_turn_id: "turn-1", p_user_id: "u1", p_input: input });
    expect(Object.keys(turn.playerInputs)).toEqual(["u2", "u1"]);
  });

  it("отклоняется, пока мастер уже описывает раунд", async () => {
    const client: any = { ...chain({ data: turnRow({ status: "resolving" }), error: null }), rpc: vi.fn() };
    const service = new RoomService(client);
    await expect(service.submitPlayerAction("room-1", "u1", input)).rejects.toThrow(RoomRuleError);
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("повторный ход того же игрока отклоняется", async () => {
    const client: any = { ...chain({ data: turnRow({ player_inputs: { u1: input } }), error: null }), rpc: vi.fn() };
    const service = new RoomService(client);
    await expect(service.submitPlayerAction("room-1", "u1", input)).rejects.toThrow("Сказанного не вернёшь");
  });

  it("если функция БД не вернула строку (раунд ушёл в обработку) — понятный отказ, а не потерянный ход", async () => {
    const rpc = vi.fn(async () => ({ data: [], error: null }));
    const client: any = { ...chain({ data: turnRow(), error: null }), rpc };
    const service = new RoomService(client);
    await expect(service.submitPlayerAction("room-1", "u1", input)).rejects.toThrow("Мастер уже описывает этот раунд");
  });

  it("без миграции работает по-старому, но не пишет в раунд, который уже не ждёт ходов", async () => {
    const log: Array<[string, unknown[]]> = [];
    const rpc = vi.fn(async () => ({ data: null, error: { message: "function not found" } }));
    const client: any = chain({ data: turnRow({ player_inputs: { u1: input } }), error: null }, log);
    client.rpc = rpc;
    // первый запрос (чтение активного раунда) отдаёт раунд без хода игрока
    client.single = vi.fn().mockResolvedValueOnce({ data: turnRow(), error: null });
    const service = new RoomService(client);
    await service.submitPlayerAction("room-1", "u1", input);
    expect(log.some(([m, a]) => m === "eq" && a[0] === "status" && a[1] === "waiting")).toBe(true);
  });
});

describe("блокировка раунда на время ответа мастера", () => {
  it("зависшую блокировку можно перехватить по времени", async () => {
    const log: Array<[string, unknown[]]> = [];
    const client: any = chain({ data: null, error: null }, log);
    // первый захват (waiting -> resolving) не удался, перехват зависшей — удался
    client.maybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { id: "turn-1" }, error: null });
    const service = new RoomService(client);

    expect(await service.lockTurnForResolving("turn-1")).toBe(true);
    const lt = log.find(([m]) => m === "lt");
    expect(lt?.[1][0]).toBe("resolving_started_at");
    const cutoffAge = Date.now() - new Date(String(lt?.[1][1])).getTime();
    expect(cutoffAge).toBeGreaterThanOrEqual(STALE_RESOLVE_LOCK_SECONDS * 1000 - 50);
  });

  it("свежую чужую блокировку перехватить нельзя", async () => {
    const client: any = chain({ data: null, error: null });
    const service = new RoomService(client);
    expect(await service.lockTurnForResolving("turn-1")).toBe(false);
  });
});

describe("завершение раунда после перехвата блокировки", () => {
  const row = (id: string, round: number, status: string) => ({
    id,
    room_id: "room-1",
    round_number: round,
    status,
    player_inputs: {},
    dm_response: status === "completed" ? "Ответ первого запроса" : null,
    created_at: "2026-01-01T00:00:00Z",
  });

  it("не закрывает следующий раунд, если описанный раунд уже завершён другим запросом", async () => {
    const log: Array<[string, unknown[]]> = [];
    const client: any = chain({ data: null, error: null }, log);
    // последний раунд комнаты — уже второй (waiting); первый завершён
    client.single = vi.fn().mockResolvedValue({ data: row("turn-2", 2, "waiting"), error: null });
    client.maybeSingle = vi.fn().mockResolvedValue({ data: row("turn-1", 1, "completed"), error: null });
    const service = new RoomService(client);

    const res = await service.resolveRoomTurn("room-1", "Запоздавший ответ", "turn-1");

    expect(res.alreadyCompleted).toBe(true);
    expect(res.completedTurn.id).toBe("turn-1");
    expect(res.nextTurn.id).toBe("turn-2");
    expect(log.some(([m]) => m === "update")).toBe(false);
    expect(log.some(([m]) => m === "insert")).toBe(false);
  });

  it("пульс обновляет метку только у раунда в обработке", async () => {
    const log: Array<[string, unknown[]]> = [];
    const service = new RoomService(chain({ data: null, error: null }, log) as any);
    await service.touchResolvingLock("turn-1");
    expect(log.find(([m]) => m === "update")?.[1][0]).toHaveProperty("resolving_started_at");
    expect(log.filter(([m]) => m === "eq").map(([, a]) => a)).toEqual([
      ["id", "turn-1"],
      ["status", "resolving"],
    ]);
  });

  it("рассылка без канала (нет соединения) не бросает ошибку", async () => {
    const service = new RoomService({} as any);
    await expect(service.broadcastDmStream("room-1", { type: "status" })).resolves.toBeUndefined();
  });
});

// «Нельзя взять героя, выбранного другим игроком» — в join-versions.test.ts

describe("управление бойцом в бою комнаты", () => {
  const room = {
    hostUserId: "host",
    participants: [
      { userId: "u1", character: { id: "sheet-2", name: "Торин" } },
      { userId: "u2", character: { id: "sheet-3", name: "Лира" } },
    ],
  };
  const roomService = { getActiveRoomByCampaignId: vi.fn(async () => room) } as any;
  const req = new Request("http://x/api/combat/action", { method: "POST" });

  beforeEach(() => {
    resetCombatAccessCaches();
    dbMock.combat.findUnique.mockResolvedValue({ campaignId: "camp-1" });
  });

  const asCombatant = (name: string, type = "player") =>
    dbMock.combatant.findUnique.mockResolvedValue({ name, type, combatId: "cb-1" });

  it("игрок не может ходить за героя другого игрока", async () => {
    asCombatant("Лира");
    const denied = await checkCombatControl(req, "cb-1", "attack", { attackerId: "x" }, { userId: "u1", roomService });
    expect(denied).toContain("персонаж другого игрока");
  });

  it("за своего героя — можно; ведущему — за любого", async () => {
    asCombatant("Торин");
    expect(await checkCombatControl(req, "cb-1", "attack", { attackerId: "x" }, { userId: "u1", roomService })).toBeNull();
    asCombatant("Лира");
    resetCombatAccessCaches();
    expect(await checkCombatControl(req, "cb-1", "attack", { attackerId: "x" }, { userId: "host", roomService })).toBeNull();
  });

  it("враги и запросы без токена не ограничиваются", async () => {
    asCombatant("Гоблин", "enemy");
    expect(await checkCombatControl(req, "cb-1", "attack", { attackerId: "x" }, { userId: "u1", roomService })).toBeNull();
    asCombatant("Лира");
    expect(await checkCombatControl(req, "cb-1", "attack", { attackerId: "x" }, { userId: null, roomService })).toBeNull();
  });

  it("служебные действия (конец хода, ход бота) не привязаны к бойцу", () => {
    expect(actorIdForAction("next-turn", {})).toBeNull();
    expect(actorIdForAction("bot-turn", {})).toBeNull();
    expect(actorIdForAction("cast-spell", { casterId: "c9" })).toBe("c9");
  });
});

describe("сюжет в комнате", () => {
  const roomArc = {
    title: "Пепел над Громовым Ручьём",
    premise: "Шахтёры пропадают в Старой штольне.",
    mainThreat: "Культ Пепла будит древнего элементаля.",
    levelFrom: 1,
    levelTo: 6,
    villains: [{ name: "Морна", role: "шпионка", motivation: "месть", secret: "сестра старосты", appearsInAct: 1 }],
    act: {
      name: "Тени в штольне",
      levelFrom: 1,
      levelTo: 2,
      goal: "Найти шахтёров",
      summary: "Отряд спускается в штольню.",
      climaxObjective: "Сорвать ритуал",
      personalHooks: [{ characterName: "Торин", hook: "Брат среди пропавших" }],
      scenes: [{ name: "С1", sceneType: "social", location: "Таверна", description: "Слухи", encounter: "Диалог" }],
      twist: "Староста знал",
      branches: [{ ifPlayer: "пощадят", then: "узнают путь" }],
      rewards: "Золото",
    },
    finaleHint: "Элементаль проснётся.",
  };

  it("арка сетевой кампании (формат с одним act) читается как обычная", () => {
    const arc = parseStoryArc(JSON.stringify(roomArc));
    expect(arc?.acts).toHaveLength(1);
    expect(arc?.acts[0].climaxObjective).toBe("Сорвать ритуал");
    expect(arc?.finale).toBe("Элементаль проснётся.");
  });

  it("мастер комнаты получает полный промпт и ТЕКУЩИЙ акт кампании, а не первый", async () => {
    const arc = parseStoryArc(JSON.stringify(roomArc))!;
    arc.acts.push({
      name: "Огонь под горой",
      levelFrom: 2,
      levelTo: 4,
      goal: "Остановить культ в предгорьях",
      summary: "Культ ушёл в горы.",
      scenes: [{ name: "С1", location: "Перевал", description: "Засада", encounter: "Бой" }],
      twist: "Барон в сговоре",
      branches: [{ ifPlayer: "штурм", then: "потери" }],
      rewards: "Реликвия",
      worldChanges: ["Громовой Ручей опустел: жители бегут на юг"],
      npcDevelopments: [{ name: "Бранн", change: "арестован людьми барона" }],
      enemies: [{ name: "Пепельные культисты", description: "фанатики с огненными заговорами" }],
    } as any);
    arc.villains.push({ name: "Барон Вейл", role: "покровитель культа", motivation: "власть", secret: "должник культа", appearsInAct: 2 });

    dbMock.campaign.findUnique.mockResolvedValue({
      id: "camp-1",
      name: "Пепел",
      setting: "Forgotten Realms",
      tone: "dark",
      difficulty: "normal",
      language: "ru",
      dmStyle: "balanced",
      ruleStrictness: "standard",
      startingLevel: 1,
      levelFrom: 1,
      levelTo: 6,
      partyTies: "tight_knit",
      restFrequency: "standard",
      storyArc: JSON.stringify(arc),
      arcCurrentAct: 1,
    });
    dbMock.character.findMany.mockResolvedValue([
      { id: "p1", name: "Торин", race: "Дварф", class: "Воин", level: 2, notes: JSON.stringify({ name: "Торин", backstory: "Вырос в шахтах.", abilityScores: { str: 16 } }) },
      { id: "p2", name: "Лира", race: "Эльф", class: "Плут", level: 2, notes: null },
    ]);

    const prompt = await buildRoomDmSystemPrompt({ id: "r", name: "Комната" } as any, "camp-1");

    expect(prompt).toContain("ТЕКУЩИЙ АКТ 2 из 2: «Огонь под горой»");
    expect(prompt).toContain("Громовой Ручей опустел");
    expect(prompt).toContain("Бранн: арестован людьми барона");
    expect(prompt).toContain("Пепельные культисты");
    expect(prompt).toContain("Барон Вейл");
    expect(prompt).toContain("Пройденный Акт 1: «Тени в штольне»");
    expect(prompt).toContain("СОВМЕСТНЫЙ РАУНД В СЕТЕВОЙ КОМНАТЕ");
    // полный свод правил мастера, как в сольной игре
    expect(prompt).toContain("РАЗДЕЛЕНИЕ ПРАВ НА БРОСКИ");
    // лист персонажа из notes не вываливается в промпт целиком — только досье
    expect(prompt).toContain("Предыстория: Вырос в шахтах.");
    expect(prompt).not.toContain("abilityScores");
  });

  it("без кампании комната работает на собственном коротком промпте", async () => {
    const prompt = await buildRoomDmSystemPrompt({ id: "r", name: "Комната", startingLevel: 1, maxLevel: 5, campaignSettings: {} } as any, null);
    expect(prompt).toContain("кооперативную кампанию");
  });

  it("JSON-лист без текстовых полей в промпт не попадает вовсе", () => {
    expect(stripVolatileNotes(JSON.stringify({ name: "X", abilityScores: { str: 10 } }))).toBeNull();
    expect(stripVolatileNotes("[Статус: спит]\n" + JSON.stringify({ backstory: "Сирота." }))).toBe("Предыстория: Сирота.");
  });
});
