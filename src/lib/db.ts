import { PrismaClient } from '@prisma/client'
import { applyHeroSheetWrite, liveHeroRows, splitHeroWrite } from '@/lib/dnd/hero-db-hooks'

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createClient> | undefined
}

/**
 * Клиент базы кампании.
 *
 * Модель Character обёрнута: у героя игрока лист живёт в public.characters (Supabase),
 * а строка кампании хранит только ссылку sheetCharacterId. Поэтому при чтении на такие строки
 * накладываются значения листа, а при записи хиты и опыт уходят в лист — подробности
 * в src/lib/dnd/hero-db-hooks.ts. Вложенные выборки (campaign.include.characters) Prisma
 * через этот перехват не проводит: там листы накладываются явно (withSheets).
 */
function createClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
  })

  return base.$extends({
    query: {
      character: {
        async findMany({ args, query }) {
          return liveHeroRows(await query(args))
        },
        async findFirst({ args, query }) {
          return liveHeroRows(await query(args))
        },
        async findFirstOrThrow({ args, query }) {
          return liveHeroRows(await query(args))
        },
        async findUnique({ args, query }) {
          return liveHeroRows(await query(args))
        },
        async findUniqueOrThrow({ args, query }) {
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
