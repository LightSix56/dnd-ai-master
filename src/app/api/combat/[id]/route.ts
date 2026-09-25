import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hydrateCombat } from "@/lib/combat/serialize";

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(props?.params);
    const combatId = resolvedParams?.id?.trim();

    if (!combatId) {
      return NextResponse.json({ error: "combatId обязателен" }, { status: 400 });
    }

    const row = await db.combat.findUnique({
      where: { id: combatId },
      include: {
        combatants: true,
        mapElements: true,
      },
    });

    if (!row) {
      return NextResponse.json({ error: "Бой не найден", combat: null }, { status: 404 });
    }

    const combat = hydrateCombat(row as any);
    return NextResponse.json({ combat });
  } catch (error) {
    console.error("[api/combat/[id]] GET error:", error);
    return NextResponse.json({ error: "Ошибка сервера при загрузке боя" }, { status: 500 });
  }
}
