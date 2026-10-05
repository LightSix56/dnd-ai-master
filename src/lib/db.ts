import { PrismaClient } from '@prisma/client'
import {
  applyHeroSheetWrite,
  liveHeroRows,
  liveNestedHeroes,
  SHEET_FIELDS,
  splitHeroWrite,
  withNestedHeroLink,
} from '@/lib/dnd/hero-db-hooks'

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createClient> | undefined
}

/**
 * Клиент базы кампании.
 *
 * Модель Character обёрнута: у героя игрока лист живёт в public.characters (Supabase),
 * а строка кампании хранит только ссылку sheetCharacterId. Поэтому при чтении на такие строки
 * накладываются значения листа, а при записи хиты и опыт уходят в лист — подробности
 * в src/lib/dnd/hero-db-hooks.ts. Вложенные выборки героев через перехват модели Character
 * Prisma не проводит, поэтому кампании, прочитанные вместе с героями, обёрнуты отдельно.
 */
function createClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
  })

  // Запрос с select без ссылки на лист вернул бы колонки-копии. Если выбрано хоть одно
  // поле, которым владеет лист, добавляем ссылку — тогда на строку наложится живой лист.
  const withLink = <A extends { select?: Record<string, unknown> | null }>(args: A): A => {
    const select = args?.select
    if (!select || select.sheetCharacterId) return args
    if (!SHEET_FIELDS.some((field) => select[field])) return args
    return { ...args, select: { ...select, sheetCharacterId: true } }
  }

  return base.$extends({
    query: {
      campaign: {
        async findMany({ args, query }) {
          return liveNestedHeroes(await query(withNestedHeroLink(args)))
        },
        async findFirst({ args, query }) {
          return liveNestedHeroes(await query(withNestedHeroLink(args)))
        },
        async findUnique({ args, query }) {
          return liveNestedHeroes(await query(withNestedHeroLink(args)))
        },
        async update({ args, query }) {
          return liveNestedHeroes(await query(withNestedHeroLink(args)))
        },
      },
      character: {
        async findMany({ args, query }) {
          return liveHeroRows(await query(withLink(args)))
        },
        async findFirst({ args, query }) {
          return liveHeroRows(await query(withLink(args)))
        },
        async findFirstOrThrow({ args, query }) {
          return liveHeroRows(await query(withLink(args)))
        },
        async findUnique({ args, query }) {
          return liveHeroRows(await query(withLink(args)))
        },
        async findUniqueOrThrow({ args, query }) {
          return liveHeroRows(await query(withLink(args)))
        },
        async create({ args, query }) {
          return liveHeroRows(await query(args))
        },
        async update({ args, query }) {
          const data = (args.data ?? {}) as Record<string, unknown>
          const target = await base.character.findUnique({
            where: args.where,
            select: { sheetCharacterId: true },
          })
          if (!target?.sheetCharacterId) return liveHeroRows(await query(args))

          const split = splitHeroWrite(data)
          await applyHeroSheetWrite(target.sheetCharacterId, split.sheetOps)
          const row = await query({ ...args, data: split.prismaData as typeof args.data })
          return liveHeroRows(row)
        },
      },
    },
  })
}

export const db = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
