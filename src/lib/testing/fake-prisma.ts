// Мини-Prisma в памяти для тестов: модели — массивы строк, where — простые сравнения.

type Row = Record<string, any>;

function matches(row: Row, where: Row | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, cond]) => {
    if (key === "OR") return (cond as Row[]).some((w) => matches(row, w));
    if (key === "AND") return (cond as Row[]).every((w) => matches(row, w));
    if (key === "NOT") return !matches(row, cond as Row);
    const value = row[key];
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      if ("in" in cond) return (cond.in as unknown[]).includes(value);
      if ("contains" in cond) return typeof value === "string" && value.includes(cond.contains);
      if ("not" in cond) return value !== cond.not;
      if ("equals" in cond) return value === cond.equals;
      return true;
    }
    return (value ?? null) === (cond ?? null);
  });
}

function applyData(row: Row, data: Row): void {
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === "object" && !(value instanceof Date) && !Array.isArray(value)) {
      if (typeof value.increment === "number") row[key] = (row[key] ?? 0) + value.increment;
      else if (typeof value.decrement === "number") row[key] = (row[key] ?? 0) - value.decrement;
      else if ("set" in value) row[key] = value.set;
      else row[key] = value;
    } else {
      row[key] = value;
    }
  }
}

export function fakeModel(name: string, rows: Row[] = [], defaults: Row = {}) {
  let counter = 0;
  const model = {
    rows,
    async findMany(args: { where?: Row } = {}) {
      return rows.filter((r) => matches(r, args.where)).map((r) => ({ ...r }));
    },
    async findFirst(args: { where?: Row } = {}) {
      const row = rows.find((r) => matches(r, args.where));
      return row ? { ...row } : null;
    },
    async findUnique(args: { where: Row }) {
      const row = rows.find((r) => matches(r, args.where));
      return row ? { ...row } : null;
    },
    async create(args: { data: Row }) {
      counter += 1;
      const row = { id: `${name}-${counter}`, ...defaults, ...args.data };
      rows.push(row);
      return { ...row };
    },
    async update(args: { where: Row; data: Row }) {
      const row = rows.find((r) => matches(r, args.where));
      if (!row) throw new Error(`fake-prisma: ${name} не найден`);
      applyData(row, args.data);
      return { ...row };
    },
    async updateMany(args: { where?: Row; data: Row }) {
      const hit = rows.filter((r) => matches(r, args.where));
      hit.forEach((r) => applyData(r, args.data));
      return { count: hit.length };
    },
    async delete(args: { where: Row }) {
      const index = rows.findIndex((r) => matches(r, args.where));
      if (index < 0) throw new Error(`fake-prisma: ${name} не найден`);
      return rows.splice(index, 1)[0];
    },
    async count(args: { where?: Row } = {}) {
      return rows.filter((r) => matches(r, args.where)).length;
    },
  };
  return model;
}

export interface FakePrismaSeed {
  character?: Row[];
  campaign?: Row[];
  chatMessage?: Row[];
  combat?: Row[];
  combatant?: Row[];
  gameEvent?: Row[];
}

export function fakePrisma(seed: FakePrismaSeed = {}) {
  return {
    character: fakeModel("character", seed.character ?? [], {
      type: "npc",
      level: 1,
      experiencePoints: 0,
      hpCurrent: 10,
      hpMax: 10,
      hpTemp: 0,
      notes: null,
      sheetCharacterId: null,
      sheetLevelSeen: null,
      isAlive: true,
    }),
    campaign: fakeModel("campaign", seed.campaign ?? []),
    chatMessage: fakeModel("chatMessage", seed.chatMessage ?? []),
    combat: fakeModel("combat", seed.combat ?? [], { status: "active", sheetSyncedAt: null, xpAwardedAt: null }),
    combatant: fakeModel("combatant", seed.combatant ?? []),
    gameEvent: fakeModel("gameEvent", seed.gameEvent ?? []),
  };
}
