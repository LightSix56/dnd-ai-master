// Мини-Supabase в памяти для тестов: таблицы — обычные массивы строк.
// Поддерживает ровно те цепочки, которыми пользуется серверный код:
// from().select().eq()/neq()/in()/is()/filter().order().maybeSingle()/single(),
// insert()/update()/upsert()/delete() с последующим select(), и rpc().

type Row = Record<string, any>;
type Result<T = any> = { data: T; error: { message: string; code?: string } | null };

export interface FakeSupabaseOptions {
  tables?: Record<string, Row[]>;
  /** Уникальные ключи: нарушение при insert даёт ошибку 23505, как в Postgres */
  unique?: Record<string, string[][]>;
  rpc?: Record<string, (args: Row, tables: Record<string, Row[]>) => unknown>;
  /** Таблицы, любое обращение к которым возвращает ошибку базы */
  failTables?: string[];
}

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `00000000-0000-4000-8000-${String(idCounter).padStart(12, "0")}`;
}

function readPath(row: Row, column: string): unknown {
  // "campaign_settings->>campaignId"
  if (column.includes("->>")) {
    const [col, key] = column.split("->>");
    return row[col]?.[key];
  }
  return row[column];
}

class Query implements PromiseLike<Result> {
  private filters: Array<(row: Row) => boolean> = [];
  private op: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private payload: Row | Row[] | null = null;
  private conflictKeys: string[] = ["id"];
  private mode: "many" | "single" | "maybeSingle" = "many";

  constructor(
    private readonly table: string,
    private readonly state: FakeSupabase
  ) {}

  select(_columns?: string) {
    return this;
  }
  insert(payload: Row | Row[]) {
    this.op = "insert";
    this.payload = payload;
    return this;
  }
  update(payload: Row) {
    this.op = "update";
    this.payload = payload;
    return this;
  }
  upsert(payload: Row | Row[], options?: { onConflict?: string }) {
    this.op = "upsert";
    this.payload = payload;
    if (options?.onConflict) this.conflictKeys = options.onConflict.split(",").map((k) => k.trim());
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push((row) => readPath(row, column) === value);
    return this;
  }
  neq(column: string, value: unknown) {
    this.filters.push((row) => readPath(row, column) !== value);
    return this;
  }
  in(column: string, values: unknown[]) {
    this.filters.push((row) => values.includes(readPath(row, column)));
    return this;
  }
  is(column: string, value: unknown) {
    this.filters.push((row) => (readPath(row, column) ?? null) === value);
    return this;
  }
  filter(column: string, operator: string, value: unknown) {
    if (operator === "eq") return this.eq(column, value);
    throw new Error(`fake-supabase: оператор ${operator} не поддержан`);
  }
  order() {
    return this;
  }
  limit() {
    return this;
  }
  single() {
    this.mode = "single";
    return this;
  }
  maybeSingle() {
    this.mode = "maybeSingle";
    return this;
  }

  private run(): Result {
    this.state.calls.push({ table: this.table, op: this.op, payload: this.payload });
    if (this.state.failTables.has(this.table)) {
      return { data: null, error: { message: `fake: ${this.table} недоступна` } };
    }
    const rows = (this.state.tables[this.table] ??= []);
    const matches = (row: Row) => this.filters.every((f) => f(row));
    let affected: Row[] = [];

    if (this.op === "select") {
      affected = rows.filter(matches);
    } else if (this.op === "insert" || this.op === "upsert") {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload as Row];
      for (const item of items) {
        const existing =
          this.op === "upsert"
            ? rows.find((r) => this.conflictKeys.every((k) => r[k] === item[k]))
            : undefined;
        if (existing) {
          Object.assign(existing, item);
          affected.push(existing);
          continue;
        }
        const row: Row = { ...item };
        if (row.id === undefined) row.id = nextId();
        const clash = (this.state.unique[this.table] ?? []).some((keys) =>
          rows.some((r) => keys.every((k) => r[k] != null && r[k] === row[k]))
        );
        if (clash) {
          return { data: null, error: { message: "duplicate key value", code: "23505" } };
        }
        if (this.table === "characters" && row.revision === undefined) row.revision = 0;
        rows.push(row);
        affected.push(row);
      }
    } else if (this.op === "update") {
      affected = rows.filter(matches);
      for (const row of affected) {
        Object.assign(row, this.payload);
        if (this.table === "characters") row.revision = (row.revision ?? 0) + 1;
      }
    } else if (this.op === "delete") {
      affected = rows.filter(matches);
      this.state.tables[this.table] = rows.filter((r) => !affected.includes(r));
    }

    const copies = affected.map((r) => structuredClone(r));
    if (this.mode === "many") return { data: copies, error: null };
    if (copies.length === 0) {
      return this.mode === "single"
        ? { data: null, error: { message: "no rows", code: "PGRST116" } }
        : { data: null, error: null };
    }
    return { data: copies[0], error: null };
  }

  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve()
      .then(() => this.run())
      .then(onfulfilled, onrejected);
  }
}

export class FakeSupabase {
  tables: Record<string, Row[]>;
  unique: Record<string, string[][]>;
  failTables: Set<string>;
  calls: Array<{ table: string; op: string; payload: unknown }> = [];
  rpcCalls: Array<{ name: string; args: Row }> = [];
  private rpcHandlers: NonNullable<FakeSupabaseOptions["rpc"]>;

  constructor(options: FakeSupabaseOptions = {}) {
    this.tables = options.tables ?? {};
    this.unique = options.unique ?? {};
    this.failTables = new Set(options.failTables ?? []);
    this.rpcHandlers = options.rpc ?? {};
  }

  from(table: string) {
    return new Query(table, this);
  }

  async rpc(name: string, args: Row): Promise<Result> {
    this.rpcCalls.push({ name, args });
    const handler = this.rpcHandlers[name];
    if (!handler) return { data: null, error: { message: `fake: rpc ${name} не задан` } };
    try {
      return { data: handler(args, this.tables), error: null };
    } catch (e) {
      return { data: null, error: { message: (e as Error).message } };
    }
  }
}

/** Поведение функций базы из миграции 007 — чтобы тесты проверяли итоговое состояние листа */
export const SHEET_RPC: NonNullable<FakeSupabaseOptions["rpc"]> = {
  apply_character_game_state: (args, tables) => {
    const row = (tables.characters ?? []).find((r) => r.id === args.p_id);
    if (!row) throw new Error("character not found");
    const sheet = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
    row.data = { ...sheet, ...args.p_patch };
    row.revision = (row.revision ?? 0) + 1;
    return row.revision;
  },
  add_character_experience: (args, tables) => {
    const row = (tables.characters ?? []).find((r) => r.id === args.p_id);
    if (!row) throw new Error("character not found");
    const sheet = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
    const total = Math.max(0, (Number(sheet.experiencePoints) || 0) + (Number(args.p_amount) || 0));
    row.data = { ...sheet, experiencePoints: total };
    row.revision = (row.revision ?? 0) + 1;
    return total;
  },
};

export function fakeSupabase(options: FakeSupabaseOptions = {}): FakeSupabase {
  return new FakeSupabase({ rpc: SHEET_RPC, ...options });
}
